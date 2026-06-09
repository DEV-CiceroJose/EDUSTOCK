import { useState } from "react"
import { useDashboardData } from "../hooks/useDashboardData"
import ContagemView from "../features/merenda/ContagemView"
import ContagemWidget from "../features/merenda/ContagemWidget"
import KitchenPanel from "../features/merenda/KitchenPanel"
import KitchenProductionView from "../features/merenda/KitchenProductionView"

const VIEWS = ["contagem", "producao"]

export default function MerendaPage() {
  const { produtos, loading, carregar } = useDashboardData()
  const [view, setView] = useState("contagem")
  const [refreshKey, setRefreshKey] = useState(0)

  const produtosMerenda = produtos.filter((p) => 
    p.categoria_nome?.toLowerCase().includes("merenda") || p.grupo_nome?.toLowerCase().includes("merenda")
  )

  const handleRegistrado = () => {
    setRefreshKey((k) => k + 1)
    carregar()
  }

  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-ink-faint">
        Carregando dados da merenda…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Merenda Escolar</h1>
          <p className="text-sm text-ink-faint">{produtosMerenda.length} produtos • Gestão de alimentação</p>
        </div>
        <div className="flex gap-2">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                view === v ? "bg-brand text-[#f4f1e7]" : "bg-surface text-ink-soft hover:bg-surface-2"
              }`}
            >
              {v === "contagem" ? "Contagem" : "Produção"}
            </button>
          ))}
        </div>
      </div>

      {view === "contagem" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ContagemView onRegistrado={handleRegistrado} />
          <div className="space-y-5">
            <ContagemWidget refreshKey={refreshKey} />
            <KitchenPanel />
          </div>
        </div>
      ) : (
        <KitchenProductionView onBaixaConcluida={handleRegistrado} />
      )}
    </div>
  )
}
