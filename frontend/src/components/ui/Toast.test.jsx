import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToastProvider } from "./Toast"

describe("ToastProvider", () => {
  it("expõe uma região viva para leitores de tela", () => {
    render(
      <ToastProvider>
        <div>Conteúdo</div>
      </ToastProvider>
    )
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
  })
})
