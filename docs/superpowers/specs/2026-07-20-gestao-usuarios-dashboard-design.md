# Design Document — Tela de gestão de usuários no dashboard

## Overview

O backend (`plataforma` app) já suporta criar, listar e editar o papel de usuários da plataforma (`UsuarioViewSet`, `UsuarioSerializer`), testado desde o PR #7 (`feature/plataforma-autenticacao-modulos`). Nunca existiu, porém, nenhuma tela no dashboard (`frontend/`) para isso — hoje, gerenciar usuários exige chamar a API crua ou usar o Django Admin. Este documento cobre só a tela que falta.

### Escopo deste documento

**Incluído:**
- Página `/admin/usuarios`: lista os usuários, permite trocar o papel (`ADMIN`/`OPERADOR`) de cada um inline, e criar um usuário novo por um modal.
- Item de navegação "Usuários" na Sidebar, visível só para contas `is_staff` (mesmo gate de "Módulos").

**Explicitamente fora de escopo (decidido com o usuário):**
- Conceder/revogar `is_staff` pela tela. Isso continua exigindo Django Admin ou `manage.py` — decisão deliberada para manter a fronteira de segurança estabelecida no PR #8 (`admin-staff-gate-ux`): apenas contas já confiáveis fora do app podem criar novas contas com esse nível de acesso.
- Desativar (`is_active=False`) ou excluir usuário. O backend não expõe `DELETE` em `UsuarioViewSet` (`http_method_names = ["get", "post", "patch", "head", "options"]`) e não há requisito de negócio para isso agora.
- Qualquer mudança no backend — `UsuarioViewSet`/`UsuarioSerializer` já cobrem exatamente o que esta tela precisa (list, create, patch de `papel`).
- Fluxo de "esqueci minha senha" — fora de escopo; resolvido para este caso ao tornar a senha obrigatória na criação (ver abaixo), não pelo self-service de recuperação.

## Decisões confirmadas com o usuário

1. **`is_staff` não é gerenciável por esta tela.** Só `papel` (ADMIN/OPERADOR da aplicação). Justificativa: o PR #8 acabou de restringir o painel de Módulos a contas `is_staff` exatamente para que esse nível de acesso não fosse auto-concedível dentro do app; uma tela de usuários que já pudesse conceder `is_staff` desfaria essa fronteira no mesmo ciclo em que foi criada.
2. **Ações: listar, criar, editar papel.** Sem desativar/excluir por enquanto — o backend não suporta e não há pedido de negócio para isso.
3. **Senha obrigatória na criação.** A API hoje aceita criar sem senha (`UsuarioSerializer.create`, `plataforma/serializers.py:22-30` — sem senha, o usuário fica com senha inutilizável, "definirá depois"). Sem fluxo de recuperação de senha, isso criaria contas travadas. A tela torna a senha obrigatória no formulário (validação client-side); a API continua aceitando omissão (não muda), só a UI exige.
4. **Edição inline, não modal.** Como o único campo editável é `papel` (dois valores possíveis), a lista usa um `<select>` por linha que salva no `onChange` — sem modal de edição separado. Mais direto do que abrir um modal pra mudar um campo.

## Arquitetura

Sem mudanças de backend. Dois arquivos novos no `frontend/`:

```
frontend/src/
├── pages/
│   └── AdminUsuariosPage.jsx       # nova — lista + select de papel inline
└── features/
    └── usuarios/
        └── NewUserModal.jsx        # novo — modal de criação
```

### `AdminUsuariosPage.jsx`

Mesmo formato de `AdminModulosPage.jsx` (`frontend/src/pages/AdminModulosPage.jsx`):
- `useEffect` no mount: se `ehAdmin()`, `fetch(GET /api/usuarios/)` com `Authorization: Token <token>`.
- Se `!ehAdmin()`: renderiza `<p>Apenas administradores acessam esta página.</p>` (texto idêntico ao de `AdminModulosPage`, mesmo padrão).
- Lista cada usuário: `username` + um `<select>` com as duas opções de papel (`ADMIN`, `OPERADOR`), valor atual pré-selecionado.
- `onChange` do select: `PATCH /api/usuarios/{id}/` com `{ papel: novoValor }`. Sucesso → atualiza o item na lista local (sem recarregar a lista inteira). Falha → toast de erro (`useToast`) e reverte o `<select>` para o papel anterior.
- Botão "Novo usuário" no topo, abre `NewUserModal`.

### `NewUserModal.jsx`

Mesmo molde de `NewCategoryModal.jsx` (`frontend/src/features/inventario/NewCategoryModal.jsx`): usa o `Modal` genérico (`frontend/src/components/ui/Modal.jsx`), três campos controlados (usuário, senha, papel — select), submit desabilitado até usuário e senha não estarem vazios.
- Submit: `POST /api/usuarios/` com `{ username, password, papel }`.
- Sucesso: `onCreate` (prop, como `NewCategoryModal`) recebe o usuário criado, a página-mãe adiciona à lista local e fecha o modal.
- Falha (ex. `username` duplicado — a API retorna 400 com o erro do `UniqueValidator` padrão do DRF): mensagem de erro exibida dentro do modal (não um toast solto), modal continua aberto para o usuário corrigir — mesmo padrão de erro inline que `ProductFormModal.jsx` já usa para seus campos.

### Navegação e rota

- `frontend/src/layouts/Sidebar.jsx`: novo item em `navItems`, ao lado do item "Módulos" existente (linha 15): `{ to: "/admin/usuarios", label: "Usuários", icon: "users", section: "Sistema", modulo: null, somenteAdmin: true }` (reaproveita o ícone `users` já usado em Fornecedores).
- `frontend/src/main.jsx`: nova rota `<Route path="admin/usuarios" element={<AdminUsuariosPage />} />`, no mesmo nível de `admin/modulos` (dentro do `MainLayout`, sem `RequireModule` — não é um módulo, é uma tela de sistema, mesmo tratamento de `admin/modulos`).

## Tratamento de erros

| Situação | Comportamento |
|---|---|
| `GET /api/usuarios/` falha (ex. rede) | Lista fica vazia; sem crash — mesmo comportamento atual de `AdminModulosPage` para essa mesma classe de erro (não há um estado de erro dedicado hoje, e este documento não introduz um) |
| `PATCH` de papel falha | Toast de erro, `<select>` reverte visualmente pro papel anterior |
| `POST` de criação falha (400, ex. username duplicado) | Erro renderizado dentro do modal, modal permanece aberto |
| Usuário não-admin acessa `/admin/usuarios` direto pela URL | Mesma tela "Apenas administradores acessam esta página." de `AdminModulosPage` — proteção é só de UI (client-side), a proteção real já existe no backend via `EhAdmin` em cada chamada de API |

## Estratégia de testes

Espelha os testes já existentes para os componentes irmãos:

- `AdminUsuariosPage.test.jsx` (novo, no molde de `AdminModulosPage.test.jsx`): lista carrega usuários da API; trocar o papel no select dispara o `PATCH` correto; usuário sem `is_staff` vê a mensagem de bloqueio.
- `NewUserModal.test.jsx` (novo, no molde de `NewCategoryModal.test.jsx`): botão de submit desabilitado até usuário+senha preenchidos; submit chama `POST /api/usuarios/` com o payload certo; erro da API é exibido sem fechar o modal.

Sem testes de backend novos — `UsuarioViewSet`/`UsuarioSerializer` já têm cobertura completa em `plataforma/tests/test_views.py` (`UsuarioViewSetTest`), e este documento não muda esse código.

## Riscos

| Risco | Mitigação |
|---|---|
| Um admin remove o próprio papel `ADMIN`, perdendo acesso à própria gestão de usuários | Aceitável: `is_staff` (não `papel`) é quem controla acesso a esta tela desde o PR #8 — trocar o próprio `papel` para `OPERADOR` não tira o acesso a `/admin/usuarios` nem a `/admin/modulos`, já que ambos checam `is_staff`. Nenhuma proteção extra necessária. |
| Confundir `papel` (gerido aqui) com `is_staff` (não gerido aqui) | A tela não deve mencionar "administrador do sistema" perto do select de papel — usar "Papel" e as opções "Administrador"/"Operador" tal como o backend já nomeia (`Perfil.PAPEL_CHOICES`), sem sugerir que isso controla acesso ao painel de Módulos |
