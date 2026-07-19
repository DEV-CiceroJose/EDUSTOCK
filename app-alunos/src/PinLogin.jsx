import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, Delete } from 'lucide-react'
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
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center bg-white px-6 py-10">
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 grid place-items-center rounded-3xl bg-brand text-white"
          style={{ width: 72, height: 72 }}
        >
          <School size={32} data-testid="icone-cabecalho" />
        </div>
        <h1 className="m-0 text-[1.6rem] font-extrabold">Frequência</h1>
        <p className="mt-1.5 text-base text-ink-soft">Digite o PIN da sua turma</p>
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

      {pin.length === 4 && MAPA_PINS[pin] && !loading && (
        <div className="mt-6 rounded-2xl bg-brand-tint px-5 py-3 text-center text-base">
          <span className="font-bold text-brand">Turma {MAPA_PINS[pin].turma}</span>{' '}
          <span className="text-ink-soft">— {TURNO_LABEL[MAPA_PINS[pin].turno] ?? MAPA_PINS[pin].turno}</span>
        </div>
      )}
    </div>
  )
}
