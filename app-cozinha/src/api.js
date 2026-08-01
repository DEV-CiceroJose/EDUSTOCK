/**
 * Cliente de domínio do app-cozinha. Transporte, autenticação do header e
 * política de retry ficam no pacote compartilhado dos apps operacionais.
 */

import { createOperacaoHttpClient } from "@edustock/operacao-shared"

const OPERACOES_PENDENTES_KEY = "cozinha_operacoes_pendentes"
const http = createOperacaoHttpClient({
  baseUrl: import.meta.env.VITE_API_BASE ?? "",
  tokenKey: "cozinha_token",
})

export async function login(pin) {
  const data = await http.request("POST", "/api/operacao/auth/", {
    pin,
    perfil: "COZINHA",
  })

  if (!data?.token || data?.perfil !== "COZINHA") {
    throw new Error("Não foi possível iniciar uma sessão válida para a cozinha.")
  }

  http.setToken(data.token)
  return data
}

export function limparSessao() {
  http.clearToken()
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

function lerOperacoesPendentes() {
  try {
    return JSON.parse(sessionStorage.getItem(OPERACOES_PENDENTES_KEY) ?? "{}")
  } catch {
    sessionStorage.removeItem(OPERACOES_PENDENTES_KEY)
    return {}
  }
}

function chaveOperacao(data, turno) {
  return `${data}:${turno}`
}

export function obterOperacaoPendente(data, turno) {
  const operacoes = lerOperacoesPendentes()
  const chave = chaveOperacao(data, turno)
  if (!operacoes[chave]) {
    operacoes[chave] = globalThis.crypto.randomUUID()
    sessionStorage.setItem(OPERACOES_PENDENTES_KEY, JSON.stringify(operacoes))
  }
  return operacoes[chave]
}

export function concluirOperacaoPendente(data, turno, operacaoId) {
  const operacoes = lerOperacoesPendentes()
  const chave = chaveOperacao(data, turno)
  if (operacoes[chave] !== operacaoId) return
  delete operacoes[chave]
  sessionStorage.setItem(OPERACOES_PENDENTES_KEY, JSON.stringify(operacoes))
}

export async function getPlano(data, turno) {
  return http.request(
    "GET",
    `/api/operacao/plano-do-dia/?data=${data}&turno=${turno}`,
    undefined,
    { retry: true },
  )
}

export async function baixaProducao(data, turno, itens, operacaoId = obterOperacaoPendente(data, turno)) {
  const body = { data, turno, operacao_id: operacaoId }
  if (itens) body.itens = itens
  return http.request(
    "POST",
    "/api/operacao/baixa-de-producao/",
    body,
    { retry: false },
  )
}

export async function consultarBaixa(operacaoId) {
  return http.request(
    "GET",
    `/api/operacao/baixa-de-producao/?operacao_id=${encodeURIComponent(operacaoId)}`,
    undefined,
    { retry: true },
  )
}
