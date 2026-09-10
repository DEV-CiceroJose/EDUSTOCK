import { Icon } from "../../lib/icons"

const numero = new Intl.NumberFormat("pt-BR")

function SummaryCard({ label, value, detail, icon, attention = false }) {
  return (
    <article className={`card-flat min-h-32 p-5 ${attention ? "border-accent/35 bg-accent-tint/45" : ""}`}>
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[.08em] ${attention ? "text-accent" : "text-ink-faint"}`}>
        <span aria-hidden="true">{icon}</span>
        {label}
      </div>
      <strong className={`mt-3 block font-display text-3xl font-bold ${attention ? "text-accent" : "text-brand-dark"}`}>
        {value}
      </strong>
      <p className="mt-1 text-xs text-ink-soft">{detail}</p>
    </article>
  )
}

export default function OperationalSummaryCards({ presenca, refeicoes, estoque }) {
  if (!presenca && !refeicoes && !estoque) return null
  const progresso = refeicoes?.previstas > 0
    ? `${Math.round((refeicoes.produzidas / refeicoes.previstas) * 100)}%`
    : null
  const itensAtencao = estoque ? estoque.atencao + estoque.criticos : null

  return (
    <section aria-label="Resumo operacional" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {presenca && (
        <SummaryCard
          label="Presenças"
          value={numero.format(presenca.total_alunos)}
          detail={`${presenca.turmas_registradas} de ${presenca.turmas_esperadas} turmas`}
          icon={Icon.presence(18)}
        />
      )}
      {refeicoes && (
        <SummaryCard
          label="Refeições previstas"
          value={numero.format(refeicoes.previstas)}
          detail={`${numero.format(refeicoes.produzidas)} produzidas · ${numero.format(refeicoes.servidas)} servidas`}
          icon={Icon.food(18)}
        />
      )}
      {refeicoes && (
        <SummaryCard
          label="Produção"
          value={progresso ?? "Sem previsão"}
          detail={progresso ? "da previsão do dia já produzida" : "Registre a previsão para acompanhar"}
          icon={Icon.chart(18)}
        />
      )}
      {estoque && (
        <SummaryCard
          label="Precisa de atenção"
          value={numero.format(itensAtencao)}
          detail={`${estoque.vencidos} vencidos · ${estoque.proximos_vencimento} próximos do vencimento`}
          icon={Icon.alert(18)}
          attention
        />
      )}
    </section>
  )
}
