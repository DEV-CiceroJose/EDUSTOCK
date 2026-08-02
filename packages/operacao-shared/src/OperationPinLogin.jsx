import { useCallback, useEffect, useState } from "react"

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"]

export default function OperationPinLogin({
  title,
  subtitle,
  icon,
  iconClassName = "bg-brand",
  login,
  onSuccess,
  notice = "",
  fallbackError = "PIN inválido. Tente novamente.",
  disabled = false,
  disabledNotice = "",
  footer = null,
  backspaceIcon = "⌫",
}) {
  const [pin, setPin] = useState("")
  const [erro, setErro] = useState("")
  const [loading, setLoading] = useState(false)
  const [slowLoading, setSlowLoading] = useState(false)

  useEffect(() => {
    if (!loading) {
      setSlowLoading(false)
      return undefined
    }
    const timer = window.setTimeout(() => setSlowLoading(true), 1500)
    return () => window.clearTimeout(timer)
  }, [loading])

  const confirmar = useCallback(async (pinValue) => {
    if (pinValue.length !== 4) return
    setLoading(true)
    try {
      const session = await login(pinValue)
      onSuccess(session)
    } catch (error) {
      setErro(error.message ?? fallbackError)
      setPin("")
    } finally {
      setLoading(false)
    }
  }, [fallbackError, login, onSuccess])

  const pressKey = useCallback((value) => {
    setErro("")
    if (value === "back") {
      setPin((current) => current.slice(0, -1))
      return
    }
    setPin((current) => {
      if (current.length >= 4) return current
      const next = current + value
      if (next.length === 4) void confirmar(next)
      return next
    })
  }, [confirmar])

  return (
    <main
      className="operation-pin-shell"
      aria-busy={loading}
    >
      <div className="mb-8 text-center">
        <div
          className={`mx-auto mb-4 grid place-items-center rounded-3xl text-white ${iconClassName}`}
          style={{ width: 72, height: 72 }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <h1 className="m-0 text-[1.6rem] font-extrabold">{title}</h1>
        <p className="mt-1.5 text-base text-ink-soft">{subtitle}</p>
      </div>

      <div
        className="mb-6 flex items-center justify-center"
        aria-label={`${pin.length} de 4 dígitos informados`}
        aria-live="polite"
        aria-atomic="true"
      >
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={`pin-dot${index < pin.length ? " filled" : ""}`} />
        ))}
      </div>

      {disabled && disabledNotice && (
        <div role="status" aria-live="polite" className="mb-4 w-full rounded-2xl bg-err-tint px-4 py-3 text-center text-[0.95rem] font-semibold text-err">
          {disabledNotice}
        </div>
      )}

      {notice && !erro && !disabled && (
        <div role="status" aria-live="polite" className="mb-4 w-full rounded-2xl bg-warn-tint px-4 py-3 text-center text-[0.95rem] font-semibold text-warn">
          {notice}
        </div>
      )}

      {erro && (
        <div role="alert" aria-live="assertive" className="mb-4 w-full rounded-2xl bg-err-tint px-4 py-3 text-center text-[0.95rem] font-semibold text-err">
          {erro}
        </div>
      )}

      <div className="grid w-full gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {TECLAS.map((key, index) => {
          if (key === "") return <div key={`empty-${index}`} />
          if (key === "back") {
            return (
              <button
                key="back"
                type="button"
                onClick={() => pressKey("back")}
                className="numkey numkey-back"
                aria-label="Apagar"
                disabled={disabled || loading || pin.length === 0}
              >
                {backspaceIcon}
              </button>
            )
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => pressKey(key)}
              className="numkey"
              disabled={disabled || loading || pin.length >= 4}
            >
              {key}
            </button>
          )
        })}
      </div>

      {loading && (
        <p role="status" aria-live="polite" className="mt-6 text-center text-[0.95rem] text-ink-soft">
          {slowLoading ? "Servidor iniciando, aguarde…" : "Verificando…"}
        </p>
      )}

      {footer}
    </main>
  )
}
