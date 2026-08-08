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
import type {
  Alertas,
  Categoria,
  Fornecedor,
  Grupo,
  Id,
  Movimentacao,
  Produto,
} from "./types"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
}

type PaginatedResponse<T> = {
  results: T[]
  next: string | null
}

async function req<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
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
  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

async function reqList<T>(path: string): Promise<T[]> {
  const separator = path.includes("?") ? "&" : "?"
  let page = await req<T[] | PaginatedResponse<T>>(`${path}${separator}page_size=500`)
  if (Array.isArray(page)) return page

  const items = [...page.results]
  while (page.next) {
    page = await req<PaginatedResponse<T>>(page.next)
    items.push(...page.results)
  }
  return items
}

async function reqRecent<T>(path: string, pageSize = 100): Promise<T[]> {
  const separator = path.includes("?") ? "&" : "?"
  const page = await req<T[] | PaginatedResponse<T>>(`${path}${separator}page_size=${pageSize}`)
  return Array.isArray(page) ? page : page.results
}

export const httpProdutos = {
  list: (q?: string) => reqList<Produto>(`/produtos/${q ? `?search=${encodeURIComponent(q)}` : ""}`),
  get: (id: Id) => req<Produto>(`/produtos/${id}/`),
  create: (data: Record<string, unknown>) => req<Produto>(`/produtos/`, { method: "POST", body: data }),
  update: (id: Id, data: Record<string, unknown>) => req<Produto>(`/produtos/${id}/`, { method: "PATCH", body: data }),
  remove: (id: Id) => req<null>(`/produtos/${id}/`, { method: "DELETE" }),
}

export const httpCategorias = {
  list: () => reqList<Categoria>(`/categorias/`),
  create: (data: Record<string, unknown>) => req<Categoria>(`/categorias/`, { method: "POST", body: data }),
  remove: (id: Id) => req<null>(`/categorias/${id}/`, { method: "DELETE" }),
}

export const httpGrupos = {
  list: () => reqList<Grupo>(`/grupos/`),
  create: (data: Record<string, unknown>) => req<Grupo>(`/grupos/`, { method: "POST", body: data }),
  remove: (id: Id) => req<null>(`/grupos/${id}/`, { method: "DELETE" }),
}

export const httpBensPermanentes = {
  list: () => reqList<Record<string, unknown>>(`/bens-permanentes/`),
  create: (data: Record<string, unknown>) => req<Record<string, unknown>>(`/bens-permanentes/`, { method: "POST", body: data }),
  update: (id: Id, data: Record<string, unknown>) => req<Record<string, unknown>>(`/bens-permanentes/${id}/`, { method: "PATCH", body: data }),
  remove: (id: Id) => req<null>(`/bens-permanentes/${id}/`, { method: "DELETE" }),
}

export const httpFornecedores = {
  list: () => reqList<Fornecedor>(`/fornecedores/`),
  create: (data: Record<string, unknown>) => req<Fornecedor>(`/fornecedores/`, { method: "POST", body: data }),
  update: (id: Id, data: Record<string, unknown>) => req<Fornecedor>(`/fornecedores/${id}/`, { method: "PATCH", body: data }),
  remove: (id: Id) => req<null>(`/fornecedores/${id}/`, { method: "DELETE" }),
}

export const httpMovimentacoes = {
  list: (qs = "") => reqRecent<Movimentacao>(`/movimentacoes/${qs ? `?${qs}` : ""}`),
  create: (data: Record<string, unknown>) => req<Movimentacao>(`/movimentacoes/`, { method: "POST", body: data }),
  estornar: (id: Id, motivo: string) => req<Movimentacao>(`/movimentacoes/${id}/estornar/`, { method: "POST", body: { motivo } }),
}

export const httpEntradas = {
  list: () => reqList<Record<string, unknown>>(`/entradas/`),
  create: (data: Record<string, unknown>) => req<Record<string, unknown>>(`/entradas/`, { method: "POST", body: data }),
}

export const httpAlertas = {
  list: (params: Record<string, string | number | null | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v != null && v !== "")
        .map(([key, value]) => [key, String(value)])
    ).toString()
    return req<Alertas>(`/alertas/${qs ? `?${qs}` : ""}`)
  },
}

export const httpRelatorios = {
  prestacaoContas: ({ inicio, fim }: { inicio: string; fim: string }) =>
    req<Record<string, unknown>>(`/relatorios/prestacao-contas/?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`),
}

export const httpOperacao = {
  registrarContagem: (data: Record<string, unknown>) =>
    req<Record<string, unknown>>(`/operacao/contagem/`, { method: "POST", body: data }),
  resumo: (data?: string) =>
    req<Record<string, unknown>>(`/operacao/resumo/${data ? `?data=${encodeURIComponent(data)}` : ""}`),
  planoDoDia: ({ data, turno }: { data?: string; turno: string }) => {
    const qs = new URLSearchParams({ turno })
    if (data) qs.set("data", data)
    return req<Record<string, unknown>>(`/operacao/plano-do-dia/?${qs}`)
  },
  baixaProducao: (data: Record<string, unknown>) =>
    req<Record<string, unknown>>(`/operacao/baixa-de-producao/`, { method: "POST", body: data }),
}
