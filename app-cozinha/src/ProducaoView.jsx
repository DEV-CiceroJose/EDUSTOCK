import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlano, baixaProducao, logout } from './api.js'

const TURNOS = [
  { key: 'MANHA', label: 'Manhã' },
  { key: 'TARDE', label: 'Tarde' },
  { key: 'INTEGRAL', label: 'Integral' },
]

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

/* ─── Ícones SVG inline por categoria ───────────────────────────────── */
function IconeCategoria({ nome }) {
  const n = (nome ?? '').toLowerCase()
  // Alimentos → prato
  if (n.includes('alimento') || n.includes('merenda') || n.includes('refeit')) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v9m0 0 4-4m-4 4-4-4" />
      </svg>
    )
  }
  // Limpeza → balde
  if (n.includes('limpeza') || n.includes('higie')) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h10l-1 10H8L7 7Z" />
        <path d="M5 7h14" />
        <path d="M10 3h4v4h-4z" />
      </svg>
    )
  }
  // Padrão → caixa
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8V21H3V8" />
      <path d="M23 3H1v5h22V3z" />
      <path d="M10 12h4" />
    </svg>
  )
}

/* ─── Card de produto ─────────────────────────────────────────────────── */
function CardProduto({ item }) {
  return (
    <div className={`recipe-card${item.estoque_insuficiente ? ' insufficient' : ''}`}>
      {/* Ícone da categoria */}
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

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
          {item.produto_nome}
        </div>
        <div style={{ color: 'var(--color-ink-soft)', fontSize: '0.85rem', marginTop: 2 }}>
          {item.categoria_nome}
        </div>
      </div>

      {/* Quantidade em destaque */}
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
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--color-err)',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
            }}
          >
            ⚠ Estoque insuficiente
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Modal de confirmação da baixa ─────────────────────────────────── */
function ModalBaixa({ plano, onConfirmar, onCancelar, loading }) {
  const itensDisponiveis = plano.itens.filter((i) => !i.estoque_insuficiente)

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 4px' }}>
          Confirmar baixa de produção
        </h2>
        <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
          Serão registradas saídas de estoque para os itens abaixo.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
          {itensDisponiveis.map((item) => (
            <div
              key={item.produto_id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.7rem 1rem',
                background: 'var(--color-canvas)',
                borderRadius: 14,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.produto_nome}</span>
              <span style={{ fontWeight: 800, color: 'var(--color-brand)', fontSize: '1rem' }}>
                {item.quantidade_legivel ?? `${item.quantidade} ${item.unidade}`}
              </span>
            </div>
          ))}
        </div>

        {plano.itens.some((i) => i.estoque_insuficiente) && (
          <div
            style={{
              background: 'var(--color-warn-tint)',
              color: 'var(--color-warn)',
              borderRadius: 14,
              padding: '0.7rem 1rem',
              fontSize: '0.88rem',
              fontWeight: 600,
              marginBottom: '1.25rem',
            }}
          >
            Itens com estoque insuficiente serão ignorados.
          </div>
        )}

        <button
          className="btn-action btn-primary"
          onClick={onConfirmar}
          disabled={loading || itensDisponiveis.length === 0}
        >
          {loading ? 'Registrando…' : '✓ Dar baixa'}
        </button>
        <button
          onClick={onCancelar}
          style={{
            marginTop: '0.75rem',
            width: '100%',
            padding: '0.9rem',
            background: 'transparent',
            border: 'none',
            fontSize: '0.95rem',
            color: 'var(--color-ink-soft)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

/* ─── Modal de resultado da baixa ───────────────────────────────────── */
function ModalResultado({ resultado, onFechar }) {
  return (
    <div className="modal-overlay">
      <div className="modal-sheet" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
          {resultado.falhas === 0 ? '✅' : '⚠️'}
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px' }}>
          Baixa concluída
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, margin: '1rem 0 1.25rem' }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-ok)' }}>
              {resultado.sucesso}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>sucesso(s)</div>
          </div>
          {resultado.falhas > 0 && (
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-err)' }}>
                {resultado.falhas}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>falha(s)</div>
            </div>
          )}
        </div>

        {/* Detalhe das falhas */}
        {resultado.resultados?.filter((r) => !r.ok).map((r) => (
          <div
            key={r.produto_id}
            style={{
              background: 'var(--color-err-tint)',
              color: 'var(--color-err)',
              borderRadius: 12,
              padding: '0.6rem 0.9rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: 6,
              textAlign: 'left',
            }}
          >
            {r.produto_nome}: {r.erro}
          </div>
        ))}

        <button className="btn-action btn-primary" style={{ marginTop: '1rem' }} onClick={onFechar}>
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
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingBaixa, setLoadingBaixa] = useState(false)
  const [resultado, setResultado] = useState(null)

  const carregarPlano = useCallback(async () => {
    setLoadingPlano(true)
    setErroPlano('')
    try {
      const p = await getPlano(data, turno)
      setPlano(p)
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      setErroPlano(e.message ?? 'Erro ao carregar plano.')
    } finally {
      setLoadingPlano(false)
    }
  }, [data, turno, navigate])

  useEffect(() => {
    carregarPlano()
  }, [carregarPlano])

  async function executarBaixa() {
    setLoadingBaixa(true)
    try {
      const res = await baixaProducao(data, turno)
      setResultado(res)
      setModalAberto(false)
    } catch (e) {
      setErroPlano(e.message ?? 'Erro ao registrar baixa.')
      setModalAberto(false)
    } finally {
      setLoadingBaixa(false)
    }
  }

  function fecharResultado() {
    setResultado(null)
    carregarPlano() // recarrega para refletir novos saldos
  }

  function sair() {
    logout()
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
      {/* ── Cabeçalho ── */}
      <header
        style={{
          background: 'var(--color-brand)',
          color: '#fff',
          padding: '1rem 1.25rem',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        {/* Alerta de frequência baixa */}
        {plano?.previsao?.alerta_reducao && (
          <div
            style={{
              background: 'var(--color-warn)',
              color: '#fff',
              borderRadius: 12,
              padding: '0.6rem 1rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ⚠️ Frequência abaixo de 50% da média — considere reduzir a produção
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.1 }}>
              Ordem de Produção
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: 2 }}>
              {formatarData(data)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {plano && (
              <>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>
                  {plano.total_alunos}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>alunos</div>
              </>
            )}
          </div>
        </div>

        {/* Chips de turno */}
        <div style={{ display: 'flex', gap: 8 }}>
          {TURNOS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTurno(t.key)}
              className={`turno-chip${turno === t.key ? ' active' : ''}`}
              style={turno !== t.key ? { color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)' } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Corpo ── */}
      <main style={{ flex: 1, padding: '1.25rem', paddingBottom: '7rem' }}>
        {loadingPlano && (
          <div style={{ textAlign: 'center', color: 'var(--color-ink-faint)', paddingTop: '3rem', fontSize: '1rem' }}>
            Carregando plano…
          </div>
        )}

        {erroPlano && !loadingPlano && (
          <div
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

      {/* ── Rodapé fixo com botão de baixa ── */}
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--color-surface)',
          borderTop: '1.5px solid var(--color-line)',
          padding: '1rem 1.25rem',
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={sair}
            style={{
              padding: '0.9rem 1rem',
              borderRadius: 16,
              border: '1.5px solid var(--color-line)',
              background: 'var(--color-canvas)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--color-ink-soft)',
              flexShrink: 0,
            }}
          >
            Sair
          </button>
          <button
            className="btn-action btn-primary"
            style={{ flex: 1 }}
            disabled={!plano || itensDisponiveis.length === 0 || loadingPlano}
            onClick={() => setModalAberto(true)}
          >
            Dar Baixa de Produção
          </button>
        </div>
      </footer>

      {/* ── Modal de confirmação ── */}
      {modalAberto && plano && (
        <ModalBaixa
          plano={plano}
          onConfirmar={executarBaixa}
          onCancelar={() => setModalAberto(false)}
          loading={loadingBaixa}
        />
      )}

      {/* ── Modal de resultado ── */}
      {resultado && (
        <ModalResultado resultado={resultado} onFechar={fecharResultado} />
      )}
    </div>
  )
}
