import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { httpDashboard, httpOperacao, httpProdutos } from "./http"
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

  it("consulta o resumo operacional com a data e o token atual", async () => {
    salvarSessao({ token: "token-atual", papel: "ADMIN", modulos_ativos: [] })
    const fetchMock = vi.fn().mockResolvedValue(resposta({ data: "2026-09-08" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(httpDashboard.get("2026-09-08")).resolves.toEqual({ data: "2026-09-08" })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/dashboard/operacao/?data=2026-09-08"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Token token-atual" }),
      }),
    )
  })

  it("consulta o plano de produção pela rota autenticada de gestão", async () => {
    salvarSessao({ token: "token-atual", papel: "ADMIN", modulos_ativos: ["merenda"] })
    const fetchMock = vi.fn().mockResolvedValue(resposta({ refeicao: "ALMOCO" }))
    vi.stubGlobal("fetch", fetchMock)

    await httpOperacao.planoDoDia({ data: "2026-09-10", refeicao: "ALMOCO" })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/merenda/plano-do-dia/?data=2026-09-10&refeicao=ALMOCO"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Token token-atual" }),
      }),
    )
  })

  it("registra a baixa pela rota autenticada de gestão", async () => {
    salvarSessao({ token: "token-atual", papel: "OPERADOR", modulos_ativos: ["merenda"] })
    const fetchMock = vi.fn().mockResolvedValue(resposta({ sucesso: 0, falhas: 0 }))
    vi.stubGlobal("fetch", fetchMock)
    const payload = {
      operacao_id: "85e82492-28d4-48a0-b4dc-a25cc8db4ebc",
      data: "2026-09-10",
      refeicao: "CAFE_MANHA",
    }

    await httpOperacao.baixaProducao(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/merenda/baixa-de-producao/"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.objectContaining({ Authorization: "Token token-atual" }),
      }),
    )
  })
})
