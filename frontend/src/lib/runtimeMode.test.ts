import { afterEach, describe, expect, it, vi } from "vitest"
import { getRuntimeMode, resolveRuntimeMode } from "./runtimeMode"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("resolveRuntimeMode", () => {
  it("ignora mock solicitado em produção", () => {
    expect(resolveRuntimeMode({ production: true, demo: true, requestedMock: true }))
      .toEqual({ useMock: false, demo: true })
  })

  it("permite mock somente fora de produção", () => {
    expect(resolveRuntimeMode({ production: false, demo: false, requestedMock: true }).useMock)
      .toBe(true)
  })

  it("centraliza as variáveis de ambiente no modo de execução", () => {
    vi.stubEnv("PROD", true)
    vi.stubEnv("VITE_DEMO_MODE", "true")

    expect(getRuntimeMode(true)).toEqual({ useMock: false, demo: true })
  })
})
