import { useState, useCallback, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Delete } from 'lucide-react'
import { getSessao, registrarContagem, limparSessao, logout } from './api.js'

const MAX_ALUNOS_POR_TURMA = 45

/**
 * Formata a variação percentual em relação à média histórica.
 * Retorna null se não houver histórico.
 */
function formatarVariacao(previsao) {
  if (!previsao) return null
  const { total_alunos, media_historica } = previsao
  if (!media_historica || media_historica === 0) return null
  const pct = ((total_alunos - media_historica) / media_historica) * 100
  const sinal = pct > 0 ? '+' : ''
  return `${sinal}${pct.toFixed(0)}% em relação à média`
}

export default function ContagemView() {
  const navigate = useNavigate()
  const sessao = getSessao()

  const [numero, setNumero] = useState('')    // string de dígitos do teclado
  const [estado, setEstado] = useState('idle') // 'idle' | 'loading' | 'sucesso' | 'erro'
  const [resultado, setResultado] = useState(null)
  const [mensagemErro, setMensagemErro] = useState('')
  const enviandoRef = useRef(false)

  const pressKey = useCallback((val) => {
    if (estado !== 'idle') return
    if (val === 'back') {
      setNumero((n) => n.slice(0, -1))
    } else if (numero.length < 2) {
      setNumero((n) => n + val)
    }
  }, [estado, numero])

  // Mantém a ordem dos hooks e redireciona se a sessão expirou.
  if (!sessao) {
    return <Navigate to="/login" replace />
  }

  async function confirmar() {
    const qtd = parseInt(numero, 10)
    if (!qtd || qtd <= 0 || qtd > MAX_ALUNOS_POR_TURMA) return
    if (enviandoRef.current) return
    enviandoRef.current = true

    setEstado('loading')
    try {
      const data = await registrarContagem(qtd)
      setResultado(data)
      setEstado('sucesso')
    } catch (e) {
      if (e.status === 401) {
        limparSessao()
        navigate('/login', {
          replace: true,
          state: { message: 'Sua sessão expirou. Digite o PIN novamente.' },
        })
        return
      }

      if (e.status === 409) {
        setMensagemErro('Frequência já registrada hoje para esta turma.')
      } else if (e instanceof TypeError || !e.status) {
        setMensagemErro('Sem conexão com o sistema. Verifique a internet e tente novamente.')
      } else {
        setMensagemErro(e.message ?? 'Erro ao registrar. Tente novamente.')
      }
      setEstado('erro')
    } finally {
      enviandoRef.current = false
    }
  }

  function reiniciar() {
    setNumero('')
    setEstado('idle')
    setResultado(null)
    setMensagemErro('')
  }

  function sair() {
    void logout()
    navigate('/login', { replace: true })
  }

  /* ---- Tela de Sucesso ---- */
  if (estado === 'sucesso' && resultado) {
    const variacao = formatarVariacao(resultado.previsao)
    const alerta = resultado.previsao?.alerta_reducao

    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10"
        style={{ maxWidth: 420, margin: '0 auto' }}
      >
        <div className="result-card w-full" role="status" aria-live="polite">
          <div
            className="mx-auto mb-5 grid place-items-center rounded-full text-ok"
            style={{ width: 80, height: 80, background: 'var(--color-ok-tint)' }}
          >
            <CheckCircle2 size={40} data-testid="icone-sucesso" />
          </div>

          <p style={{ fontSize: '1rem', color: 'var(--color-ink-soft)', margin: 0 }}>
            Turma {resultado.turma} — Período integral
          </p>

          <div
            style={{
              fontSize: '4rem',
              fontWeight: 800,
              color: 'var(--color-brand)',
              lineHeight: 1.1,
              marginTop: '0.5rem',
            }}
          >
            {resultado.quantidade_alunos}
          </div>
          <p style={{ fontSize: '1.1rem', color: 'var(--color-ink-soft)', margin: '4px 0 0' }}>
            alunos registrados
          </p>

          {variacao && (
            <p
              className="mt-4 flex items-center justify-center gap-1.5 text-[0.95rem] font-semibold"
              style={{ color: alerta ? 'var(--color-warn)' : 'var(--color-ink-soft)' }}
            >
              {alerta && <AlertTriangle size={16} />}
              {variacao}
            </p>
          )}

          {alerta && (
            <div
              className="mt-4 rounded-xl px-4 py-3"
              style={{
                background: 'var(--color-warn-tint)',
                color: 'var(--color-warn)',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              Frequência abaixo de 50% da média histórica
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={sair}
          className="mt-8 w-full rounded-2xl py-4"
          style={{
            background: 'var(--color-canvas)',
            border: '1.5px solid var(--color-line)',
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Concluído
        </button>
      </div>
    )
  }

  /* ---- Tela de Erro ---- */
  if (estado === 'erro') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10"
        style={{ maxWidth: 420, margin: '0 auto' }}
      >
        <div className="result-card w-full" role="alert">
          <div
            className="mx-auto mb-5 grid place-items-center rounded-full text-err"
            style={{ width: 80, height: 80, background: 'var(--color-err-tint)' }}
          >
            <AlertTriangle size={40} data-testid="icone-erro" />
          </div>
          <p
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--color-err)',
              margin: 0,
            }}
          >
            {mensagemErro}
          </p>
        </div>

        <button
          type="button"
          onClick={reiniciar}
          className="mt-6 w-full rounded-2xl py-4"
          style={{
            background: 'var(--color-brand)',
            color: '#fff',
            border: 'none',
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>

        <button
          type="button"
          onClick={sair}
          className="mt-3 w-full rounded-2xl py-4"
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '0.95rem',
            color: 'var(--color-ink-soft)',
            cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>
    )
  }

  /* ---- Tela Principal de Registro ---- */
  const quantidadeInformada = parseInt(numero, 10)
  const limiteExcedido = numero.length > 0 && quantidadeInformada > MAX_ALUNOS_POR_TURMA
  const podeConfirmar = (
    numero.length > 0
    && quantidadeInformada > 0
    && !limiteExcedido
    && estado === 'idle'
  )
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

  return (
    <div
      className="flex min-h-screen flex-col bg-white px-6 pb-8 pt-6"
      style={{ maxWidth: 420, margin: '0 auto' }}
      aria-busy={estado === 'loading'}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
            Turma {sessao.turma}
          </div>
          <div style={{ color: 'var(--color-ink-soft)', fontSize: '0.95rem', marginTop: 2 }}>
            Período integral
          </div>
        </div>
        <button
          type="button"
          onClick={sair}
          style={{
            background: 'var(--color-canvas)',
            border: '1.5px solid var(--color-line)',
            borderRadius: 12,
            padding: '0.4rem 0.9rem',
            fontSize: '0.85rem',
            cursor: 'pointer',
            color: 'var(--color-ink-soft)',
            fontWeight: 600,
          }}
        >
          Sair
        </button>
      </div>

      <p
        className="mb-2 text-center"
        style={{ color: 'var(--color-ink-soft)', fontSize: '1rem' }}
      >
        Quantos alunos estão presentes?
      </p>

      <div
        className="pin-display mb-6 flex items-center justify-center"
        style={{ minHeight: '5rem' }}
        aria-label="Quantidade de alunos informada"
        aria-live="polite"
      >
        {numero ? (
          <span style={{ color: 'var(--color-brand)' }}>{numero}</span>
        ) : (
          <span style={{ color: 'var(--color-ink-faint)', fontSize: '2rem' }}>—</span>
        )}
      </div>

      <p
        className="mb-4 text-center"
        role={limiteExcedido ? 'alert' : undefined}
        style={{
          color: limiteExcedido ? 'var(--color-err)' : 'var(--color-ink-soft)',
          fontSize: '0.9rem',
          fontWeight: limiteExcedido ? 700 : 500,
        }}
      >
        {limiteExcedido
          ? 'O limite permitido é 45 alunos.'
          : 'Máximo permitido: 45 alunos.'}
      </p>

      <div
        className="grid flex-1 gap-3"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {teclas.map((t, i) => {
          if (t === '') {
            return <div key={`empty-${i}`} />
          }
          if (t === 'back') {
            return (
              <button
                key="back"
                type="button"
                onClick={() => pressKey('back')}
                className="numkey numkey-back"
                aria-label="Apagar"
              >
                <Delete size={22} />
              </button>
            )
          }
          return (
            <button
              key={t}
              type="button"
              onClick={() => pressKey(t)}
              className="numkey"
            >
              {t}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={confirmar}
        disabled={!podeConfirmar}
        className="numkey-confirm mt-4 w-full rounded-2xl py-5"
        style={{
          fontSize: '1.15rem',
          fontWeight: 700,
          background: podeConfirmar ? 'var(--color-brand)' : '#ccc',
          color: '#fff',
          border: 'none',
          cursor: podeConfirmar ? 'pointer' : 'not-allowed',
          transition: 'background 150ms',
          minHeight: 64,
        }}
      >
        {estado === 'loading' ? 'Enviando…' : 'Confirmar'}
      </button>
    </div>
  )
}
