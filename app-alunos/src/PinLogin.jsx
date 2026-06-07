import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from './api.js'

/**
 * Lê o mapa de PINs do .env:
 *   VITE_PINS=6A:1001,6B:1002,...
 *   VITE_TURNOS=6A:MANHA,7B:TARDE,...
 *
 * Retorna { [pin]: { turma, turno } }
 */
function carregarMapaPins() {
  const raw = import.meta.env.VITE_PINS ?? ''
  const turnos = import.meta.env.VITE_TURNOS ?? ''

  const mapasTurnos = {}
  for (const par of turnos.split(',')) {
    const [turma, turno] = par.split(':')
    if (turma && turno) mapasTurnos[turma.trim()] = turno.trim()
  }

  const mapa = {}
  for (const par of raw.split(',')) {
    const [turma, pin] = par.split(':')
    if (turma && pin) {
      mapa[pin.trim()] = {
        turma: turma.trim(),
        turno: mapasTurnos[turma.trim()] ?? 'MANHA',
      }
    }
  }
  return mapa
}

const MAPA_PINS = carregarMapaPins()

const TURNO_LABEL = { MANHA: 'Manhã', TARDE: 'Tarde', INTEGRAL: 'Integral' }

export default function PinLogin() {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const pressKey = useCallback((val) => {
    setErro('')
    if (val === 'back') {
      setPin((p) => p.slice(0, -1))
    } else if (pin.length < 4) {
      const novoPin = pin + val
      setPin(novoPin)
      // Auto-confirma quando completa 4 dígitos
      if (novoPin.length === 4) {
        confirmar(novoPin)
      }
    }
  }, [pin]) // eslint-disable-line

  async function confirmar(pinVal = pin) {
    if (pinVal.length !== 4) return
    const entrada = MAPA_PINS[pinVal]
    if (!entrada) {
      setErro('PIN inválido. Tente novamente.')
      setPin('')
      return
    }

    setLoading(true)
    try {
      await login(pinVal, entrada.turma, entrada.turno)
      navigate('/registrar', { replace: true })
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
      {/* Cabeçalho */}
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
          🏫
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
          Frequência
        </h1>
        <p style={{ color: 'var(--color-ink-soft)', marginTop: 6, fontSize: '1rem' }}>
          Digite o PIN da sua turma
        </p>
      </div>

      {/* Indicadores de dígito */}
      <div className="mb-6 flex items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`pin-dot${i < pin.length ? ' filled' : ''}`}
          />
        ))}
      </div>

      {/* Mensagem de erro */}
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

      {/* Teclado numérico */}
      <div
        className="grid w-full gap-3"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {teclas.map((t, i) => {
          if (t === '') return <div key={i} />
          if (t === 'back') {
            return (
              <button
                key="back"
                onClick={() => pressKey('back')}
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
              key={t}
              onClick={() => pressKey(t)}
              className="numkey"
              disabled={loading || pin.length >= 4}
            >
              {t}
            </button>
          )
        })}
      </div>

      {/* Estado de loading */}
      {loading && (
        <p
          className="mt-6 text-center"
          style={{ color: 'var(--color-ink-soft)', fontSize: '0.95rem' }}
        >
          Verificando…
        </p>
      )}

      {/* Rodapé com turno identificado (feedback visual antes de confirmar) */}
      {pin.length === 4 && MAPA_PINS[pin] && !loading && (
        <div
          className="mt-6 rounded-2xl px-5 py-3 text-center"
          style={{ background: 'var(--color-brand-tint)', fontSize: '1rem' }}
        >
          <span style={{ fontWeight: 700, color: 'var(--color-brand)' }}>
            Turma {MAPA_PINS[pin].turma}
          </span>{' '}
          <span style={{ color: 'var(--color-ink-soft)' }}>
            — {TURNO_LABEL[MAPA_PINS[pin].turno] ?? MAPA_PINS[pin].turno}
          </span>
        </div>
      )}
    </div>
  )
}
