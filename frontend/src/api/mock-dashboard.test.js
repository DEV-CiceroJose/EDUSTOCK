import { afterEach, describe, expect, it, vi } from "vitest"
import { mockDashboard } from "./mock"

describe("mock do dashboard operacional", () => {
  afterEach(() => vi.useRealTimers())

  it("mantém a data solicitada como o último ponto da tendência", async () => {
    vi.stubEnv("TZ", "Pacific/Kiritimati")
    vi.useFakeTimers()
    const consulta = mockDashboard.get("2026-09-08")
    vi.runAllTimers()
    const resultado = await consulta

    expect(resultado.data).toBe("2026-09-08")
    expect(resultado.tendencia.map((ponto) => ponto.data)).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
    ])
  })
})
