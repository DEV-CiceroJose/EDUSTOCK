import { describe, it, expect, beforeEach } from "vitest"
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
})
