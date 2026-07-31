import { useState } from "react"
import { useDashboardData } from "../hooks/useDashboardData"
import ContagemView from "../features/merenda/ContagemView"
import ContagemWidget from "../features/merenda/ContagemWidget"
import KitchenProductionView from "../features/merenda/KitchenProductionView"
import DataLoadError from "../components/ui/DataLoadError"

const VIEWS = ["contagem", "producao"]

export default function MerendaPage() {
  const { produtos, loading, error, carregar } = useDashboardData()
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
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <DataLoadError error={error} onRetry={carregar} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">Merenda Escolar</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-faint">{produtosMerenda.length} produtos • Gestão de alimentação</p>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <ContagemView onRegistrado={handleRegistrado} />
          <ContagemWidget refreshKey={refreshKey} />
        </div>
      ) : (
        <KitchenProductionView onBaixaConcluida={handleRegistrado} />
      )}
    </div>
  )
}
