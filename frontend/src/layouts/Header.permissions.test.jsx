import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { salvarSessao } from "../lib/auth"
import Header from "./Header"

const { getRuntimeMode } = vi.hoisted(() => ({ getRuntimeMode: vi.fn() }))

vi.mock("../lib/runtimeMode", () => ({ getRuntimeMode }))

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
  beforeEach(() => {
    sessionStorage.clear()
    getRuntimeMode.mockReturnValue({ useMock: false, demo: false })
  })

  afterEach(() => getRuntimeMode.mockReset())

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

  it("mostra o selo somente quando o modo resolvido é de demonstração", () => {
    getRuntimeMode.mockReturnValue({ useMock: false, demo: true })

    renderHeader()

    expect(screen.getByText("Demonstração")).toBeInTheDocument()
  })

  it("não mostra o selo fora do modo de demonstração", () => {
    renderHeader()

    expect(screen.queryByText("Demonstração")).not.toBeInTheDocument()
  })
})
