import { useState } from "react"
import { useDashboardData } from "../hooks/useDashboardData"
import AlertasView from "../features/alertas/AlertasView"
import AlertTicker from "../features/alertas/AlertTicker"
import DetailsModal from "../features/inventario/DetailsModal"

export default function AlertasPage() {
  const { alertas, alerts, loading, carregar, produtos } = useDashboardData()
  const [detalhe, setDetalhe] = useState(null)

  const handlePickAlerta = (produtoId) => {
    const produto = produtos.find((p) => p.id === produtoId)
    if (produto) setDetalhe(produto)
  }

  const handlePickTickerAlert = (alert) => {
    if (alert.produtoId) {
      const produto = produtos.find((p) => p.id === alert.produtoId)
      if (produto) setDetalhe(produto)
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-ink-faint">
        Carregando alertas…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] overflow-x-hidden px-6 py-8">
      <AlertasView alertas={alertas} onPick={handlePickAlerta} />
      <AlertTicker alerts={alerts} onPick={handlePickTickerAlert} />
      <DetailsModal
        produto={detalhe}
        onClose={() => setDetalhe(null)}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </div>
  )
}
