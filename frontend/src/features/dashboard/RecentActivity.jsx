import { Icon } from "../../lib/icons"

const horario = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })

export default function RecentActivity({ activities = [] }) {
  if (activities.length === 0) return null
  return (
    <section aria-labelledby="recent-activity-title" className="card-flat p-5 sm:p-6">
      <div>
        <span className="text-[.68rem] font-bold uppercase tracking-[.12em] text-brand-500">Trilha de auditoria</span>
        <h2 id="recent-activity-title" className="mt-1 font-display text-xl font-bold text-brand-dark">Atividade recente</h2>
      </div>
      <ol className="mt-5 space-y-4">
        {activities.map((activity) => (
          <li key={activity.id} className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-tint text-brand" aria-hidden="true">
              {Icon.activity(15)}
            </span>
            <p className="min-w-0 text-sm leading-5 text-ink-soft">
              <time className="mr-2 font-mono text-[.68rem] font-bold text-brand-dark" dateTime={activity.criado_em}>
                {horario.format(new Date(activity.criado_em))}
              </time>
              <strong className="text-ink">{activity.ator}</strong> {activity.acao} {activity.recurso}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
