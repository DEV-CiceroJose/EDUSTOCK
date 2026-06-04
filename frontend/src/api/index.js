import { mockProdutos, mockGrupos, mockCategorias, mockFornecedores, mockMovimentacoes, mockEntradas } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes, httpFornecedores, httpMovimentacoes, httpEntradas } from "./http"

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const gruposApi = USE_MOCK ? mockGrupos : httpGrupos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const fornecedoresApi = USE_MOCK ? mockFornecedores : httpFornecedores
export const movimentacoesApi = USE_MOCK ? mockMovimentacoes : httpMovimentacoes
export const entradasApi = USE_MOCK ? mockEntradas : httpEntradas
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
