import { Link } from "react-router-dom"
import { Icon } from "../../lib/icons"

const numero = new Intl.NumberFormat("pt-BR")

function situacaoPresenca(presenca) {
  if (!presenca || presenca.turmas_registradas === 0) return ["Pendente", "Sem registro", "pending"]
  if (presenca.turmas_registradas < presenca.turmas_esperadas) {
    return ["Em andamento", `${presenca.turmas_registradas} de ${presenca.turmas_esperadas} turmas`, "current"]
  }
  return ["Concluída", `${numero.format(presenca.total_alunos)} alunos`, "done"]
}

function situacaoPlanejamento(refeicoes) {
  if (!refeicoes || refeicoes.previstas === 0) return ["Pendente", "Sem previsão", "pending"]
  return ["Concluído", `${numero.format(refeicoes.previstas)} previstas`, "done"]
}

function situacaoProducao(refeicoes) {
  if (!refeicoes || refeicoes.produzidas === 0) return ["Aguardando", "Sem produção", "pending"]
  if (refeicoes.previstas > 0 && refeicoes.produzidas < refeicoes.previstas) {
    return ["Em andamento", `${numero.format(refeicoes.produzidas)} produzidas`, "current"]
  }
  return ["Concluída", `${numero.format(refeicoes.produzidas)} produzidas`, "done"]
}

function situacaoBaixa(refeicoes) {
  const etapas = refeicoes?.etapas ?? []
  const concluidas = etapas.filter((etapa) => etapa.status === "CONCLUIDA").length
  if (etapas.length > 0 && concluidas === etapas.length) return ["Concluída", `${concluidas} refeições`, "done"]
  if (concluidas > 0) return ["Em andamento", `${concluidas} de ${etapas.length} refeições`, "current"]
  return ["Aguardando", "Baixa pendente", "pending"]
}

function FlowStep({ label, status }) {
  const [title, detail, tone] = status
  const toneClass = tone === "done"
    ? "border-brand-300/40 bg-brand-tint text-brand"
    : tone === "current"
      ? "border-accent/35 bg-accent-tint text-accent"
      : "border-white/15 bg-white/5 text-white/60"

  return (
    <li className="flex min-w-36 flex-1 items-start gap-3 lg:min-w-0">
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${toneClass}`} aria-hidden="true">
        {tone === "done" ? Icon.check(16) : tone === "current" ? Icon.clock(16) : "·"}
      </span>
      <span>
        <span className="block text-[.68rem] font-bold uppercase tracking-wider text-white/55">{label}</span>
        <strong className="mt-1 block text-sm text-white">{title}</strong>
        <small className="mt-0.5 block text-xs text-white/60">{detail}</small>
      </span>
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
        <Link to="/merenda" className="btn btn-accent">
          Abrir plano da merenda {Icon.chevronR(16)}
        </Link>
      </div>
      <ol className="mt-6 flex gap-4 overflow-x-auto pb-2 lg:gap-6">
        <FlowStep label="Presença" status={situacaoPresenca(presenca)} />
        <FlowStep label="Planejamento" status={situacaoPlanejamento(refeicoes)} />
        <FlowStep label="Produção" status={situacaoProducao(refeicoes)} />
        <FlowStep label="Baixa FEFO" status={situacaoBaixa(refeicoes)} />
      </ol>
    </section>
  )
}
