import { useCallback, useEffect, useState } from "react"
import { motion } from "motion/react"
import { operacaoApi } from "../api"
import { categoryStyle } from "../lib/catalog"
import { Icon } from "../lib/icons.jsx"
import ConfirmDialog from "./ConfirmDialog"
import { useToast } from "./Toast"

const TURNOS = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "INTEGRAL", label: "Integral" },
]

export default function KitchenProductionView({ onBaixaConcluida }) {
  const toast = useToast()
  const [turno, setTurno] = useState("MANHA")
  const [plano, setPlano] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setResultado(null)
    try {
      const p = await operacaoApi.planoDoDia({ turno })
      setPlano(p)
    } catch (err) {
      toast(String(err.message || err), "danger")
      setPlano(null)
    } finally {
      setLoading(false)
    }
  }, [turno, toast])

  useEffect(() => { carregar() }, [carregar])

  async function executarBaixa() {
    setConfirmOpen(false)
    setBaixando(true)
    try {
      const res = await operacaoApi.baixaProducao({ turno })
      setResultado(res)
      toast(
        res.falhas > 0
          ? `Baixa parcial: ${res.sucesso} ok, ${res.falhas} falha(s)`
          : `Baixa concluída: ${res.sucesso} item(ns)`,
        res.falhas > 0 ? "low" : "ok",
      )
      onBaixaConcluida?.()
      await carregar()
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setBaixando(false)
    }
  }

  const itens = plano?.itens ?? []
  const resumoConfirm = itens.map((i) => `• ${i.produto_nome}: ${i.quantidade_legivel}`).join("\n")

  return (
    <div className="text-[20px] leading-snug">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold">Produção do dia</h2>
          <p className="mt-1 text-base text-ink-faint">Ordem automática para a cozinha</p>
        </div>
        <button
          type="button"
          disabled={!itens.length || baixando}
          onClick={() => setConfirmOpen(true)}
          className="btn btn-accent px-6 py-3 text-lg disabled:opacity-40"
        >
          Dar Baixa de Produção
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TURNOS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTurno(t.key)}
            className={`rounded-full border px-4 py-2 text-lg font-semibold ${
              turno === t.key
                ? "border-brand bg-brand text-[#f4f1e7]"
                : "border-line bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {plano?.previsao?.alerta_reducao && (
        <div className="card mt-4 flex items-center gap-3 border-l-4 border-out bg-out-tint/40 p-4">
          {Icon.alert(22)}
          <div>
            <p className="font-bold text-out">Presença muito abaixo da média</p>
            <p className="text-base text-ink-soft">
              {plano.total_alunos} alunos hoje — revise as porções antes da baixa.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-ink-faint">
          Montando ordem de produção…
        </div>
      )}

      {!loading && itens.length === 0 && (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="font-display text-xl font-bold">Nenhum item no plano</p>
          <p className="text-base text-ink-faint">Registre a contagem de alunos e configure fatores de consumo.</p>
        </div>
      )}

      {!loading && itens.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {itens.map((item, i) => {
            const estilo = categoryStyle(item.categoria_nome, i)
            return (
              <motion.div
                key={item.produto_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`card p-5 ${
                  item.estoque_insuficiente
                    ? "border-2 border-out bg-out-tint/20"
                    : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                    style={{ background: estilo.tint, color: estilo.fg }}
                  >
                    {estilo.renderIcon(24)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-xl font-bold">{item.produto_nome}</h3>
                    <p className="text-base text-ink-faint">{item.categoria_nome}</p>
                    <p className="mt-2 font-display text-3xl font-bold text-brand">
                      {item.quantidade_legivel}
                    </p>
                    <p className="text-sm text-ink-faint">
                      Saldo: {item.saldo_atual} {item.unidade}
                    </p>
                    {item.estoque_insuficiente && (
                      <p className="mt-2 flex items-center gap-1 text-base font-bold text-out">
                        {Icon.alert(18)} Estoque insuficiente
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {resultado && (
        <div className="card mt-6 p-5">
          <h3 className="font-display text-xl font-bold">Resultado da baixa</h3>
          <ul className="mt-3 space-y-2">
            {resultado.resultados.map((r) => (
              <li
                key={r.produto_id}
                className={`text-base ${r.ok ? "text-ok" : "text-out"}`}
              >
                {r.ok ? "✓" : "✕"} {r.produto_nome} — {r.quantidade}
                {!r.ok && r.erro && ` (${r.erro})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar baixa de produção"
        message={`Serão registradas saídas de estoque (motivo: consumo) para:\n\n${resumoConfirm}`}
        confirmLabel="Confirmar baixa"
        tone="brand"
        onConfirm={executarBaixa}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
