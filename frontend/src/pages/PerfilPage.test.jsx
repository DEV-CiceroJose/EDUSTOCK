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
