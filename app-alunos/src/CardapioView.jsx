import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCardapio, limparSessao } from './api.js'

const hoje = () => {
  const data = new Date()
  const doisDigitos = (valor) => String(valor).padStart(2, '0')
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

export default function CardapioView() {
  const navigate = useNavigate()
  const [data, setData] = useState(hoje)
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async (dia) => {
    setCarregando(true); setErro('')
    try { setItens((await getCardapio(dia)).refeicoes) }
    catch (e) {
      if (e.status === 401) { limparSessao(); navigate('/login', { replace: true }) }
      else setErro(e.message || 'Não foi possível carregar o cardápio.')
    } finally { setCarregando(false) }
  }, [navigate])

  useEffect(() => { void carregar(data) }, [carregar, data])

  return <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
    <header><h1 className="text-2xl font-extrabold">Cardápio</h1><p className="mt-1 text-ink-soft">Veja o que será servido em cada refeição.</p></header>
    <label className="block font-semibold">Data<input className="mt-1 w-full rounded-xl border border-line bg-white p-3" type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
    {erro && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{erro}</p>}
    {carregando && <p role="status">Carregando cardápio…</p>}
    {!carregando && !itens.length && <div className="result-card"><h2 className="text-xl font-bold">Cardápio ainda não informado</h2><p className="mt-2 text-ink-soft">A cozinha ainda não definiu as refeições desta data.</p></div>}
    {!carregando && itens.map((item) => <article className="result-card text-left" key={item.id}><p className="text-sm font-bold uppercase tracking-wide text-brand">{item.refeicao_label}</p><h2 className="mt-2 text-2xl font-extrabold">{item.receita_nome}</h2>{item.observacao && <p className="mt-2 text-ink-soft">{item.observacao}</p>}</article>)}
  </main>
}
