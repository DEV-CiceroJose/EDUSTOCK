import { useEffect, useState } from "react"
import { fornecedoresApi } from "../../api"
import Modal from "../../components/ui/Modal"
import { useToast } from "../../components/ui/Toast"

const VAZIO = {
  nome: "", documento: "", endereco: "", telefone: "", email: "",
  emite_nota_fiscal: true, aceita_fiado: false, ativo: true, observacao: "",
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

export default function FornecedorFormModal({ open, fornecedor, onClose, onSaved }) {
  const editando = Boolean(fornecedor)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setForm(fornecedor ? { ...VAZIO, ...fornecedor } : VAZIO)
    setErro("")
  }, [open, fornecedor])

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))

  async function submit(ev) {
    ev.preventDefault()
    if (!form.nome.trim()) { setErro("Informe o nome"); return }
    setSalvando(true)
    try {
      if (editando) {
        await fornecedoresApi.update(fornecedor.id, form)
        toast("Fornecedor atualizado")
      } else {
        await fornecedoresApi.create(form)
        toast("Fornecedor cadastrado")
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
      title={editando ? "Editar fornecedor" : "Novo fornecedor"}
      subtitle={editando ? fornecedor?.nome : "Cadastre um fornecedor"}
      maxW="max-w-xl"
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome" full>
          <input className="field" value={form.nome} onChange={set("nome")} placeholder="Ex.: Atacadão Escolar" />
          {erro && <p className="mt-1 text-xs text-out">{erro}</p>}
        </Campo>

        <Campo label="CNPJ / CPF" hint="opcional">
          <input className="field" value={form.documento} onChange={set("documento")} placeholder="00.000.000/0000-00" />
        </Campo>

        <Campo label="Telefone" hint="opcional">
          <input className="field" value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" />
        </Campo>

        <Campo label="E-mail" hint="opcional">
          <input type="email" className="field" value={form.email} onChange={set("email")} placeholder="contato@fornecedor.com" />
        </Campo>

        <Campo label="Endereço" hint="opcional">
          <input className="field" value={form.endereco} onChange={set("endereco")} placeholder="Rua, número, cidade" />
        </Campo>

        <Campo label="Observação" hint="opcional" full>
          <textarea className="field" rows={2} value={form.observacao} onChange={set("observacao")} />
        </Campo>

        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.emite_nota_fiscal} onChange={set("emite_nota_fiscal")} className="h-4 w-4" />
            <span className="text-sm font-semibold">Emite nota fiscal</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.aceita_fiado} onChange={set("aceita_fiado")} className="h-4 w-4" />
            <span className="text-sm font-semibold">Aceita fiado</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.ativo} onChange={set("ativo")} className="h-4 w-4" />
            <span className="text-sm font-semibold">Ativo</span>
          </label>
        </div>

        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
