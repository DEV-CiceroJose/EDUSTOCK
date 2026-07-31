import { useState, useCallback } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ToastContext } from "./useToast"

let seq = 0

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((msg, tone = "ok") => {
    const id = ++seq
    setItems((s) => [...s, { id, msg, tone }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 2800)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="fixed bottom-20 right-5 z-[10000] flex flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="card flex items-center gap-2.5 px-4 py-3 text-sm font-medium shadow-[var(--shadow-pop)]"
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[0.7rem] font-bold text-white ${
                  t.tone === "danger" ? "bg-out" : t.tone === "low" ? "bg-low" : "bg-ok"
                }`}
              >
                {t.tone === "danger" ? "✕" : "✓"}
              </span>
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
