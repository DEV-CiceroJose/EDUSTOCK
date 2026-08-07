import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ConfiguracoesPage from "./ConfiguracoesPage"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("ConfiguraçõesPage", () => {
  it("não mostra o controle de dados mock em produção", () => {
    vi.stubEnv("PROD", true)

    render(<ConfiguracoesPage />)

    expect(screen.queryByRole("switch", { name: "Usar dados mock" })).not.toBeInTheDocument()
  })
})
