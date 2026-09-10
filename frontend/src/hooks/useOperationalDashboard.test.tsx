import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { dashboardApi } from "../api"
import type { DashboardOperacional } from "../api/types"
import { useOperationalDashboard } from "./useOperationalDashboard"

vi.mock("../api", () => ({
  dashboardApi: { get: vi.fn() },
}))

const dashboard = {
  data: "2026-09-08",
  escola: { id: 1, nome: "Escola Demonstrativa" },
  modulos: ["merenda"],
  presenca: null,
  refeicoes: null,
  estoque: null,
  proximas_acoes: [],
  tendencia: [],
  atividade_recente: [],
  atualizado_em: "2026-09-08T09:42:00-03:00",
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

describe("useOperationalDashboard", () => {
  beforeEach(() => vi.clearAllMocks())

  it("starts loading and exposes the resolved dashboard data", async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue(dashboard)

    const { result } = renderHook(() => useOperationalDashboard("2026-09-08"))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data?.data).toBe("2026-09-08")
    expect(result.current.error).toBeNull()
    expect(dashboardApi.get).toHaveBeenCalledWith("2026-09-08")
  })

  it("exposes an error and recovers when reload succeeds", async () => {
    const failure = new Error("Falha temporária")
    vi.mocked(dashboardApi.get)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(dashboard)

    const { result } = renderHook(() => useOperationalDashboard("2026-09-08"))

    await waitFor(() => expect(result.current.error).toBe(failure))
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()

    act(() => result.current.reload())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data?.data).toBe("2026-09-08"))

    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(dashboardApi.get).toHaveBeenCalledTimes(2)
  })

  it("preserva os dados anteriores quando uma atualização falha", async () => {
    const failure = new Error("Falha temporária")
    vi.mocked(dashboardApi.get)
      .mockResolvedValueOnce(dashboard)
      .mockRejectedValueOnce(failure)

    const { result } = renderHook(() => useOperationalDashboard("2026-09-08"))
    await waitFor(() => expect(result.current.data).toEqual(dashboard))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.error).toBe(failure))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual(dashboard)
  })

  it("ignores a response from the previous data after rerender", async () => {
    const anterior = deferred<DashboardOperacional>()
    const atual = deferred<DashboardOperacional>()
    vi.mocked(dashboardApi.get)
      .mockReturnValueOnce(anterior.promise)
      .mockReturnValueOnce(atual.promise)

    const { result, rerender } = renderHook(
      ({ data }) => useOperationalDashboard(data),
      { initialProps: { data: "2026-09-08" } },
    )
    rerender({ data: "2026-09-09" })

    await act(async () => {
      anterior.resolve({ ...dashboard, data: "2026-09-08" })
      await anterior.promise
    })
    expect(result.current.data).toBeNull()

    await act(async () => {
      atual.resolve({ ...dashboard, data: "2026-09-09" })
      await atual.promise
    })
    expect(result.current.data?.data).toBe("2026-09-09")
  })

  it("ignores a response that arrives after desmontagem", async () => {
    const pendente = deferred<DashboardOperacional>()
    vi.mocked(dashboardApi.get).mockReturnValueOnce(pendente.promise)

    const { result, unmount } = renderHook(() => useOperationalDashboard("2026-09-08"))
    unmount()

    await act(async () => {
      pendente.resolve(dashboard)
      await pendente.promise
    })
    expect(result.current.data).toBeNull()
  })
})
