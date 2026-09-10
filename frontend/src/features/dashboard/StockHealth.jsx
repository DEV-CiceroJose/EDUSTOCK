import { Link } from "react-router-dom"
import { Icon } from "../../lib/icons"

function percentual(valor, total) {
  return total > 0 ? Math.round((valor / total) * 100) : 0
}

export default function StockHealth({ stock, modules = [] }) {
  if (!stock) return null
  const adequado = percentual(stock.adequados, stock.itens)
  const atencao = percentual(stock.atencao, stock.itens)
  const critico = percentual(stock.criticos, stock.itens)
  const destino = modules.includes("alertas") ? "/alertas" : modules.includes("inventario") ? "/inventario" : null

  return (
    <section aria-labelledby="stock-health-title" className="card-flat p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[.68rem] font-bold uppercase tracking-[.12em] text-brand-500">Inventário</span>
          <h2 id="stock-health-title" className="mt-1 font-display text-xl font-bold text-brand-dark">Saúde do estoque</h2>
        </div>
        {destino && (
          <Link to={destino} className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-700">
            Ver detalhes {Icon.chevronR(14)}
          </Link>
        )}
      </div>
      {stock.itens === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">Cadastre itens para acompanhar a saúde do estoque.</p>
      ) : (
        <>
          <div className="mt-7 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <span className="bg-brand-500" style={{ width: `${adequado}%` }} />
            <span className="bg-low" style={{ width: `${atencao}%` }} />
            <span className="bg-out" style={{ width: `${critico}%` }} />
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div><dt className="text-xs text-ink-faint">Adequado</dt><dd className="mt-1 font-display text-lg font-bold text-brand">{adequado}% adequado</dd></div>
            <div><dt className="text-xs text-ink-faint">Atenção</dt><dd className="mt-1 font-display text-lg font-bold text-low">{atencao}% atenção</dd></div>
            <div><dt className="text-xs text-ink-faint">Crítico</dt><dd className="mt-1 font-display text-lg font-bold text-out">{critico}% crítico</dd></div>
          </dl>
        </>
      )}
    </section>
  )
}
