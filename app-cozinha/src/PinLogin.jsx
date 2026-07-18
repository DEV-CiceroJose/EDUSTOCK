import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, Delete } from 'lucide-react'
import { login } from './api.js'

export default function PinLogin() {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // PIN configurado via .env — validação final sempre no backend
  const pinEsperado = import.meta.env.VITE_PIN_COZINHA ?? ''

  const pressKey = useCallback((val) => {
    setErro('')
    if (val === 'back') {
      setPin((p) => p.slice(0, -1))
    } else if (pin.length < 4) {
      const novoPin = pin + val
      setPin(novoPin)
      if (novoPin.length === 4) confirmar(novoPin)
    }
  }, [pin]) // eslint-disable-line

  async function confirmar(pinVal = pin) {
    if (pinVal.length !== 4) return

    // Verificação local antes de ir ao servidor (reduz latência na interface)
    if (pinEsperado && pinVal !== pinEsperado) {
      setErro('PIN inválido.')
      setPin('')
      return
    }

    setLoading(true)
    try {
      await login(pinVal)
      navigate('/producao', { replace: true })
    } catch (e) {
      setErro(e.message ?? 'Falha na conexão.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center bg-white px-6 py-10">
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 grid place-items-center rounded-3xl bg-accent text-white"
          style={{ width: 72, height: 72 }}
        >
          <ChefHat size={32} data-testid="icone-cabecalho" />
        </div>
        <h1 className="m-0 text-[1.6rem] font-extrabold">Produção</h1>
        <p className="mt-1.5 text-base text-ink-soft">Digite o PIN da cozinha</p>
      </div>

      <div className="mb-6 flex items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
        ))}
      </div>

      {erro && (
        <div className="mb-4 w-full rounded-2xl bg-err-tint px-4 py-3 text-center text-[0.95rem] font-semibold text-err">
          {erro}
        </div>
      )}

      <div className="grid w-full gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {teclas.map((t, i) => {
          if (t === '') return <div key={i} />
          if (t === 'back') {
            return (
              <button key="back" onClick={() => pressKey('back')} className="numkey numkey-back" aria-label="Apagar" disabled={loading}>
                <Delete size={22} />
              </button>
            )
          }
          return (
            <button key={t} onClick={() => pressKey(t)} className="numkey" disabled={loading || pin.length >= 4}>
              {t}
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
