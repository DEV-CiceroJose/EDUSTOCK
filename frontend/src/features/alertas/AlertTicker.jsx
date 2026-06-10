import { Icon } from "../../lib/icons.jsx"

export default function AlertTicker({ alerts, onPick }) {
  const has = alerts.length > 0
  const list = has ? alerts : [{ id: "ok", label: "Tudo sob controle — nenhum alerta crítico", code: "ok" }]
  // duplica para loop contínuo
  const loop = [...list, ...list]

  return (
    <footer className="sticky bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-md">
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center gap-2 border-r border-line px-4 py-2.5 text-ink-soft">
          {Icon.bell(16)}
          <span className="hidden text-xs font-bold uppercase tracking-wider sm:inline">Alertas</span>
          {has && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-out px-1 text-[0.66rem] font-bold text-white">
              {alerts.length}
            </span>
          )}
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden overflow-x-hidden">
          <div className="marquee flex w-max items-center gap-6 py-2.5 pl-6">
            {loop.map((a, i) => (
              <button
                key={`${a.id}-${i}`}
                onClick={() => a.produtoId && onPick?.(a)}
                className="flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <span
                  className={`inline-flex items-center gap-1.5 ${
                    a.code === "out" ? "text-out" : a.code === "low" ? "text-low" : "text-ok"
                  }`}
                >
                  {a.code !== "ok" && Icon.alert(15)}
                </span>
                <span className={a.produtoId ? "font-medium underline-offset-2 hover:underline" : "text-ink-soft"}>
                  {a.label}
                </span>
                <span className="text-line">•</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
