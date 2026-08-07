import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ConfiguracoesPage from "./ConfiguracoesPage"

const { getRuntimeMode } = vi.hoisted(() => ({ getRuntimeMode: vi.fn() }))

vi.mock("../lib/runtimeMode", () => ({ getRuntimeMode }))

afterEach(() => {
  getRuntimeMode.mockReset()
  vi.unstubAllEnvs()
})

describe("ConfiguraçõesPage", () => {
  it("não mostra o controle de dados mock no modo de produção resolvido", () => {
    getRuntimeMode.mockReturnValue({ useMock: false, demo: true })

    render(<ConfiguracoesPage />)

    expect(screen.queryByRole("switch", { name: "Usar dados mock" })).not.toBeInTheDocument()
  })
})
