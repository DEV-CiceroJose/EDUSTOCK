const TOKEN_KEY = "edustock:auth:token"
const PAPEL_KEY = "edustock:auth:papel"
const MODULOS_KEY = "edustock:auth:modulos"

export function salvarSessao({ token, papel, modulos_ativos }) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(PAPEL_KEY, papel)
  sessionStorage.setItem(MODULOS_KEY, JSON.stringify(modulos_ativos))
}

export function limparSessao() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PAPEL_KEY)
  sessionStorage.removeItem(MODULOS_KEY)
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getPapel() {
  return sessionStorage.getItem(PAPEL_KEY)
}

export function getModulosAtivos() {
  const raw = sessionStorage.getItem(MODULOS_KEY)
  return raw ? JSON.parse(raw) : []
}

export function estaAutenticado() {
  return Boolean(getToken())
}

export function ehAdmin() {
  return getPapel() === "ADMIN"
}
