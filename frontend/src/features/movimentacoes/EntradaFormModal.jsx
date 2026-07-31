import { useMemo, useState } from "react"
import { entradasApi } from "../../api"
import { brl } from "../../lib/format"
import { Icon } from "../../lib/icons.jsx"
import Modal from "../../components/ui/Modal"
import { useToast } from "../../components/ui/useToast"
import { getModulosAtivos } from "../../lib/auth"

const linhaVazia = () => ({ produto: "", quantidade: "", preco_unitario: "" })

export default function EntradaFormModal({ open, produtos, fornecedores, onClose, onSaved }) {
  if (!open) return null
  return (
    <EntradaForm
      produtos={produtos}
      fornecedores={fornecedores}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function EntradaForm({ produtos, fornecedores, onClose, onSaved }) {
  const mostrarPreco = getModulosAtivos().includes("financeiro")
  const [cab, setCab] = useState({
    fornecedor: "",
    numero_nota_fiscal: "",
    data: new Date().toISOString().slice(0, 10),
    observacao: "",
  })
  const [linhas, setLinhas] = useState([linhaVazia()])
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  const setC = (k) => (e) => setCab((c) => ({ ...c, [k]: e.target.value }))
  const setL = (i, k) => (e) =>
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: e.target.value } : l)))
  const addLinha = () => setLinhas((ls) => [...ls, linhaVazia()])
  const rmLinha = (i) => setLinhas((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))

  const total = useMemo(
    () => linhas.reduce((s, l) => s + (Number(l.quantidade) || 0) * (Number(l.preco_unitario) || 0), 0),
    [linhas]
  )

  async function submit(ev) {
    ev.preventDefault()
    const itens = linhas
      .filter((l) => l.produto && Number(l.quantidade) > 0)
      .map((l) => ({
        produto: Number(l.produto),
        quantidade: Number(l.quantidade),
        preco_unitario: l.preco_unitario === "" ? null : Number(l.preco_unitario),
      }))
    if (itens.length === 0) return setErro("Adicione ao menos um item com produto e quantidade.")
    setSalvando(true)
    try {
      await entradasApi.create({
        fornecedor: cab.fornecedor ? Number(cab.fornecedor) : null,
        numero_nota_fiscal: cab.numero_nota_fiscal,
        data: cab.data || null,
        observacao: cab.observacao,
        itens,
      })
      toast("Entrada registrada")
      onSaved?.()
      onClose()
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nova entrada" subtitle="Recebimento de itens" maxW="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Fornecedor</span>
            <select className="field" value={cab.fornecedor} onChange={setC("fornecedor")}>
              <option value="">— sem fornecedor —</option>
              {fornecedores.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nota Fiscal</span>
            <input className="field" value={cab.numero_nota_fiscal} onChange={setC("numero_nota_fiscal")} placeholder="NF-00000" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Data</span>
            <input type="date" className="field" value={cab.data} onChange={setC("data")} />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-semibold">Itens</span>
          {linhas.map((l, i) => (
            <div
              key={i}
              className={`grid items-center gap-2 ${
                mostrarPreco ? "grid-cols-[1fr_80px_90px_auto]" : "grid-cols-[1fr_80px_auto]"
              }`}
            >
              <select className="field" value={l.produto} onChange={setL(i, "produto")}>
                <option value="">— produto —</option>
                {produtos.map((p) => (<option key={p.id} value={p.id}>{p.nome}</option>))}
              </select>
              <input type="number" step="any" min="0" className="field" value={l.quantidade} onChange={setL(i, "quantidade")} placeholder="Qtd" />
              {mostrarPreco && (
                <input type="number" step="0.01" min="0" className="field" value={l.preco_unitario} onChange={setL(i, "preco_unitario")} placeholder="R$" />
              )}
              <button type="button" onClick={() => rmLinha(i)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-surface-2" title="Remover">
                {Icon.trash(15)}
              </button>
            </div>
          ))}
          <button type="button" onClick={addLinha} className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-surface-2">
            {Icon.plus(15)} Adicionar item
          </button>
        </div>

        {mostrarPreco && (
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-ink-soft">Total</span>
            <span className="font-display text-xl font-bold">{brl(total)}</span>
          </div>
        )}

        {erro && <p className="text-xs text-out">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Salvando…" : "Registrar entrada"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
