import { useState } from "react"
import { motion } from "motion/react"
import { operacaoApi } from "../../api"
import { Icon } from "../../lib/icons.jsx"
import { useToast } from "../../components/ui/Toast"

const TURNOS = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "INTEGRAL", label: "Integral" },
]

const TURMAS_RAPIDAS = [
  "Total",
  "1º DS-A", "1º DS-B", "2º DS-A", "2º DS-B", "3º DS-A", "3º DS-B",
  "1º TET-A", "1º TET-B", "2º TET-A", "2º TET-B", "3º TET-A", "3º TET-B",
]

// Teclado numérico grande para uso em tablet/celular na hora da chamada
function TecladoNumerico({ valor, onChange, onConfirm, disabled }) {
  const digitar = (d) => {
    if (disabled) return
    if (d === "bk") {
      onChange(valor.slice(0, -1))
      return
    }
    if (valor.length >= 4) return
    onChange(valor + d)
  }

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bk", "0", "ok"]

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {teclas.map((t) => (
        <button
          key={t}
          type="button"
          disabled={disabled}
          onClick={() => (t === "ok" ? onConfirm() : digitar(t))}
          className={`grid min-h-[3.5rem] place-items-center rounded-2xl text-2xl font-bold transition active:scale-95 sm:min-h-[4rem] sm:text-3xl ${
            t === "ok"
              ? "col-span-1 bg-brand text-[#f4f1e7] disabled:opacity-40"
              : t === "bk"
                ? "bg-surface-2 text-ink-soft"
                : "border border-line bg-surface hover:bg-surface-2"
          }`}
        >
          {t === "bk" ? "⌫" : t === "ok" ? "✓" : t}
        </button>
      ))}
    </div>
  )
}

export default function ContagemView({ onRegistrado }) {
  const toast = useToast()
  const [turno, setTurno] = useState("MANHA")
  const [turma, setTurma] = useState("Total")
  const [valor, setValor] = useState("")
  const [status, setStatus] = useState(null) // ok | dup | err
  const [loading, setLoading] = useState(false)
  const [ultimaPrevisao, setUltimaPrevisao] = useState(null)

  async function confirmar() {
    const qtd = parseInt(valor, 10)
    if (!valor || Number.isNaN(qtd) || qtd < 0) {
      toast("Informe a quantidade de alunos", "low")
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const resp = await operacaoApi.registrarContagem({
        turma: turma.trim(),
        turno,
        quantidade_alunos: qtd,
      })
      setStatus("ok")
      setUltimaPrevisao(resp.previsao)
      setValor("")
      toast(`Contagem registrada: ${qtd} alunos (${turma})`)
      onRegistrado?.()
    } catch (err) {
      const msg = String(err.message || err)
      if (msg.includes("Já existe contagem")) {
        setStatus("dup")
        toast(msg, "low")
      } else {
        setStatus("err")
        toast(msg, "danger")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 text-center">
        <span className="grid mx-auto mb-2 h-12 w-12 place-items-center rounded-2xl bg-accent-tint text-accent">
          {Icon.presence(24)}
        </span>
        <h2 className="font-display text-2xl font-bold">Contagem de alunos</h2>
        <p className="text-sm text-ink-faint">Registro rápido para a cozinha</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {TURNOS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTurno(t.key)}
            className={`rounded-full border px-4 py-2 text-base font-semibold ${
              turno === t.key
                ? "border-brand bg-brand text-[#f4f1e7]"
                : "border-line bg-surface text-ink-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {TURMAS_RAPIDAS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTurma(t)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              turma === t ? "bg-brand-tint text-brand" : "bg-surface-2 text-ink-soft"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold">Turma</span>
        <input
          className="field text-center text-xl font-bold"
          value={turma}
          onChange={(e) => setTurma(e.target.value)}
          placeholder="Ex.: 6A"
        />
      </label>

      <div className="card mt-4 p-5 text-center">
        <div className="font-display text-5xl font-bold tabular-nums text-brand">
          {valor || "0"}
        </div>
        <p className="mt-1 text-sm text-ink-faint">alunos presentes</p>
      </div>

      <div className="mt-4">
        <TecladoNumerico
          valor={valor}
          onChange={setValor}
          onConfirm={confirmar}
          disabled={loading}
        />
      </div>

      {status === "ok" && ultimaPrevisao && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-4 border border-ok/30 bg-ok-tint p-4 text-center"
        >
          <p className="font-semibold text-ok">Contagem salva com sucesso</p>
          <p className="mt-1 text-sm text-ink-soft">
            Total no turno: {ultimaPrevisao.total_alunos} alunos
            {ultimaPrevisao.alerta_reducao && (
              <span className="ml-2 font-bold text-out">— presença muito baixa</span>
            )}
          </p>
        </motion.div>
      )}

      {status === "dup" && (
        <div className="card mt-4 border border-low bg-low-tint p-4 text-center text-sm font-semibold text-low">
          Esta turma já foi registrada hoje neste turno.
        </div>
      )}
    </div>
  )
}
