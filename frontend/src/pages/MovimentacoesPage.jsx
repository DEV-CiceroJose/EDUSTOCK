import { useState } from "react"
import { useDashboardData } from "../hooks/useDashboardData"
import MovimentacoesView from "../features/movimentacoes/MovimentacoesView"
import EntradaFormModal from "../features/movimentacoes/EntradaFormModal"
import SaidaFormModal from "../features/movimentacoes/SaidaFormModal"

export default function MovimentacoesPage() {
  const { movimentacoes, produtos, fornecedores, loading, carregar } = useDashboardData()
  const [entradaOpen, setEntradaOpen] = useState(false)
  const [saidaOpen, setSaidaOpen] = useState(false)

  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-ink-faint">
        Carregando movimentações…
      </div>
    )
  }

  return (
    <>
      <MovimentacoesView
        movimentacoes={movimentacoes}
        onNovaEntrada={() => setEntradaOpen(true)}
        onNovaSaida={() => setSaidaOpen(true)}
      />

      <EntradaFormModal
        open={entradaOpen}
        produtos={produtos}
        fornecedores={fornecedores}
        onClose={() => setEntradaOpen(false)}
        onSaved={carregar}
      />

      <SaidaFormModal
        open={saidaOpen}
        produtos={produtos}
        onClose={() => setSaidaOpen(false)}
        onSaved={carregar}
      />
    </>
  )
}
