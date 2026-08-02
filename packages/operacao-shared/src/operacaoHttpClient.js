const DEFAULT_BACKOFF_MS = [500, 1500]
const NETWORK_ERROR_MESSAGE = "Sem conexão com o sistema. Verifique a internet e tente novamente."

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createOperacaoHttpClient({
  baseUrl = "",
  tokenKey,
  backoffMs = DEFAULT_BACKOFF_MS,
}) {
  if (!tokenKey) {
    throw new Error("tokenKey é obrigatório.")
  }

  const getToken = () => sessionStorage.getItem(tokenKey) ?? ""
  const setToken = (value) => sessionStorage.setItem(tokenKey, value)
  const clearToken = () => sessionStorage.removeItem(tokenKey)

  async function request(method, path, body, { retry = false } = {}) {
    const headers = { "Content-Type": "application/json" }
    const token = getToken()
    if (token) headers["X-Operacao-Token"] = token

    const totalTentativas = retry ? backoffMs.length + 1 : 1
    let ultimoErroDeRede = null

    for (let tentativa = 0; tentativa < totalTentativas; tentativa += 1) {
      if (tentativa > 0) await esperar(backoffMs[tentativa - 1])

      let response
      try {
        response = await fetch(`${baseUrl}${path}`, {
          method,
          headers,
          body: body == null ? undefined : JSON.stringify(body),
        })
      } catch (error) {
        ultimoErroDeRede = error
        continue
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const error = new Error(data.detail ?? `HTTP ${response.status}`)
        error.status = response.status
        error.data = data
        throw error
      }

      if (response.status === 204) return null
      return response.json()
    }

    const erroDeRede = new Error(NETWORK_ERROR_MESSAGE, {
      cause: ultimoErroDeRede,
    })
    erroDeRede.codigo = "erro_rede"
    erroDeRede.status = 0
    throw erroDeRede
  }

  return {
    request,
    getToken,
    setToken,
    clearToken,
    isLoggedIn: () => Boolean(getToken()),
  }
}
