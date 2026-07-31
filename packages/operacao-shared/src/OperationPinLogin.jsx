import { useCallback, useState } from "react"

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"]

export default function OperationPinLogin({
  title,
  subtitle,
  icon,
  iconClassName = "bg-brand",
  login,
  onSuccess,
  fallbackError = "PIN inválido. Tente novamente.",
}) {
  const [pin, setPin] = useState("")
  const [erro, setErro] = useState("")
  const [loading, setLoading] = useState(false)

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
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center bg-white px-6 py-10">
      <div className="mb-8 text-center">
        <div
          className={`mx-auto mb-4 grid place-items-center rounded-3xl text-white ${iconClassName}`}
          style={{ width: 72, height: 72 }}
        >
          {icon}
        </div>
        <h1 className="m-0 text-[1.6rem] font-extrabold">{title}</h1>
        <p className="mt-1.5 text-base text-ink-soft">{subtitle}</p>
      </div>

      <div className="mb-6 flex items-center justify-center" aria-label={`${pin.length} de 4 dígitos informados`}>
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={`pin-dot${index < pin.length ? " filled" : ""}`} />
        ))}
      </div>

      {erro && (
        <div role="alert" className="mb-4 w-full rounded-2xl bg-err-tint px-4 py-3 text-center text-[0.95rem] font-semibold text-err">
          {erro}
        </div>
      )}

      <div className="grid w-full gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {TECLAS.map((key, index) => {
          if (key === "") return <div key={index} />
          if (key === "back") {
            return (
              <button
                key="back"
                type="button"
                onClick={() => pressKey("back")}
                className="numkey numkey-back"
                aria-label="Apagar"
                disabled={loading}
              >
                ⌫
              </button>
            )
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => pressKey(key)}
              className="numkey"
              disabled={loading || pin.length >= 4}
            >
              {key}
            </button>
          )
        })}
      </div>

      {loading && (
        <p className="mt-6 text-center text-[0.95rem] text-ink-soft">Verificando…</p>
      )}
    </div>
  )
}
