import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import DetailsModal from "./DetailsModal"
import * as config from "../../lib/config"

afterEach(cleanup)

const PRODUTO = {
  nome: "Arroz", categoria_nome: "Alimentos", grupo_nome: "Geral",
  quantidade: "10.000", estoque_minimo: "5.000", unidade: "KG",
  preco: "5.40", validade: null, numero_nota_fiscal: "", periodicidade: "MENSAL",
  fornecedor_nome: "",
}

describe("DetailsModal — linhas de preço", () => {
  it("não renderiza preço/valor em estoque quando mostrarPreco é false", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: false })
    render(<DetailsModal produto={PRODUTO} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.queryByText("Preço unitário")).not.toBeInTheDocument()
    expect(screen.queryByText("Valor em estoque")).not.toBeInTheDocument()
  })

  it("renderiza preço/valor em estoque quando mostrarPreco é true", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: true })
    render(<DetailsModal produto={PRODUTO} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByText("Preço unitário")).toBeInTheDocument()
    expect(screen.getByText("Valor em estoque")).toBeInTheDocument()
  })
})
