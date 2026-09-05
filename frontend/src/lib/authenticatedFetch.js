import { getToken, marcarSessaoExpirada } from "./auth"

export const SESSION_EXPIRED_EVENT = "edustock:session-expired"

export async function fetchAutenticado(url, options = {}) {
  const authorization = new Headers(options.headers).get("Authorization")
  const response = await fetch(url, options)
  if (response.status === 401 && authorization && authorization === `Token ${getToken()}`) {
    marcarSessaoExpirada()
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    throw new Error("Sua sessão expirou. Entre novamente.")
  }
  return response
}
