import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { getSessao, login, logout, registrarContagem } from './api.js'

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

describe('api.js — ciclo de sessão', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('salva e recupera apenas uma sessão de representante completa', async () => {
    global.fetch = vi.fn().mockResolvedValue(respostaJson(200, {
      token: 'token-valido',
      turma: '6A',
      turno: 'MANHA',
      perfil: 'ALUNO_REP',
    }))

    await login('1234')

    expect(getSessao()).toEqual({ turma: '6A', turno: 'MANHA', perfil: 'ALUNO_REP' })
    expect(sessionStorage.getItem('operacao_token')).toBe('token-valido')
  })

  it('descarta metadados antigos quando o token não existe', () => {
    sessionStorage.setItem('operacao_sessao', JSON.stringify({
      turma: '6A',
      turno: 'MANHA',
      perfil: 'ALUNO_REP',
    }))

    expect(getSessao()).toBeNull()
    expect(sessionStorage.getItem('operacao_sessao')).toBeNull()
  })

  it('invalida o token no servidor e limpa a sessão local ao sair', async () => {
    sessionStorage.setItem('operacao_token', 'token-valido')
    sessionStorage.setItem('operacao_sessao', JSON.stringify({
      turma: '6A',
      turno: 'MANHA',
      perfil: 'ALUNO_REP',
    }))
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(204, null))
    global.fetch = fetchMock

    await logout()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/operacao/auth/logout/',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-Operacao-Token': 'token-valido' }),
      }),
    )
    expect(sessionStorage.getItem('operacao_token')).toBeNull()
    expect(sessionStorage.getItem('operacao_sessao')).toBeNull()
  })
})
