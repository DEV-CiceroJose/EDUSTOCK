import { motion } from "motion/react"
import { categoryStyle } from "../lib/catalog"
import { Icon } from "../lib/icons.jsx"

export default function CategoryRail({ categorias, counts, total, active, onPick, onAddCategory }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 font-display text-sm font-bold uppercase tracking-wider text-ink-faint">
        Categorias Principais
      </h2>

      {/* Todos */}
      <button
        onClick={() => onPick("all")}
        className={`card-flat flex items-center gap-3 px-3 py-3 text-left transition ${
          active === "all" ? "ring-2 ring-brand ring-offset-2 ring-offset-canvas" : "hover:bg-surface-2"
        }`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-tint text-brand">
          {Icon.grid(20)}
        </span>
        <span className="flex-1 font-semibold">Todos os itens</span>
        <span className="font-mono text-xs text-ink-faint">{total}</span>
      </button>

      {categorias.map((c, i) => {
        const st = categoryStyle(c.name, i)
        const on = active === c.id
        const n = counts[c.id] || 0
        return (
          <motion.button
            key={c.id}
            onClick={() => onPick(c.id)}
            whileTap={{ scale: 0.98 }}
            className={`card-flat flex items-center gap-3 px-3 py-3 text-left transition ${
              on ? "ring-2 ring-offset-2 ring-offset-canvas" : "hover:bg-surface-2"
            }`}
            style={on ? { "--tw-ring-color": st.fg } : undefined}
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{ background: st.tint, color: st.fg }}
            >
              {st.renderIcon(20)}
            </span>
            <span className="flex-1 text-sm font-semibold leading-tight">{c.name}</span>
            <span className="font-mono text-xs text-ink-faint">{n}</span>
          </motion.button>
        )
      })}

      <button
        onClick={onAddCategory}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
      >
        {Icon.plus(16)} Nova categoria
      </button>
    </div>
  )
}
