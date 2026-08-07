import { mockProdutos, mockGrupos, mockCategorias, mockFornecedores, mockMovimentacoes, mockEntradas, mockAlertas, mockRelatorios, mockOperacao } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes, httpFornecedores, httpMovimentacoes, httpEntradas, httpAlertas, httpRelatorios, httpOperacao } from "./http"
import { getConfig } from "../lib/config"
import { getRuntimeMode } from "../lib/runtimeMode"
import type { Alertas, Categoria, Fornecedor, Grupo, Movimentacao, Produto } from "./types"

const runtimeMode = getRuntimeMode((getConfig() as { useMock: boolean }).useMock)
const USE_MOCK = runtimeMode.useMock

type DashboardListApi<T> = { list: (...args: any[]) => Promise<T[]> }
type AlertasApi = { list: (params?: Record<string, string | number | null | undefined>) => Promise<Alertas> }

export const produtosApi = (USE_MOCK ? mockProdutos : httpProdutos) as typeof httpProdutos & DashboardListApi<Produto>
export const gruposApi = (USE_MOCK ? mockGrupos : httpGrupos) as typeof httpGrupos & DashboardListApi<Grupo>
export const categoriasApi = (USE_MOCK ? mockCategorias : httpCategorias) as typeof httpCategorias & DashboardListApi<Categoria>
export const fornecedoresApi = (USE_MOCK ? mockFornecedores : httpFornecedores) as typeof httpFornecedores & DashboardListApi<Fornecedor>
export const movimentacoesApi = (USE_MOCK ? mockMovimentacoes : httpMovimentacoes) as typeof httpMovimentacoes & DashboardListApi<Movimentacao>
export const entradasApi = USE_MOCK ? mockEntradas : httpEntradas
export const alertasApi = (USE_MOCK ? mockAlertas : httpAlertas) as AlertasApi
export const relatoriosApi = USE_MOCK ? mockRelatorios : httpRelatorios
export const operacaoApi = USE_MOCK ? mockOperacao : httpOperacao
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
