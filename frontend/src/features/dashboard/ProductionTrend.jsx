const numero = new Intl.NumberFormat("pt-BR")
const dia = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })

function total(points, field) {
  return points.reduce((sum, point) => sum + point[field], 0)
}

export default function ProductionTrend({ points = [] }) {
  if (points.length === 0) return null
  const planejadas = total(points, "planejadas")
  const produzidas = total(points, "produzidas")
  const servidas = total(points, "servidas")
  const teto = Math.max(1, ...points.flatMap((point) => [point.planejadas, point.produzidas, point.servidas]))

  return (
    <section aria-labelledby="production-trend-title" className="card-flat p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[.68rem] font-bold uppercase tracking-[.12em] text-brand-500">Últimos sete dias</span>
          <h2 id="production-trend-title" className="mt-1 font-display text-xl font-bold text-brand-dark">Produção e consumo</h2>
        </div>
        <div className="flex flex-wrap gap-3 text-[.7rem] text-ink-soft" aria-hidden="true">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand-300" />Planejado</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand" />Produzido</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent" />Servido</span>
        </div>
      </div>
      <p className="sr-only">
        Em 7 dias: {numero.format(planejadas)} planejadas, {numero.format(produzidas)} produzidas e {numero.format(servidas)} servidas.
      </p>
      <div className="mt-8 grid h-44 grid-cols-7 gap-2 border-b border-line px-1" aria-hidden="true">
        {points.map((point) => (
          <div key={point.data} className="flex min-w-0 flex-col items-center justify-end gap-2">
            <div className="flex h-32 w-full max-w-12 items-end justify-center gap-[3px]">
              <span className="w-1/3 rounded-t bg-brand-300" style={{ height: `${(point.planejadas / teto) * 100}%` }} />
              <span className="w-1/3 rounded-t bg-brand" style={{ height: `${(point.produzidas / teto) * 100}%` }} />
              <span className="w-1/3 rounded-t bg-accent" style={{ height: `${(point.servidas / teto) * 100}%` }} />
            </div>
            <span className="pb-2 text-[.62rem] capitalize text-ink-faint">
              {dia.format(new Date(`${point.data}T12:00:00Z`)).replace(".", "")}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
