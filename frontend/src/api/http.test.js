import { afterEach, describe, expect, it, vi } from "vitest"
import { httpProdutos } from "./http"

function resposta(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  }
}

describe("cliente HTTP paginado", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("reúne todas as páginas sem mudar o contrato de lista do frontend", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resposta({
        results: [{ id: 1, nome: "Arroz" }],
        next: "http://localhost:8000/api/produtos/?page=2&page_size=500",
      }))
      .mockResolvedValueOnce(resposta({
        results: [{ id: 2, nome: "Feijão" }],
        next: null,
      }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(httpProdutos.list()).resolves.toEqual([
      { id: 1, nome: "Arroz" },
      { id: 2, nome: "Feijão" },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain("/produtos/?page_size=500")
  })
})
