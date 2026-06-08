import { useEffect, useState } from "react"
import { operacaoApi } from "../../api"
import { Icon } from "../../lib/icons.jsx"

export default function ContagemWidget({ refreshKey = 0, onOpenContagem }) {
  const [resumo, setResumo] = useState(null)

  useEffect(() => {
    operacaoApi.resumo().then(setResumo).catch(() => setResumo(null))
  }, [refreshKey])

  if (!resumo) {
    return (
      <div className="card p-5 text-center text-sm text-ink-faint">
        Carregando frequência…
      </div>
    )
  }

  const variacao = resumo.variacao_pct
  const variacaoLabel = variacao == null
    ? "Sem histórico"
    : `${variacao > 0 ? "+" : ""}${variacao}% vs média`

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-accent-tint/60 px-5 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-white">
          {Icon.food(18)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="truncate font-display font-bold">Merenda hoje</h2>
          <p className="truncate text-[0.68rem] text-ink-faint">Frequência digital</p>
        </div>
        {resumo.alerta_reducao && (
          <span className="rounded-full bg-out px-2 py-0.5 text-[0.66rem] font-bold uppercase text-white">
            Baixa
          </span>
        )}
      </div>
      <div className="p-5 text-center">
        <div className="font-display text-5xl font-bold text-brand">{resumo.total_alunos}</div>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Alunos registrados hoje
        </p>
        <p className={`mt-2 text-sm font-medium ${resumo.alerta_reducao ? "text-out" : "text-ink-faint"}`}>
          {variacaoLabel}
          {resumo.media_historica > 0 && (
            <span className="block text-xs">Média 30d: {Math.round(resumo.media_historica)}</span>
          )}
        </p>
        {onOpenContagem && (
          <button type="button" onClick={onOpenContagem} className="btn btn-accent mt-4 w-full">
            {Icon.plus(18)} Registrar contagem
          </button>
        )}
      </div>
    </div>
  )
}
