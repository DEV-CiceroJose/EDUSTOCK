/**
 * Cliente de domínio do app-alunos. Transporte, autenticação do header e
 * política de retry ficam no pacote compartilhado dos apps operacionais.
 */

import { createOperacaoHttpClient } from "@edustock/operacao-shared"

const SESSION_KEY = "operacao_sessao"
const http = createOperacaoHttpClient({
  baseUrl: import.meta.env.VITE_API_BASE ?? "",
  tokenKey: "operacao_token",
})

export async function login(pin) {
  const data = await http.request("POST", "/api/operacao/auth/", {
    pin,
    perfil: "ALUNO_REP",
  })
  http.setToken(data.token)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    turma: data.turma,
    turno: data.turno,
    perfil: data.perfil,
  }))
  return data
}

export function logout() {
  http.clearToken()
  sessionStorage.removeItem(SESSION_KEY)
}

export function getSessao() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null")
  } catch {
    return null
  }
}

export async function registrarContagem(quantidade_alunos, data) {
  const body = { quantidade_alunos }
  if (data) body.data = data
  return http.request(
    "POST",
    "/api/operacao/contagem/",
    body,
    { retry: true },
  )
}
