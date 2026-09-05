import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import Sidebar from "./Sidebar"
import { salvarSessao, estaAutenticado } from "../lib/auth"

describe("Sidebar", () => {
  beforeEach(() => sessionStorage.clear())

  it("sai pelo menu mesmo enquanto o servidor demora a responder", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: [] })
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}))
    try {
      render(<MemoryRouter initialEntries={["/perfil"]}><Routes>
        <Route path="/perfil" element={<Sidebar mobile />} />
        <Route path="/login" element={<div>Tela de login</div>} />
      </Routes></MemoryRouter>)
      fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }))
      expect(screen.getByText("Tela de login")).toBeInTheDocument()
      expect(estaAutenticado()).toBe(false)
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/auth/logout/"),
        expect.objectContaining({ method: "POST", headers: { Authorization: "Token abc" } }))
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("esconde itens de módulos desativados", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: ["inventario"] })
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText("Inventário")).toBeInTheDocument()
    expect(screen.queryByText("Fornecedores")).not.toBeInTheDocument()
  })

  it("sempre mostra Perfil e Configurações mesmo sem módulos ativos", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: [] })
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText("Perfil")).toBeInTheDocument()
    expect(screen.getByText("Configurações")).toBeInTheDocument()
  })

  it("renderiza navegação mobile e fecha ao escolher uma rota", () => {
    const fechar = vi.fn()
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: ["inventario"] })
    render(
      <MemoryRouter>
        <Sidebar mobile onNavigate={fechar} onClose={fechar} />
      </MemoryRouter>
    )
    expect(screen.getByRole("complementary", { name: "Navegação principal" })).toBeInTheDocument()
    screen.getByText("Inventário").click()
    expect(fechar).toHaveBeenCalled()
  })
})
