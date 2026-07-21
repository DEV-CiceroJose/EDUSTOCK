import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import InventarioPage from "./InventarioPage"

afterEach(cleanup)

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
