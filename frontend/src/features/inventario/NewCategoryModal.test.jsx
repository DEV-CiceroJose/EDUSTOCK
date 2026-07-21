import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import NewCategoryModal from "./NewCategoryModal"

afterEach(cleanup)

describe("NewCategoryModal", () => {
  it("não renderiza nada quando open é false", () => {
    render(<NewCategoryModal open={false} onClose={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.queryByText("Nova categoria")).not.toBeInTheDocument()
  })

  it("botão Criar categoria começa desabilitado e habilita ao digitar", async () => {
    const user = userEvent.setup()
    render(<NewCategoryModal open onClose={vi.fn()} onCreate={vi.fn()} />)
    const botao = screen.getByRole("button", { name: /criar categoria/i })
    expect(botao).toBeDisabled()
    await user.type(screen.getByLabelText(/nome da categoria/i), "Higiene")
    expect(botao).toBeEnabled()
  })

  it("chama onCreate com o nome digitado e depois onClose", async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<NewCategoryModal open onClose={onClose} onCreate={onCreate} />)
    await user.type(screen.getByLabelText(/nome da categoria/i), "Higiene")
    await user.click(screen.getByRole("button", { name: /criar categoria/i }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Higiene"))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
