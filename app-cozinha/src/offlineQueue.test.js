import { beforeEach, describe, expect, it } from "vitest"
import { createOfflineQueue } from "@edustock/operacao-shared"

describe("fila offline", () => {
  beforeEach(() => {
    localStorage.clear()
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
