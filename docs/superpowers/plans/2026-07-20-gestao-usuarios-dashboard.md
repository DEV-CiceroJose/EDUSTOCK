# Tela de gestão de usuários no dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma tela `/admin/usuarios` no dashboard (`frontend/`) para listar usuários, criar usuário novo (com senha obrigatória) e trocar o papel (`ADMIN`/`OPERADOR`) de cada um — sem tocar no backend, que já suporta tudo isso.

**Architecture:** Dois componentes React novos: `AdminUsuariosPage` (lista com `<select>` de papel inline por linha, no molde de `AdminModulosPage` já existente) e `NewUserModal` (modal de criação, no molde de `NewCategoryModal` já existente, mas com tratamento de erro inline vindo da API). Navegação nova na Sidebar e rota nova em `main.jsx`, ambas gated por `ehAdmin()` (já reflete `is_staff` desde o PR #8).

**Tech Stack:** React 19 + React Router 7 + Vitest/Testing Library, no `frontend/`. Nenhuma mudança em Python/Django.

## Global Constraints

- Esta tela NÃO gerencia `is_staff` — só o campo `papel` (`ADMIN`/`OPERADOR`) da aplicação. Conceder `is_staff` continua exigindo Django Admin/`manage.py`, fora deste escopo.
- Sem desativar/excluir usuário — `UsuarioViewSet` não expõe `DELETE` (`http_method_names = ["get", "post", "patch", "head", "options"]`, `plataforma/views.py:87`), e isso não muda.
- Nenhuma mudança em código Python/Django — `UsuarioViewSet`/`UsuarioSerializer` já cobrem list/create/patch de `papel`.
- Senha obrigatória no formulário de criação (validação só no frontend — a API continua aceitando omissão de senha, isso não muda).
- Seguir o padrão visual e de código já estabelecido: `Modal` genérico (`frontend/src/components/ui/Modal.jsx`), classes utilitárias `field`/`btn btn-brand`/`btn btn-ghost`, mesmo texto de bloqueio `"Apenas administradores acessam esta página."` que `AdminModulosPage.jsx` já usa.
- TDD: escrever o teste, ver falhar, implementar, ver passar, commitar — em cada task.
- Frontend testado com `npm test` dentro de `frontend/`.

---

### Task 1: `NewUserModal` — modal de criação de usuário

**Files:**
- Create: `frontend/src/features/usuarios/NewUserModal.jsx`
- Test: `frontend/src/features/usuarios/NewUserModal.test.jsx`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: componente `NewUserModal({ open: boolean, onClose: () => void, onCreated: (usuario: {id, username, papel}) => void })` — usado por `AdminUsuariosPage` na Task 2. `onCreated` é chamado só em caso de sucesso, com o corpo JSON retornado pela API; o modal fecha (`onClose()`) sozinho depois de chamar `onCreated`.

- [ ] **Step 1: Escrever `frontend/src/features/usuarios/NewUserModal.test.jsx`**

```jsx
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import NewUserModal from "./NewUserModal"

afterEach(cleanup)

describe("NewUserModal", () => {
  it("não renderiza nada quando open é false", () => {
    render(<NewUserModal open={false} onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.queryByText("Novo usuário")).not.toBeInTheDocument()
  })

  it("botão Criar usuário começa desabilitado e só habilita com usuário e senha preenchidos", async () => {
    const user = userEvent.setup()
    render(<NewUserModal open onClose={vi.fn()} onCreated={vi.fn()} />)
    const botao = screen.getByRole("button", { name: /criar usuário/i })
    expect(botao).toBeDisabled()
    await user.type(screen.getByLabelText(/^usuário$/i), "maria")
    expect(botao).toBeDisabled()
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    expect(botao).toBeEnabled()
  })

  it("cria o usuário e chama onCreated com os dados retornados pela API", async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onClose = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 7, username: "maria", papel: "OPERADOR" }),
    })
    render(<NewUserModal open onClose={onClose} onCreated={onCreated} />)
    await user.type(screen.getByLabelText(/^usuário$/i), "maria")
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    await user.click(screen.getByRole("button", { name: /criar usuário/i }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 7, username: "maria", papel: "OPERADOR" }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("mostra o erro da API e mantém o modal aberto quando a criação falha", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ username: ["user with this username already exists."] }),
    })
    render(<NewUserModal open onClose={onClose} onCreated={vi.fn()} />)
    await user.type(screen.getByLabelText(/^usuário$/i), "maria")
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    await user.click(screen.getByRole("button", { name: /criar usuário/i }))
    await waitFor(() => expect(screen.getByText("user with this username already exists.")).toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/features/usuarios/NewUserModal.test.jsx` (dentro de `frontend/`)
Expected: FAIL — o módulo `./NewUserModal` ainda não existe.

- [ ] **Step 3: Criar `frontend/src/features/usuarios/NewUserModal.jsx`**

```jsx
import { useEffect, useState } from "react"
import Modal from "../../components/ui/Modal"
import { getToken } from "../../lib/auth"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export default function NewUserModal({ open, onClose, onCreated }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [papel, setPapel] = useState("OPERADOR")
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (open) {
      setUsername("")
      setPassword("")
      setPapel("OPERADOR")
      setErro("")
      setSalvando(false)
    }
  }, [open])

  async function submit(ev) {
    ev.preventDefault()
    setErro("")
    setSalvando(true)
    try {
      const resp = await fetch(`${BASE}/usuarios/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
        body: JSON.stringify({ username, password, papel }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setErro(data.username?.[0] || data.detail || "Não foi possível criar o usuário.")
        return
      }
      onCreated(data)
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo usuário" subtitle="Cadastre um acesso à plataforma" maxW="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Usuário</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Papel</span>
          <select value={papel} onChange={(e) => setPapel(e.target.value)} className="field">
            <option value="OPERADOR">Operador</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        {erro && <p className="text-sm text-out">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button
            type="submit"
            disabled={!username.trim() || !password.trim() || salvando}
            className="btn btn-brand disabled:opacity-50"
          >
            {salvando ? "Criando…" : "Criar usuário"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/features/usuarios/NewUserModal.test.jsx`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/usuarios/NewUserModal.jsx frontend/src/features/usuarios/NewUserModal.test.jsx
git commit -m "feat(frontend): modal de criacao de usuario com senha obrigatoria e erro inline"
```

---

### Task 2: `AdminUsuariosPage` — lista com papel editável inline

**Files:**
- Create: `frontend/src/pages/AdminUsuariosPage.jsx`
- Test: `frontend/src/pages/AdminUsuariosPage.test.jsx`

**Interfaces:**
- Consumes: `NewUserModal` da Task 1 — `<NewUserModal open onClose onCreated />`, exatamente essa assinatura.
- Produces: componente `AdminUsuariosPage` (sem props) — usado pela rota `admin/usuarios` na Task 3.

- [ ] **Step 1: Escrever `frontend/src/pages/AdminUsuariosPage.test.jsx`**

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AdminUsuariosPage from "./AdminUsuariosPage"
import { salvarSessao } from "../lib/auth"
import { ToastProvider } from "../components/ui/Toast"

describe("AdminUsuariosPage", () => {
  beforeEach(() => {
    sessionStorage.clear()
    salvarSessao({ token: "abc", papel: "ADMIN", is_staff: true, modulos_ativos: [] })
  })
  afterEach(() => vi.restoreAllMocks())

  it("lista usuários e permite trocar o papel", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR" }]),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await waitFor(() => expect(screen.getByText("maria")).toBeInTheDocument())
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ADMIN" } })
    await waitFor(() => expect(screen.getByRole("combobox").value).toBe("ADMIN"))
  })

  it("reverte o select e mostra toast quando a troca de papel falha", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR" }]),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await waitFor(() => expect(screen.getByText("maria")).toBeInTheDocument())
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ADMIN" } })
    await waitFor(() => expect(screen.getByRole("combobox").value).toBe("OPERADOR"))
  })

  it("mostra mensagem para quem não é admin", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", is_staff: false, modulos_ativos: [] })
    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    expect(screen.getByText(/apenas administradores/i)).toBeInTheDocument()
  })

  it("adiciona o usuário criado à lista ao concluir o modal", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 2, username: "joao", papel: "OPERADOR" }) })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await waitFor(() => expect(screen.getByRole("button", { name: /novo usuário/i })).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /novo usuário/i }))
    await user.type(screen.getByLabelText(/^usuário$/i), "joao")
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    await user.click(screen.getByRole("button", { name: /^criar usuário$/i }))
    await waitFor(() => expect(screen.getByText("joao")).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- src/pages/AdminUsuariosPage.test.jsx` (dentro de `frontend/`)
Expected: FAIL — o módulo `./AdminUsuariosPage` ainda não existe.

- [ ] **Step 3: Criar `frontend/src/pages/AdminUsuariosPage.jsx`**

```jsx
import { useEffect, useState } from "react"
import { getToken, ehAdmin } from "../lib/auth"
import { useToast } from "../components/ui/Toast"
import { Icon } from "../lib/icons.jsx"
import NewUserModal from "../features/usuarios/NewUserModal"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
const PAPEIS = [
  { value: "OPERADOR", label: "Operador" },
  { value: "ADMIN", label: "Administrador" },
]

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (ehAdmin()) carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const resp = await fetch(`${BASE}/usuarios/`, {
      headers: { Authorization: `Token ${getToken()}` },
    })
    const data = await resp.json()
    setUsuarios(data)
    setCarregando(false)
  }

  async function trocarPapel(usuario, novoPapel) {
    const anterior = usuario.papel
    setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, papel: novoPapel } : u)))
    const resp = await fetch(`${BASE}/usuarios/${usuario.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
      body: JSON.stringify({ papel: novoPapel }),
    })
    if (!resp.ok) {
      setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, papel: anterior } : u)))
      toast("Não foi possível alterar o papel.", "danger")
    }
  }

  function aoCriar(novoUsuario) {
    setUsuarios((lista) => [...lista, novoUsuario].sort((a, b) => a.username.localeCompare(b.username)))
    toast("Usuário criado")
  }

  if (!ehAdmin()) {
    return <p className="p-6 text-ink-soft">Apenas administradores acessam esta página.</p>
  }
  if (carregando) return <p className="p-6 text-ink-soft">Carregando usuários…</p>

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Usuários</h1>
        <button onClick={() => setModalOpen(true)} className="btn btn-brand">
          {Icon.plus(16)} Novo usuário
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <div key={u.id} className="card flex items-center justify-between p-4">
            <p className="font-semibold">{u.username}</p>
            <select
              value={u.papel}
              onChange={(e) => trocarPapel(u, e.target.value)}
              className="field w-auto"
            >
              {PAPEIS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <NewUserModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={aoCriar} />
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- src/pages/AdminUsuariosPage.test.jsx`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AdminUsuariosPage.jsx frontend/src/pages/AdminUsuariosPage.test.jsx
git commit -m "feat(frontend): pagina de gestao de usuarios com papel editavel inline"
```

---

### Task 3: Navegação e rota

**Files:**
- Modify: `frontend/src/layouts/Sidebar.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/bugfix-preservation.test.jsx`

**Interfaces:**
- Consumes: `AdminUsuariosPage` da Task 2.
- Produces: nada consumido por outra task — esta é a task que efetivamente torna a tela alcançável na aplicação.

- [ ] **Step 1: Atualizar `frontend/src/layouts/Sidebar.jsx`**

Na lista `navItems`, logo depois da linha do item "Módulos" (`{ to: "/admin/modulos", label: "Módulos", icon: "gear", section: "Sistema", modulo: null, somenteAdmin: true },`), adicione:

```js
  { to: "/admin/usuarios", label: "Usuários", icon: "users", section: "Sistema", modulo: null, somenteAdmin: true },
```

- [ ] **Step 2: Atualizar `frontend/src/main.jsx`**

Adicione o import, junto dos outros imports de `pages/`:

```js
import AdminUsuariosPage from "./pages/AdminUsuariosPage"
```

Adicione a rota, logo depois de `<Route path="admin/modulos" element={<AdminModulosPage />} />`:

```jsx
            <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
```

- [ ] **Step 3: Rodar a suíte completa do frontend e confirmar a quebra esperada**

Run: `npm test` (dentro de `frontend/`)
Expected: FAIL em `frontend/src/bugfix-preservation.test.jsx` — o teste `'should preserve navigation links structure and accessibility'` (dentro de `describe('Sidebar Navigation Preservation', ...)`) tem `expect(links.length).toBe(9)` (linha 119), que agora conta 10 links (8 itens base + "Módulos" + "Usuários", já que a sessão de teste usa `is_staff: true`). Todos os outros testes devem continuar passando.

- [ ] **Step 4: Corrigir a asserção em `frontend/src/bugfix-preservation.test.jsx`**

Troque:

```js
      expect(links.length).toBe(9) // All 8 navigation items + admin-only "Módulos" (papel: ADMIN in this suite)
```

por:

```js
      expect(links.length).toBe(10) // All 8 navigation items + admin-only "Módulos" and "Usuários" (is_staff: true in this suite)
```

- [ ] **Step 5: Rodar a suíte completa do frontend e confirmar que passa**

Run: `npm test`
Expected: todos os testes passam

- [ ] **Step 6: Commit**

```bash
git add frontend/src/layouts/Sidebar.jsx frontend/src/main.jsx frontend/src/bugfix-preservation.test.jsx
git commit -m "feat(frontend): expoe pagina de usuarios na navegacao e nas rotas"
```

---

### Task 4: Verificação final

**Files:** nenhum (só execução)

**Interfaces:** nenhuma — task de checagem, não produz nada consumido por outra task.

- [ ] **Step 1: Rodar a suíte completa do frontend**

Run: `npm test` (dentro de `frontend/`)
Expected: `OK`, sem falhas

- [ ] **Step 2: Verificação manual no navegador**

Com o backend (`python manage.py runserver 8000`) e o frontend (`npm run dev` em `frontend/`, porta 5173) rodando:
1. Logar como uma conta `is_staff` (ex. `admin`/`admin123`, criada em sessões anteriores) → confirmar que "Usuários" aparece na Sidebar junto de "Módulos".
2. Abrir `/admin/usuarios` → confirmar que a lista carrega.
3. Clicar em "Novo usuário", preencher usuário/senha/papel, criar → confirmar que aparece na lista e um toast de sucesso.
4. Tentar criar um usuário com um nome já existente → confirmar que o erro aparece dentro do modal, sem fechar.
5. Trocar o papel de um usuário existente no `<select>` da lista → confirmar que salva (recarregar a página e ver se persistiu).
6. Logar como `alberis@edustock.com` (papel ADMIN da aplicação, sem `is_staff`) → confirmar que "Usuários" **não** aparece na Sidebar, e que acessar `/admin/usuarios` direto pela URL mostra "Apenas administradores acessam esta página."
