/* ------------------------------------------------------------------
   Cliente HTTP para a API REST real do Django (DRF).
   Ativado quando VITE_USE_MOCK=false.
   Contrato esperado dos endpoints (ViewSets DRF):
     GET    /api/produtos/?search=
     POST   /api/produtos/
     GET    /api/produtos/:id/
     PATCH  /api/produtos/:id/
     DELETE /api/produtos/:id/
     ...idem /api/categorias/
------------------------------------------------------------------ */

import { getToken } from "../lib/auth"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

async function req(path, { method = "GET", body } = {}) {
  const token = getToken()
  const url = /^https?:\/\//.test(path) ? path : `${BASE}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail
    try { detail = await res.json() } catch { detail = res.statusText }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail))
  }
  if (res.status === 204) return null
  return res.json()
}

async function reqList(path) {
  const separator = path.includes("?") ? "&" : "?"
  let page = await req(`${path}${separator}page_size=500`)
  if (Array.isArray(page)) return page

  const items = [...(page.results ?? [])]
  while (page.next) {
    page = await req(page.next)
    items.push(...(page.results ?? []))
  }
  return items
}

export const httpProdutos = {
  list: (q) => reqList(`/produtos/${q ? `?search=${encodeURIComponent(q)}` : ""}`),
  get: (id) => req(`/produtos/${id}/`),
  create: (data) => req(`/produtos/`, { method: "POST", body: data }),
  update: (id, data) => req(`/produtos/${id}/`, { method: "PATCH", body: data }),
  remove: (id) => req(`/produtos/${id}/`, { method: "DELETE" }),
}

export const httpCategorias = {
  list: () => reqList(`/categorias/`),
  create: (data) => req(`/categorias/`, { method: "POST", body: data }),
  remove: (id) => req(`/categorias/${id}/`, { method: "DELETE" }),
}

export const httpGrupos = {
  list: () => reqList(`/grupos/`),
  create: (data) => req(`/grupos/`, { method: "POST", body: data }),
  remove: (id) => req(`/grupos/${id}/`, { method: "DELETE" }),
}

export const httpBensPermanentes = {
  list: () => reqList(`/bens-permanentes/`),
  create: (data) => req(`/bens-permanentes/`, { method: "POST", body: data }),
  update: (id, data) => req(`/bens-permanentes/${id}/`, { method: "PATCH", body: data }),
  remove: (id) => req(`/bens-permanentes/${id}/`, { method: "DELETE" }),
}

export const httpFornecedores = {
  list: () => reqList(`/fornecedores/`),
  create: (data) => req(`/fornecedores/`, { method: "POST", body: data }),
  update: (id, data) => req(`/fornecedores/${id}/`, { method: "PATCH", body: data }),
  remove: (id) => req(`/fornecedores/${id}/`, { method: "DELETE" }),
}

export const httpMovimentacoes = {
  list: (qs = "") => reqList(`/movimentacoes/${qs ? `?${qs}` : ""}`),
  create: (data) => req(`/movimentacoes/`, { method: "POST", body: data }),
}

export const httpEntradas = {
  list: () => reqList(`/entradas/`),
  create: (data) => req(`/entradas/`, { method: "POST", body: data }),
}

export const httpAlertas = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    ).toString()
    return req(`/alertas/${qs ? `?${qs}` : ""}`)
  },
}

export const httpRelatorios = {
  prestacaoContas: ({ inicio, fim }) =>
    req(`/relatorios/prestacao-contas/?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`),
}

export const httpOperacao = {
  registrarContagem: (data) =>
    req(`/operacao/contagem/`, { method: "POST", body: data }),
  resumo: (data) =>
    req(`/operacao/resumo/${data ? `?data=${encodeURIComponent(data)}` : ""}`),
  planoDoDia: ({ data, turno }) => {
    const qs = new URLSearchParams({ turno })
    if (data) qs.set("data", data)
    return req(`/operacao/plano-do-dia/?${qs}`)
  },
  baixaProducao: (data) =>
    req(`/operacao/baixa-de-producao/`, { method: "POST", body: data }),
}
