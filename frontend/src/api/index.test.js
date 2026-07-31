import { beforeEach, describe, expect, it, vi } from "vitest"

describe("seleção da fonte de dados", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it("usa API real por padrão", async () => {
    const api = await import("./index")
    expect(api.isMock).toBe(false)
  })

  it("usa dados mock quando a preferência está ativa", async () => {
    localStorage.setItem(
      "edustock:config",
      JSON.stringify({
        useMock: true,
        validityAlertDays: 30,
        cardDensity: "confortavel",
      })
    )
    const api = await import("./index")
    expect(api.isMock).toBe(true)
  })
})
