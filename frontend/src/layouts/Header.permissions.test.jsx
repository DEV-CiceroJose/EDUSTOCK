import { beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { salvarSessao } from "../lib/auth"
import Header from "./Header"

function renderHeader() {
  render(
    <MemoryRouter>
      <Header
        search=""
        setSearch={() => {}}
        onAddItem={() => {}}
        onReport={() => {}}
      />
    </MemoryRouter>,
  )
}

describe("identificação do usuário no Header", () => {
  beforeEach(() => sessionStorage.clear())

  it("identifica corretamente uma sessão de operador", () => {
    salvarSessao({
      token: "token",
      papel: "OPERADOR",
      is_staff: true,
      username: "operador.teste",
      nome: "Operador Teste",
      modulos_ativos: ["inventario"],
    })

    renderHeader()

    expect(screen.getByText("Operador Teste")).toBeInTheDocument()
    expect(screen.getByText("Operador")).toBeInTheDocument()
    expect(screen.queryByText("Administrador")).not.toBeInTheDocument()
  })

  it("identifica corretamente uma sessão de administrador", () => {
    salvarSessao({
      token: "token",
      papel: "ADMIN",
      is_staff: false,
      username: "admin.teste",
      nome: "Admin Teste",
      modulos_ativos: ["inventario"],
    })

    renderHeader()

    expect(screen.getByText("Admin Teste")).toBeInTheDocument()
    expect(screen.getByText("Administrador")).toBeInTheDocument()
  })
})
