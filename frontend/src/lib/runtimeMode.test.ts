import { describe, expect, it } from "vitest"
import { resolveRuntimeMode } from "./runtimeMode"

describe("resolveRuntimeMode", () => {
  it("ignora mock solicitado em produção", () => {
    expect(resolveRuntimeMode({ production: true, demo: true, requestedMock: true }))
      .toEqual({ useMock: false, demo: true })
  })

  it("permite mock somente fora de produção", () => {
    expect(resolveRuntimeMode({ production: false, demo: false, requestedMock: true }).useMock)
      .toBe(true)
  })
})
