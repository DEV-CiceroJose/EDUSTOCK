import { beforeEach, describe, expect, it, vi } from "vitest"
import { createOfflineQueue } from "@edustock/operacao-shared"

describe("fila offline", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("respeita Retry-After do HTTP 429", async () => {
    const queue = createOfflineQueue({
      storageKey: "fila",
      send: vi.fn().mockRejectedValue(Object.assign(new Error("limite"), {
        status: 429,
        retryAfterMs: 120_000,
      })),
      now: () => 1_000,
    })
    queue.add({ operacao_id: "operacao-1" })

    await queue.flush()

    expect(queue.list()[0]).toMatchObject({ status: "pending", retryAt: 121_000 })
  })

  it.each([429, 500, 503])("mantém HTTP %s como pendente", async (status) => {
    const queue = createOfflineQueue({ storageKey: "fila", send: async () => {
      const error = new Error("falhou")
      error.status = status
      throw error
    }})
    queue.add({ operacao_id: crypto.randomUUID(), quantidade_alunos: 20 })
    await queue.flush()
    expect(queue.list()).toHaveLength(1)
    expect(queue.list()[0].status).toBe("pending")
  })

  it.each([400, 404, 409, 422])("marca HTTP %s para atenção", async (status) => {
    const queue = createOfflineQueue({ storageKey: "fila", send: async () => {
      const error = new Error("rejeitado")
      error.status = status
      throw error
    }})
    queue.add({ operacao_id: crypto.randomUUID(), quantidade_alunos: 20 })
    await queue.flush()
    expect(queue.list()).toHaveLength(1)
    expect(queue.list()[0].status).toBe("attention")
  })
})
