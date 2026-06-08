import { AnimatePresence, motion } from "motion/react"
import { Icon } from "../../lib/icons.jsx"

export default function Modal({ open, onClose, title, subtitle, children, maxW = "max-w-lg" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-brand-700/35 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className={`card relative w-full ${maxW} overflow-hidden shadow-[var(--shadow-pop)]`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                <h3 className="font-display text-xl font-semibold leading-tight">{title}</h3>
                {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-surface-2"
                aria-label="Fechar"
              >
                {Icon.close(18)}
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
