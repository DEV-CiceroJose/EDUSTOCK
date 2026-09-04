const TOKEN_KEY = "edustock:auth:token"
const PAPEL_KEY = "edustock:auth:papel"
const MODULOS_KEY = "edustock:auth:modulos"
const IS_STAFF_KEY = "edustock:auth:is_staff"
const USERNAME_KEY = "edustock:auth:username"
const NOME_KEY = "edustock:auth:nome"
const PAPEL_REDE_KEY = "edustock:auth:papel_rede"
const ESCOLA_KEY = "edustock:auth:escola"
const ESCOLAS_KEY = "edustock:auth:escolas"
const MUNICIPIO_KEY = "edustock:auth:municipio"
const SESSAO_EXPIRADA_KEY = "edustock:auth:expirada"

export function salvarSessao({ token, papel, is_staff, username, nome, modulos_ativos, papel_rede, escola, escolas, municipio }) {
  sessionStorage.removeItem(SESSAO_EXPIRADA_KEY)
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(PAPEL_KEY, papel)
  sessionStorage.setItem(IS_STAFF_KEY, String(Boolean(is_staff)))
  sessionStorage.setItem(USERNAME_KEY, username ?? "")
  sessionStorage.setItem(NOME_KEY, nome ?? "")
  sessionStorage.setItem(MODULOS_KEY, JSON.stringify(modulos_ativos))
  sessionStorage.setItem(PAPEL_REDE_KEY, papel_rede ?? "")
  sessionStorage.setItem(ESCOLA_KEY, JSON.stringify(escola ?? null))
  sessionStorage.setItem(ESCOLAS_KEY, JSON.stringify(escolas ?? []))
  sessionStorage.setItem(MUNICIPIO_KEY, JSON.stringify(municipio ?? null))
}

export function limparSessao() {
  sessionStorage.removeItem(SESSAO_EXPIRADA_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PAPEL_KEY)
  sessionStorage.removeItem(IS_STAFF_KEY)
  sessionStorage.removeItem(USERNAME_KEY)
  sessionStorage.removeItem(NOME_KEY)
  sessionStorage.removeItem(MODULOS_KEY)
  sessionStorage.removeItem(PAPEL_REDE_KEY)
  sessionStorage.removeItem(ESCOLA_KEY)
  sessionStorage.removeItem(ESCOLAS_KEY)
  sessionStorage.removeItem(MUNICIPIO_KEY)
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
  return getPapel() === "ADMIN" || sessionStorage.getItem(PAPEL_REDE_KEY) === "GESTOR_REDE"
}

export function marcarSessaoExpirada() {
  limparSessao()
  sessionStorage.setItem(SESSAO_EXPIRADA_KEY, "true")
}

export function sessaoFoiExpirada() {
  return sessionStorage.getItem(SESSAO_EXPIRADA_KEY) === "true"
}

export async function encerrarSessao() {
  const token = getToken()
  limparSessao()
  if (!token) return
  try {
    const base = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
    await fetch(`${base}/auth/logout/`, {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // A sessão local já foi encerrada, inclusive se a API estiver indisponível.
  }
}

export function podeVerRede() {
  return ["GESTOR_REDE", "NUTRICIONISTA"].includes(sessionStorage.getItem(PAPEL_REDE_KEY))
}

export function getEscolas() {
  try { return JSON.parse(sessionStorage.getItem(ESCOLAS_KEY) || "[]") } catch { return [] }
}

export function getEscola() {
  try { return JSON.parse(sessionStorage.getItem(ESCOLA_KEY) || "null") } catch { return null }
}

export function atualizarEscola(escola) {
  sessionStorage.setItem(ESCOLA_KEY, JSON.stringify(escola))
}

export function podeGerenciarCadastros() {
  return sessionStorage.getItem(IS_STAFF_KEY) === "true" || ehAdmin()
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
