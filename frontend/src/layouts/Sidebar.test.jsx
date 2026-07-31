import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Sidebar from "./Sidebar"
import { salvarSessao } from "../lib/auth"

describe("Sidebar", () => {
  beforeEach(() => sessionStorage.clear())

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
