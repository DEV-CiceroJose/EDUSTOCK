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

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers['X-Operacao-Token'] = t

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.detail ?? `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }

  if (res.status === 204) return null
  return res.json()
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
 * @param {string} data   — YYYY-MM-DD
 * @param {string} turno  — MANHA | TARDE | INTEGRAL
 */
export async function getPlano(data, turno) {
  return req('GET', `/api/operacao/plano-do-dia/?data=${data}&turno=${turno}`)
}

/**
 * Executa a baixa de produção: registra saídas de estoque para cada item.
 * @param {string} data
 * @param {string} turno
 * @param {Array?} itens — lista de overrides [{ produto_id, quantidade }]
 */
export async function baixaProducao(data, turno, itens) {
  const body = { data, turno }
  if (itens) body.itens = itens
  return req('POST', '/api/operacao/baixa-de-producao/', body)
}
