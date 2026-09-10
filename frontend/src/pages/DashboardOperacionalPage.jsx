import { getNome, getUsername } from "../lib/auth"
import { useOperationalDashboard } from "../hooks/useOperationalDashboard"
import OperationalSummaryCards from "../features/dashboard/OperationalSummaryCards"
import DailyFlow from "../features/dashboard/DailyFlow"
import NextActions from "../features/dashboard/NextActions"
import ProductionTrend from "../features/dashboard/ProductionTrend"
import StockHealth from "../features/dashboard/StockHealth"
import RecentActivity from "../features/dashboard/RecentActivity"
import {
  DashboardEmptyState,
  DashboardSectionError,
  DashboardSkeleton,
} from "../features/dashboard/DashboardStates"

const dataCompleta = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})
const horario = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })

function semDadosOperacionais(dashboard) {
  const semPresenca = !dashboard.presenca || (
    dashboard.presenca.total_alunos === 0 && dashboard.presenca.turmas_registradas === 0
  )
  const semRefeicoes = !dashboard.refeicoes || (
    dashboard.refeicoes.previstas === 0
    && dashboard.refeicoes.produzidas === 0
    && dashboard.refeicoes.servidas === 0
  )
  const semEstoque = !dashboard.estoque || dashboard.estoque.itens === 0
  const semTendencia = dashboard.tendencia.every((ponto) => (
    ponto.planejadas === 0 && ponto.produzidas === 0 && ponto.servidas === 0
  ))
  return semPresenca
    && semRefeicoes
    && semEstoque
    && dashboard.proximas_acoes.length === 0
    && semTendencia
    && dashboard.atividade_recente.length === 0
}

export default function DashboardOperacionalPage() {
  const { data: dashboard, loading, error, reload } = useOperationalDashboard()
  const nome = getNome()?.trim() || getUsername()?.trim() || "usuário"
  const primeiroNome = nome.split(/\s+/)[0]

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.14em] text-accent">Operação do dia</span>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">
            Bom dia, {primeiroNome}.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            Acompanhe o que aconteceu hoje, o que precisa de atenção e qual é a próxima ação.
          </p>
        </div>
        {dashboard && (
          <div className="text-right text-xs text-ink-faint">
            <p className="capitalize">{dataCompleta.format(new Date(`${dashboard.data}T12:00:00Z`))}</p>
            <p className="mt-1">Atualizado às {horario.format(new Date(dashboard.atualizado_em))}</p>
          </div>
        )}
      </header>

      {loading && !dashboard ? (
        <DashboardSkeleton />
      ) : error && !dashboard ? (
        <DashboardSectionError onRetry={reload} />
      ) : dashboard ? (
        <div className="space-y-5">
          {error && <DashboardSectionError onRetry={reload} partial />}
          {semDadosOperacionais(dashboard) ? (
            <DashboardEmptyState modulos={dashboard.modulos} />
          ) : (
            <>
              <OperationalSummaryCards
                presenca={dashboard.presenca}
                refeicoes={dashboard.refeicoes}
                estoque={dashboard.estoque}
              />
              {dashboard.modulos.includes("merenda") && (
                <DailyFlow presenca={dashboard.presenca} refeicoes={dashboard.refeicoes} />
              )}
              <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
                <div className="lg:order-2">
                  <NextActions actions={dashboard.proximas_acoes} modules={dashboard.modulos} />
                </div>
                <div className="lg:order-1">
                  <ProductionTrend points={dashboard.tendencia} />
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <StockHealth stock={dashboard.estoque} modules={dashboard.modulos} />
                <RecentActivity activities={dashboard.atividade_recente} />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
