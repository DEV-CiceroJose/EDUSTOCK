import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { criarReceita, limparSessao, listarProdutosReceita, listarReceitas } from './api.js'

const REFEICOES = [
  ['CAFE_MANHA', 'Café da manhã'],
  ['ALMOCO', 'Almoço'],
  ['LANCHE_TARDE', 'Lanche da tarde'],
]

function mensagemErro(erro) {
  if (!erro?.data || typeof erro.data === 'string') return erro?.message || 'Não foi possível salvar a receita.'
  const valor = Object.values(erro.data)[0]
  return Array.isArray(valor) ? valor[0] : String(valor)
}

export default function ReceitasView() {
  const navigate = useNavigate()
  const [receitas, setReceitas] = useState([])
  const [produtos, setProdutos] = useState([])
  const [nome, setNome] = useState('')
  const [refeicao, setRefeicao] = useState('ALMOCO')
  const [observacao, setObservacao] = useState('')
  const [ingredientes, setIngredientes] = useState([{ produto: '', quantidade_por_aluno: '' }])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    Promise.all([listarReceitas(), listarProdutosReceita()])
      .then(([listaReceitas, listaProdutos]) => {
        setReceitas(listaReceitas)
        setProdutos(listaProdutos)
      })
      .catch((e) => {
        if (e.status === 401) {
          limparSessao()
          navigate('/login', { replace: true })
        } else setErro(mensagemErro(e))
      })
      .finally(() => setCarregando(false))
  }, [navigate])

  function atualizarIngrediente(indice, campo, valor) {
    setIngredientes((atuais) => atuais.map((item, i) => i === indice ? { ...item, [campo]: valor } : item))
  }

  async function salvar(evento) {
    evento.preventDefault()
    setErro('')
    setSucesso('')
    const itens = ingredientes.filter((item) => item.produto && item.quantidade_por_aluno)
    if (!itens.length) {
      setErro('Adicione ao menos um ingrediente com a quantidade por aluno.')
      return
    }
    setSalvando(true)
    try {
      const criada = await criarReceita({
        nome: nome.trim(), refeicao, observacao: observacao.trim(), ativa: true,
        ingredientes: itens.map((item) => ({
          produto: Number(item.produto),
          quantidade_por_aluno: item.quantidade_por_aluno,
        })),
      })
      setReceitas((atuais) => [...atuais, criada].sort((a, b) => a.nome.localeCompare(b.nome)))
      setNome('')
      setObservacao('')
      setIngredientes([{ produto: '', quantidade_por_aluno: '' }])
      setSucesso(`Receita “${criada.nome}” cadastrada.`)
    } catch (e) {
      if (e.status === 401) {
        limparSessao()
        navigate('/login', { replace: true })
      } else setErro(mensagemErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'mt-1 w-full rounded-xl border border-line bg-white p-3'
  return <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
    <header><h1 className="text-2xl font-extrabold">Receitas</h1><p className="mt-1 text-ink-soft">Cadastre o preparo e o consumo de cada ingrediente por aluno.</p></header>
    {erro && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{erro}</p>}
    {sucesso && <p role="status" className="rounded-xl border border-green-300 bg-green-50 p-3 text-green-800">{sucesso}</p>}
    <form className="space-y-4 rounded-2xl border border-line bg-white p-5" onSubmit={salvar}>
      <h2 className="text-lg font-bold">Nova receita</h2>
      <label className="block font-semibold">Nome<input required maxLength={150} className={campo} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <label className="block font-semibold">Refeição<select className={campo} value={refeicao} onChange={(e) => setRefeicao(e.target.value)}>{REFEICOES.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}</select></label>
      <fieldset className="space-y-3"><legend className="font-semibold">Ingredientes</legend>
        {ingredientes.map((item, indice) => <div className="grid gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-[1fr_10rem_auto]" key={indice}>
          <label>Produto<select required className={campo} value={item.produto} onChange={(e) => atualizarIngrediente(indice, 'produto', e.target.value)}><option value="">Selecione</option>{produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} ({produto.unidade_consumo})</option>)}</select></label>
          <label>Por aluno<input required min="0.01" step="0.01" inputMode="decimal" type="number" className={campo} value={item.quantidade_por_aluno} onChange={(e) => atualizarIngrediente(indice, 'quantidade_por_aluno', e.target.value)} /></label>
          {ingredientes.length > 1 && <button type="button" className="self-end rounded-xl border border-line px-3 py-3" onClick={() => setIngredientes((atuais) => atuais.filter((_, i) => i !== indice))}>Remover</button>}
        </div>)}
        <button type="button" className="rounded-xl border border-line px-4 py-2 font-semibold" onClick={() => setIngredientes((atuais) => [...atuais, { produto: '', quantidade_por_aluno: '' }])}>+ Ingrediente</button>
      </fieldset>
      {!produtos.length && !carregando && <p className="text-sm text-amber-800">Nenhum produto possui unidade de consumo configurada. Configure os produtos antes de criar a receita.</p>}
      <label className="block font-semibold">Observação<textarea className={campo} rows="3" value={observacao} onChange={(e) => setObservacao(e.target.value)} /></label>
      <button disabled={salvando || !produtos.length} className="btn-action btn-primary" type="submit">{salvando ? 'Salvando…' : 'Cadastrar receita'}</button>
    </form>
    <section className="space-y-3"><h2 className="text-lg font-bold">Receitas cadastradas</h2>{carregando && <p>Carregando…</p>}{!carregando && !receitas.length && <p>Nenhuma receita cadastrada.</p>}{receitas.map((receita) => <article className="rounded-2xl border border-line bg-white p-4" key={receita.id}><h3 className="font-bold">{receita.nome}</h3><p className="text-sm text-ink-soft">{REFEICOES.find(([valor]) => valor === receita.refeicao)?.[1]} · {receita.ingredientes.length} ingrediente(s)</p></article>)}</section>
  </main>
}
