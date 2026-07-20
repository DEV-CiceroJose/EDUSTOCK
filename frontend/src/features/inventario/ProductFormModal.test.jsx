import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import ProductFormModal from "./ProductFormModal"
import * as auth from "../../lib/auth"

afterEach(cleanup)

describe("ProductFormModal — campo de preço", () => {
  it("não renderiza o campo de preço quando mostrarPreco é false", () => {
    vi.spyOn(auth, "getModulosAtivos").mockReturnValue([])
    render(<ProductFormModal open produto={null} grupos={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/Preço unitário/i)).not.toBeInTheDocument()
  })

  it("renderiza o campo de preço quando mostrarPreco é true", () => {
    vi.spyOn(auth, "getModulosAtivos").mockReturnValue(["financeiro"])
    render(<ProductFormModal open produto={null} grupos={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText(/Preço unitário/i)).toBeInTheDocument()
  })
})
