# Design Document — Edição de nome na tela de Perfil

## Overview

`frontend/src/pages/PerfilPage.jsx` nunca foi terminada: o nome e o e-mail mostrados vêm de `import.meta.env.VITE_USER_NAME`/`VITE_USER_EMAIL` (variáveis de ambiente do build), não da sessão de quem realmente logou — por isso sempre aparece "Usuário Dev", e não há nenhum jeito de mudar isso, já que os campos são `<div>` estáticas, não inputs. A página também tem um badge "Modo Desenvolvimento" esquecido de alguma versão anterior.

### Escopo deste documento

**Incluído:**
- Campo "Nome" editável na tela de Perfil, persistido no backend.
- `username`/`nome` passam a vir no payload de login e ficam disponíveis na sessão do frontend.
- Remoção do badge "Modo Desenvolvimento" e do campo "Email" (nenhuma conta tem e-mail cadastrado hoje — ver decisão abaixo).

**Explicitamente fora de escopo (decidido com o usuário):**
- Campo Email — removido da tela por enquanto, não implementado como editável nem como exibição. Nenhum usuário do sistema (`admin`, `criar_admin`, o formulário de criação em `AdminUsuariosPage`) jamais preenche `User.email` — mostrar um campo sempre vazio seria pior do que não mostrar.
- Trocar o `username` (usado para login) — fora de escopo, não foi pedido.
- Trocar senha pela tela de Perfil — fora de escopo, não foi pedido.
- Reaproveitar `nome`/`username` no `Header.jsx` (que hoje mostra "Administrador"/"Almoxarife-chefe" fixos, sem relação com a sessão real) — mesmo problema, mas não foi pedido agora. A sessão passa a carregar esses dados, então isso fica mais barato de fazer depois, mas não faz parte deste documento.

## Decisão confirmada com o usuário

`username`/`nome` vêm no payload de `POST /api/auth/login/` (junto com `papel`/`is_staff`/`modulos_ativos`, que já seguem esse padrão) em vez de a tela de Perfil buscar seus próprios dados via `GET`. Evita uma chamada de rede extra a cada visita à página, e mantém consistência com o resto da sessão.

## Arquitetura

### Backend (`plataforma`)

- `plataforma/views.py::LoginView` — resposta ganha dois campos novos:
  ```json
  { "token": "...", "papel": "ADMIN", "is_staff": true, "username": "admin", "nome": "admin", "modulos_ativos": [...] }
  ```
  `nome` é `user.first_name or user.username` — como nenhuma conta tem `first_name` definido hoje, todo mundo começa vendo o próprio `username` como nome, até editar.

- Novo `MeuPerfilView` (`plataforma/views.py`), `APIView`:
  ```python
  class MeuPerfilView(APIView):
      authentication_classes = [TokenAcessoAuthentication]
      permission_classes = [IsAuthenticated]

      def patch(self, request):
          nome = str(request.data.get("nome", "")).strip()
          if not nome:
              return Response({"detail": "Nome não pode ser vazio."}, status=400)
          request.user.first_name = nome
          request.user.save(update_fields=["first_name"])
          return Response({"nome": nome})
  ```
  Sem `EhAdmin` — qualquer usuário autenticado edita o próprio nome, independente de `papel` ou `is_staff`. Rota nova: `path("auth/me/", MeuPerfilView.as_view(), name="auth-me")` em `plataforma/urls.py`.

### Frontend (`frontend/`)

- `lib/auth.js` — `salvarSessao` passa a gravar `username`/`nome` (duas chaves novas de sessão). Novas funções `getNome()`, `getUsername()`, e `atualizarNome(novoNome)` (reescreve só a chave do nome, sem tocar token/papel/is_staff/módulos).
- `pages/PerfilPage.jsx` — reescrita:
  - Remove os `import.meta.env.VITE_USER_*` e o bloco "Modo Desenvolvimento".
  - Campo "Nome": input controlado, inicializado com `getNome()`; botão "Salvar" desabilitado se o campo estiver vazio ou igual ao valor atual (nada para salvar). `PATCH /api/auth/me/` no submit; sucesso chama `atualizarNome` e mostra um toast; erro (rede ou 400) mostra mensagem inline, mantém o valor digitado.
  - Remove o bloco "Email" inteiro.
  - Avatar continua usando a primeira letra do nome atual (`getNome()`, reativo ao editar).

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| `PATCH /api/auth/me/` com nome vazio | 400 — bloqueado também no frontend (botão desabilitado), mas o backend valida de qualquer forma |
| Falha de rede ao salvar | Mensagem inline "Falha na conexão. Tente novamente.", valor do campo preservado |
| Sem token / token expirado | 401 — mesmo comportamento já existente em outras chamadas autenticadas da tela (sem tratamento novo específico) |

## Estratégia de testes

**Backend:**
- `MeuPerfilViewTest`: nome atualizado com sucesso (200, `user.first_name` persistido); nome vazio retorna 400 e não altera `first_name`; requisição sem token retorna 401.
- `LoginViewTest` existente ganha asserção para `username`/`nome` na resposta (incluindo o caso `first_name` vazio → `nome` cai pro `username`).

**Frontend:**
- `PerfilPage.test.jsx` ganha: campo Nome pré-preenchido com `getNome()`; botão Salvar desabilitado sem mudança; salvar com sucesso chama `PATCH` e atualiza a sessão; erro da API mantém o modal—i.e. a página—com o valor digitado e mostra a mensagem. Os 2 testes de logout já existentes continuam passando sem alteração (não dependem de Nome/Email).

## Riscos

| Risco | Mitigação |
|---|---|
| Sessões já abertas (token existente de antes desta mudança) não têm `nome`/`username` salvos | `getNome()` retorna `null`/vazio nesse caso; a tela cai pro estado "sem nome ainda" — mesmo efeito de re-logar, que já é o fluxo normal quando o token expira (12h) |
| Outra aba ou dispositivo do mesmo usuário não vê o nome atualizado até logar de novo | Aceitável — sessão é por `sessionStorage`, não hoisted entre abas/dispositivos; mesmo comportamento que `papel`/`is_staff` já têm hoje |
