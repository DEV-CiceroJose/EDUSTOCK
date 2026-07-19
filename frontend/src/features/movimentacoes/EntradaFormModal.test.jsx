import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import EntradaFormModal from "./EntradaFormModal"
import * as config from "../../lib/config"

afterEach(cleanup)

const PRODUTOS = [{ id: 1, nome: "Arroz" }]
const FORNECEDORES = []

describe("EntradaFormModal — coluna e total de preço", () => {
  it("não renderiza input de preço nem total quando mostrarPreco é false", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: false })
    render(<EntradaFormModal open produtos={PRODUTOS} fornecedores={FORNECEDORES} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByPlaceholderText("R$")).not.toBeInTheDocument()
    expect(screen.queryByText("Total")).not.toBeInTheDocument()
  })

  it("renderiza input de preço e total quando mostrarPreco é true", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: true })
    render(<EntradaFormModal open produtos={PRODUTOS} fornecedores={FORNECEDORES} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByPlaceholderText("R$")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
  })
})
