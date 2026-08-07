import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  baixaProducao,
  concluirOperacaoPendente,
  consultarBaixa,
  getPlano,
  login,
  logout,
  obterOperacaoPendente,
} from './api.js'

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
    localStorage.clear()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('getPlano tenta de novo depois de uma falha de rede e retorna no sucesso', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respostaJson(200, { itens: [] }))
    global.fetch = fetchMock

    const resultado = await getPlano('2026-07-17', 'ALMOCO')

    expect(resultado).toEqual({ itens: [] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 10000)

  it('baixaProducao NUNCA tenta de novo depois de uma falha de rede', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    global.fetch = fetchMock

    await expect(
      baixaProducao(
        '2026-07-17',
        'ALMOCO',
        undefined,
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toThrow(
      'Sem conexão com o sistema. Verifique a internet e tente novamente.',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preserva uma baixa em fila local quando a rede está indisponível', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(baixaProducao(
      '2026-07-17',
      'ALMOCO',
      undefined,
      '11111111-1111-4111-8111-111111111111',
    )).rejects.toMatchObject({ enfileirada: true })

    const fila = JSON.parse(localStorage.getItem('edustock:cozinha:fila-baixas'))
    expect(fila).toMatchObject({ version: 1 })
    expect(fila.entries).toHaveLength(1)
    expect(fila.entries[0].payload).toMatchObject({ refeicao: 'ALMOCO' })
  })

  it('erro HTTP de aplicação (4xx) nunca é reenviado, mesmo em endpoint com retry:true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(403, { detail: 'Módulo inativo' }))
    global.fetch = fetchMock

    await expect(getPlano('2026-07-17', 'ALMOCO')).rejects.toThrow('Módulo inativo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('preserva o mesmo identificador até a operação ser concluída', () => {
    const primeira = obterOperacaoPendente('2026-07-17', 'ALMOCO')
    const segunda = obterOperacaoPendente('2026-07-17', 'ALMOCO')

    expect(segunda).toBe(primeira)

    concluirOperacaoPendente('2026-07-17', 'ALMOCO', primeira)
    expect(obterOperacaoPendente('2026-07-17', 'ALMOCO')).not.toBe(primeira)
  })

  it('envia o identificador no payload e permite consultar o resultado', async () => {
    const operacaoId = '11111111-1111-4111-8111-111111111111'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respostaJson(200, { operacao_id: operacaoId, sucesso: 1 }))
      .mockResolvedValueOnce(respostaJson(200, { operacao_id: operacaoId, consultada: true }))
    global.fetch = fetchMock

    await baixaProducao('2026-07-17', 'ALMOCO', undefined, operacaoId)
    await consultarBaixa(operacaoId)

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      data: '2026-07-17',
      refeicao: 'ALMOCO',
      operacao_id: operacaoId,
    })
    expect(fetchMock.mock.calls[1][0]).toContain(`operacao_id=${operacaoId}`)
  })

  it('só salva uma sessão de cozinha com resposta completa', async () => {
    global.fetch = vi.fn().mockResolvedValue(respostaJson(200, {
      token: 'token-cozinha',
      perfil: 'COZINHA',
    }))

    await login('4321')

    expect(sessionStorage.getItem('cozinha_token')).toBe('token-cozinha')
  })

  it('invalida o token no servidor e limpa a sessão local ao sair', async () => {
    sessionStorage.setItem('cozinha_token', 'token-cozinha')
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(204, null))
    global.fetch = fetchMock

    await logout()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/operacao/auth/logout/',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-Operacao-Token': 'token-cozinha' }),
      }),
    )
    expect(sessionStorage.getItem('cozinha_token')).toBeNull()
  })
})
