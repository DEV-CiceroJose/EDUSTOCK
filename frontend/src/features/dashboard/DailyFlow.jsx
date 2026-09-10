import { Link } from "react-router-dom"
import { Icon } from "../../lib/icons"

const numero = new Intl.NumberFormat("pt-BR")

const STATUS_DA_ETAPA = {
  SEM_REGISTRO: { label: "Sem registro", tone: "pending" },
  AGUARDANDO_BAIXA: { label: "Aguardando baixa", tone: "current" },
  PARCIAL: { label: "Parcial", tone: "current" },
  CONCLUIDA: { label: "Concluída", tone: "done" },
}

function FlowMetric({ label, value, detail, icon }) {
  return (
    <li className="flex min-w-40 flex-1 items-start gap-3 lg:min-w-0">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white/70" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block text-[.68rem] font-bold uppercase tracking-wider text-white/55">{label}</span>
        <strong className="mt-1 block text-sm text-white">{value}</strong>
        <small className="mt-0.5 block text-xs text-white/60">{detail}</small>
      </span>
    </li>
  )
}

function StageStatus({ status }) {
  const state = STATUS_DA_ETAPA[status]
  if (!state) return null
  const toneClass = state.tone === "done"
    ? "bg-brand-tint text-brand"
    : state.tone === "current"
      ? "bg-accent-tint text-accent"
      : "bg-white/10 text-white/70"

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[.62rem] font-bold ${toneClass}`}>
      <span aria-hidden="true">
        {state.tone === "done" ? Icon.check(12) : state.tone === "current" ? Icon.clock(12) : "·"}
      </span>
      {state.label}
    </span>
  )
}

function MealStages({ stages }) {
  return (
    <li className="min-w-52 flex-[1.35] lg:min-w-0">
      <span className="block text-[.68rem] font-bold uppercase tracking-wider text-white/55">Baixa FEFO</span>
      {stages.length === 0 ? (
        <p className="mt-2 text-xs text-white/60">Nenhuma etapa informada.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {stages.map((stage) => (
            <li key={stage.refeicao} className="flex items-center justify-between gap-2 text-xs text-white/85">
              <span>{stage.rotulo}</span>
              <StageStatus status={stage.status} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function DailyFlow({ presenca, refeicoes }) {
  if (!presenca || !refeicoes) return null
  return (
    <section aria-label="Fluxo do dia" className="overflow-hidden rounded-2xl bg-brand-dark px-5 py-5 text-white shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[.68rem] font-bold uppercase tracking-[.14em] text-brand-300">Fluxo do dia</span>
          <h2 id="daily-flow-title" className="mt-1 font-display text-lg font-bold">Da presença à baixa do estoque</h2>
        </div>
        <Link to="/merenda?view=producao" className="btn btn-accent">
          Abrir plano da merenda {Icon.chevronR(16)}
        </Link>
      </div>
      <ol className="mt-6 flex gap-4 overflow-x-auto pb-2 lg:gap-6">
        <FlowMetric
          label="Presença"
          value={`${numero.format(presenca.total_alunos)} alunos registrados`}
          detail={`${presenca.turmas_registradas} de ${presenca.turmas_esperadas} turmas`}
          icon={Icon.presence(16)}
        />
        <FlowMetric
          label="Planejamento"
          value={`${numero.format(refeicoes.previstas)} refeições previstas`}
          detail={`Descarte: ${refeicoes.descarte_kg} kg`}
          icon={Icon.report(16)}
        />
        <FlowMetric
          label="Produção"
          value={`${numero.format(refeicoes.produzidas)} produzidas · ${numero.format(refeicoes.servidas)} servidas`}
          detail="Porções do resumo operacional"
          icon={Icon.food(16)}
        />
        <MealStages stages={refeicoes.etapas} />
      </ol>
    </section>
  )
}
