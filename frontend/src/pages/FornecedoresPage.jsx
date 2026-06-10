import { useState } from "react"
import { useDashboardData } from "../hooks/useDashboardData"
import FornecedoresView from "../features/fornecedores/FornecedoresView"
import FornecedorFormModal from "../features/fornecedores/FornecedorFormModal"

export default function FornecedoresPage() {
  const { fornecedores, loading, carregar } = useDashboardData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editFornecedor, setEditFornecedor] = useState(null)

  const handleNew = () => {
    setEditFornecedor(null)
    setModalOpen(true)
  }

  const handleEdit = (fornecedor) => {
    setEditFornecedor(fornecedor)
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
    setEditFornecedor(null)
  }

  const handleSaved = () => {
    handleClose()
    carregar()
  }

  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-ink-faint">
        Carregando fornecedores…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <FornecedoresView
        fornecedores={fornecedores}
        onNew={handleNew}
        onEdit={handleEdit}
        onChanged={carregar}
      />
      
      <FornecedorFormModal
        open={modalOpen}
        fornecedor={editFornecedor}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </div>
  )
}
