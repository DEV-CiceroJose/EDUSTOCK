# Gate de admin por `is_staff` + correções de UX no Gestor Escolar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir o painel "Módulos do sistema" a contas Django `is_staff`, e corrigir dois problemas de UX no dashboard `frontend/`: o botão "Adicionar Item" do header que não faz nada quando já se está em Inventário, e o `window.prompt()` nativo usado para criar categoria.

**Architecture:** Backend (`plataforma` app): a permission class `EhAdmin` passa a checar `request.user.is_staff` em vez de `Perfil.papel`; `LoginView` passa a devolver `is_staff` no payload de login. Frontend: `lib/auth.js` guarda esse flag na sessão e `ehAdmin()` passa a lê-lo; o botão "Adicionar Item" do header passa um sinalizador via `location.state` do React Router que `InventarioPage` consome para abrir o modal existente; a criação de categoria ganha um modal próprio reaproveitando o componente `Modal` já usado por `ConfirmDialog`.

**Tech Stack:** Django 5 + Django REST Framework (backend, `plataforma` app), React 19 + React Router 7 + Vitest/Testing Library (frontend `frontend/`).

## Global Constraints

- Não remover o model `Perfil` nem o campo `papel` — só deixam de ser o critério de acesso ao painel de módulos (spec: "Explicitamente fora de escopo").
- Não alterar `app-alunos`/`app-cozinha` (autenticação por PIN, fora de escopo).
- Seguir o padrão visual existente: modal novo usa o componente `Modal` (`frontend/src/components/ui/Modal.jsx`) e as classes utilitárias já usadas (`field`, `btn btn-brand`, `btn btn-ghost`).
- TDD: escrever o teste, ver falhar, implementar, ver passar, commitar — em cada task.
- Backend testado com `python manage.py test plataforma` (rodar da raiz do repo, `C:\dev\EDUSTOCK`). Frontend testado com `npm test` dentro de `frontend/`.

---

### Task 1: Backend — `EhAdmin` passa a exigir `is_staff`

**Files:**
- Modify: `plataforma/permissions.py`
- Test: `plataforma/tests/test_permissions.py`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `EhAdmin` (classe DRF `BasePermission`) — usada por `ModuloViewSet` e `UsuarioViewSet` em `plataforma/views.py` (Task 2 depende deste comportamento).

- [ ] **Step 1: Reescrever `EhAdminTest` em `plataforma/tests/test_permissions.py` para o novo contrato**

Substitua a classe `EhAdminTest` inteira (linhas 31-53 do arquivo atual) por:

```python
class EhAdminTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_permite_quando_is_staff(self):
        user = User.objects.create_user(username="admin1", password="x", is_staff=True)
        request = self.factory.get("/")
        request.user = user
        self.assertTrue(EhAdmin().has_permission(request, None))

    def test_bloqueia_quando_nao_staff(self):
        user = User.objects.create_user(username="op1", password="x")
        request = self.factory.get("/")
        request.user = user
        self.assertFalse(EhAdmin().has_permission(request, None))

    def test_bloqueia_papel_admin_da_aplicacao_sem_is_staff(self):
        """Perfil.papel=ADMIN sozinho não basta mais — é preciso ser is_staff."""
        user = User.objects.create_user(username="semstaff", password="x")
        Perfil.objects.create(user=user, papel=Perfil.ADMIN)
        request = self.factory.get("/")
        request.user = user
        self.assertFalse(EhAdmin().has_permission(request, None))
```

O restante do arquivo (`RequerModuloAtivoTest` e os imports no topo) não muda.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `python manage.py test plataforma.tests.test_permissions -v 2`
Expected: `test_permite_quando_is_staff` FAIL (usuário `is_staff=True` sem `Perfil` ainda é bloqueado pelo código atual, que exige `perfil.papel == ADMIN`); `test_bloqueia_papel_admin_da_aplicacao_sem_is_staff` FAIL (código atual permite, pois hoje o papel `ADMIN` sozinho é suficiente).

- [ ] **Step 3: Atualizar `plataforma/permissions.py`**

Substitua a classe `EhAdmin` (linhas 27-33 do arquivo atual):

```python
class EhAdmin(BasePermission):
    message = "Apenas administradores podem acessar este recurso."

    def has_permission(self, request, view):
        perfil = getattr(request.user, "perfil", None)
        return bool(perfil and perfil.papel == Perfil.ADMIN)
```

por:

```python
class EhAdmin(BasePermission):
    message = "Apenas administradores podem acessar este recurso."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)
```

O import `from .models import Modulo, Perfil` no topo do arquivo deve virar `from .models import Modulo`, já que `Perfil` deixa de ser usado neste arquivo (só `RequerModuloAtivo` usa `Modulo`).

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `python manage.py test plataforma.tests.test_permissions -v 2`
Expected: `OK` (6 testes: 3 de `RequerModuloAtivoTest` + 3 de `EhAdminTest`)

- [ ] **Step 5: Commit**

```bash
git add plataforma/permissions.py plataforma/tests/test_permissions.py
git commit -m "feat(plataforma): EhAdmin passa a exigir is_staff em vez de papel"
```

---

### Task 2: Backend — `LoginView` devolve `is_staff`; atualizar testes que dependiam do papel para simular admin

**Files:**
- Modify: `plataforma/views.py`
- Test: `plataforma/tests/test_views.py`

**Interfaces:**
- Consumes: `EhAdmin` da Task 1 (comportamento já checando `is_staff`).
- Produces: payload de `POST /api/auth/login/` com a chave `is_staff` (bool) — consumida pelo frontend na Task 3 (`salvarSessao(data)` em `LoginPage.jsx` já repassa o objeto inteiro, sem mudança necessária lá).

- [ ] **Step 1: Escrever/ajustar os testes em `plataforma/tests/test_views.py`**

Em `LoginViewTest`, adicione a asserção que falta na linha do teste existente (`test_login_com_credenciais_corretas_retorna_token_e_modulos`, dentro do método) e um teste novo logo abaixo:

```python
    def test_login_com_credenciais_corretas_retorna_token_e_modulos(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "joao", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["papel"], Perfil.OPERADOR)
        self.assertFalse(resp.data["is_staff"])
        self.assertEqual(resp.data["modulos_ativos"], ["inventario"])

    def test_login_retorna_is_staff_true_para_usuario_staff(self):
        User.objects.create_user(username="root", password="senha-boa-123", is_staff=True)
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "root", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertTrue(resp.data["is_staff"])
```

Em `ModuloViewSetTest`, troque o helper `_autenticar` (que hoje recebe um `papel` e cria `Perfil`) para receber diretamente `is_staff`:

```python
    def _autenticar(self, is_staff):
        user = User.objects.create_user(
            username=f"user-staff-{is_staff}", password="x", is_staff=is_staff
        )
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")
```

E troque as 4 chamadas nos testes dessa classe:
- `test_admin_lista_modulos`: `self._autenticar(Perfil.ADMIN)` → `self._autenticar(True)`
- `test_admin_desativa_modulo_sem_dependentes`: `self._autenticar(Perfil.ADMIN)` → `self._autenticar(True)`
- `test_nao_desativa_modulo_com_dependente_ativo`: `self._autenticar(Perfil.ADMIN)` → `self._autenticar(True)`
- `test_operador_nao_pode_togglear`: renomeie o método para `test_usuario_sem_staff_nao_pode_togglear` e troque `self._autenticar(Perfil.OPERADOR)` → `self._autenticar(False)`

Em `UsuarioViewSetTest`, troque o helper `_autenticar_admin`:

```python
    def _autenticar_admin(self):
        admin = User.objects.create_user(username="admin1", password="x", is_staff=True)
        token = TokenAcesso.objects.create(
            user=admin, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")
```

(remove a linha `Perfil.objects.create(user=admin, papel=Perfil.ADMIN)` que existia dentro dele — não é mais necessária para a permissão). Os métodos que chamam `self._autenticar_admin()` (`test_admin_cria_operador`, `test_admin_altera_papel_de_usuario`, `test_admin_cria_usuario_sem_senha`) não mudam. `test_operador_nao_pode_criar_usuario` também não muda — já cria um usuário sem `is_staff`, que continua sendo `False` por padrão.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `python manage.py test plataforma.tests.test_views -v 2`
Expected: FAIL em `test_login_com_credenciais_corretas_retorna_token_e_modulos` (`KeyError: 'is_staff'`) e em `test_login_retorna_is_staff_true_para_usuario_staff` (mesmo motivo). Os testes de `ModuloViewSetTest`/`UsuarioViewSetTest` devem continuar passando neste ponto (a Task 1 já fez `EhAdmin` checar `is_staff`, e os helpers atualizados já passam `is_staff=True`/`False` corretamente) — confirme que não há regressão aqui antes de prosseguir.

- [ ] **Step 3: Atualizar `plataforma/views.py`**

No método `post` de `LoginView`, o `Response` final (linhas 41-45 do arquivo atual):

```python
        return Response({
            "token": str(token.token),
            "papel": perfil.papel,
            "modulos_ativos": modulos_ativos,
        })
```

vira:

```python
        return Response({
            "token": str(token.token),
            "papel": perfil.papel,
            "is_staff": user.is_staff,
            "modulos_ativos": modulos_ativos,
        })
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `python manage.py test plataforma -v 2`
Expected: `OK` (roda toda a suíte de `plataforma`, incluindo `test_authentication.py`, `test_migrations.py`, `test_models.py`, `test_management_command.py` que não foram tocados)

- [ ] **Step 5: Commit**

```bash
git add plataforma/views.py plataforma/tests/test_views.py
git commit -m "feat(plataforma): login retorna is_staff; testes usam is_staff para simular admin"
```

---

### Task 3: Frontend — `lib/auth.js` guarda e expõe `is_staff`

**Files:**
- Modify: `frontend/src/lib/auth.js`
- Test: `frontend/src/lib/auth.test.js`
- Modify (ajuste de fixtures, sem mudar o que é testado): `frontend/src/pages/AdminModulosPage.test.jsx`, `frontend/src/bugfix-preservation.test.jsx`

**Interfaces:**
- Consumes: payload de login com `is_staff` (Task 2) — `LoginPage.jsx:28` já faz `salvarSessao(data)` passando o objeto inteiro da resposta, não precisa de mudança.
- Produces: `ehAdmin(): boolean` — mesma assinatura já usada por `AdminModulosPage.jsx` e `Sidebar.jsx`, agora refletindo `is_staff` em vez de `papel`.

- [ ] **Step 1: Reescrever `frontend/src/lib/auth.test.js`**

```js
import { describe, it, expect, beforeEach } from "vitest"
import {
  salvarSessao, limparSessao, getToken, getPapel,
  getModulosAtivos, estaAutenticado, ehAdmin,
} from "./auth"

describe("auth", () => {
  beforeEach(() => sessionStorage.clear())

  it("salva e recupera a sessão", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", is_staff: true, modulos_ativos: ["inventario", "merenda"] })
    expect(getToken()).toBe("abc-123")
    expect(getPapel()).toBe("ADMIN")
    expect(getModulosAtivos()).toEqual(["inventario", "merenda"])
    expect(estaAutenticado()).toBe(true)
    expect(ehAdmin()).toBe(true)
  })

  it("ehAdmin depende de is_staff, não do papel da aplicação", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", is_staff: false, modulos_ativos: [] })
    expect(ehAdmin()).toBe(false)
  })

  it("limparSessao remove tudo", () => {
    salvarSessao({ token: "abc-123", papel: "OPERADOR", is_staff: false, modulos_ativos: [] })
    limparSessao()
    expect(getToken()).toBeNull()
    expect(estaAutenticado()).toBe(false)
    expect(ehAdmin()).toBe(false)
  })

  it("getModulosAtivos retorna array vazio sem sessão", () => {
    expect(getModulosAtivos()).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/lib/auth.test.js` (dentro de `frontend/`)
Expected: FAIL no teste `"ehAdmin depende de is_staff, não do papel da aplicação"` (código atual: `ehAdmin()` olha `papel`, então com `papel: "ADMIN"` ele retornaria `true` mesmo com `is_staff: false`)

- [ ] **Step 3: Atualizar `frontend/src/lib/auth.js`**

Substitua o arquivo inteiro por:

```js
const TOKEN_KEY = "edustock:auth:token"
const PAPEL_KEY = "edustock:auth:papel"
const MODULOS_KEY = "edustock:auth:modulos"
const IS_STAFF_KEY = "edustock:auth:is_staff"

export function salvarSessao({ token, papel, is_staff, modulos_ativos }) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(PAPEL_KEY, papel)
  sessionStorage.setItem(IS_STAFF_KEY, String(Boolean(is_staff)))
  sessionStorage.setItem(MODULOS_KEY, JSON.stringify(modulos_ativos))
}

export function limparSessao() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PAPEL_KEY)
  sessionStorage.removeItem(IS_STAFF_KEY)
  sessionStorage.removeItem(MODULOS_KEY)
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getPapel() {
  return sessionStorage.getItem(PAPEL_KEY)
}

export function getModulosAtivos() {
  const raw = sessionStorage.getItem(MODULOS_KEY)
  return raw ? JSON.parse(raw) : []
}

export function estaAutenticado() {
  return Boolean(getToken())
}

export function ehAdmin() {
  return sessionStorage.getItem(IS_STAFF_KEY) === "true"
}
```

- [ ] **Step 4: Rodar os testes de `auth.test.js` e confirmar que passam**

Run: `npm test -- src/lib/auth.test.js`
Expected: PASS (4 testes)

- [ ] **Step 5: Corrigir fixtures de outros testes que dependiam do `papel` para simular admin**

Em `frontend/src/pages/AdminModulosPage.test.jsx`, linha 10, o `salvarSessao` do primeiro teste (`"lista módulos e permite togglear"`) precisa continuar autenticando como admin. Troque:

```js
    salvarSessao({ token: "abc", papel: "ADMIN", modulos_ativos: ["inventario"] })
```

por:

```js
    salvarSessao({ token: "abc", papel: "ADMIN", is_staff: true, modulos_ativos: ["inventario"] })
```

(o segundo `salvarSessao`, dentro do teste `"mostra mensagem para quem não é admin"`, na linha 33, continua igual — `papel: "OPERADOR"` sem `is_staff`, que já resulta em `is_staff: false`).

Em `frontend/src/bugfix-preservation.test.jsx`, há dois blocos `salvarSessao({ token: 'test-token', papel: 'ADMIN', modulos_ativos: [...] })` (um dentro de `describe('Sidebar Navigation Preservation', ...)`, por volta da linha 74, outro dentro de `describe('Sidebar Responsive Behavior Preservation', ...)`, por volta da linha 478) — ambos testam que o item "Módulos" aparece na Sidebar para um admin. Adicione `is_staff: true` aos dois:

```js
      salvarSessao({
        token: 'test-token',
        papel: 'ADMIN',
        is_staff: true,
        modulos_ativos: ['inventario', 'movimentacoes', 'fornecedores', 'alertas', 'relatorios', 'merenda'],
      })
```

- [ ] **Step 6: Rodar a suíte completa do frontend e confirmar que passa**

Run: `npm test` (dentro de `frontend/`)
Expected: todos os testes passam, incluindo `AdminModulosPage.test.jsx` e `bugfix-preservation.test.jsx`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/auth.js frontend/src/lib/auth.test.js frontend/src/pages/AdminModulosPage.test.jsx frontend/src/bugfix-preservation.test.jsx
git commit -m "feat(frontend): ehAdmin passa a refletir is_staff da conta Django"
```

---

### Task 4: Frontend — botão "Adicionar Item" do header abre o modal de qualquer página

**Files:**
- Modify: `frontend/src/layouts/MainLayout.jsx`
- Modify: `frontend/src/pages/InventarioPage.jsx`
- Test (novo arquivo): `frontend/src/pages/InventarioPage.test.jsx`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces: nada consumido por tasks futuras (Task 5 volta a editar `InventarioPage.jsx`, mas numa parte diferente do arquivo — a criação de categoria).

- [ ] **Step 1: Escrever `frontend/src/pages/InventarioPage.test.jsx`**

```jsx
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import InventarioPage from "./InventarioPage"

afterEach(cleanup)

vi.mock("../hooks/useDashboardData", () => ({
  useDashboardData: () => ({
    produtos: [],
    categorias: [],
    grupos: [],
    fornecedores: [],
    loading: false,
    carregar: vi.fn(),
    counts: { cat: {}, grupo: {} },
    visiveis: () => [],
    search: "",
  }),
}))

describe("InventarioPage — abertura do modal via navegação do header", () => {
  it("abre o modal de novo item quando chega com location.state.openAdd", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/inventario", state: { openAdd: true } }]}>
        <InventarioPage />
      </MemoryRouter>
    )
    expect(screen.getByText("Adicionar novo item")).toBeInTheDocument()
  })

  it("não abre o modal numa navegação normal, sem state", () => {
    render(
      <MemoryRouter initialEntries={["/inventario"]}>
        <InventarioPage />
      </MemoryRouter>
    )
    expect(screen.queryByText("Adicionar novo item")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/pages/InventarioPage.test.jsx` (dentro de `frontend/`)
Expected: FAIL no primeiro teste — `InventarioPage` hoje não lê `location.state`, então o modal nunca abre sozinho.

- [ ] **Step 3: Atualizar `frontend/src/pages/InventarioPage.jsx`**

Troque a linha de import do React (linha 1):

```js
import { useState } from "react"
```

por:

```js
import { useEffect, useState } from "react"
```

Adicione o import do React Router logo abaixo dos imports existentes (depois da linha `import { useToast } from "../components/ui/Toast"`):

```js
import { useLocation, useNavigate } from "react-router-dom"
```

No corpo de `InventarioPage`, logo após a linha `const { produtos, categorias, grupos, fornecedores, loading, carregar, counts, visiveis, search } = useDashboardData()`, adicione:

```js
  const location = useLocation()
  const navigate = useNavigate()
```

E logo após a linha `const toast = useToast(); const produtosFiltrados = visiveis(cat)`, adicione o efeito:

```js

  useEffect(() => {
    if (location.state?.openAdd) {
      setAddOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])
```

- [ ] **Step 4: Rodar o teste de `InventarioPage` e confirmar que passa**

Run: `npm test -- src/pages/InventarioPage.test.jsx`
Expected: PASS (2 testes)

- [ ] **Step 5: Atualizar `frontend/src/layouts/MainLayout.jsx`**

Troque:

```js
  const handleAddItem = () => {
    navigate('/inventario')
  }
```

por:

```js
  const handleAddItem = () => {
    navigate('/inventario', { state: { openAdd: true } })
  }
```

- [ ] **Step 6: Rodar a suíte completa do frontend e confirmar que passa**

Run: `npm test`
Expected: todos os testes passam, incluindo os de `bugfix-exploration.test.jsx` (o teste "Bug 2" só checa que `navigate` foi chamado com `'/inventario'` — `toHaveBeenCalledWith('/inventario')` falha se o segundo argumento mudar a assinatura da chamada esperada; **confira este ponto no Step 7**)

- [ ] **Step 7: Se `bugfix-exploration.test.jsx` quebrar por causa do novo argumento de `navigate`, ajustar a asserção**

O teste `'Bug 2: Clicking "Adicionar Item" button should navigate to /inventario'` em `frontend/src/bugfix-exploration.test.jsx` usa `expect(mockNavigate).toHaveBeenCalledWith('/inventario')`. Como `handleAddItem` agora chama `navigate('/inventario', { state: { openAdd: true } })`, essa asserção deixa de bater (esperava só um argumento). Troque para:

```js
    expect(mockNavigate).toHaveBeenCalledWith('/inventario', { state: { openAdd: true } })
```

Depois rode `npm test` de novo e confirme que passa tudo.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/layouts/MainLayout.jsx frontend/src/pages/InventarioPage.jsx frontend/src/pages/InventarioPage.test.jsx frontend/src/bugfix-exploration.test.jsx
git commit -m "fix(frontend): botao Adicionar Item do header abre o modal de qualquer pagina"
```

---

### Task 5: Frontend — modal próprio para "Nova categoria" (substitui `window.prompt`)

**Files:**
- Create: `frontend/src/features/inventario/NewCategoryModal.jsx`
- Test: `frontend/src/features/inventario/NewCategoryModal.test.jsx`
- Modify: `frontend/src/pages/InventarioPage.jsx`
- Test: `frontend/src/pages/InventarioPage.test.jsx` (estende o arquivo criado na Task 4)

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces: componente `NewCategoryModal({ open: boolean, onClose: () => void, onCreate: (nome: string) => Promise<void> })` — usado só por `InventarioPage.jsx` neste plano.

- [ ] **Step 1: Escrever `frontend/src/features/inventario/NewCategoryModal.test.jsx`**

```jsx
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import NewCategoryModal from "./NewCategoryModal"

afterEach(cleanup)

describe("NewCategoryModal", () => {
  it("não renderiza nada quando open é false", () => {
    render(<NewCategoryModal open={false} onClose={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.queryByText("Nova categoria")).not.toBeInTheDocument()
  })

  it("botão Criar categoria começa desabilitado e habilita ao digitar", async () => {
    const user = userEvent.setup()
    render(<NewCategoryModal open onClose={vi.fn()} onCreate={vi.fn()} />)
    const botao = screen.getByRole("button", { name: /criar categoria/i })
    expect(botao).toBeDisabled()
    await user.type(screen.getByLabelText(/nome da categoria/i), "Higiene")
    expect(botao).toBeEnabled()
  })

  it("chama onCreate com o nome digitado e depois onClose", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<NewCategoryModal open onClose={onClose} onCreate={onCreate} />)
    await user.type(screen.getByLabelText(/nome da categoria/i), "Higiene")
    await user.click(screen.getByRole("button", { name: /criar categoria/i }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Higiene"))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/features/inventario/NewCategoryModal.test.jsx` (dentro de `frontend/`)
Expected: FAIL — o módulo `./NewCategoryModal` ainda não existe.

- [ ] **Step 3: Criar `frontend/src/features/inventario/NewCategoryModal.jsx`**

```jsx
import { useEffect, useState } from "react"
import Modal from "../../components/ui/Modal"

export default function NewCategoryModal({ open, onClose, onCreate }) {
  const [nome, setNome] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (open) {
      setNome("")
      setSalvando(false)
    }
  }, [open])

  async function submit(ev) {
    ev.preventDefault()
    const valor = nome.trim()
    if (!valor) return
    setSalvando(true)
    try {
      await onCreate(valor)
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova categoria" subtitle="Organize os itens do estoque" maxW="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nome da categoria</span>
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Material de Limpeza"
            className="field"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={!nome.trim() || salvando} className="btn btn-brand disabled:opacity-50">
            {salvando ? "Criando…" : "Criar categoria"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/features/inventario/NewCategoryModal.test.jsx`
Expected: PASS (3 testes)

- [ ] **Step 5: Escrever o teste de integração em `frontend/src/pages/InventarioPage.test.jsx`**

Adicione ao arquivo criado na Task 4 (depois do `describe` existente), incluindo o mock de `../api` no topo do arquivo junto dos outros imports/mocks:

```jsx
import userEvent from "@testing-library/user-event"

vi.mock("../api", () => ({
  categoriasApi: { create: vi.fn().mockResolvedValue({ id: 99, name: "Higiene" }) },
  produtosApi: {},
  movimentacoesApi: {},
}))

describe("InventarioPage — criação de categoria", () => {
  it("abre o modal de nova categoria e cria via categoriasApi", async () => {
    const user = userEvent.setup()
    const { categoriasApi } = await import("../api")
    render(
      <MemoryRouter initialEntries={["/inventario"]}>
        <InventarioPage />
      </MemoryRouter>
    )
    await user.click(screen.getByText("Nova categoria"))
    expect(screen.getByText("Nova categoria")).toBeInTheDocument()
    await user.type(screen.getByLabelText(/nome da categoria/i), "Higiene")
    await user.click(screen.getByRole("button", { name: /criar categoria/i }))
    await waitFor(() => expect(categoriasApi.create).toHaveBeenCalledWith({ name: "Higiene" }))
  })
})
```

Adicione `waitFor` ao import existente de `@testing-library/react` no topo do arquivo (`import { render, screen, cleanup, waitFor } from "@testing-library/react"`).

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `npm test -- src/pages/InventarioPage.test.jsx`
Expected: FAIL — `InventarioPage` ainda chama `window.prompt`, não há modal "Nova categoria" na tela nem campo com esse label.

- [ ] **Step 7: Atualizar `frontend/src/pages/InventarioPage.jsx`**

Adicione o import do novo modal, junto dos outros imports de `features/inventario`:

```js
import NewCategoryModal from "../features/inventario/NewCategoryModal"
```

Adicione o estado do modal, junto dos outros `useState` (depois de `const [addOpen, setAddOpen] = useState(false)`):

```js
  const [catModalOpen, setCatModalOpen] = useState(false)
```

Remova a função `novaCategoria` inteira:

```js
  const novaCategoria = async () => {
    const nome = window.prompt("Nome da nova categoria:")
    if (!nome?.trim()) return
    await categoriasApi.create({ name: nome.trim() })
    toast("Categoria criada"); carregar()
  }
```

e substitua por:

```js
  const criarCategoria = async (nome) => {
    await categoriasApi.create({ name: nome })
    toast("Categoria criada")
    carregar()
  }
```

Na prop `onAddCategory` do `<CategoryRail ... />`, troque `onAddCategory={novaCategoria}` por `onAddCategory={() => setCatModalOpen(true)}`.

Por fim, adicione o `<NewCategoryModal ... />` junto dos outros modais renderizados no fim do JSX (ao lado de `<ConfirmDialog ... />`):

```jsx
      <NewCategoryModal open={catModalOpen} onClose={() => setCatModalOpen(false)} onCreate={criarCategoria} />
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npm test -- src/pages/InventarioPage.test.jsx`
Expected: PASS (3 testes: os 2 da Task 4 + o novo de criação de categoria)

- [ ] **Step 9: Rodar a suíte completa do frontend e confirmar que passa**

Run: `npm test`
Expected: todos os testes passam

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/inventario/NewCategoryModal.jsx frontend/src/features/inventario/NewCategoryModal.test.jsx frontend/src/pages/InventarioPage.jsx frontend/src/pages/InventarioPage.test.jsx
git commit -m "fix(frontend): substitui window.prompt por modal proprio na criacao de categoria"
```

---

### Task 6: Verificação final

**Files:** nenhum (só execução)

**Interfaces:** nenhuma — task de checagem, não produz nada consumido por outra task.

- [ ] **Step 1: Rodar a suíte completa do backend**

Run: `python manage.py test` (raiz do repo)
Expected: `OK`, sem falhas em `core` nem em `plataforma`

- [ ] **Step 2: Rodar a suíte completa do frontend**

Run: `npm test` (dentro de `frontend/`)
Expected: `OK`, sem falhas

- [ ] **Step 3: Verificação manual no navegador**

Com o backend (`python manage.py runserver 8000`) e o frontend (`npm run dev` em `frontend/`, porta 5173) rodando:
1. Logar como `admin` (Django staff) → confirmar que "Módulos" aparece na Sidebar e a página `/admin/modulos` carrega a lista.
2. Logar como `alberis@edustock.com` (papel ADMIN da aplicação, `is_staff=False`) → confirmar que "Módulos" **não** aparece na Sidebar.
3. Na página Inventário, clicar em "Adicionar Item" no header → confirmar que o modal "Adicionar novo item" abre imediatamente (mesmo já estando em Inventário).
4. De outra página (ex. Relatórios), clicar em "Adicionar Item" → confirmar que navega para Inventário e o modal já abre aberto.
5. Clicar em "Nova categoria" → confirmar que abre o modal próprio (não o `prompt()` do navegador), digitar um nome e criar → confirmar que a categoria aparece na lista.
