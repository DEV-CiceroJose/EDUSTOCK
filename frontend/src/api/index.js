import { mockProdutos, mockCategorias } from "./mock"
import { httpProdutos, httpCategorias } from "./http"

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const isMock = USE_MOCK
