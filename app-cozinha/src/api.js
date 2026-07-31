/**
 * Cliente de domínio do app-cozinha. Transporte, autenticação do header e
 * política de retry ficam no pacote compartilhado dos apps operacionais.
 */

import { createOperacaoHttpClient } from "@edustock/operacao-shared"

const http = createOperacaoHttpClient({
  baseUrl: import.meta.env.VITE_API_BASE ?? "",
  tokenKey: "cozinha_token",
})

export async function login(pin) {
  const data = await http.request("POST", "/api/operacao/auth/", {
    pin,
    perfil: "COZINHA",
  })
  http.setToken(data.token)
  return data
}

export function logout() {
  http.clearToken()
}

export function isLoggedIn() {
  return http.isLoggedIn()
}

export async function getPlano(data, turno) {
  return http.request(
    "GET",
    `/api/operacao/plano-do-dia/?data=${data}&turno=${turno}`,
    undefined,
    { retry: true },
  )
}

export async function baixaProducao(data, turno, itens) {
  const body = { data, turno }
  if (itens) body.itens = itens
  return http.request(
    "POST",
    "/api/operacao/baixa-de-producao/",
    body,
    { retry: false },
  )
}
