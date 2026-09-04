import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { httpProdutos } from "./http"
import { getToken, salvarSessao } from "../lib/auth"

function resposta(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  }
}

describe("cliente HTTP paginado", () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it("encerra uma sessão rejeitada pela API", async () => {
    salvarSessao({ token: "expirado", papel: "ADMIN", modulos_ativos: [] })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: "Token expirado." }) }))
    await expect(httpProdutos.list()).rejects.toThrow()
    expect(getToken()).toBeNull()
  })

  it("preserva a sessão ao receber falta de permissão", async () => {
    salvarSessao({ token: "valido", papel: "OPERADOR", modulos_ativos: [] })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ detail: "Sem permissão." }) }))
    await expect(httpProdutos.list()).rejects.toThrow()
    expect(getToken()).toBe("valido")
  })

  it("uma resposta atrasada não encerra um novo login", async () => {
    salvarSessao({ token: "antigo", papel: "ADMIN", modulos_ativos: [] })
    let responder
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(resolve => { responder = resolve })))
    const consulta = httpProdutos.list()
    salvarSessao({ token: "novo", papel: "ADMIN", modulos_ativos: [] })
    responder({ ok: false, status: 401, json: async () => ({ detail: "Token expirado." }) })
    await expect(consulta).rejects.toThrow()
    expect(getToken()).toBe("novo")
  })

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
