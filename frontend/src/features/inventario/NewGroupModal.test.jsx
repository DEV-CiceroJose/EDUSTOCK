import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import NewGroupModal from "./NewGroupModal"

afterEach(cleanup)

const categorias = [{ id: 1, name: "Alimentos" }, { id: 2, name: "Limpeza" }]

describe("NewGroupModal", () => {
  it("orienta a criar categoria quando nao existem categorias", () => {
    render(<NewGroupModal open categorias={[]} onClose={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText(/crie uma categoria antes/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /criar grupo/i })).toBeDisabled()
  })

  it("cria um grupo na categoria selecionada", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<NewGroupModal open categorias={categorias} onClose={onClose} onCreate={onCreate} />)
    await user.type(screen.getByLabelText(/nome do grupo/i), "Grãos")
    await user.selectOptions(screen.getByLabelText("Categoria"), "2")
    await user.click(screen.getByRole("button", { name: /criar grupo/i }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ nome: "Grãos", categoria: 2 }))
    expect(onClose).toHaveBeenCalled()
  })
})
