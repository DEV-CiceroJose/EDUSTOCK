# Design Document — Gate de admin por conta Django staff + correções de UX no Gestor Escolar

## Overview

Três correções pontuais no dashboard `frontend/` (Gestor Escolar), encontradas ao validar o ambiente local logo após sincronizar com `origin/main` (PR #7, módulo `plataforma`):

1. O painel "Módulos do sistema" (`AdminModulosPage`) é hoje controlado por `Perfil.papel == "ADMIN"`, um papel da própria aplicação, independente do `is_staff`/`is_superuser` do Django. Isso permite que qualquer usuário promovido a `ADMIN` dentro do app gerencie módulos, mesmo sem ser uma conta de confiança do Django. O pedido é restringir essa capacidade só a contas Django `is_staff`.
2. O botão "Adicionar Item" do header (`Header.jsx`) só navega para `/inventario`; se o usuário já está nessa página, o clique não tem efeito visível.
3. "Nova categoria" usa `window.prompt()` nativo do navegador — inconsistente com o resto da UI do produto.

### Escopo deste documento

**Incluído:**
- Trocar a fonte de verdade de "quem é admin" de `Perfil.papel` para `User.is_staff` nos endpoints `ModuloViewSet`/`UsuarioViewSet` e na Sidebar/`AdminModulosPage` do frontend.
- Corrigir o botão "Adicionar Item" do header para abrir o modal de novo produto de qualquer página.
- Substituir `window.prompt()` da criação de categoria por um modal no padrão visual do app.

**Explicitamente fora de escopo:**
- Remover o model `Perfil`/campo `papel` — continua existindo (usado por `UsuarioViewSet`, ainda sem tela própria no frontend) e pode voltar a ter uso no futuro (ex. distinguir operadores dentro de uma mesma conta staff). Só deixa de ser o critério de acesso ao painel de módulos.
- Expor uma tela de gestão de `is_staff` dentro do próprio app — promover alguém a staff continua sendo uma operação feita via Django Admin/`manage.py`, fora do app (é exatamente essa fronteira que o pedido do cliente estabelece).
- Qualquer mudança nas contas `app-alunos`/`app-cozinha` (PIN) — não são afetadas.

## Decisão confirmada com o usuário

As contas `admin` (Django staff/superuser, sem `Perfil`) e `alberis@edustock.com` (`Perfil.papel=ADMIN`, `is_staff=False`) permanecem **separadas**: depois desta mudança, `alberis@edustock.com` deixa de ver "Módulos" no menu (vira, na prática, um usuário comum dentro do app); só `admin` — que já consegue logar no app via `/api/auth/login/`, pois esse endpoint aceita qualquer `User` válido do Django — mantém acesso ao painel.

## Parte 1 — Gate de admin por `is_staff`

### Backend

- `plataforma/permissions.py::EhAdmin` — passa a checar `bool(request.user and request.user.is_staff)` em vez de `perfil.papel == Perfil.ADMIN`. Continua aplicada só a `ModuloViewSet` e `UsuarioViewSet`; todo o resto da API permanece exigindo apenas `IsAuthenticated` + módulo ativo, sem mudança.
- `plataforma/views.py::LoginView` — a resposta de `POST /api/auth/login/` ganha o campo `is_staff`:
  ```json
  { "token": "...", "papel": "ADMIN", "is_staff": true, "modulos_ativos": [...] }
  ```
  `papel` continua sendo retornado sem mudanças (não é removido).

### Frontend

- `frontend/src/lib/auth.js` — nova chave de sessão `edustock:auth:is_staff`; `salvarSessao` passa a gravá-la; `ehAdmin()` passa a ler esse flag em vez de `getPapel() === "ADMIN"`. `getPapel()` continua existindo, sem uso alterado.
- `AdminModulosPage.jsx` e `Sidebar.jsx` não mudam de código — já dependem de `ehAdmin()`, que passa a refletir a nova regra automaticamente.

### Testes a atualizar

`plataforma/tests/test_permissions.py` e `test_views.py` hoje criam usuários com `Perfil(papel=ADMIN)` e esperam acesso liberado — passam a precisar `user.is_staff = True` (e os casos "bloqueia para operador" passam a usar `is_staff=False`, independente do papel). Ajustar os testes junto da mudança, no mesmo commit.

## Parte 2 — Botão "Adicionar Item" do header

`MainLayout.jsx::handleAddItem` passa a navegar com um sinalizador de estado:
```js
navigate('/inventario', { state: { openAdd: true } })
```
`InventarioPage.jsx` passa a ler esse estado (`useLocation`) num `useEffect`: se `location.state?.openAdd` estiver presente, chama `setAddOpen(true)` e limpa o estado da navegação (`navigate(location.pathname, { replace: true, state: {} })`) para não reabrir o modal numa atualização de página ou navegação de volta.

Isso cobre os dois casos: clicar estando em outra página (navega e abre) e clicar já estando em Inventário (o `state` muda mesmo com o mesmo path, o efeito dispara e abre o modal).

## Parte 3 — Modal de "Nova categoria"

Novo componente `frontend/src/features/inventario/NewCategoryModal.jsx`, construído sobre o `Modal` genérico já usado por `ConfirmDialog`/`ProductFormModal` (mesmo padrão visual): título "Nova categoria", campo de texto controlado, botões "Cancelar" e "Criar categoria" (desabilitado com texto vazio).

`InventarioPage.jsx` troca `novaCategoria` (hoje um `window.prompt`) por um estado `catModalOpen`; `CategoryRail`'s `onAddCategory` passa a abrir o modal em vez de chamar o prompt direto. A chamada a `categoriasApi.create` e o toast de sucesso continuam iguais, só migram para o `onSubmit` do novo modal.

## Riscos

| Risco | Mitigação |
|---|---|
| `alberis@edustock.com` perde acesso a "Módulos" e pode surpreender quem espera ver a tela | Decisão explícita do usuário nesta sessão; comportamento documentado aqui |
| Testes de `plataforma` quebram até serem atualizados | Atualização faz parte do mesmo commit/task da mudança de permissão |
| `location.state` sobrevivendo entre navegações e reabrindo o modal indevidamente | Limpar o `state` via `replace: true` assim que consumido |
