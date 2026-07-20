import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { relatoriosApi } from "../../api"
import { brl, dataBR } from "../../lib/format"
import {
  downloadBlob,
  formatPeriodoLabel,
  isoHoje,
  periodoMesAtual,
  periodoTrimestre,
  prestacaoContasToCsv,
} from "../../lib/export"
import { gerarPdfPrestacaoContas } from "../../lib/prestacaoPdf"
import { Icon } from "../../lib/icons.jsx"
import { useToast } from "../../components/ui/Toast"
import { getModulosAtivos } from "../../lib/auth"

const CHIPS = [
  { key: "mes", label: "Mês Atual" },
  { key: "trim", label: "Trimestre" },
  { key: "custom", label: "Personalizado" },
]

export default function RelatoriosView() {
  const toast = useToast()
  const mostrarPreco = getModulosAtivos().includes("financeiro")
  const [preset, setPreset] = useState("mes")
  const [inicio, setInicio] = useState(periodoMesAtual().inicio)
  const [fim, setFim] = useState(isoHoje())
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const periodoLabel = useMemo(() => {
    if (!dados?.periodo) return null
    return formatPeriodoLabel(dados.periodo.inicio, dados.periodo.fim)
  }, [dados])

  function aplicarPreset(key) {
    setPreset(key)
    if (key === "mes") {
      const p = periodoMesAtual()
      setInicio(p.inicio)
      setFim(p.fim)
    } else if (key === "trim") {
      const p = periodoTrimestre()
      setInicio(p.inicio)
      setFim(p.fim)
    }
  }

  async function gerar() {
    setLoading(true)
    setSucesso(false)
    try {
      const result = await relatoriosApi.prestacaoContas({ inicio, fim })
      setDados(result)
      setSucesso(true)
      toast("Relatório gerado com sucesso")
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setLoading(false)
    }
  }

  function exportarCsv() {
    if (!dados) return
    const csv = prestacaoContasToCsv(dados)
    downloadBlob(csv, `prestacao-contas-${inicio}-${fim}.csv`, "text/csv;charset=utf-8")
    toast("CSV exportado")
  }

  function exportarPdf() {
    if (!dados) return
    try {
      gerarPdfPrestacaoContas(dados)
      toast("PDF exportado")
    } catch (err) {
      toast(String(err.message || err), "danger")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Relatórios</h2>
          <p className="mt-1 text-sm text-ink-faint">Prestação de contas para a GRE</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!dados}
            onClick={exportarCsv}
            className="btn btn-ghost disabled:opacity-40"
          >
            {Icon.report(18)} Exportar CSV
          </button>
          <button
            type="button"
            disabled={!dados}
            onClick={exportarPdf}
            className="btn btn-brand disabled:opacity-40"
          >
            {Icon.report(18)} Exportar PDF
          </button>
        </div>
      </div>

      {sucesso && periodoLabel && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-5 flex items-center gap-3 border border-ok/30 bg-ok-tint p-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ok text-lg font-bold text-white">
            ✓
          </span>
          <div>
            <p className="font-display text-lg font-bold text-ok">
              Relatório de {periodoLabel} pronto
            </p>
            <p className="text-sm text-ink-soft">
              Revise os dados abaixo e exporte em PDF ou CSV para envio à GRE.
            </p>
          </div>
        </motion.div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => aplicarPreset(c.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              preset === c.key
                ? "border-brand bg-brand text-[#f4f1e7]"
                : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">De</span>
            <input type="date" className="field" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Até</span>
            <input type="date" className="field" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={gerar}
        disabled={loading || !inicio || !fim}
        className="btn btn-brand mt-4 disabled:opacity-50"
      >
        {loading ? "Gerando…" : "Gerar relatório"}
      </button>

      {loading && (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-ink-faint">
          Organizando documentos do período…
        </div>
      )}

      {!loading && dados && (
        <div className="mt-8 space-y-6">
          {mostrarPreco && (
            <div className="card p-5">
              <h3 className="font-display text-lg font-bold">Resumo financeiro</h3>
              <p className="mt-1 text-sm text-ink-faint">
                Total geral: <strong className="text-brand">{brl(dados.resumo_financeiro?.total_geral)}</strong>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(dados.resumo_financeiro?.por_categoria ?? []).map((c) => (
                  <span
                    key={c.categoria_id}
                    className="rounded-full bg-brand-tint px-3 py-1 text-sm font-semibold text-brand"
                  >
                    {c.categoria_nome}: {brl(c.total)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(dados.fornecedores ?? []).length === 0 && (
            <div className="grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
              <span className="mb-2 text-ink-faint">{Icon.report(40)}</span>
              <p className="font-display text-lg font-bold">Nenhum documento no período</p>
              <p className="text-sm text-ink-faint">Registre entradas ou ajuste o intervalo de datas.</p>
            </div>
          )}

          {(dados.fornecedores ?? []).map((f) => (
            <div key={f.fornecedor_id ?? "sem"} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{f.fornecedor_nome}</h3>
                  {f.documento && <p className="text-sm text-ink-faint">{f.documento}</p>}
                </div>
                {mostrarPreco && (
                  <span className="font-display text-xl font-bold text-brand">
                    {brl(f.total_fornecedor)}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-4">
                {(f.documentos ?? []).map((doc, i) => (
                  <div key={`${doc.entrada_id}-${i}`} className="rounded-xl border border-line bg-surface-2/50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">
                        NF {doc.numero_nota_fiscal || "—"}
                      </span>
                      <span className="text-sm text-ink-faint">{dataBR(doc.data)}</span>
                      {mostrarPreco && (
                        <span className="font-semibold text-brand">{brl(doc.total)}</span>
                      )}
                      {doc.legado && (
                        <span className="rounded-full bg-low-tint px-2 py-0.5 text-[0.66rem] font-bold uppercase text-low">
                          Legado
                        </span>
                      )}
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
                            <th className="py-2 pr-3">Produto</th>
                            <th className="py-2 pr-3">Qtd</th>
                            {mostrarPreco && (
                              <>
                                <th className="py-2 pr-3">Preço</th>
                                <th className="py-2">Subtotal</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(doc.itens ?? []).map((it, j) => (
                            <tr key={j} className="border-b border-line/60">
                              <td className="py-2 pr-3 font-medium">
                                {it.produto_nome}
                                {it.numero_nota_fiscal_legado && (
                                  <span className="ml-1 font-mono text-[0.65rem] text-ink-faint">
                                    NF leg. {it.numero_nota_fiscal_legado}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-3">{it.quantidade}</td>
                              {mostrarPreco && (
                                <>
                                  <td className="py-2 pr-3">{it.preco_unitario ? brl(it.preco_unitario) : "—"}</td>
                                  <td className="py-2">{brl(it.subtotal)}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
