import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { categoryStyle } from "../lib/catalog"
import { Icon } from "../lib/icons.jsx"

export default function CategoryRail({ categorias, grupos, counts, total, active, onPick, onAddCategory }) {
  const [aberta, setAberta] = useState(null)

  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 font-display text-sm font-bold uppercase tracking-wider text-ink-faint">
        Categorias Principais
      </h2>

      <button
        onClick={() => onPick({ tipo: "all" })}
        className={`card-flat flex items-center gap-3 px-3 py-3 text-left transition ${
          active.tipo === "all" ? "ring-2 ring-brand ring-offset-2 ring-offset-canvas" : "hover:bg-surface-2"
        }`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-tint text-brand">{Icon.grid(20)}</span>
        <span className="flex-1 font-semibold">Todos os itens</span>
        <span className="font-mono text-xs text-ink-faint">{total}</span>
      </button>

      {categorias.map((c, i) => {
        const st = categoryStyle(c.name, i)
        const on = active.tipo === "cat" && active.id === c.id
        const gruposDaCat = grupos.filter((g) => g.categoria === c.id)
        const expandida = aberta === c.id
        return (
          <div key={c.id}>
            <div
              className={`card-flat flex items-center gap-3 px-3 py-3 transition ${
                on ? "ring-2 ring-offset-2 ring-offset-canvas" : "hover:bg-surface-2"
              }`}
              style={on ? { "--tw-ring-color": st.fg } : undefined}
            >
              <button onClick={() => onPick({ tipo: "cat", id: c.id })} className="flex flex-1 items-center gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: st.tint, color: st.fg }}>
                  {st.renderIcon(20)}
                </span>
                <span className="flex-1 text-sm font-semibold leading-tight">{c.name}</span>
                <span className="font-mono text-xs text-ink-faint">{counts.cat[c.id] || 0}</span>
              </button>
              {gruposDaCat.length > 0 && (
                <button
                  onClick={() => setAberta(expandida ? null : c.id)}
                  className="grid h-6 w-6 place-items-center rounded-md text-ink-faint hover:bg-surface-2"
                  aria-label="Expandir grupos"
                >
                  <span className={`transition-transform ${expandida ? "rotate-90" : ""}`}>{Icon.chevronR(14)}</span>
                </button>
              )}
            </div>

            <AnimatePresence>
              {expandida && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pl-5"
                >
                  <div className="mt-1 flex flex-col gap-1 border-l-2 border-line pl-2">
                    {gruposDaCat.map((g) => {
                      const gon = active.tipo === "grupo" && active.id === g.id
                      return (
                        <button
                          key={g.id}
                          onClick={() => onPick({ tipo: "grupo", id: g.id })}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                            gon ? "bg-brand-tint font-semibold text-brand" : "hover:bg-surface-2"
                          }`}
                        >
                          <span>{g.nome}</span>
                          <span className="font-mono text-xs text-ink-faint">{counts.grupo[g.id] || 0}</span>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
