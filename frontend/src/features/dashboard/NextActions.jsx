import { Link } from "react-router-dom"
import { Icon } from "../../lib/icons"

const MODULO_POR_DESTINO = {
  "/alertas": "alertas",
  "/distribuicao": "inventario",
  "/fornecedores": "fornecedores",
  "/inventario": "inventario",
  "/merenda": "merenda",
  "/movimentacoes": "movimentacoes",
  "/relatorios": "relatorios",
}

function acaoPermitida(acao, modulos) {
  const destino = acao.href?.split("?")[0]
  const modulo = MODULO_POR_DESTINO[destino]
  return Boolean(modulo && modulos.includes(modulo))
}

export default function NextActions({ actions = [], modules = [] }) {
  const permitidas = actions.filter((acao) => acaoPermitida(acao, modules))
  return (
    <section aria-labelledby="next-actions-title" className="card-flat h-full p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[.68rem] font-bold uppercase tracking-[.12em] text-accent">Prioridades</span>
          <h2 id="next-actions-title" className="mt-1 font-display text-xl font-bold text-brand-dark">Próximas ações</h2>
        </div>
        <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-bold text-accent">
          {permitidas.length}
        </span>
      </div>
      {permitidas.length === 0 ? (
        <p className="mt-7 rounded-xl bg-brand-tint px-4 py-5 text-sm text-brand">
          Nenhuma ação pendente para os módulos disponíveis.
        </p>
      ) : (
        <ul aria-label="Próximas ações" className="mt-5 divide-y divide-line">
          {permitidas.map((acao) => (
            <li key={`${acao.codigo}-${acao.href}`} className="py-4 first:pt-0 last:pb-0">
              <Link to={acao.href} className="group grid grid-cols-[2rem_1fr_auto] items-start gap-3 rounded-xl focus-visible:outline-none">
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${acao.prioridade === "alta" ? "bg-accent-tint text-accent" : "bg-brand-tint text-brand"}`} aria-hidden="true">
                  {acao.prioridade === "alta" ? Icon.alert(15) : Icon.clock(15)}
                </span>
                <span>
                  <strong className="block text-sm text-brand-dark group-hover:text-brand">{acao.titulo}</strong>
                  <span className="mt-1 block text-xs leading-5 text-ink-soft">{acao.descricao}</span>
                </span>
                <span className="mt-2 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true">
                  {Icon.chevronR(16)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
