import { useState, useCallback, useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Backspace } from '@phosphor-icons/react/Backspace'
import { CalendarBlank } from '@phosphor-icons/react/CalendarBlank'
import { CheckCircle } from '@phosphor-icons/react/CheckCircle'
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap'
import { Warning } from '@phosphor-icons/react/Warning'
import { OfflineQueueStatus } from '@edustock/operacao-shared'
import { filaContagens, getSessao, getStatusDoDia, registrarContagem, limparSessao, logout } from './api.js'

const MAX_ALUNOS_POR_TURMA = 45

function formatarData(iso) {
  if (!iso) return ''
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

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
  const [estado, setEstado] = useState('carregando') // carregando | idle | loading | sucesso | erro
  const [resultado, setResultado] = useState(null)
  const [mensagemErro, setMensagemErro] = useState('')
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState('')
  const [offlineEntries, setOfflineEntries] = useState(() => filaContagens.list())
  const enviandoRef = useRef(false)

  const pressKey = useCallback((val) => {
    if (estado !== 'idle') return
    if (val === 'back') {
      setNumero((n) => n.slice(0, -1))
    } else if (numero.length < 2) {
      setNumero((n) => n + val)
    }
  }, [estado, numero])

  const carregarStatus = useCallback(async () => {
    if (!sessao) return
    setEstado('carregando')
    setMensagemErro('')
    try {
      const statusDia = await getStatusDoDia()
      setUltimaSincronizacao(new Date(statusDia.sincronizado_em).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }))
      if (statusDia.frequencia_registrada) {
        setResultado({
          turma: statusDia.turma,
          turno: statusDia.turno,
          quantidade_alunos: statusDia.frequencia.quantidade_alunos,
          registrada_em: statusDia.frequencia.registrada_em,
          recuperado: true,
          historico_recente: statusDia.historico_recente ?? [],
        })
        setEstado('sucesso')
      } else {
        setEstado('idle')
      }
    } catch (erro) {
      if (erro.status === 401) {
        limparSessao()
        navigate('/login', {
          replace: true,
          state: { message: 'Sua sessão expirou. Digite o PIN novamente.' },
        })
        return
      }
      setMensagemErro(
        erro.status === 403
          ? erro.message
          : 'Não foi possível confirmar o registro do dia. Verifique a conexão e tente novamente.'
      )
      setEstado('erro')
    }
  }, [navigate, sessao?.turma])

  useEffect(() => {
    void carregarStatus()
  }, [carregarStatus])

  useEffect(() => filaContagens.subscribe(setOfflineEntries), [])

  function removerPendente(id) {
    if (window.confirm('Remover este registro rejeitado da fila?')) {
      filaContagens.remove(id)
    }
  }

  const offlineQueueStatus = (
    <OfflineQueueStatus
      entries={offlineEntries}
      onRetry={() => void filaContagens.retry()}
      onRemove={removerPendente}
    />
  )

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
      if (data.pendente) {
        setResultado({
          turma: sessao.turma,
          turno: sessao.turno,
          quantidade_alunos: qtd,
          pendente: true,
        })
        setEstado('sucesso')
        return
      }
      const statusAtualizado = await getStatusDoDia()
      setResultado({
        ...data,
        historico_recente: statusAtualizado.historico_recente ?? [],
      })
      setUltimaSincronizacao(new Date(statusAtualizado.sincronizado_em).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }))
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

  function sair() {
    void logout()
    navigate('/login', { replace: true })
  }

  if (estado === 'carregando') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <SpinnerGap size={36} weight="bold" className="mb-4 animate-spin text-brand" />
        <p className="font-semibold text-ink-soft">Sincronizando o registro de hoje…</p>
      </div>
    )
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
        {offlineQueueStatus}
        <div className="result-card w-full" role="status" aria-live="polite">
          <div
            className="mx-auto mb-5 grid place-items-center rounded-full text-ok"
            style={{ width: 80, height: 80, background: 'var(--color-ok-tint)' }}
          >
            <CheckCircle size={40} weight="duotone" data-testid="icone-sucesso" />
          </div>

          <p style={{ fontSize: '1rem', color: 'var(--color-ink-soft)', margin: 0 }}>
            Turma {resultado.turma} — Período integral
          </p>

          {resultado.recuperado && (
            <p className="mt-3 font-semibold text-ok">
              A frequência desta turma já foi enviada hoje.
            </p>
          )}
          {resultado.pendente && (
            <p className="mt-3 font-semibold text-warn">
              Salvo neste dispositivo. O envio será feito automaticamente quando a conexão voltar.
            </p>
          )}

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
              {alerta && <Warning size={16} weight="fill" />}
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

          {ultimaSincronizacao && (
            <p className="mt-4 text-sm text-ink-faint">
              Sincronizado às {ultimaSincronizacao}
            </p>
          )}
        </div>

        {resultado.historico_recente?.length > 0 && (
          <section className="mt-5 w-full rounded-2xl border border-line bg-canvas p-4" aria-labelledby="historico-turma">
            <h2 id="historico-turma" className="mb-3 flex items-center gap-2 text-base font-bold text-brand">
              <CalendarBlank size={20} weight="duotone" /> Histórico recente
            </h2>
            <div className="flex flex-col gap-2">
              {resultado.historico_recente.map((registro) => (
                <div key={`${registro.data}-${registro.criado_em}`} className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{formatarData(registro.data)}</span>
                  <strong>{registro.quantidade_alunos} alunos</strong>
                </div>
              ))}
            </div>
          </section>
        )}

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
        {offlineQueueStatus}
        <div className="result-card w-full" role="alert">
          <div
            className="mx-auto mb-5 grid place-items-center rounded-full text-err"
            style={{ width: 80, height: 80, background: 'var(--color-err-tint)' }}
          >
            <Warning size={40} weight="duotone" data-testid="icone-erro" />
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
          onClick={carregarStatus}
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
      aria-busy={estado === 'loading' || estado === 'carregando'}
    >
      {offlineQueueStatus}
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

      {ultimaSincronizacao && (
        <p className="mb-2 text-center text-xs text-ink-faint">
          Sincronizado às {ultimaSincronizacao}
        </p>
      )}

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
                <Backspace size={22} weight="bold" />
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
