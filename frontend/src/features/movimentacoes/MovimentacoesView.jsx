import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { Icon } from "../../lib/icons.jsx"
import { dataBR } from "../../lib/format"
import { movimentacoesApi } from "../../api"
import Modal from "../../components/ui/Modal"
import { useToast } from "../../components/ui/useToast"
import { ehAdmin } from "../../lib/auth"

export default function MovimentacoesView({ movimentacoes, onNovaEntrada, onNovaSaida, onAtualizar }) {
  const [tipo, setTipo] = useState("todos")
  const [aEstornar, setAEstornar] = useState(null)
  const admin = ehAdmin()

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
                {admin && <th className="px-4 py-3"><span className="sr-only">Ações</span></th>}
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
                  {admin && (
                    <td className="px-4 py-2.5 text-right">
                      {!m.estorno && !m.corrige_movimentacao && (
                        <button type="button" onClick={() => setAEstornar(m)} className="btn btn-ghost px-2 py-1 text-xs">
                          Estornar
                        </button>
                      )}
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <EstornoModal movimentacao={aEstornar} onClose={() => setAEstornar(null)} onSaved={onAtualizar} />
    </div>
  )
}

function EstornoModal({ movimentacao, onClose, onSaved }) {
  const [motivo, setMotivo] = useState("")
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  async function submit(event) {
    event.preventDefault()
    const texto = motivo.trim()
    if (texto.length < 5) {
      setErro("Informe um motivo de ao menos 5 caracteres.")
      return
    }
    setSalvando(true)
    setErro("")
    try {
      await movimentacoesApi.estornar(movimentacao.id, texto)
      await onSaved?.()
      toast("Movimentação estornada")
      onClose()
    } catch (err) {
      setErro(String(err.message || err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={Boolean(movimentacao)} onClose={onClose} title="Estornar movimentação" subtitle="Será criado um lançamento oposto, sem apagar o histórico." maxW="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Motivo do estorno</span>
          <textarea className="field min-h-24" value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Descreva o lançamento incorreto" />
        </label>
        {erro && <p className="text-xs text-out">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Estornando…" : "Confirmar estorno"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
