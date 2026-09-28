import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCardapio, limparSessao, listarReceitas, salvarCardapio } from './api.js'

const REFEICOES = [['CAFE_MANHA', 'Café da manhã'], ['ALMOCO', 'Almoço'], ['LANCHE_TARDE', 'Lanche da tarde']]
const hoje = () => {
  const data = new Date()
  const doisDigitos = (valor) => String(valor).padStart(2, '0')
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

export default function CardapioView() {
  const navigate = useNavigate()
  const [data, setData] = useState(hoje)
  const [refeicao, setRefeicao] = useState('ALMOCO')
  const [receita, setReceita] = useState('')
  const [observacao, setObservacao] = useState('')
  const [receitas, setReceitas] = useState([])
  const [cardapio, setCardapio] = useState([])
  const [ocupado, setOcupado] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const tratarErro = useCallback((e) => {
    if (e.status === 401) { limparSessao(); navigate('/login', { replace: true }) }
    else setErro(e.message || 'Não foi possível carregar o cardápio.')
  }, [navigate])

  const carregarCardapio = useCallback(async (dia) => {
    setOcupado(true); setErro('')
    try { setCardapio((await getCardapio(dia)).refeicoes) } catch (e) { tratarErro(e) } finally { setOcupado(false) }
  }, [tratarErro])

  useEffect(() => { listarReceitas().then(setReceitas).catch(tratarErro) }, [tratarErro])
  useEffect(() => { void carregarCardapio(data) }, [carregarCardapio, data])

  const opcoes = receitas.filter((item) => item.ativa && item.refeicao === refeicao)
  async function salvar(evento) {
    evento.preventDefault(); setErro(''); setSucesso(''); setOcupado(true)
    try {
      const salvo = await salvarCardapio({ data, refeicao, receita: Number(receita), observacao: observacao.trim() })
      setSucesso(`${salvo.receita_nome} foi definido no cardápio.`)
      await carregarCardapio(data)
    } catch (e) { tratarErro(e) } finally { setOcupado(false) }
  }

  const campo = 'mt-1 w-full rounded-xl border border-line bg-white p-3'
  return <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
    <header><h1 className="text-2xl font-extrabold">Cardápio do dia</h1><p className="mt-1 text-ink-soft">Escolha a receita servida em cada refeição.</p></header>
    {erro && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{erro}</p>}
    {sucesso && <p role="status" className="rounded-xl border border-green-300 bg-green-50 p-3 text-green-800">{sucesso}</p>}
    <form className="space-y-4 rounded-2xl border border-line bg-white p-5" onSubmit={salvar}>
      <label className="block font-semibold">Data<input type="date" required className={campo} value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label className="block font-semibold">Refeição<select className={campo} value={refeicao} onChange={(e) => { setRefeicao(e.target.value); setReceita('') }}>{REFEICOES.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}</select></label>
      <label className="block font-semibold">Receita<select required className={campo} value={receita} onChange={(e) => setReceita(e.target.value)}><option value="">Selecione</option>{opcoes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      {!opcoes.length && <p className="text-sm text-amber-800">Cadastre primeiro uma receita para esta refeição.</p>}
      <label className="block font-semibold">Observação<textarea className={campo} rows="3" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: servir com fruta" /></label>
      <button className="btn-action btn-primary" disabled={ocupado || !receita} type="submit">{ocupado ? 'Aguarde…' : 'Salvar cardápio'}</button>
    </form>
    <section className="space-y-3"><h2 className="text-lg font-bold">Programado para esta data</h2>{!ocupado && !cardapio.length && <p>Nenhuma refeição definida.</p>}{cardapio.map((item) => <article className="rounded-2xl border border-line bg-white p-4" key={item.id}><p className="text-sm font-semibold text-ink-soft">{item.refeicao_label}</p><h3 className="text-lg font-bold">{item.receita_nome}</h3>{item.observacao && <p className="mt-1">{item.observacao}</p>}</article>)}</section>
  </main>
}
