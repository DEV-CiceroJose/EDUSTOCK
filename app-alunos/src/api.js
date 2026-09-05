/**
 * Cliente de domínio do app-alunos. Transporte, autenticação do header e
 * política de retry ficam no pacote compartilhado dos apps operacionais.
 */

import { createOfflineQueue, createOperacaoHttpClient } from "@edustock/operacao-shared"

const SESSION_KEY = "operacao_sessao"
const http = createOperacaoHttpClient({
  baseUrl: import.meta.env.VITE_API_BASE ?? "",
  tokenKey: "operacao_token",
})
export const filaContagens = createOfflineQueue({
  storageKey: "edustock:alunos:fila-contagens",
  send: (body) => {
    const { _turma, _escola_id, ...payload } = body
    if (getSessao()?.turma !== _turma || getSessao()?.escola?.id !== _escola_id) {
      const error = new Error("Aguardando a sessão da turma que criou este registro.")
      error.status = 401
      error.offlineClassification = "attention"
      throw error
    }
    return http.request("POST", "/api/operacao/contagem/", payload, { retry: false })
  },
})

export async function login(pin) {
  const escola = import.meta.env.VITE_ESCOLA_CODIGO
  const data = await http.request("POST", "/api/operacao/auth/", {
    pin,
    perfil: "ALUNO_REP",
    ...(escola ? { escola } : {}),
  })

  if (
    !data?.token
    || !data?.turma
    || data?.turno !== "INTEGRAL"
    || data?.perfil !== "ALUNO_REP"
  ) {
    throw new Error("Não foi possível iniciar uma sessão válida para esta turma.")
  }

  http.setToken(data.token)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    turma: data.turma,
    turno: data.turno,
    perfil: data.perfil,
    escola: data.escola,
  }))
  void sincronizarContagensPendentes()
  return data
}

export function limparSessao() {
  http.clearToken()
  sessionStorage.removeItem(SESSION_KEY)
}

export async function logout() {
  const invalidacao = http.getToken()
    ? http.request("DELETE", "/api/operacao/auth/logout/").catch(() => null)
    : Promise.resolve(null)

  limparSessao()
  await invalidacao
}

export function getSessao() {
  try {
    const sessao = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null")
    const sessaoValida = (
      http.isLoggedIn()
      && sessao?.perfil === "ALUNO_REP"
      && Boolean(sessao?.turma)
      && sessao?.turno === "INTEGRAL"
    )

    if (!sessaoValida) {
      limparSessao()
      return null
    }

    return sessao
  } catch {
    limparSessao()
    return null
  }
}

export async function registrarContagem(quantidade_alunos, data) {
  const body = { quantidade_alunos, operacao_id: globalThis.crypto.randomUUID() }
  if (data) body.data = data
  try {
    return await http.request("POST", "/api/operacao/contagem/", body, { retry: true })
  } catch (error) {
    if (error.status) throw error
    filaContagens.add({
      ...body,
      _turma: getSessao()?.turma,
      _escola_id: getSessao()?.escola?.id,
    })
    return { ...body, pendente: true }
  }
}

export const sincronizarContagensPendentes = () => filaContagens.flush()

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void sincronizarContagensPendentes())
}

export async function getStatusDoDia(data) {
  const query = data ? `?data=${encodeURIComponent(data)}` : ""
  return http.request("GET", `/api/operacao/status-do-dia/${query}`)
}
