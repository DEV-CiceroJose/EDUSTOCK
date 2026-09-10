import { Link } from "react-router-dom"
import { Icon } from "../../lib/icons"

export function DashboardSkeleton() {
  return (
    <section
      role="status"
      aria-label="Carregando painel operacional"
      className="animate-pulse space-y-5"
    >
      <span className="sr-only">Carregando painel operacional…</span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-32 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="h-36 rounded-2xl bg-brand/15" />
      <div className="grid gap-5 lg:grid-cols-[1.35fr_.85fr]">
        <div className="h-72 rounded-2xl border border-line bg-surface" />
        <div className="h-72 rounded-2xl border border-line bg-surface" />
      </div>
    </section>
  )
}

function proximaEtapa(modulos) {
  if (modulos.includes("merenda")) {
    return {
      titulo: "Comece pela presença das turmas",
      descricao: "Registre a frequência de hoje para calcular a previsão das refeições.",
      href: "/merenda",
      acao: "Registrar presença",
    }
  }
  if (modulos.includes("inventario")) {
    return {
      titulo: "Comece pelo inventário da escola",
      descricao: "Cadastre os itens disponíveis para acompanhar saldos e necessidades de reposição.",
      href: "/inventario",
      acao: "Abrir inventário",
    }
  }
  return {
    titulo: "Nenhum dado operacional disponível",
    descricao: "Os módulos disponíveis para seu acesso ainda não fornecem dados para este painel.",
  }
}

export function DashboardEmptyState({ modulos = [] }) {
  const etapa = proximaEtapa(modulos)
  return (
    <section
      aria-labelledby="dashboard-empty-title"
      className="card-flat grid min-h-72 place-items-center px-6 py-12 text-center"
    >
      <div className="max-w-lg">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-tint text-brand" aria-hidden="true">
          {Icon.presence(26)}
        </span>
        <h2 id="dashboard-empty-title" className="font-display text-2xl font-bold text-brand-dark">
          {etapa.titulo}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">{etapa.descricao}</p>
        {etapa.href && (
          <Link className="btn btn-accent mt-6" to={etapa.href}>
            {etapa.acao} {Icon.chevronR(16)}
          </Link>
        )}
      </div>
    </section>
  )
}

export function DashboardSectionError({ onRetry, partial = false }) {
  return (
    <section
      role="alert"
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-out/25 bg-out-tint px-5 py-4 text-out"
    >
      <div>
        <h2 className="font-semibold">
          {partial ? "Alguns dados não puderam ser atualizados" : "Não foi possível carregar o painel"}
        </h2>
        <p className="mt-1 text-sm">
          {partial ? "As informações disponíveis continuam visíveis abaixo." : "Verifique a conexão e tente novamente."}
        </p>
      </div>
      <button type="button" onClick={onRetry} className="btn btn-ghost">
        {Icon.refresh(17)} Tentar novamente
      </button>
    </section>
  )
}
