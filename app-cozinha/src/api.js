/**
 * api.js — cliente HTTP do app-cozinha
 *
 * Todos os pedidos vão para /api/operacao/*
 * Nunca expõe preços, fornecedores ou relatórios financeiros.
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''

function token() {
  return sessionStorage.getItem('cozinha_token') ?? ''
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const BACKOFF_MS = [500, 1500]

/**
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 * @param {{ retry?: boolean }} [opts] — retry: reenvia até 2x em falha de rede/timeout.
 *   Nunca reenvia por causa de uma resposta HTTP de erro (4xx/5xx), só quando o
 *   fetch falha antes de obter resposta (rede caiu, timeout).
 */
async function req(method, path, body, opts = {}) {
  const { retry = false } = opts
  const headers = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers['X-Operacao-Token'] = t

  const tentativasTotais = retry ? BACKOFF_MS.length + 1 : 1

  let ultimoErroDeRede = null
  for (let tentativa = 0; tentativa < tentativasTotais; tentativa++) {
    if (tentativa > 0) await esperar(BACKOFF_MS[tentativa - 1])

    let res
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      })
    } catch (e) {
      ultimoErroDeRede = e
      continue // falha de rede/timeout: tenta de novo se ainda houver tentativas
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const err = new Error(data.detail ?? `HTTP ${res.status}`)
      err.status = res.status
      err.data = data
      throw err // erro de aplicação: nunca reenviar
    }

    if (res.status === 204) return null
    return res.json()
  }

  throw ultimoErroDeRede
}

/**
 * Login com PIN da cozinha.
 */
export async function login(pin) {
  const data = await req('POST', '/api/operacao/auth/', {
    pin,
    perfil: 'COZINHA',
  })
  sessionStorage.setItem('cozinha_token', data.token)
  return data
}

export function logout() {
  sessionStorage.removeItem('cozinha_token')
}

export function isLoggedIn() {
  return !!token()
}

/**
 * Retorna o plano de produção do dia para o turno informado.
 * GET é sempre seguro para retry — não tem efeito colateral.
 */
export async function getPlano(data, turno) {
  return req('GET', `/api/operacao/plano-do-dia/?data=${data}&turno=${turno}`, undefined, { retry: true })
}

/**
 * Executa a baixa de produção: registra saídas de estoque para cada item.
 *
 * retry: false explícito — core/operacao.py:baixa_de_producao cria uma
 * Movimentacao de saída a cada chamada, sem deduplicação. Reenviar
 * automaticamente depois de uma falha de rede arrisca debitar o estoque
 * duas vezes, então esta chamada NUNCA reenvia sozinha.
 */
export async function baixaProducao(data, turno, itens) {
  const body = { data, turno }
  if (itens) body.itens = itens
  return req('POST', '/api/operacao/baixa-de-producao/', body, { retry: false })
}
