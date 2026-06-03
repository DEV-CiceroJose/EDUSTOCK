import { motion } from "motion/react"

export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface-2/70 p-1">
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              on ? "text-brand" : "text-ink-soft hover:text-ink"
            }`}
          >
            {on && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-xl bg-surface shadow-[var(--shadow-soft)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
