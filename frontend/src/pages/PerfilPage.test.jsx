import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import PerfilPage from "./PerfilPage"
import { salvarSessao, estaAutenticado } from "../lib/auth"

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
    salvarSessao({ token: "abc123", papel: "OPERADOR", modulos_ativos: ["inventario"] })
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
