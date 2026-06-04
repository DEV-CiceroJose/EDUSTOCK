import { mockProdutos, mockGrupos, mockCategorias, mockFornecedores } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes, httpFornecedores } from "./http"

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const gruposApi = USE_MOCK ? mockGrupos : httpGrupos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const fornecedoresApi = USE_MOCK ? mockFornecedores : httpFornecedores
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
