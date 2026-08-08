export type Id = number
export type Unidade = "UN" | "KG" | "L" | "CX" | "PC"
export type Periodicidade = "SEMANAL" | "MENSAL" | "EVENTUAL"
export type MovimentoTipo = "ENTRADA" | "SAIDA"
export type Urgencia = "critico" | "alerta"

export interface Categoria {
  id: Id
  name: string
}

export interface Grupo {
  id: Id
  nome: string
  categoria: Id
  categoria_nome: string
}

export interface Fornecedor {
  id: Id
  nome: string
  documento?: string
  ativo?: boolean
}

export interface Produto {
  id: Id
  nome: string
  grupo: Id
  grupo_nome?: string
  categoria?: Id
  categoria_nome?: string
  fornecedor?: Id | null
  fornecedor_nome?: string | null
  quantidade: string | number
  unidade: Unidade
  estoque_minimo: string | number
  perecivel: boolean
  periodicidade: Periodicidade
  validade?: string | null
  ultimo_preco?: string | null
}

export interface Movimentacao {
  id: Id
  produto: Id
  produto_nome: string
  tipo: MovimentoTipo
  quantidade: string | number
  preco_unitario?: string | null
  motivo?: string
  corrige_movimentacao?: Id | null
  estorno?: Id | null
  data: string
}

export interface AlertaItem {
  produto_id: Id
  nome: string
  motivo: string
  urgencia: Urgencia
}

export interface Alertas {
  resumo: {
    vencidos?: number
    esgotados?: number
    total_validade?: number
    total_estoque_critico?: number
  }
  validade: AlertaItem[]
  estoque_critico: AlertaItem[]
}

export interface ListApi<T> {
  list: (...args: never[]) => Promise<T[]>
}

export interface CrudApi<T> extends ListApi<T> {
  get?: (id: Id) => Promise<T>
  create: (data: Record<string, unknown>) => Promise<T>
  update?: (id: Id, data: Record<string, unknown>) => Promise<T>
  remove?: (id: Id) => Promise<null>
}
