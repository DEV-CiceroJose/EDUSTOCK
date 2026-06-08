import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { Icon } from "../../lib/icons.jsx"
import { dataBR } from "../../lib/format"

export default function MovimentacoesView({ movimentacoes, onNovaEntrada, onNovaSaida }) {
  const [tipo, setTipo] = useState("todos")

  const lista = useMemo(() => {
    if (tipo === "todos") return movimentacoes
    return movimentacoes.filter((m) => m.tipo === tipo)
  }, [movimentacoes, tipo])

  const CHIPS = [
    { key: "todos", label: "Todas" },
    { key: "ENTRADA", label: "Entradas" },
    { key: "SAIDA", label: "Saídas" },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Movimentações</h2>
          <p className="mt-1 text-sm text-ink-faint">{lista.length} registro(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onNovaSaida} className="btn btn-ghost">{Icon.minus(16)} Registrar saída</button>
          <button onClick={onNovaEntrada} className="btn btn-brand">{Icon.plus(16)} Nova entrada</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => setTipo(c.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              tipo === c.key ? "border-brand bg-brand text-[#f4f1e7]" : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="card mt-5 overflow-hidden">
        {lista.length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <span className="mb-2 text-ink-faint">{Icon.refresh(40)}</span>
            <p className="font-display text-lg font-bold">Nenhuma movimentação</p>
            <p className="text-sm text-ink-faint">Registre uma entrada ou saída.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Qtd.</th>
                <th className="px-4 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m, i) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.2) }}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{dataBR(m.data)}</td>
                  <td className="px-4 py-2.5 font-medium">{m.produto_nome}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[0.66rem] font-bold uppercase ${
                      m.tipo === "ENTRADA" ? "bg-ok-tint text-ok" : "bg-low-tint text-low"
                    }`}>
                      {m.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{m.quantidade}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{m.motivo || "—"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
