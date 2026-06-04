import { useEffect, useMemo, useState } from "react"
import { movimentacoesApi } from "../api"
import { MOTIVOS_SAIDA } from "../api/units"
import Modal from "./Modal"
import { useToast } from "./Toast"

export default function SaidaFormModal({ open, produtos, onClose, onSaved }) {
  const [form, setForm] = useState({ produto: "", quantidade: "", motivo: "consumo" })
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) { setForm({ produto: "", quantidade: "", motivo: "consumo" }); setErro("") }
  }, [open])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const saldo = useMemo(() => {
    const p = produtos.find((x) => String(x.id) === String(form.produto))
    return p ? Number(p.quantidade) : null
  }, [produtos, form.produto])

  async function submit(ev) {
    ev.preventDefault()
    if (!form.produto) return setErro("Selecione o produto")
    const q = Number(form.quantidade)
    if (!q || q <= 0) return setErro("Quantidade inválida")
    if (saldo != null && q > saldo) return setErro(`Saída excede o saldo (${saldo})`)
    setSalvando(true)
    try {
      await movimentacoesApi.create({ produto: Number(form.produto), tipo: "SAIDA", quantidade: q, motivo: form.motivo })
      toast("Saída registrada")
      onSaved?.()
      onClose()
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar saída" subtitle="Consumo, perda ou ajuste" maxW="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Produto</span>
          <select className="field" value={form.produto} onChange={set("produto")}>
            <option value="">— selecione —</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome} (saldo {p.quantidade} {p.unidade})</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Quantidade</span>
          <input type="number" step="any" min="0" className="field" value={form.quantidade} onChange={set("quantidade")} placeholder="0" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Motivo</span>
          <select className="field" value={form.motivo} onChange={set("motivo")}>
            {MOTIVOS_SAIDA.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
        </label>
        {erro && <p className="text-xs text-out">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Registrando…" : "Registrar saída"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
