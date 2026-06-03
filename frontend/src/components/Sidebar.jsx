import { Icon } from "../lib/icons.jsx"

const ITEMS = [
  { key: "home", icon: "home", label: "Início" },
  { key: "inv", icon: "grid", label: "Inventário" },
  { key: "users", icon: "users", label: "Usuários" },
  { key: "config", icon: "gear", label: "Configurações" },
]

export default function Sidebar({ active = "inv", onPick = () => {} }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface/60 py-4 lg:flex">
      {ITEMS.map((it) => {
        const on = it.key === active
        return (
          <button
            key={it.key}
            onClick={() => onPick(it.key)}
            title={it.label}
            className={`group relative grid h-11 w-11 place-items-center rounded-xl transition-colors ${
              on ? "bg-brand text-[#f4f1e7]" : "text-ink-soft hover:bg-surface-2"
            }`}
          >
            {Icon[it.icon](21)}
            {on && <span className="absolute -left-2 h-5 w-1 rounded-full bg-brand" />}
          </button>
        )
      })}
    </aside>
  )
}
