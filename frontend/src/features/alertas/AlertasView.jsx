import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { Icon } from "../../lib/icons.jsx"

const CHIPS = [
  { key: "todos", label: "Todos" },
  { key: "validade", label: "Validade" },
  { key: "estoque", label: "Nível de Estoque" },
]

function urgenciaClasses(urgencia) {
  if (urgencia === "critico") {
    return "border-l-4 border-out bg-out-tint/30"
  }
  return "border-l-4 border-low bg-low-tint/30"
}

export default function AlertasView({ alertas, onPick }) {
  const [filtro, setFiltro] = useState("todos")

  const lista = useMemo(() => {
    const validade = (alertas.validade ?? []).map((a) => ({ ...a, tipo: "validade" }))
    const estoque = (alertas.estoque_critico ?? []).map((a) => ({ ...a, tipo: "estoque" }))
    if (filtro === "validade") return validade
    if (filtro === "estoque") return estoque
    return [...validade, ...estoque]
  }, [alertas, filtro])

  const resumo = alertas.resumo ?? {}

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Alertas</h2>
          <p className="mt-1 text-sm text-ink-faint">
            Monitoramento de validade e estoque crítico
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="card p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-out-tint text-out">
            {Icon.bell(20)}
          </span>
          <div className="mt-3 font-display text-3xl font-bold">{resumo.vencidos ?? 0}</div>
          <div className="mt-0.5 text-xs text-ink-faint">Itens vencidos / críticos</div>
        </div>
        <div className="card p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-out-tint text-out">
            {Icon.alert(20)}
          </span>
          <div className="mt-3 font-display text-3xl font-bold">{resumo.esgotados ?? 0}</div>
          <div className="mt-0.5 text-xs text-ink-faint">Itens esgotados</div>
        </div>
        <div className="card p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-low-tint text-low">
            {Icon.box(20)}
          </span>
          <div className="mt-3 font-display text-3xl font-bold">{resumo.total_validade ?? 0}</div>
          <div className="mt-0.5 text-xs text-ink-faint">Alertas de validade</div>
        </div>
        <div className="card p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-low-tint text-low">
            {Icon.report(20)}
          </span>
          <div className="mt-3 font-display text-3xl font-bold">{resumo.total_estoque_critico ?? 0}</div>
          <div className="mt-0.5 text-xs text-ink-faint">Alertas de estoque</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => setFiltro(c.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              filtro === c.key
                ? "border-brand bg-brand text-[#f4f1e7]"
                : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-2.5">
        {lista.length === 0 && (
          <div className="grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
            <span className="mb-2 text-ink-faint">{Icon.bell(40)}</span>
            <p className="font-display text-lg font-bold">Nenhum alerta</p>
            <p className="text-sm text-ink-faint">Tudo sob controle no momento.</p>
          </div>
        )}

        {lista.map((a, i) => (
          <motion.button
            key={`${a.tipo}-${a.produto_id}`}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onPick?.(a.produto_id)}
            className={`card flex w-full items-start gap-4 p-4 text-left transition hover:opacity-90 ${urgenciaClasses(a.urgencia)}`}
          >
            <span className={a.urgencia === "critico" ? "text-out" : "text-low"}>
              {Icon.alert(18)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-bold">{a.nome}</div>
              <div className="mt-0.5 text-sm text-ink-faint">
                {a.grupo_nome}
                {a.fornecedor_nome ? ` · ${a.fornecedor_nome}` : " · —"}
              </div>
              <div className={`mt-1.5 text-sm font-semibold ${a.urgencia === "critico" ? "text-out" : "text-low"}`}>
                {a.motivo}
              </div>
            </div>
            <span className="shrink-0 text-ink-faint">{Icon.chevronR(15)}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
