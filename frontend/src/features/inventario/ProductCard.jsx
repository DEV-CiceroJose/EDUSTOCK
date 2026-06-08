import { motion } from "motion/react"
import { categoryStyle } from "../../lib/catalog"
import { Icon } from "../../lib/icons.jsx"
import { qtd, dataBR, stockStatus, stockPercent, validadeStatus } from "../../lib/format"
import { unidadeLabel } from "../../api/units"

const BAR = { ok: "var(--color-ok)", low: "var(--color-low)", out: "var(--color-out)" }

export default function ProductCard({ produto, index = 0, busy, onAdd, onRemove, onDetails }) {
  const st = categoryStyle(produto.categoria_nome, index)
  const stock = stockStatus(produto.quantidade, produto.estoque_minimo)
  const val = validadeStatus(produto.validade)
  const pct = stockPercent(produto.quantidade, produto.estoque_minimo)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.3) }}
      className="card flex flex-col p-3.5"
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl"
          style={{ background: st.tint, color: st.fg }}
        >
          {st.renderIcon(26)}
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[0.58rem] font-bold text-ink-faint shadow-[var(--shadow-soft)]">
            {produto.unidade}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="min-w-0 truncate font-semibold leading-tight" title={produto.nome}>
              {produto.nome}
            </h3>
            <button
              onClick={() => onDetails(produto)}
              className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-surface-2"
              title="Ver detalhes"
            >
              {Icon.detail(16)}
            </button>
          </div>
          <div className="truncate text-xs text-ink-faint">
            {produto.categoria_nome}
            {produto.grupo_nome ? ` › ${produto.grupo_nome}` : ""}
          </div>

          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-display text-2xl font-bold leading-none">{qtd(produto.quantidade)}</span>
            <span className="truncate text-xs font-medium text-ink-soft">
              {unidadeLabel(produto.unidade).toLowerCase()}
            </span>
          </div>

          <div className="meter mt-2">
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ background: BAR[stock.code] }}
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`tag tag-${stock.code}`}>
          <span className="dot" /> {stock.label}
        </span>
        {produto.validade && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.66rem] font-medium text-ink-soft">
            {val.code === "expired" ? "Vencido" : "Val."} {dataBR(produto.validade)}
          </span>
        )}
      </div>
      {produto.numero_nota_fiscal && (
        <div className="mt-1 font-mono text-[0.6rem] text-ink-faint">NF {produto.numero_nota_fiscal}</div>
      )}

      {/* Controles: Adicionar / Retirar */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onAdd(produto)}
          disabled={busy}
          className="btn btn-soft min-w-0 py-2 text-xs disabled:opacity-50"
        >
          {Icon.plus(15)} <span className="truncate">Adicionar</span>
        </button>
        <button
          onClick={() => onRemove(produto)}
          disabled={busy || Number(produto.quantidade) <= 0}
          className="btn min-w-0 py-2 text-xs disabled:opacity-40"
          style={{ background: "var(--color-out-tint)", color: "var(--color-out)" }}
        >
          {Icon.minus(15)} <span className="truncate">Retirar</span>
        </button>
      </div>
    </motion.div>
  )
}
