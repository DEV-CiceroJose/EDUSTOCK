import { mockProdutos, mockGrupos, mockCategorias } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes } from "./http"

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const gruposApi = USE_MOCK ? mockGrupos : httpGrupos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
