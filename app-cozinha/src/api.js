/**
 * Cliente de domínio do app-cozinha. Transporte, autenticação do header e
 * política de retry ficam no pacote compartilhado dos apps operacionais.
 */

import { createOfflineQueue, createOperacaoHttpClient } from "@edustock/operacao-shared"

const OPERACOES_PENDENTES_KEY = "cozinha_operacoes_pendentes"
const SESSION_KEY = "cozinha_sessao"
const http = createOperacaoHttpClient({
  baseUrl: import.meta.env.VITE_API_BASE ?? "",
  tokenKey: "cozinha_token",
})
const filaBaixas = createOfflineQueue({
  storageKey: "edustock:cozinha:fila-baixas",
  send: (body) => {
    const { _escola_id, ...payload } = body
    if (getSessao()?.escola?.id !== _escola_id) {
      const error = new Error("Aguardando a sessão da escola que criou esta baixa.")
      error.status = 401
      throw error
    }
    return http.request("POST", "/api/operacao/baixa-de-producao/", payload, { retry: false })
  },
})

export async function login(pin) {
  const escola = import.meta.env.VITE_ESCOLA_CODIGO
  const data = await http.request("POST", "/api/operacao/auth/", {
    pin,
    perfil: "COZINHA",
    ...(escola ? { escola } : {}),
  })

  if (!data?.token || data?.perfil !== "COZINHA") {
    throw new Error("Não foi possível iniciar uma sessão válida para a cozinha.")
  }

  http.setToken(data.token)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ perfil: data.perfil, escola: data.escola }))
  void sincronizarBaixasPendentes()
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

export function isLoggedIn() {
  return http.isLoggedIn()
}

export function getSessao() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") } catch { return null }
}

function lerOperacoesPendentes() {
  try {
    return JSON.parse(sessionStorage.getItem(OPERACOES_PENDENTES_KEY) ?? "{}")
  } catch {
    sessionStorage.removeItem(OPERACOES_PENDENTES_KEY)
    return {}
  }
}

function chaveOperacao(data, refeicao) {
  return `${data}:${refeicao}`
}

export function obterOperacaoPendente(data, refeicao) {
  const operacoes = lerOperacoesPendentes()
  const chave = chaveOperacao(data, refeicao)
  if (!operacoes[chave]) {
    operacoes[chave] = globalThis.crypto.randomUUID()
    sessionStorage.setItem(OPERACOES_PENDENTES_KEY, JSON.stringify(operacoes))
  }
  return operacoes[chave]
}

export function concluirOperacaoPendente(data, refeicao, operacaoId) {
  const operacoes = lerOperacoesPendentes()
  const chave = chaveOperacao(data, refeicao)
  if (operacoes[chave] !== operacaoId) return
  delete operacoes[chave]
  sessionStorage.setItem(OPERACOES_PENDENTES_KEY, JSON.stringify(operacoes))
}

export async function getPlano(data, refeicao) {
  return http.request(
    "GET",
    `/api/operacao/plano-do-dia/?data=${data}&refeicao=${refeicao}`,
    undefined,
    { retry: true },
  )
}

export async function getStatusDoDia(data) {
  return http.request(
    "GET",
    `/api/operacao/status-do-dia/?data=${encodeURIComponent(data)}`,
    undefined,
    { retry: true },
  )
}

export async function baixaProducao(data, refeicao, itens, operacaoId = obterOperacaoPendente(data, refeicao)) {
  const body = { data, refeicao, operacao_id: operacaoId }
  if (itens) body.itens = itens
  try {
    return await http.request("POST", "/api/operacao/baixa-de-producao/", body, { retry: false })
  } catch (error) {
    if (!error.status) {
      filaBaixas.add({ ...body, _escola_id: getSessao()?.escola?.id })
      error.enfileirada = true
    }
    throw error
  }
}

export const sincronizarBaixasPendentes = () => filaBaixas.flush()

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void sincronizarBaixasPendentes())
}

export async function consultarBaixa(operacaoId) {
  return http.request(
    "GET",
    `/api/operacao/baixa-de-producao/?operacao_id=${encodeURIComponent(operacaoId)}`,
    undefined,
    { retry: true },
  )
}
