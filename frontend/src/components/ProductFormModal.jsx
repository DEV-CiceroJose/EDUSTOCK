import { useEffect, useState } from "react"
import { produtosApi } from "../api"
import { UNIDADES } from "../api/units"
import Modal from "./Modal"
import { useToast } from "./Toast"

const VAZIO = {
  nome: "", numero_nota_fiscal: "", categoria: "",
  quantidade: "", unidade: "UN", validade: "", preco: "",
}

function Campo({ label, hint, children, full }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold">
        {label}
        {hint && <span className="text-[0.66rem] font-normal text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export default function ProductFormModal({ open, produto, categorias, onClose, onSaved }) {
  const editando = Boolean(produto)
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    if (produto) {
      setForm({
        nome: produto.nome ?? "",
        numero_nota_fiscal: produto.numero_nota_fiscal ?? "",
        categoria: String(produto.categoria ?? ""),
        quantidade: String(produto.quantidade ?? ""),
        unidade: produto.unidade ?? "UN",
        validade: produto.validade ?? "",
        preco: produto.preco ?? "",
      })
    } else {
      setForm({ ...VAZIO, categoria: categorias[0] ? String(categorias[0].id) : "" })
    }
    setErros({})
  }, [open, produto, categorias])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function validar() {
    const e = {}
    if (!form.nome.trim()) e.nome = "Informe o nome"
    if (!form.categoria) e.categoria = "Selecione"
    if (form.quantidade === "" || Number(form.quantidade) < 0) e.quantidade = "Inválida"
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    if (!validar()) return
    setSalvando(true)
    try {
      if (editando) {
        await produtosApi.update(produto.id, form)
        toast("Item atualizado")
      } else {
        await produtosApi.create(form)
        toast("Item cadastrado")
      }
      onSaved?.()
      onClose()
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? "Editar item" : "Adicionar novo item"}
      subtitle={editando ? produto?.nome : "Cadastre um produto no estoque"}
      maxW="max-w-xl"
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome do item" full>
          <input className="field" value={form.nome} onChange={set("nome")} placeholder="Ex.: Papel Sulfite A4" />
          {erros.nome && <p className="mt-1 text-xs text-out">{erros.nome}</p>}
        </Campo>

        <Campo label="Categoria">
          <select className="field" value={form.categoria} onChange={set("categoria")}>
            <option value="">— selecione —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {erros.categoria && <p className="mt-1 text-xs text-out">{erros.categoria}</p>}
        </Campo>

        <Campo label="Nota Fiscal" hint="opcional">
          <input className="field" value={form.numero_nota_fiscal} onChange={set("numero_nota_fiscal")} placeholder="NF-00000" />
        </Campo>

        <Campo label="Quantidade">
          <input type="number" step="any" min="0" className="field" value={form.quantidade} onChange={set("quantidade")} placeholder="0" />
          {erros.quantidade && <p className="mt-1 text-xs text-out">{erros.quantidade}</p>}
        </Campo>

        <Campo label="Unidade">
          <select className="field" value={form.unidade} onChange={set("unidade")}>
            {UNIDADES.map((u) => (
              <option key={u.value} value={u.value}>{u.value} · {u.label}</option>
            ))}
          </select>
        </Campo>

        <Campo label="Validade" hint="opcional">
          <input type="date" className="field" value={form.validade} onChange={set("validade")} />
        </Campo>

        <Campo label="Preço unitário" hint="R$ · opcional">
          <input type="number" step="0.01" min="0" className="field" value={form.preco} onChange={set("preco")} placeholder="0,00" />
        </Campo>

        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar item"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
