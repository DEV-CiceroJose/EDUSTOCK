import { mockProdutos, mockGrupos, mockCategorias, mockFornecedores, mockMovimentacoes, mockEntradas, mockAlertas, mockRelatorios, mockOperacao } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes, httpFornecedores, httpMovimentacoes, httpEntradas, httpAlertas, httpRelatorios, httpOperacao } from "./http"
import { getConfig } from "../lib/config"

const USE_MOCK = getConfig().useMock

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const gruposApi = USE_MOCK ? mockGrupos : httpGrupos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const fornecedoresApi = USE_MOCK ? mockFornecedores : httpFornecedores
export const movimentacoesApi = USE_MOCK ? mockMovimentacoes : httpMovimentacoes
export const entradasApi = USE_MOCK ? mockEntradas : httpEntradas
export const alertasApi = USE_MOCK ? mockAlertas : httpAlertas
export const relatoriosApi = USE_MOCK ? mockRelatorios : httpRelatorios
export const operacaoApi = USE_MOCK ? mockOperacao : httpOperacao
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
