export type Id = number
export type Unidade = "UN" | "KG" | "L" | "CX" | "PC"
export type Periodicidade = "SEMANAL" | "MENSAL" | "EVENTUAL"
export type MovimentoTipo = "ENTRADA" | "SAIDA"
export type Urgencia = "critico" | "alerta"

export type DashboardStageStatus = "SEM_REGISTRO" | "AGUARDANDO_BAIXA" | "CONCLUIDA" | "PARCIAL"
export type DashboardActionCode = "TURMAS_PENDENTES" | "REFEICAO_PENDENTE" | "ESTOQUE_CRITICO" | "DIVERGENCIA_ESTOQUE"
export type DashboardActionPriority = "alta" | "media" | "baixa"

export interface DashboardSchool {
  id: Id
  nome: string
}

export interface DashboardPresence {
  total_alunos: number
  turmas_registradas: number
  turmas_esperadas: number
  media_historica: number
  variacao_pct: number | null
}

export interface DashboardMealStage {
  refeicao: string
  rotulo: string
  status: DashboardStageStatus
}

export interface DashboardMeals {
  previstas: number
  produzidas: number
  servidas: number
  descarte_kg: string
  etapas: DashboardMealStage[]
}

export interface DashboardStock {
  itens: number
  adequados: number
  atencao: number
  criticos: number
  vencidos: number
  proximos_vencimento: number
}

export interface DashboardAction {
  codigo: DashboardActionCode
  prioridade: DashboardActionPriority
  titulo: string
  descricao: string
  href: string
}

export interface DashboardTrendPoint {
  data: string
  planejadas: number
  produzidas: number
  servidas: number
}

export interface DashboardActivity {
  id: Id
  acao: string
  recurso: string
  ator: string
  criado_em: string
}

export interface DashboardOperacional {
  data: string
  escola: DashboardSchool
  modulos: string[]
  presenca: DashboardPresence | null
  refeicoes: DashboardMeals | null
  estoque: DashboardStock | null
  proximas_acoes: DashboardAction[]
  tendencia: DashboardTrendPoint[]
  atividade_recente: DashboardActivity[]
  atualizado_em: string
}

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
