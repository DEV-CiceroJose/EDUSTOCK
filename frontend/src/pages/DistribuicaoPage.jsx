import { useEffect, useState } from 'react'
import { distribuicao } from '../api/distribuicao'
import { getEscola } from '../lib/auth'
import './distribuicao-print.css'

const tipos = { ABSORVENTE: 'Absorventes', KIT_ESCOLAR: 'Kit escolar', FARDAMENTO: 'Fardamento' }
const estados = { RASCUNHO: 'Rascunho', LIBERADA: 'Liberada', SUSPENSA: 'Suspensa', ENCERRADA: 'Encerrada' }
const input = 'w-full rounded-lg border border-line bg-surface p-2'
const button = 'rounded-lg border border-line px-4 py-2 font-medium disabled:opacity-50'
const vazio = { nome: '', turma: '', serie: '', sexo: 'N', ativo: true }

export default function DistribuicaoPage() {
  const [aba, setAba] = useState('alunos')
  const [base, setBase] = useState(null)
  const [rodadas, setRodadas] = useState([])
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [previa, setPrevia] = useState(null)
  const [aluno, setAluno] = useState(vazio)
  const [busca, setBusca] = useState('')
  const [turma, setTurma] = useState('')
  const [nova, setNova] = useState({ titulo: '', tipo: 'KIT_ESCOLAR', itens: [{ produto: '', quantidade: '1' }] })
  const [filtros, setFiltros] = useState({ rodada: '', tipo: '', turma: '', situacao: '' })
  const [relatorio, setRelatorio] = useState(null)

  async function carregar() {
    const [cadastro, entregas] = await Promise.all([distribuicao('/alunos/'), distribuicao('/rodadas/')])
    setBase(cadastro)
    setRodadas(entregas)
  }

  useEffect(() => {
    let ativo = true
    Promise.all([distribuicao('/alunos/'), distribuicao('/rodadas/')])
      .then(([cadastro, entregas]) => { if (ativo) { setBase(cadastro); setRodadas(entregas) } })
      .catch(e => { if (ativo) setErro(e.message) })
    return () => { ativo = false }
  }, [])

  async function executar(action) {
    if (ocupado) return
    setOcupado(true)
    setErro('')
    setMensagem('')
    try { await action() } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function salvarAluno(event) {
    event.preventDefault()
    await executar(async () => {
      await distribuicao(aluno.id ? `/alunos/${aluno.id}/` : '/alunos/', {
        method: aluno.id ? 'PATCH' : 'POST', body: { ...aluno, turma: Number(aluno.turma) },
      })
      setAluno(vazio)
      setPrevia(null)
      await carregar()
      setMensagem('Cadastro salvo. Rodadas já liberadas preservam a lista original.')
    })
  }

  async function importar(event) {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo) return
    setPrevia(null)
    await executar(async () => {
      const body = new FormData()
      body.append('arquivo', arquivo)
      setPrevia(await distribuicao('/importacao/', { method: 'POST', body }))
    })
  }

  const query = () => new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor)).toString()
  const alunos = (base?.alunos || []).filter(a => a.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()) && (!turma || String(a.turma) === turma))
  const listaTurmas = base?.turmas || []

  return <div className="distribuicao-page mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <header><h1 className="text-2xl font-bold">Alunos e entregas</h1><p>{getEscola()?.nome} · Cadastro escolar e distribuição de materiais</p></header>
    <nav aria-label="Seções de distribuição" className="flex flex-wrap gap-2 print:hidden">
      {[['alunos', 'Alunos'], ['rodadas', 'Rodadas de entrega'], ['relatorio', 'Relatório']].map(([key, label]) => <button key={key} className={button} aria-pressed={aba === key} onClick={() => setAba(key)}>{label}</button>)}
    </nav>
    {erro && <div role="alert" className="rounded-lg border border-red-300 p-3 text-red-700">{erro} <button className={button} disabled={ocupado} onClick={() => executar(carregar)}>Tentar novamente</button></div>}
    {mensagem && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{mensagem}</p>}
    {!base && !erro && <p role="status">Carregando cadastro…</p>}
    {base && aba === 'alunos' && <>
      <div className="rounded-xl border border-line p-4"><strong>{base.total_ativos} alunos ativos na escola</strong><div className="mt-2 flex flex-wrap gap-3">{base.por_turma.map(t => <span key={t.turma_id}>{t.turma__nome}: {t.total}</span>)}</div></div>
      <section className="space-y-3 rounded-xl border border-line p-4">
        <h2 className="font-bold">Importar alunos</h2><p>Preencha nome, turma, série e sexo (F, M ou N). Use uma turma existente. O sistema gera o ID. Cadastros existentes serão preservados.</p>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={ocupado} onClick={() => executar(() => distribuicao('/modelo/', { download: 'modelo-alunos.xlsx' }))}>Baixar modelo Excel</button>
          <label className={button}>Conferir planilha <input aria-label="Planilha de alunos" type="file" accept=".xlsx,.csv" disabled={ocupado} onChange={importar} className="block max-w-full" /></label></div>
        {previa && <div className="space-y-2"><p>{previa.novos} novos · {previa.ignorados} já cadastrados · {previa.erros.length} erros</p>
          {[...previa.erros, ...previa.avisos].map((e, i) => <p key={i}>{e}</p>)}
          <ul className="max-h-56 overflow-auto">{previa.previa.map((a, i) => <li key={i}>{a.nome} · {listaTurmas.find(t => t.id === a.turma_id)?.nome} · {a.serie} · {a.sexo}</li>)}</ul>
          <p className="text-sm">Prévia de até 100 linhas. Confira homônimos antes de confirmar; use o cadastro individual quando forem alunos diferentes.</p>
          <button className={button} disabled={ocupado || !previa.token || !previa.novos} onClick={() => executar(async () => {
            const r = await distribuicao('/importacao/', { method: 'PUT', body: { token: previa.token } })
            setPrevia(null); await carregar(); setMensagem(`${r.criados} alunos importados. ${r.ignorados} cadastros preservados.`)
          })}>Confirmar importação</button>
        </div>}
      </section>
      <form onSubmit={salvarAluno} className="space-y-3 rounded-xl border border-line p-4">
        <h2 className="font-bold">{aluno.id ? `Editar aluno #${aluno.id}` : 'Cadastro individual'}</h2>
        <div className="grid gap-3 sm:grid-cols-2"><label>Nome<input className={input} required maxLength={200} value={aluno.nome} onChange={e => setAluno({ ...aluno, nome: e.target.value })} /></label>
          <label>Turma<select className={input} required value={aluno.turma} onChange={e => setAluno({ ...aluno, turma: e.target.value })}><option value="">Selecione</option>{listaTurmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
          <label>Série<input className={input} required maxLength={40} value={aluno.serie} onChange={e => setAluno({ ...aluno, serie: e.target.value })} /></label>
          <label>Sexo<select className={input} value={aluno.sexo} onChange={e => setAluno({ ...aluno, sexo: e.target.value })}><option value="F">Feminino</option><option value="M">Masculino</option><option value="N">Não informado</option></select></label></div>
        <label className="block"><input type="checkbox" checked={aluno.ativo} onChange={e => setAluno({ ...aluno, ativo: e.target.checked })} /> Aluno ativo</label>
        <button className={button} disabled={ocupado}>Salvar aluno</button> {aluno.id && <button className={button} type="button" onClick={() => setAluno(vazio)}>Cancelar edição</button>}
      </form>
      <div className="flex flex-wrap gap-3"><label>Buscar aluno<input className={input} value={busca} onChange={e => setBusca(e.target.value)} /></label><label>Filtrar turma<select className={input} value={turma} onChange={e => setTurma(e.target.value)}><option value="">Todas</option>{listaTurmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label></div>
      <div className="space-y-2">{alunos.map(a => <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3" key={a.id}><span>#{a.id} · {a.nome} · {a.turma_nome} · {a.serie} · {a.ativo ? 'Ativo' : 'Inativo'}</span><button className={button} onClick={() => { setAluno(a); window.scrollTo(0, 0) }}>Editar</button></div>)}{!alunos.length && <p>Nenhum aluno encontrado.</p>}</div>
    </>}
    {base && aba === 'rodadas' && <>
      <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={event => {
        event.preventDefault()
        executar(async () => {
          await distribuicao('/rodadas/', { method: 'POST', body: { ...nova, itens: nova.itens.map(i => ({ ...i, produto: Number(i.produto) })) } })
          setNova({ titulo: '', tipo: 'KIT_ESCOLAR', itens: [{ produto: '', quantidade: '1' }] }); await carregar(); setMensagem('Rodada criada como rascunho. Confira os itens antes de liberar.')
        })
      }}>
        <h2 className="font-bold">Nova rodada</h2><label className="block">Título<input className={input} required maxLength={160} value={nova.titulo} onChange={e => setNova({ ...nova, titulo: e.target.value })} /></label>
        <label className="block">Material<select className={input} value={nova.tipo} onChange={e => setNova({ ...nova, tipo: e.target.value })}>{Object.entries(tipos).map(([v, t]) => <option value={v} key={v}>{t}</option>)}</select></label>
        <p>{nova.tipo === 'ABSORVENTE' ? 'Destinatárias: alunas com sexo feminino cadastrado.' : 'Destinatários: todos os alunos ativos.'} A lista será fixada na primeira liberação.</p>
        {nova.itens.map((item, i) => <div className="grid gap-3 sm:grid-cols-2" key={i}>
          <label>Produto {i + 1}<select className={input} required value={item.produto} onChange={e => setNova({ ...nova, itens: nova.itens.map((v, j) => j === i ? { ...v, produto: e.target.value } : v) })}><option value="">Selecione</option>{base.produtos.map(p => <option key={p.id} value={p.id}>{p.nome} · {p.unidade} · saldo {p.quantidade}</option>)}</select></label>
          <label>Quantidade por aluno (unidade do estoque)<input className={input} required type="number" min="0.001" step="0.001" value={item.quantidade} onChange={e => setNova({ ...nova, itens: nova.itens.map((v, j) => j === i ? { ...v, quantidade: e.target.value } : v) })} /></label>
        </div>)}
        <div className="flex flex-wrap gap-2"><button className={button} type="button" disabled={nova.itens.length >= 30} onClick={() => setNova({ ...nova, itens: [...nova.itens, { produto: '', quantidade: '1' }] })}>Adicionar item</button>{nova.itens.length > 1 && <button className={button} type="button" onClick={() => setNova({ ...nova, itens: nova.itens.slice(0, -1) })}>Remover último item</button>}<button className={button} disabled={ocupado}>Criar rodada</button></div>
      </form>
      {rodadas.map(r => <section key={r.id} className="space-y-3 rounded-xl border border-line p-4"><h2 className="font-bold">{r.titulo} · {tipos[r.tipo]}</h2><p>{estados[r.estado]} · {r.entregues}/{r.total} entregues</p><ul>{r.itens.map(i => <li key={i.produto}>{i.produto_nome}: {i.quantidade} {i.unidade} por aluno</li>)}</ul>
        <div className="flex flex-wrap gap-2">{(r.estado === 'RASCUNHO' || r.estado === 'SUSPENSA') && <button className={button} disabled={ocupado} onClick={() => executar(async () => { await distribuicao(`/rodadas/${r.id}/estado/`, { method: 'POST', body: { estado: 'LIBERADA' } }); await carregar() })}>{r.estado === 'SUSPENSA' ? 'Retomar entregas' : 'Liberar entregas'}</button>}
          {r.estado === 'LIBERADA' && <button className={button} disabled={ocupado} onClick={() => executar(async () => { await distribuicao(`/rodadas/${r.id}/estado/`, { method: 'POST', body: { estado: 'SUSPENSA' } }); await carregar() })}>Suspender</button>}
          {r.estado !== 'ENCERRADA' && <button className={button} disabled={ocupado} onClick={() => { if (window.confirm('Encerrar esta rodada? Ela não poderá receber novas entregas.')) executar(async () => { await distribuicao(`/rodadas/${r.id}/estado/`, { method: 'POST', body: { estado: 'ENCERRADA' } }); await carregar() }) }}>Encerrar rodada</button>}
        </div></section>)}{!rodadas.length && <p>Nenhuma rodada criada.</p>}
    </>}
    {base && aba === 'relatorio' && <section className="space-y-4">
      <h2 className="text-xl font-bold">Relatório de entregas e pendências</h2>
      <div className="grid gap-3 sm:grid-cols-2 print:hidden">{[
        ['rodada', 'Rodada', rodadas.map(r => [r.id, r.titulo])], ['tipo', 'Tipo de material', Object.entries(tipos)],
        ['turma', 'Turma', listaTurmas.map(t => [t.id, t.nome])], ['situacao', 'Situação', [['ENTREGUE', 'Entregues'], ['PENDENTE', 'Pendentes']]],
      ].map(([key, label, options]) => <label key={key}>{label}<select className={input} value={filtros[key]} onChange={e => { setFiltros({ ...filtros, [key]: e.target.value }); setRelatorio(null) }}><option value="">Todas</option>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>)}</div>
      <div className="flex flex-wrap gap-2 print:hidden"><button className={button} disabled={ocupado} onClick={() => executar(async () => setRelatorio(await distribuicao(`/relatorio/?${query()}`)))}>Gerar relatório</button><button className={button} disabled={ocupado} onClick={() => executar(() => distribuicao(`/relatorio/?${query()}&exportar=csv`, { download: 'relatorio-entregas.csv' }))}>Exportar CSV</button><button className={button} disabled={!relatorio} onClick={() => window.print()}>Imprimir / Salvar PDF</button></div>
      {relatorio && <><p className="text-lg">{relatorio.escola}: {relatorio.total} entregas previstas · {relatorio.entregues} entregues · {relatorio.pendentes} pendentes · {relatorio.percentual}% concluído</p><p>Contagem por aluno e rodada. Uma pessoa pode participar de várias rodadas.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Aluno / ID', 'Turma / Série', 'Rodada', 'Situação', 'Data', 'Responsável'].map(t => <th className="p-2" key={t}>{t}</th>)}</tr></thead><tbody>{relatorio.resultados.map(r => <tr key={r.id} className="border-t border-line"><td className="p-2">{r.nome} · #{r.aluno_id}</td><td className="p-2">{r.turma_nome} · {r.serie}</td><td className="p-2">{r.rodada_titulo} · {tipos[r.tipo]}</td><td className="p-2">{r.entregue_em ? 'Entregue' : 'Pendente'}</td><td className="p-2">{r.entregue_em ? new Date(r.entregue_em).toLocaleString('pt-BR') : '—'}</td><td className="p-2">{r.responsavel || '—'}</td></tr>)}</tbody></table></div>{!relatorio.resultados.length && <p>Nenhum resultado para os filtros selecionados.</p>}</>}
    </section>}
  </div>
}
