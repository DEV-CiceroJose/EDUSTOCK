const TOKEN_KEY = "edustock:auth:token"
const PAPEL_KEY = "edustock:auth:papel"
const MODULOS_KEY = "edustock:auth:modulos"
const IS_STAFF_KEY = "edustock:auth:is_staff"
const USERNAME_KEY = "edustock:auth:username"
const NOME_KEY = "edustock:auth:nome"

export function salvarSessao({ token, papel, is_staff, username, nome, modulos_ativos }) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(PAPEL_KEY, papel)
  sessionStorage.setItem(IS_STAFF_KEY, String(Boolean(is_staff)))
  sessionStorage.setItem(USERNAME_KEY, username ?? "")
  sessionStorage.setItem(NOME_KEY, nome ?? "")
  sessionStorage.setItem(MODULOS_KEY, JSON.stringify(modulos_ativos))
}

export function limparSessao() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PAPEL_KEY)
  sessionStorage.removeItem(IS_STAFF_KEY)
  sessionStorage.removeItem(USERNAME_KEY)
  sessionStorage.removeItem(NOME_KEY)
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
  return sessionStorage.getItem(IS_STAFF_KEY) === "true"
}

export function podeGerenciarCadastros() {
  return ehAdmin() || getPapel() === "ADMIN"
}

export function getUsername() {
  return sessionStorage.getItem(USERNAME_KEY)
}

export function getNome() {
  return sessionStorage.getItem(NOME_KEY)
}

export function atualizarNome(novoNome) {
  sessionStorage.setItem(NOME_KEY, novoNome)
}
