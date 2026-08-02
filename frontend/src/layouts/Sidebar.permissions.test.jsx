import { beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { salvarSessao } from "../lib/auth"
import Sidebar from "./Sidebar"

describe("permissões do Sidebar", () => {
  beforeEach(() => sessionStorage.clear())

  it("não mostra Módulos nem Usuários para operador staff", () => {
    salvarSessao({
      token: "token",
      papel: "OPERADOR",
      is_staff: true,
      modulos_ativos: ["inventario"],
    })

    render(<MemoryRouter><Sidebar mobile /></MemoryRouter>)

    expect(screen.queryByText("Módulos")).not.toBeInTheDocument()
    expect(screen.queryByText("Usuários")).not.toBeInTheDocument()
    expect(screen.getByText("Inventário")).toBeInTheDocument()
  })

  it("mostra Módulos e Usuários somente para papel ADMIN", () => {
    salvarSessao({
      token: "token",
      papel: "ADMIN",
      is_staff: false,
      modulos_ativos: ["inventario"],
    })

    render(<MemoryRouter><Sidebar mobile /></MemoryRouter>)

    expect(screen.getByText("Módulos")).toBeInTheDocument()
    expect(screen.getByText("Usuários")).toBeInTheDocument()
  })
})
