import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Modal from "./Modal"

describe("Modal acessível", () => {
  it("expõe semântica de diálogo e fecha com Escape", async () => {
    const fechar = vi.fn()
    render(
      <Modal open onClose={fechar} title="Editar produto" subtitle="Dados">
        <button type="button">Salvar</button>
      </Modal>
    )

    const dialogo = screen.getByRole("dialog", { name: "Editar produto" })
    expect(dialogo).toHaveAttribute("aria-modal", "true")
    await waitFor(() => expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus())

    fireEvent.keyDown(document, { key: "Escape" })
    expect(fechar).toHaveBeenCalledTimes(1)
  })

  it("mantém o foco dentro do diálogo ao usar Tab", async () => {
    render(
      <Modal open onClose={() => {}} title="Confirmação">
        <button type="button">Primeiro</button>
        <button type="button">Último</button>
      </Modal>
    )

    const ultimo = screen.getByText("Último")
    const fechar = screen.getByRole("button", { name: "Fechar" })
    await waitFor(() => expect(fechar).toHaveFocus())
    ultimo.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(fechar).toHaveFocus()
  })
})
