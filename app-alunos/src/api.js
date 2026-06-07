/**
 * api.js — cliente HTTP do app-alunos
 *
 * Todos os pedidos vão para /api/operacao/*
 * O token de sessão é lido de sessionStorage e enviado no header
 * X-Operacao-Token (nunca no Authorization, que é do painel admin).
 *
 * Nenhuma função aqui expõe preços, fornecedores ou relatórios.
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''

function token() {
  return sessionStorage.getItem('operacao_token') ?? ''
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

  // 204 No Content não tem corpo
  if (res.status === 204) return null
  return res.json()
}

/**
 * Login via PIN — troca PIN+perfil por token de sessão.
 * @param {string} pin  — 4 dígitos
 * @param {string} turma — identificador da turma (ex.: "6A")
 * @param {string} turno — "MANHA" | "TARDE" | "INTEGRAL"
 * @returns {{ token, perfil, turma, turno }}
 */
export async function login(pin, turma, turno) {
  const data = await req('POST', '/api/operacao/auth/', {
    pin,
    perfil: 'ALUNO_REP',
  })
  // Salva o token e os dados da sessão
  sessionStorage.setItem('operacao_token', data.token)
  sessionStorage.setItem('operacao_sessao', JSON.stringify({
    turma: data.turma || turma,
    turno: data.turno || turno,
    perfil: data.perfil,
  }))
  return data
}

export function logout() {
  sessionStorage.removeItem('operacao_token')
  sessionStorage.removeItem('operacao_sessao')
}

export function getSessao() {
  try {
    return JSON.parse(sessionStorage.getItem('operacao_sessao') ?? 'null')
  } catch {
    return null
  }
}

/**
 * Registra a frequência de hoje para a turma autenticada.
 * @param {number} quantidade_alunos
 * @param {string?} data — YYYY-MM-DD (omitir = hoje)
 * @returns {{ id, data, turno, turma, quantidade_alunos, previsao }}
 */
export async function registrarContagem(quantidade_alunos, data) {
  const body = { quantidade_alunos }
  if (data) body.data = data
  return req('POST', '/api/operacao/contagem/', body)
}
