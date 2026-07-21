import { useEffect, useState } from "react"
import Modal from "../../components/ui/Modal"

export default function NewCategoryModal({ open, onClose, onCreate }) {
  const [nome, setNome] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (open) {
      setNome("")
      setSalvando(false)
    }
  }, [open])

  async function submit(ev) {
    ev.preventDefault()
    const valor = nome.trim()
    if (!valor) return
    setSalvando(true)
    try {
      await onCreate(valor)
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova categoria" subtitle="Organize os itens do estoque" maxW="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nome da categoria</span>
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Material de Limpeza"
            className="field"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={!nome.trim() || salvando} className="btn btn-brand disabled:opacity-50">
            {salvando ? "Criando…" : "Criar categoria"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
