import { useState } from "react"
import Modal from "../../components/ui/Modal"

export default function NewGroupModal({ open, onClose, categorias = [], onCreate }) {
  if (!open) return null
  return <NewGroupForm categorias={categorias} onClose={onClose} onCreate={onCreate} />
}

function NewGroupForm({ categorias, onClose, onCreate }) {
  const [nome, setNome] = useState("")
  const [categoria, setCategoria] = useState(() => String(categorias[0]?.id ?? ""))
  const [salvando, setSalvando] = useState(false)
  const podeCriar = nome.trim() && categoria && !salvando

  async function submit(ev) {
    ev.preventDefault()
    const valor = nome.trim()
    if (!valor || !categoria) return
    setSalvando(true)
    try {
      await onCreate({ nome: valor, categoria: Number(categoria) })
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo grupo" subtitle="Escolha uma categoria para organizar os itens" maxW="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nome do grupo</span>
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Grãos" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Categoria</span>
          <select className="field" value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={!categorias.length}>
            <option value="">— selecione —</option>
            {categorias.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {!categorias.length && <p className="mt-1 text-xs text-ink-faint">Crie uma categoria antes de criar um grupo.</p>}
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={!podeCriar} className="btn btn-brand disabled:opacity-50">
            {salvando ? "Criando..." : "Criar grupo"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
