import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { getPlano, baixaProducao } from './api.js'

const originalFetch = global.fetch

function respostaJson(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

describe('api.js — retry de rede', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('getPlano tenta de novo depois de uma falha de rede e retorna no sucesso', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respostaJson(200, { itens: [] }))
    global.fetch = fetchMock

    const resultado = await getPlano('2026-07-17', 'MANHA')

    expect(resultado).toEqual({ itens: [] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 10000)

  it('baixaProducao NUNCA tenta de novo depois de uma falha de rede', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    global.fetch = fetchMock

    await expect(baixaProducao('2026-07-17', 'MANHA')).rejects.toThrow('Failed to fetch')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('erro HTTP de aplicação (4xx) nunca é reenviado, mesmo em endpoint com retry:true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(403, { detail: 'Módulo inativo' }))
    global.fetch = fetchMock

    await expect(getPlano('2026-07-17', 'MANHA')).rejects.toThrow('Módulo inativo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
