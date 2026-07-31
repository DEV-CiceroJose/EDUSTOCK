import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import InventarioPage from "./InventarioPage"
import { salvarSessao } from "../lib/auth"

afterEach(cleanup)
beforeEach(() => {
  sessionStorage.clear()
  salvarSessao({
    token: "test-token",
    papel: "ADMIN",
    is_staff: true,
    modulos_ativos: ["inventario"],
  })
})

vi.mock("../api", () => ({
  categoriasApi: { create: vi.fn().mockResolvedValue({ id: 99, name: "Higiene" }) },
  produtosApi: {},
  movimentacoesApi: {},
}))

vi.mock("../hooks/useDashboardData", () => ({
  useDashboardData: () => ({
    produtos: [],
    categorias: [],
    grupos: [],
    fornecedores: [],
    loading: false,
    carregar: vi.fn(),
    counts: { cat: {}, grupo: {} },
    visiveis: () => [],
    search: "",
  }),
}))

describe("InventarioPage — abertura do modal via navegação do header", () => {
  it("abre o modal de novo item quando chega com location.state.openAdd", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/inventario", state: { openAdd: true } }]}>
        <InventarioPage />
      </MemoryRouter>
    )
    expect(screen.getByText("Adicionar novo item")).toBeInTheDocument()
  })

  it("não abre o modal numa navegação normal, sem state", () => {
    render(
      <MemoryRouter initialEntries={["/inventario"]}>
        <InventarioPage />
      </MemoryRouter>
    )
    expect(screen.queryByText("Adicionar novo item")).not.toBeInTheDocument()
  })
})

describe("InventarioPage — criação de categoria", () => {
  it("abre o modal de nova categoria e cria via categoriasApi", async () => {
    const user = userEvent.setup()
    const { categoriasApi } = await import("../api")
    render(
      <MemoryRouter initialEntries={["/inventario"]}>
        <InventarioPage />
      </MemoryRouter>
    )
    await user.click(screen.getByText("Nova categoria"))
    expect(screen.getByRole("heading", { name: "Nova categoria" })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/nome da categoria/i), "Higiene")
    await user.click(screen.getByRole("button", { name: /criar categoria/i }))
    await waitFor(() => expect(categoriasApi.create).toHaveBeenCalledWith({ name: "Higiene" }))
  })
})
