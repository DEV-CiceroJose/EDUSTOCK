import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10"
      style={{ maxWidth: 420, margin: '0 auto' }}
    >
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 grid place-items-center rounded-3xl"
          style={{
            width: 72, height: 72,
            background: 'var(--color-brand)',
            color: '#fff',
            fontSize: '2rem',
          }}
        >
          🍽️
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
          Produção
        </h1>
        <p style={{ color: 'var(--color-ink-soft)', marginTop: 6, fontSize: '1rem' }}>
          Digite o PIN da cozinha
        </p>
      </div>

      {/* Indicadores de dígito */}
      <div className="mb-6 flex items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
        ))}
      </div>

      {erro && (
        <div
          className="mb-4 w-full rounded-2xl px-4 py-3 text-center"
          style={{
            background: 'var(--color-err-tint)',
            color: 'var(--color-err)',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}
        >
          {erro}
        </div>
      )}

      <div className="grid w-full gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {teclas.map((t, i) => {
          if (t === '') return <div key={i} />
          if (t === 'back') {
            return (
              <button key="back" onClick={() => pressKey('back')} className="numkey numkey-back" aria-label="Apagar" disabled={loading}>
                ⌫
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
        <p className="mt-6 text-center" style={{ color: 'var(--color-ink-soft)', fontSize: '0.95rem' }}>
          Verificando…
        </p>
      )}
    </div>
  )
}
