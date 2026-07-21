# Edição de nome na tela de Perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o campo "Nome" da tela de Perfil (`frontend/src/pages/PerfilPage.jsx`) editável e persistido de verdade, no lugar do valor fixo hoje lido de `import.meta.env.VITE_USER_NAME` ("Usuário Dev").

**Architecture:** `POST /api/auth/login/` passa a devolver `username`/`nome` (com `nome` caindo pro `username` quando `first_name` está vazio); um endpoint novo `PATCH /api/auth/me/` deixa qualquer usuário autenticado atualizar o próprio `first_name`. No frontend, `lib/auth.js` guarda esses dois campos na sessão; `PerfilPage.jsx` é reescrita para ler de lá, editar e salvar via esse endpoint.

**Tech Stack:** Django 6 + DRF (`plataforma` app), React 19 + Vitest/Testing Library (`frontend/`).

## Global Constraints

- Campo Email não é implementado (nem editável, nem exibido) — nenhum usuário do sistema tem `User.email` preenchido hoje.
- Não editar `username` (login) nem senha por esta tela — fora de escopo.
- `MeuPerfilView` não é `EhAdmin` — qualquer usuário autenticado edita o próprio nome, independente de `papel`/`is_staff`.
- Remover o badge "Modo Desenvolvimento" da tela junto desta mudança (código morto na mesma página).
- TDD: escrever o teste, ver falhar, implementar, ver passar, commitar — em cada task.
- Backend testado com `python manage.py test plataforma` (raiz do repo). Frontend testado com `npm test` dentro de `frontend/`.

---

### Task 1: Backend — login expõe `username`/`nome`; endpoint para editar o nome

**Files:**
- Modify: `plataforma/views.py`
- Modify: `plataforma/urls.py`
- Test: `plataforma/tests/test_views.py`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: payload de `POST /api/auth/login/` com `username` (string) e `nome` (string, `first_name` ou `username` se vazio) — consumido pelo frontend na Task 2 (`salvarSessao(data)` em `LoginPage.jsx` já repassa o objeto inteiro, sem mudança necessária lá). Endpoint `PATCH /api/auth/me/` — recebe `{"nome": "<string>"}`, devolve `{"nome": "<string>"}` em sucesso (200) ou `{"detail": "<mensagem>"}` em erro (400) — consumido pelo frontend na Task 3.

- [ ] **Step 1: Escrever os testes em `plataforma/tests/test_views.py`**

Em `LoginViewTest`, troque o método `test_login_com_credenciais_corretas_retorna_token_e_modulos` (adicione as duas linhas novas antes do `assertEqual` de `modulos_ativos`):

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
        self.assertEqual(resp.data["username"], "joao")
        self.assertEqual(resp.data["nome"], "joao")
        self.assertEqual(resp.data["modulos_ativos"], ["inventario"])
```

Adicione um novo teste logo abaixo dele, ainda dentro de `LoginViewTest`:

```python
    def test_login_retorna_first_name_como_nome_quando_definido(self):
        self.user.first_name = "João Silva"
        self.user.save(update_fields=["first_name"])
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "joao", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["nome"], "João Silva")
```

Adicione uma nova classe de teste no final do arquivo:

```python
class MeuPerfilViewTest(APITestCase):
    def _autenticar(self, user):
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

    def test_atualiza_o_proprio_nome(self):
        user = User.objects.create_user(username="maria", password="x")
        self._autenticar(user)
        resp = self.client.patch("/api/auth/me/", {"nome": "Maria Souza"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["nome"], "Maria Souza")
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Maria Souza")

    def test_nome_vazio_retorna_400_e_nao_altera_first_name(self):
        user = User.objects.create_user(username="maria", password="x", first_name="Original")
        self._autenticar(user)
        resp = self.client.patch("/api/auth/me/", {"nome": "   "}, format="json")
        self.assertEqual(resp.status_code, 400)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Original")

    def test_sem_autenticacao_retorna_401(self):
        resp = self.client.patch("/api/auth/me/", {"nome": "Maria"}, format="json")
        self.assertEqual(resp.status_code, 401)
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `python manage.py test plataforma.tests.test_views -v 2`
Expected: FAIL em `test_login_com_credenciais_corretas_retorna_token_e_modulos` (`KeyError: 'username'`), `test_login_retorna_first_name_como_nome_quando_definido` (mesmo motivo), e nos 3 testes de `MeuPerfilViewTest` (404 — a URL `/api/auth/me/` ainda não existe).

- [ ] **Step 3: Atualizar `plataforma/views.py`**

No método `post` de `LoginView`, o `Response` final:

```python
        return Response({
            "token": str(token.token),
            "papel": perfil.papel,
            "is_staff": user.is_staff,
            "modulos_ativos": modulos_ativos,
        })
```

vira:

```python
        return Response({
            "token": str(token.token),
            "papel": perfil.papel,
            "is_staff": user.is_staff,
            "username": user.username,
            "nome": user.first_name or user.username,
            "modulos_ativos": modulos_ativos,
        })
```

Adicione a classe `MeuPerfilView` logo depois de `LogoutView` (antes de `ModuloViewSet`):

```python
class MeuPerfilView(APIView):
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        nome = str(request.data.get("nome", "")).strip()
        if not nome:
            return Response({"detail": "Nome não pode ser vazio."}, status=status.HTTP_400_BAD_REQUEST)
        request.user.first_name = nome
        request.user.save(update_fields=["first_name"])
        return Response({"nome": nome})
```

- [ ] **Step 4: Atualizar `plataforma/urls.py`**

Troque:

```python
from .views import LoginView, LogoutView, ModuloViewSet, UsuarioViewSet
```

por:

```python
from .views import LoginView, LogoutView, MeuPerfilView, ModuloViewSet, UsuarioViewSet
```

Troque:

```python
urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
] + router.urls
```

por:

```python
urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeuPerfilView.as_view(), name="auth-me"),
] + router.urls
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `python manage.py test plataforma -v 2`
Expected: `OK` (roda toda a suíte de `plataforma`, sem regressão em `test_authentication.py`, `test_permissions.py`, `test_migrations.py`, `test_models.py`, `test_management_command.py`)

- [ ] **Step 6: Commit**

```bash
git add plataforma/views.py plataforma/urls.py plataforma/tests/test_views.py
git commit -m "feat(plataforma): login expoe username/nome; endpoint para editar o proprio nome"
```

---

### Task 2: Frontend — `lib/auth.js` guarda `username`/`nome`

**Files:**
- Modify: `frontend/src/lib/auth.js`
- Test: `frontend/src/lib/auth.test.js`

**Interfaces:**
- Consumes: payload de login com `username`/`nome` (Task 1) — `LoginPage.jsx:28` já faz `salvarSessao(data)` passando o objeto inteiro da resposta, não precisa de mudança lá.
- Produces: `getUsername(): string`, `getNome(): string`, `atualizarNome(novoNome: string): void` — usados por `PerfilPage.jsx` na Task 3.

- [ ] **Step 1: Escrever os testes novos em `frontend/src/lib/auth.test.js`**

Adicione ao `describe("auth", ...)` existente, depois do teste `"getModulosAtivos retorna array vazio sem sessão"`:

```js
  it("salva e recupera username e nome", () => {
    salvarSessao({ token: "abc-123", papel: "OPERADOR", is_staff: false, username: "joao", nome: "João Silva", modulos_ativos: [] })
    expect(getUsername()).toBe("joao")
    expect(getNome()).toBe("João Silva")
  })

  it("atualizarNome troca só o nome, sem afetar o resto da sessão", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", is_staff: true, username: "joao", nome: "João", modulos_ativos: ["inventario"] })
    atualizarNome("João Pereira")
    expect(getNome()).toBe("João Pereira")
    expect(getUsername()).toBe("joao")
    expect(getToken()).toBe("abc-123")
    expect(ehAdmin()).toBe(true)
  })
```

Atualize o import no topo do arquivo:

```js
import {
  salvarSessao, limparSessao, getToken, getPapel,
  getModulosAtivos, estaAutenticado, ehAdmin,
  getUsername, getNome, atualizarNome,
} from "./auth"
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/lib/auth.test.js` (dentro de `frontend/`)
Expected: FAIL — `getUsername`, `getNome` e `atualizarNome` ainda não existem (erro de import/`undefined is not a function`).

- [ ] **Step 3: Atualizar `frontend/src/lib/auth.js`**

Substitua o arquivo inteiro por:

```js
const TOKEN_KEY = "edustock:auth:token"
const PAPEL_KEY = "edustock:auth:papel"
const MODULOS_KEY = "edustock:auth:modulos"
const IS_STAFF_KEY = "edustock:auth:is_staff"
const USERNAME_KEY = "edustock:auth:username"
const NOME_KEY = "edustock:auth:nome"

export function salvarSessao({ token, papel, is_staff, username, nome, modulos_ativos }) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(PAPEL_KEY, papel)
  sessionStorage.setItem(IS_STAFF_KEY, String(Boolean(is_staff)))
  sessionStorage.setItem(USERNAME_KEY, username ?? "")
  sessionStorage.setItem(NOME_KEY, nome ?? "")
  sessionStorage.setItem(MODULOS_KEY, JSON.stringify(modulos_ativos))
}

export function limparSessao() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PAPEL_KEY)
  sessionStorage.removeItem(IS_STAFF_KEY)
  sessionStorage.removeItem(USERNAME_KEY)
  sessionStorage.removeItem(NOME_KEY)
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

export function getUsername() {
  return sessionStorage.getItem(USERNAME_KEY)
}

export function getNome() {
  return sessionStorage.getItem(NOME_KEY)
}

export function atualizarNome(novoNome) {
  sessionStorage.setItem(NOME_KEY, novoNome)
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/lib/auth.test.js`
Expected: PASS (6 testes: os 4 já existentes + os 2 novos)

- [ ] **Step 5: Rodar a suíte completa do frontend e confirmar que nada quebrou**

Run: `npm test` (dentro de `frontend/`)
Expected: todos os testes passam — `salvarSessao` ganhou parâmetros novos (`username`, `nome`) mas eles são opcionais (`?? ""`), nenhum teste existente que chama `salvarSessao` sem esses campos deve quebrar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/auth.js frontend/src/lib/auth.test.js
git commit -m "feat(frontend): auth.js guarda username e nome da sessao"
```

---

### Task 3: Frontend — `PerfilPage.jsx` com nome editável

**Files:**
- Modify: `frontend/src/pages/PerfilPage.jsx`
- Test: `frontend/src/pages/PerfilPage.test.jsx`

**Interfaces:**
- Consumes: `getToken`, `getUsername`, `getNome`, `atualizarNome`, `limparSessao` da Task 2 (`frontend/src/lib/auth.js`); endpoint `PATCH /api/auth/me/` da Task 1.
- Produces: nada consumido por outra task — esta é a página final.

- [ ] **Step 1: Escrever os testes novos em `frontend/src/pages/PerfilPage.test.jsx`**

Substitua o arquivo inteiro por (mantém os 2 testes de logout já existentes, adiciona os de edição de nome):

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import PerfilPage from "./PerfilPage"
import { salvarSessao, estaAutenticado, getNome } from "../lib/auth"

function renderPerfil() {
  return render(
    <MemoryRouter initialEntries={["/perfil"]}>
      <Routes>
        <Route path="/login" element={<div>Tela de login</div>} />
        <Route path="/perfil" element={<PerfilPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("PerfilPage - handleLogout", () => {
  beforeEach(() => {
    sessionStorage.clear()
    salvarSessao({ token: "abc123", papel: "OPERADOR", is_staff: false, username: "joao", nome: "joao", modulos_ativos: ["inventario"] })
  })
  afterEach(() => vi.restoreAllMocks())

  it("chama o endpoint de logout com o token, limpa a sessão e navega para /login", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 204 })

    renderPerfil()
    expect(estaAutenticado()).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /sair/i }))

    await waitFor(() => expect(screen.getByText("Tela de login")).toBeInTheDocument())

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout/"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Token abc123" }),
      })
    )
    expect(estaAutenticado()).toBe(false)
  })

  it("ainda limpa a sessão e navega para /login mesmo se a chamada de logout falhar", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("network error"))

    renderPerfil()

    fireEvent.click(screen.getByRole("button", { name: /sair/i }))

    await waitFor(() => expect(screen.getByText("Tela de login")).toBeInTheDocument())
    expect(estaAutenticado()).toBe(false)
  })
})

describe("PerfilPage - edição de nome", () => {
  beforeEach(() => {
    sessionStorage.clear()
    salvarSessao({ token: "abc123", papel: "OPERADOR", is_staff: false, username: "joao", nome: "joao", modulos_ativos: [] })
  })
  afterEach(() => vi.restoreAllMocks())

  it("mostra o nome atual da sessão no campo", () => {
    renderPerfil()
    expect(screen.getByLabelText(/^nome$/i).value).toBe("joao")
  })

  it("botão Salvar começa desabilitado (nada mudou ainda)", () => {
    renderPerfil()
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled()
  })

  it("salva o novo nome e atualiza a sessão", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nome: "João Silva" }) })

    renderPerfil()
    const campo = screen.getByLabelText(/^nome$/i)
    await user.clear(campo)
    await user.type(campo, "João Silva")
    await user.click(screen.getByRole("button", { name: /salvar/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me/"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Token abc123" }),
        body: JSON.stringify({ nome: "João Silva" }),
      })
    ))
    await waitFor(() => expect(getNome()).toBe("João Silva"))
  })

  it("mostra erro da API e mantém o valor digitado", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: "Nome não pode ser vazio." }) })

    renderPerfil()
    const campo = screen.getByLabelText(/^nome$/i)
    await user.clear(campo)
    await user.type(campo, "X")
    await user.click(screen.getByRole("button", { name: /salvar/i }))

    await waitFor(() => expect(screen.getByText("Nome não pode ser vazio.")).toBeInTheDocument())
    expect(campo.value).toBe("X")
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/pages/PerfilPage.test.jsx` (dentro de `frontend/`)
Expected: FAIL nos 5 testes do novo `describe("PerfilPage - edição de nome", ...)` — o campo "Nome" ainda é uma `<div>` estática, não um input, e não há botão "Salvar".

- [ ] **Step 3: Reescrever `frontend/src/pages/PerfilPage.jsx`**

Substitua o arquivo inteiro por:

```jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { getToken, getUsername, getNome, atualizarNome, limparSessao } from "../lib/auth"
import { useToast } from "../components/ui/Toast"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export default function PerfilPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [nome, setNome] = useState(getNome() || "")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")

  const avatarLetter = (nome || "?").charAt(0).toUpperCase()

  async function salvarNome(ev) {
    ev.preventDefault()
    const valor = nome.trim()
    if (!valor || valor === getNome()) return
    setErro("")
    setSalvando(true)
    try {
      const resp = await fetch(`${BASE}/auth/me/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
        body: JSON.stringify({ nome: valor }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setErro(data.detail || "Não foi possível salvar o nome.")
        return
      }
      atualizarNome(data.nome)
      setNome(data.nome)
      toast("Nome atualizado")
    } catch {
      setErro("Falha na conexão. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  const handleLogout = async () => {
    const token = getToken()
    if (token) {
      try {
        await fetch(`${BASE}/auth/logout/`, {
          method: "POST",
          headers: { Authorization: `Token ${token}` },
        })
      } catch {
        // Falha de rede não deve impedir o logout local
      }
    }

    limparSessao()
    navigate("/login")
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold leading-tight">Perfil</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-faint">
          Gerencie suas informações de perfil e sessão
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface text-2xl font-bold text-brand">
            {avatarLetter}
          </div>
          <div className="flex-1">
            <p className="text-sm text-ink-faint">
              Editando o perfil de <strong className="text-ink">{getUsername()}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={salvarNome} className="mb-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-faint">Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="field"
            />
          </label>
          {erro && <p className="text-sm text-out">{erro}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!nome.trim() || nome.trim() === getNome() || salvando}
              className="btn btn-brand disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>

        <div className="flex justify-end border-t border-line pt-6">
          <button
            onClick={handleLogout}
            className="rounded-lg bg-danger px-4 py-2 font-medium text-white transition-colors hover:bg-danger/90"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/pages/PerfilPage.test.jsx`
Expected: PASS (7 testes: os 2 de logout + os 5 novos de edição de nome)

- [ ] **Step 5: Rodar a suíte completa do frontend e confirmar que passa**

Run: `npm test`
Expected: `OK`, sem falhas

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PerfilPage.jsx frontend/src/pages/PerfilPage.test.jsx
git commit -m "feat(frontend): campo Nome editavel na tela de Perfil"
```

---

### Task 4: Verificação final

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
1. Logar com qualquer conta existente → abrir "Perfil" → confirmar que o campo Nome mostra o `username` (nenhuma conta tem nome definido ainda) e o badge "Modo Desenvolvimento" sumiu.
2. Trocar o nome, clicar "Salvar" → confirmar toast de sucesso e que o nome novo persiste (deslogar e logar de novo, o nome deve vir atualizado no login).
3. Deixar o campo vazio → confirmar que "Salvar" fica desabilitado.
4. Digitar o mesmo valor já salvo → confirmar que "Salvar" continua desabilitado (nada mudou).
