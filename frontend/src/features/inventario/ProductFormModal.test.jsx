import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import ProductFormModal from "./ProductFormModal"

afterEach(cleanup)

describe("ProductFormModal — preço pertence às entradas", () => {
  it("não pede preço nem nota fiscal no cadastro do produto", () => {
    render(<ProductFormModal open produto={null} grupos={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/Preço unitário/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Nota fiscal/i)).not.toBeInTheDocument()
  })

  it("orienta a criar um grupo quando o cadastro ainda esta vazio", () => {
    render(<ProductFormModal open produto={null} grupos={[]} onClose={vi.fn()} onSaved={vi.fn()} onCreateGroup={vi.fn()} />)
    expect(screen.getByText(/crie um grupo antes/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /criar primeiro grupo/i })).toBeInTheDocument()
  })
})
