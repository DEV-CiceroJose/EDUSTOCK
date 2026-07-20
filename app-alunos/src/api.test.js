import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { login, registrarContagem } from './api.js'

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

  it('registrarContagem tenta de novo depois de uma falha de rede e retorna no sucesso', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respostaJson(200, { id: 1, quantidade_alunos: 30 }))
    global.fetch = fetchMock

    const resultado = await registrarContagem(30)

    expect(resultado).toEqual({ id: 1, quantidade_alunos: 30 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 10000)

  it('login NUNCA tenta de novo depois de uma falha de rede', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    global.fetch = fetchMock

    await expect(login('1234')).rejects.toThrow('Failed to fetch')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('erro HTTP de aplicação (409) nunca é reenviado, mesmo em endpoint com retry:true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(409, { detail: 'Frequência já registrada hoje.' }))
    global.fetch = fetchMock

    await expect(registrarContagem(30)).rejects.toThrow('Frequência já registrada hoje.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
