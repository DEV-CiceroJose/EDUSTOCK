import { useEffect, useMemo, useState } from "react"
import { comprasApi } from "../api"
import { brl } from "../lib/format"
import { baixarCSV } from "../lib/csv"
import { Icon } from "../lib/icons.jsx"
import { useToast } from "./Toast"

const HORIZONTES = [
  { value: 1, label: "1 semana" },
  { value: 2, label: "2 semanas" },
  { value: 4, label: "4 semanas" },
]
const JANELAS = [
  { value: 4, label: "4 semanas" },
  { value: 8, label: "8 semanas" },
]

export default function ComprasView() {
  const [horizonte, setHorizonte] = useState(1)
  const [semanas, setSemanas] = useState(4)
  const [dados, setDados] = useState({ itens: [], total_itens: 0, custo_total_estimado: "0.00" })
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    let vivo = true
    setLoading(true)
    comprasApi.sugerir({ horizonte, semanas })
      .then((d) => { if (vivo) setDados(d) })
      .catch((e) => toast(String(e.message || "Falha ao calcular"), "danger"))
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [horizonte, semanas]) // eslint-disable-line

  const grupos = useMemo(() => {
    const m = new Map()
    for (const it of dados.itens) {
      const k = it.fornecedor_nome || "Sem fornecedor"
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(it)
    }
    return [...m.entries()].map(([nome, itens]) => ({
      nome, itens,
      subtotal: itens.reduce((s, i) => s + (Number(i.custo_estimado) || 0), 0),
    }))
  }, [dados])

  function exportar() {
    if (dados.itens.length === 0) return
    // decimal pt-BR (vírgula) para o Excel não ler "7.000" como 7000
    const ptbr = (v) => (v == null ? "" : String(v).replace(".", ","))
    const linhas = dados.itens.map((it) => ({
      ...it,
      saldo: ptbr(it.saldo),
      estoque_minimo: ptbr(it.estoque_minimo),
      consumo_semanal: ptbr(it.consumo_semanal),
      sugerido: ptbr(it.sugerido),
      custo_estimado: ptbr(it.custo_estimado),
    }))
    baixarCSV(
      "lista-de-compras.csv",
      [
        { key: "fornecedor_nome", label: "Fornecedor" },
        { key: "produto_nome", label: "Produto" },
        { key: "saldo", label: "Saldo" },
        { key: "estoque_minimo", label: "Mínimo" },
        { key: "consumo_semanal", label: "Consumo/sem" },
        { key: "sugerido", label: "Comprar" },
        { key: "unidade", label: "Unidade" },
        { key: "custo_estimado", label: "Custo estimado" },
      ],
      linhas
    )
    toast("CSV exportado")
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Lista de compras</h2>
          <p className="mt-1 text-sm text-ink-faint">Sugestão por consumo médio + estoque mínimo</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-ink-soft">
            <span className="mb-1 block">Cobrir</span>
            <select className="field" value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))}>
              {HORIZONTES.map((h) => (<option key={h.value} value={h.value}>{h.label}</option>))}
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-soft">
            <span className="mb-1 block">Consumo (janela)</span>
            <select className="field" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
              {JANELAS.map((j) => (<option key={j.value} value={j.value}>{j.label}</option>))}
            </select>
          </label>
          <button onClick={() => window.print()} className="btn btn-ghost">{Icon.report(16)} Imprimir</button>
          <button onClick={exportar} className="btn btn-brand" disabled={dados.itens.length === 0}>
            {Icon.report(16)} Exportar CSV
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="card px-4 py-3">
          <div className="font-display text-2xl font-bold">{dados.total_itens}</div>
          <div className="text-xs text-ink-faint">itens a comprar</div>
        </div>
        <div className="card px-4 py-3">
          <div className="font-display text-2xl font-bold">{brl(dados.custo_total_estimado)}</div>
          <div className="text-xs text-ink-faint">custo total estimado</div>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-ink-faint">Calculando…</div>
      ) : dados.itens.length === 0 ? (
        <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
          <span className="mb-2 text-ink-faint">{Icon.box(40)}</span>
          <p className="font-display text-lg font-bold">Nada a comprar</p>
          <p className="text-sm text-ink-faint">Estoque suficiente para o horizonte escolhido. 🎉</p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {grupos.map((g) => (
            <div key={g.nome} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-surface-2/50 px-4 py-2.5">
                <span className="font-display font-bold">{g.nome}</span>
                <span className="font-mono text-sm text-ink-soft">{brl(g.subtotal)}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2 text-right">Saldo</th>
                    <th className="px-4 py-2 text-right">Mínimo</th>
                    <th className="px-4 py-2 text-right">Consumo/sem</th>
                    <th className="px-4 py-2 text-right">Comprar</th>
                    <th className="px-4 py-2 text-right">Custo est.</th>
                  </tr>
                </thead>
                <tbody>
                  {g.itens.map((it) => (
                    <tr key={it.produto} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2 font-medium">{it.produto_nome}</td>
                      <td className="px-4 py-2 text-right font-mono">{it.saldo}</td>
                      <td className="px-4 py-2 text-right font-mono text-ink-faint">{it.estoque_minimo}</td>
                      <td className="px-4 py-2 text-right font-mono text-ink-faint">{it.consumo_semanal}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">{it.sugerido} {it.unidade}</td>
                      <td className="px-4 py-2 text-right font-mono">{it.custo_estimado ? brl(it.custo_estimado) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
