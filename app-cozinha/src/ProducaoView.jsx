import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  baixaProducao,
  concluirOperacaoPendente,
  consultarBaixa,
  getPlano,
  limparSessao,
  logout,
  obterOperacaoPendente,
} from './api.js'
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Package,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react'

const TURNOS = [
  { key: 'MANHA', label: 'Manhã' },
  { key: 'TARDE', label: 'Tarde' },
  { key: 'INTEGRAL', label: 'Integral' },
]
const TURNO_LABEL = Object.fromEntries(TURNOS.map((turno) => [turno.key, turno.label]))

/** Formata YYYY-MM-DD para dd/mm/aaaa */
function formatarData(iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Retorna a data de hoje em YYYY-MM-DD (horário local) */
function hoje() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Determina o turno padrão pelo horário atual */
function turnoAtual() {
  const h = new Date().getHours()
  if (h < 12) return 'MANHA'
  if (h < 18) return 'TARDE'
  return 'INTEGRAL'
}

/* ─── Ícone por categoria ────────────────────────────────────────────── */
function IconeCategoria({ nome }) {
  const n = (nome ?? '').toLowerCase()
  if (n.includes('alimento') || n.includes('merenda') || n.includes('refeit')) {
    return <UtensilsCrossed size={24} data-testid="icone-categoria-alimento" />
  }
  if (n.includes('limpeza') || n.includes('higie')) {
    return <Droplets size={24} data-testid="icone-categoria-limpeza" />
  }
  return <Package size={24} data-testid="icone-categoria-padrao" />
}

/* ─── Card de produto ─────────────────────────────────────────────────── */
function CardProduto({ item }) {
  return (
    <div className={`recipe-card${item.estoque_insuficiente ? ' insufficient' : ''}`}>
      <div
        className="grid shrink-0 place-items-center rounded-2xl"
        style={{
          width: 52, height: 52,
          background: item.estoque_insuficiente ? 'rgba(193,68,68,0.12)' : 'var(--color-brand-tint)',
          color: item.estoque_insuficiente ? 'var(--color-err)' : 'var(--color-brand)',
        }}
      >
        <IconeCategoria nome={item.categoria_nome} />
      </div>

      <div className="min-w-0 flex-1">
        <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
          {item.produto_nome}
        </div>
        <div style={{ color: 'var(--color-ink-soft)', fontSize: '0.85rem', marginTop: 2 }}>
          {item.categoria_nome}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: item.estoque_insuficiente ? 'var(--color-err)' : 'var(--color-brand)',
            lineHeight: 1,
          }}
        >
          {item.quantidade_legivel ?? `${item.quantidade} ${item.unidade}`}
        </div>
        {item.estoque_insuficiente && (
          <div className="mt-1 flex items-center justify-end gap-1 text-[0.78rem] font-bold text-err">
            <AlertTriangle size={14} /> Estoque insuficiente
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Modal de confirmação da baixa ─────────────────────────────────── */
function ModalBaixa({ plano, onConfirmar, onCancelar, loading }) {
  const itensDisponiveis = plano.itens.filter((i) => !i.estoque_insuficiente)
  const confirmarRef = useRef(null)

  useEffect(() => {
    confirmarRef.current?.focus()
    const fecharComEscape = (event) => {
      if (event.key === 'Escape' && !loading) onCancelar()
    }
    document.addEventListener('keydown', fecharComEscape)
    return () => document.removeEventListener('keydown', fecharComEscape)
  }, [loading, onCancelar])

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacao-baixa"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titulo-confirmacao-baixa" className="m-0 mb-1 text-[1.3rem] font-extrabold">
          Confirmar baixa de produção
        </h2>
        <p className="m-0 mb-5 text-[0.9rem] text-ink-soft">
          {formatarData(plano.data)} · {TURNO_LABEL[plano.turno] ?? plano.turno}
        </p>

        <div className="mb-6 flex flex-col gap-2">
          {plano.itens.map((item) => (
            <div
              key={item.produto_id}
              className={`flex items-center justify-between rounded-[14px] px-4 py-3 ${item.estoque_insuficiente ? 'bg-err-tint text-err' : 'bg-canvas'}`}
            >
              <span className="text-[0.95rem] font-semibold">{item.produto_nome}</span>
              <span className={`text-base font-extrabold ${item.estoque_insuficiente ? 'text-err' : 'text-brand'}`}>
                {item.quantidade_legivel ?? `${item.quantidade} ${item.unidade}`}
                {item.estoque_insuficiente && ' · insuficiente'}
              </span>
            </div>
          ))}
        </div>

        {plano.itens.some((i) => i.estoque_insuficiente) && (
          <div className="mb-5 rounded-[14px] bg-warn-tint px-4 py-3 text-[0.88rem] font-semibold text-warn">
            A baixa é parcial: itens disponíveis serão processados e os insuficientes aparecerão como falha.
          </div>
        )}

        <button
          ref={confirmarRef}
          type="button"
          className="btn-action btn-primary"
          onClick={onConfirmar}
          disabled={loading || itensDisponiveis.length === 0}
        >
          {loading ? 'Registrando…' : (
            <>
              <CheckCircle2 size={20} /> Dar baixa
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="mt-3 w-full cursor-pointer border-none bg-transparent p-[0.9rem] text-[0.95rem] font-semibold text-ink-soft"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

/* ─── Modal de resultado da baixa ───────────────────────────────────── */
function ModalResultado({ resultado, onFechar }) {
  const IconeResultado = resultado.falhas === 0 ? CheckCircle2 : AlertTriangle
  const corIcone = resultado.falhas === 0 ? 'text-ok' : 'text-warn'
  const fecharRef = useRef(null)

  useEffect(() => {
    fecharRef.current?.focus()
    const fecharComEscape = (event) => {
      if (event.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', fecharComEscape)
    return () => document.removeEventListener('keydown', fecharComEscape)
  }, [onFechar])

  return (
    <div className="modal-overlay">
      <div
        className="modal-sheet text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-resultado-baixa"
      >
        <IconeResultado size={48} className={`mx-auto mb-2 ${corIcone}`} data-testid="icone-resultado" />
        <h2 id="titulo-resultado-baixa" className="m-0 mb-2 text-[1.3rem] font-extrabold">
          Baixa concluída
        </h2>

        {resultado.repetida && (
          <p className="m-0 text-[0.85rem] font-semibold text-ink-soft">
            Resultado recuperado sem repetir movimentações.
          </p>
        )}

        <div className="my-4 flex justify-center gap-6">
          <div>
            <div className="text-[2rem] font-extrabold text-ok">{resultado.sucesso}</div>
            <div className="text-[0.8rem] text-ink-soft">sucesso(s)</div>
          </div>
          {resultado.falhas > 0 && (
            <div>
              <div className="text-[2rem] font-extrabold text-err">{resultado.falhas}</div>
              <div className="text-[0.8rem] text-ink-soft">falha(s)</div>
            </div>
          )}
        </div>

        {resultado.resultados?.filter((r) => !r.ok).map((r) => (
          <div key={r.produto_id} className="mb-1.5 rounded-xl bg-err-tint px-3.5 py-2.5 text-left text-[0.85rem] font-semibold text-err">
            {r.produto_nome}: {r.erro}
          </div>
        ))}

        <button ref={fecharRef} type="button" className="btn-action btn-primary mt-4" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  )
}

/* ─── View principal ─────────────────────────────────────────────────── */
export default function ProducaoView() {
  const navigate = useNavigate()
  const [turno, setTurno] = useState(turnoAtual)
  const [data] = useState(hoje)
  const [plano, setPlano] = useState(null)
  const [loadingPlano, setLoadingPlano] = useState(false)
  const [erroPlano, setErroPlano] = useState('')
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingBaixa, setLoadingBaixa] = useState(false)
  const [resultado, setResultado] = useState(null)
  const enviandoRef = useRef(false)

  const redirecionarErroDeAcesso = useCallback((erro) => {
    if (erro.status !== 401 && erro.status !== 403) return false

    limparSessao()
    navigate('/login', {
      replace: true,
      state: {
        message: erro.status === 403
          ? 'O módulo de merenda está indisponível para este acesso.'
          : 'Sua sessão expirou. Digite o PIN novamente.',
      },
    })
    return true
  }, [navigate])

  const carregarPlano = useCallback(async () => {
    setLoadingPlano(true)
    setErroPlano('')
    try {
      const p = await getPlano(data, turno)
      setPlano(p)
      setUltimaSincronizacao(new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }))
    } catch (e) {
      if (redirecionarErroDeAcesso(e)) return
      setErroPlano(e.message ?? 'Erro ao carregar plano.')
    } finally {
      setLoadingPlano(false)
    }
  }, [data, turno, redirecionarErroDeAcesso])

  useEffect(() => {
    carregarPlano()
  }, [carregarPlano])

  async function executarBaixa() {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setLoadingBaixa(true)
    const operacaoId = obterOperacaoPendente(data, turno)
    try {
      const res = await baixaProducao(data, turno, undefined, operacaoId)
      concluirOperacaoPendente(data, turno, operacaoId)
      setResultado(res)
      setModalAberto(false)
    } catch (e) {
      if (redirecionarErroDeAcesso(e)) return

      const semResposta = e.status === undefined
      setModalAberto(false)
      if (semResposta) {
        try {
          const resultadoConsultado = await consultarBaixa(operacaoId)
          concluirOperacaoPendente(data, turno, operacaoId)
          setResultado(resultadoConsultado)
        } catch (erroConsulta) {
          if (redirecionarErroDeAcesso(erroConsulta)) return
          await carregarPlano()
          setErroPlano(
            erroConsulta.status === 404
              ? 'A baixa não foi encontrada no servidor. Você pode tentar novamente com segurança.'
              : 'Não foi possível confirmar a baixa. O identificador foi preservado para uma nova tentativa segura.'
          )
        }
      } else {
        if (e.status === 409) {
          concluirOperacaoPendente(data, turno, operacaoId)
        }
        setErroPlano(e.message ?? 'Erro ao registrar baixa.')
      }
    } finally {
      setLoadingBaixa(false)
      enviandoRef.current = false
    }
  }

  function fecharResultado() {
    setResultado(null)
    void carregarPlano()
  }

  function sair() {
    void logout()
    navigate('/login', { replace: true })
  }

  const itensDisponiveis = plano?.itens?.filter((i) => !i.estoque_insuficiente) ?? []

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-canvas)',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <header className="sticky top-0 z-20 bg-accent px-5 py-4 text-white">
        {plano?.previsao?.alerta_reducao && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-warn px-4 py-2.5 text-[0.9rem] font-bold text-white">
            <AlertTriangle size={18} />
            Frequência abaixo de 50% da média — considere reduzir a produção
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[1.3rem] font-extrabold leading-tight">Ordem de Produção</div>
            <div className="mt-0.5 text-[0.9rem] opacity-80">{formatarData(data)}</div>
          </div>
          <div className="text-right">
            {plano && (
              <>
                <div className="text-[1.8rem] font-extrabold leading-none">{plano.total_alunos}</div>
                <div className="text-[0.8rem] opacity-80">alunos</div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {TURNOS.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setTurno(t.key)}
              className={`turno-chip${turno === t.key ? ' active' : ' border-white/30 bg-white/10 text-white/75'}`}
              aria-pressed={turno === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[0.8rem] text-white/80">
          <span>
            {ultimaSincronizacao
              ? `Última atualização: ${ultimaSincronizacao}`
              : 'Aguardando atualização do plano'}
          </span>
          <button
            type="button"
            onClick={carregarPlano}
            disabled={loadingPlano}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3 py-2 font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={15} className={loadingPlano ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '1.25rem', paddingBottom: '7rem' }}>
        {loadingPlano && (
          <div role="status" style={{ textAlign: 'center', color: 'var(--color-ink-faint)', paddingTop: '3rem', fontSize: '1rem' }}>
            Carregando plano…
          </div>
        )}

        {erroPlano && !loadingPlano && (
          <div
            role="alert"
            style={{
              background: 'var(--color-err-tint)',
              color: 'var(--color-err)',
              borderRadius: 16,
              padding: '1rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {erroPlano}
            <button
              onClick={carregarPlano}
              style={{ display: 'block', margin: '0.75rem auto 0', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--color-err)', textDecoration: 'underline' }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loadingPlano && plano && plano.itens.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-ink-faint)', paddingTop: '3rem', fontSize: '1rem' }}>
            Nenhum item de produção para este turno.<br />
            <span style={{ fontSize: '0.85rem' }}>Verifique se as frequências foram registradas.</span>
          </div>
        )}

        {!loadingPlano && plano && plano.itens.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plano.itens.map((item) => (
              <CardProduto key={item.produto_id} item={item} />
            ))}
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 mx-auto max-w-[640px] border-t-[1.5px] border-line bg-surface px-5 py-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={sair}
            className="shrink-0 cursor-pointer rounded-2xl border-[1.5px] border-line bg-canvas px-4 py-3.5 text-[0.9rem] font-semibold text-ink-soft"
          >
            Sair
          </button>
          <button
            type="button"
            className="btn-action btn-primary flex-1"
            disabled={!plano || itensDisponiveis.length === 0 || loadingPlano}
            onClick={() => setModalAberto(true)}
          >
            Dar Baixa de Produção
          </button>
        </div>
      </footer>

      {modalAberto && plano && (
        <ModalBaixa
          plano={plano}
          onConfirmar={executarBaixa}
          onCancelar={() => {
            if (!loadingBaixa) setModalAberto(false)
          }}
          loading={loadingBaixa}
        />
      )}

      {resultado && (
        <ModalResultado resultado={resultado} onFechar={fecharResultado} />
      )}
    </div>
  )
}
