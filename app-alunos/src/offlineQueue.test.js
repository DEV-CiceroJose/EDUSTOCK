import { beforeEach, describe, expect, it, vi } from "vitest"
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

  it("persiste entradas versionadas e envia somente o payload", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true })
    const queue = createOfflineQueue({ storageKey: "fila", send, now: () => 1000 })
    const payload = { operacao_id: "operacao-1", quantidade_alunos: 20 }

    queue.add(payload)

    expect(queue.list()).toEqual([{
      id: "operacao-1",
      payload,
      status: "pending",
      attempts: 0,
      createdAt: 1000,
      retryAt: null,
      lastError: null,
    }])
    expect(JSON.parse(localStorage.getItem("fila"))).toMatchObject({ version: 1 })

    await queue.flush()

    expect(send).toHaveBeenCalledWith(payload)
    expect(queue.list()).toEqual([])
  })

  it("pausa após erro de autenticação e preserva a fila como pendente", async () => {
    const send = vi.fn(async () => {
      const error = new Error("sessão expirada")
      error.status = 401
      throw error
    })
    const queue = createOfflineQueue({ storageKey: "fila", send })
    queue.add({ operacao_id: "operacao-1" })
    queue.add({ operacao_id: "operacao-2" })

    await queue.flush()

    expect(send).toHaveBeenCalledTimes(1)
    expect(queue.list()).toHaveLength(2)
    expect(queue.list()[0]).toMatchObject({ status: "pending", attempts: 1, lastError: "sessão expirada" })
    expect(queue.list()[1]).toMatchObject({ status: "pending", attempts: 0 })
  })

  it("notifica alterações e permite repetir ou remover entradas", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("rejeitado"), { status: 422 }))
      .mockResolvedValueOnce({ ok: true })
    const queue = createOfflineQueue({ storageKey: "fila", send })
    const listener = vi.fn()
    const unsubscribe = queue.subscribe(listener)

    queue.add({ operacao_id: "operacao-1" })
    await queue.flush()
    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "operacao-1", status: "attention" }),
    ])

    await queue.retry()
    expect(queue.list()).toEqual([])

    queue.add({ operacao_id: "operacao-2" })
    queue.remove("operacao-2")
    expect(queue.list()).toEqual([])

    unsubscribe()
    queue.clear()
    expect(listener).toHaveBeenCalledTimes(6)
  })

  it("preserva entradas adicionadas enquanto um envio está em andamento", async () => {
    let concluirEnvio
    const send = vi.fn(() => new Promise((resolve) => { concluirEnvio = resolve }))
    const queue = createOfflineQueue({ storageKey: "fila", send })
    queue.add({ operacao_id: "operacao-1" })

    const flush = queue.flush()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    queue.add({ operacao_id: "operacao-2" })
    concluirEnvio({ ok: true })
    await flush

    expect(queue.list().map((entry) => entry.id)).toEqual(["operacao-2"])
  })

  it("não envia uma entrada removida enquanto outro envio está em andamento", async () => {
    let concluirEnvio
    const send = vi.fn((payload) => (
      payload.operacao_id === "operacao-1"
        ? new Promise((resolve) => { concluirEnvio = resolve })
        : Promise.resolve({ ok: true })
    ))
    const queue = createOfflineQueue({ storageKey: "fila", send })
    queue.add({ operacao_id: "operacao-1" })
    queue.add({ operacao_id: "operacao-2" })

    const flush = queue.flush()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    queue.remove("operacao-2")
    concluirEnvio({ ok: true })
    await flush

    expect(send).toHaveBeenCalledTimes(1)
    expect(queue.list()).toEqual([])
  })

  it("compartilha o envio em andamento entre flushes simultâneos", async () => {
    let concluirEnvio
    const send = vi.fn(() => new Promise((resolve) => { concluirEnvio = resolve }))
    const queue = createOfflineQueue({ storageKey: "fila", send })
    queue.add({ operacao_id: "operacao-1" })

    const primeiro = queue.flush()
    const segundo = queue.flush()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    concluirEnvio({ ok: true })
    await Promise.all([primeiro, segundo])

    expect(send).toHaveBeenCalledTimes(1)
    expect(queue.list()).toEqual([])
  })

  it("agenda uma nova passagem quando retry ocorre durante um flush", async () => {
    let rejeitarPrimeiroEnvio
    const send = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve, reject) => {
        rejeitarPrimeiroEnvio = reject
      }))
      .mockResolvedValueOnce({ ok: true })
    const queue = createOfflineQueue({ storageKey: "fila", send })
    queue.add({ operacao_id: "operacao-1" })

    const flush = queue.flush()
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    const retry = queue.retry()
    rejeitarPrimeiroEnvio(Object.assign(new Error("sessão expirada"), { status: 401 }))
    await Promise.all([flush, retry])

    expect(send).toHaveBeenCalledTimes(2)
    expect(queue.list()).toEqual([])
  })
})
