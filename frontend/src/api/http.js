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

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
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

export const httpProdutos = {
  list: (q) => req(`/produtos/${q ? `?search=${encodeURIComponent(q)}` : ""}`),
  get: (id) => req(`/produtos/${id}/`),
  create: (data) => req(`/produtos/`, { method: "POST", body: data }),
  update: (id, data) => req(`/produtos/${id}/`, { method: "PATCH", body: data }),
  remove: (id) => req(`/produtos/${id}/`, { method: "DELETE" }),
}

export const httpCategorias = {
  list: () => req(`/categorias/`),
  create: (data) => req(`/categorias/`, { method: "POST", body: data }),
  remove: (id) => req(`/categorias/${id}/`, { method: "DELETE" }),
}

export const httpGrupos = {
  list: () => req(`/grupos/`),
  create: (data) => req(`/grupos/`, { method: "POST", body: data }),
  remove: (id) => req(`/grupos/${id}/`, { method: "DELETE" }),
}

export const httpBensPermanentes = {
  list: () => req(`/bens-permanentes/`),
  create: (data) => req(`/bens-permanentes/`, { method: "POST", body: data }),
  update: (id, data) => req(`/bens-permanentes/${id}/`, { method: "PATCH", body: data }),
  remove: (id) => req(`/bens-permanentes/${id}/`, { method: "DELETE" }),
}

export const httpFornecedores = {
  list: () => req(`/fornecedores/`),
  create: (data) => req(`/fornecedores/`, { method: "POST", body: data }),
  update: (id, data) => req(`/fornecedores/${id}/`, { method: "PATCH", body: data }),
  remove: (id) => req(`/fornecedores/${id}/`, { method: "DELETE" }),
}

export const httpMovimentacoes = {
  list: (qs = "") => req(`/movimentacoes/${qs ? `?${qs}` : ""}`),
  create: (data) => req(`/movimentacoes/`, { method: "POST", body: data }),
}

export const httpEntradas = {
  list: () => req(`/entradas/`),
  create: (data) => req(`/entradas/`, { method: "POST", body: data }),
}
