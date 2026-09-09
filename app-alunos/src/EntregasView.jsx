import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmarEntrega, getSessao, limparSessao, listarEntregas, logout } from './api'

export default function EntregasView() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [rodada, setRodada] = useState('')
  const [busca, setBusca] = useState('')
  const [alvo, setAlvo] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const enviando = useRef(false)
  const dialog = useRef(null)
  const navigate = useNavigate()
  const sessao = getSessao()

  useEffect(() => {
    if (alvo) dialog.current?.showModal()
  }, [alvo])

  function tratarErro(e) {
    if (e.status === 401) {
      limparSessao()
      navigate('/login', { replace: true, state: { message: 'Sessão expirada. Digite o PIN novamente.' } })
    } else setErro(e.status ? e.message : 'Sem conexão. Conecte-se e atualize a lista antes de confirmar.')
  }

  useEffect(() => {
    let ativo = true
    listarEntregas().then(d => { if (ativo) setDados(d) }).catch(e => {
      if (!ativo) return
      if (e.status === 401) {
        limparSessao()
        navigate('/login', { replace: true, state: { message: 'Sessão expirada. Digite o PIN novamente.' } })
      } else setErro(e.status ? e.message : 'Sem conexão. Conecte-se e atualize a lista.')
    })
    return () => { ativo = false }
  }, [navigate])

  async function atualizar() {
    setErro('')
    setOcupado(true)
    try { setDados(await listarEntregas()) } catch (e) { tratarErro(e) } finally { setOcupado(false) }
  }

  async function confirmar() {
    if (!alvo || enviando.current) return
    enviando.current = true
    setOcupado(true)
    setErro('')
    setMensagem('')
    try {
      const entregue = await confirmarEntrega(alvo.id)
      setDados(d => ({ ...d, alunos: d.alunos.map(a => a.id === entregue.id ? entregue : a) }))
      setMensagem(`Entrega registrada para ${alvo.nome}.`)
      setAlvo(null)
    } catch (e) { tratarErro(e) } finally { enviando.current = false; setOcupado(false) }
  }

  const alunosRodada = (dados?.alunos || []).filter(a => !rodada || String(a.rodada_id) === rodada)
  const alunos = alunosRodada.filter(a => a.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()))
  const entregues = alunosRodada.filter(a => a.entregue_em).length
  const botao = 'rounded-xl border border-line px-4 py-3 font-semibold disabled:opacity-50'

  return <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
    <header className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Entregas de materiais</h1><p>{sessao?.escola?.nome} · {sessao?.turma}</p></div><button className={botao} onClick={() => { void logout(); navigate('/login', { replace: true }) }}>Sair</button></header>
    <p>Aqui aparecem as rodadas liberadas pela gestão para sua turma. Confira o nome e o ID antes de entregar.</p>
    {erro && <p role="alert" className="rounded-lg border border-red-300 p-3 text-red-700">{erro}</p>}
    {mensagem && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{mensagem}</p>}
    <button className={botao} disabled={ocupado} onClick={atualizar}>Atualizar lista</button>
    {!dados && !erro && <p role="status">Carregando entregas…</p>}
    {dados && <><label className="block">Rodada<select className="mt-1 w-full rounded-lg border border-line p-3" value={rodada} onChange={e => { setRodada(e.target.value); setAlvo(null) }}><option value="">Todas as rodadas</option>{dados.rodadas.map(r => <option key={r.id} value={r.id}>{r.titulo}</option>)}</select></label>
      <p>{entregues} entregues · {alunosRodada.length - entregues} pendentes</p>
      <label className="block">Buscar aluno<input className="mt-1 w-full rounded-lg border border-line p-3" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      {!alunos.length && <p>Nenhuma entrega disponível. Aguarde a liberação da gestão ou revise a busca.</p>}
      {alunos.map(a => <article className="space-y-2 rounded-xl border border-line p-4" key={a.id}><h2 className="font-bold">{a.nome} · #{a.aluno_id}</h2><p>{a.turma_nome} · {a.serie} · {a.rodada_titulo}</p>
        {a.entregue_em ? <p className="font-semibold text-green-700">Entregue em {new Date(a.entregue_em).toLocaleString('pt-BR')}</p> : <button className={botao} disabled={ocupado} onClick={() => setAlvo(a)}>Registrar entrega</button>}
      </article>)}
    </>}
    {alvo && <dialog ref={dialog} onCancel={e => { e.preventDefault(); if (!ocupado) setAlvo(null) }} aria-labelledby="confirmar-entrega" className="m-auto w-[calc(100%_-_2rem)] max-w-md space-y-4 rounded-2xl bg-white p-6 backdrop:bg-black/40">
      <h2 id="confirmar-entrega" className="text-xl font-bold">Confirmar entrega</h2><p>{alvo.nome} · #{alvo.aluno_id}</p><p>{alvo.rodada_titulo}</p>
      <ul>{dados?.rodadas.find(r => r.id === alvo.rodada_id)?.itens.map(i => <li key={i.produto}>{i.produto_nome}: {i.quantidade} {i.unidade}</li>)}</ul><p>Confirme somente após entregar os materiais. O estoque será atualizado.</p>
      {erro && <p role="alert" className="text-red-700">{erro}</p>}
      <div className="flex flex-wrap gap-3"><button autoFocus className={botao} disabled={ocupado} onClick={() => setAlvo(null)}>Cancelar</button><button className={`${botao} bg-brand text-white`} disabled={ocupado} onClick={confirmar}>{ocupado ? 'Registrando…' : 'Confirmar recebimento'}</button></div>
    </dialog>}
  </div>
}
