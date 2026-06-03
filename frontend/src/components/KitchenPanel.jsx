import { useState } from "react"
import { motion } from "motion/react"
import { Icon } from "../lib/icons.jsx"
import { useToast } from "./Toast"

function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface hover:bg-surface-2"
        aria-label="Diminuir"
      >
        {Icon.minus(16)}
      </button>
      <span className="min-w-14 rounded-xl bg-brand-tint px-3 py-1.5 text-center font-display text-lg font-bold text-brand">
        {value}
      </span>
      <button
        onClick={() => onChange(value + 1)}
        className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface hover:bg-surface-2"
        aria-label="Aumentar"
      >
        {Icon.plus(16)}
      </button>
    </div>
  )
}

export default function KitchenPanel() {
  const [presentes, setPresentes] = useState(450)
  const [enviado, setEnviado] = useState(false)
  const toast = useToast()

  function enviar() {
    setEnviado(true)
    toast(`Chamada enviada: ${presentes} porções p/ a cozinha`)
    setTimeout(() => setEnviado(false), 2600)
  }

  return (
    <div className="card overflow-hidden">
      {/* Cabeçalho do módulo */}
      <div className="flex items-center gap-2 border-b border-line bg-accent-tint/60 px-5 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-white">
          {Icon.food(18)}
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="truncate font-display font-bold">Refeitório & Alimentação</h2>
          <p className="truncate text-[0.68rem] text-ink-faint">Integração diária com a cozinha</p>
        </div>
      </div>

      <div className="p-5">
        {/* Presença */}
        <div className="rounded-2xl border border-line bg-surface-2/50 p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-brand">
            {Icon.presence(26)}
            <motion.span
              key={presentes}
              initial={{ scale: 0.85, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display text-6xl font-bold leading-none"
            >
              {presentes}
            </motion.span>
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Alunos presentes hoje
          </div>
          <div className="mt-4 flex items-center justify-center">
            <Stepper value={presentes} onChange={setPresentes} />
          </div>
        </div>

        {/* Enviar */}
        <button
          onClick={enviar}
          className={`btn mt-4 w-full py-3.5 text-base ${enviado ? "btn-soft" : "btn-accent"}`}
        >
          {enviado ? <>✓ Chamada enviada</> : <>{Icon.send(18)} Enviar chamada para a cozinha</>}
        </button>
        <p className="mt-2.5 text-center text-xs text-ink-faint">
          Congela o total de presentes e avisa a cozinha a quantidade de porções.
        </p>
      </div>
    </div>
  )
}
