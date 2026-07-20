import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import ProductFormModal from "./ProductFormModal"
import * as config from "../../lib/config"

afterEach(cleanup)

describe("ProductFormModal — campo de preço", () => {
  it("não renderiza o campo de preço quando mostrarPreco é false", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: false })
    render(<ProductFormModal open produto={null} grupos={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/Preço unitário/i)).not.toBeInTheDocument()
  })

  it("renderiza o campo de preço quando mostrarPreco é true", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: true })
    render(<ProductFormModal open produto={null} grupos={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText(/Preço unitário/i)).toBeInTheDocument()
  })
})
