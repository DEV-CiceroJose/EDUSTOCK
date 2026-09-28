import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessao, limparSessao, listarConfiguracoesNutricao, logout, salvarConfiguracaoNutricao } from './api.js'

const UNIDADES = { G: 'Grama (g)', ML: 'Mililitro (ml)', UN: 'Unidade' }

function erroLegivel(erro) {
  if (erro?.data && typeof erro.data === 'object') {
    const valor = Object.values(erro.data)[0]
    if (Array.isArray(valor) && valor.length) return String(valor[0])
    if (valor) return String(valor)
  }
  return erro?.message || 'Não foi possível salvar a configuração.'
}

function ProdutoNutricao({ produto, aoSalvar }) {
  const [unidade, setUnidade] = useState(produto.unidade_consumo || produto.unidades_consumo_permitidas[0])
  const [conteudo, setConteudo] = useState(produto.conteudo_por_unidade)
  const [porcao, setPorcao] = useState(produto.quantidade_por_aluno)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)
  const campo = 'mt-1 w-full rounded-xl border border-line bg-white p-3'

  async function salvar(evento) {
    evento.preventDefault(); setSalvando(true); setErro(''); setSalvo(false)
    try {
      const atualizado = await salvarConfiguracaoNutricao({
        produto: produto.id,
        unidade_consumo: unidade,
        conteudo_por_unidade: conteudo,
        quantidade_por_aluno: porcao,
      })
      setSalvo(true); aoSalvar(atualizado)
    } catch (e) { setErro(erroLegivel(e)) } finally { setSalvando(false) }
  }

  return <form className="space-y-4 rounded-2xl border border-line bg-white p-5" onSubmit={salvar}>
    <div><h2 className="text-lg font-bold">{produto.nome}</h2><p className="text-sm text-ink-soft">Unidade no estoque: {produto.unidade_label}</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="font-semibold">Unidade de consumo<select required className={campo} value={unidade} onChange={(e) => setUnidade(e.target.value)}>{produto.unidades_consumo_permitidas.map((item) => <option key={item} value={item}>{UNIDADES[item]}</option>)}</select></label>
      <label className="font-semibold">Conteúdo por {produto.unidade}<input required min="0.001" step="0.001" inputMode="decimal" type="number" className={campo} value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Ex.: 1000" /></label>
      <label className="font-semibold">Porção por aluno<input required min="0.01" step="0.01" inputMode="decimal" type="number" className={campo} value={porcao} onChange={(e) => setPorcao(e.target.value)} placeholder="Ex.: 80" /></label>
    </div>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    {salvo && <p role="status" className="text-green-700">Configuração salva.</p>}
    <button className="rounded-xl bg-brand px-5 py-3 font-bold text-white disabled:opacity-50" disabled={salvando} type="submit">{salvando ? 'Salvando…' : 'Salvar porção'}</button>
  </form>
}

export default function NutricaoView() {
  const navigate = useNavigate()
  const sessao = getSessao()
  const [produtos, setProdutos] = useState([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    listarConfiguracoesNutricao().then(setProdutos).catch((e) => {
      if (e.status === 401) { limparSessao(); navigate('/login', { replace: true }) }
      else setErro(erroLegivel(e))
    }).finally(() => setCarregando(false))
  }, [navigate])

  const filtrados = produtos.filter((produto) => produto.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()))
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
    <header className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-extrabold">Porções por aluno</h1><p className="mt-1 text-ink-soft">{sessao?.escola?.nome} · configure a conversão e a porção padrão de cada produto.</p></div><button className="rounded-xl border border-line bg-white px-4 py-2 font-semibold" onClick={() => { void logout(); navigate('/login', { replace: true }) }}>Sair</button></header>
    <div className="rounded-xl bg-brand-tint p-4 text-brand-dark"><strong>Exemplo:</strong> arroz em pacote de 1 kg usa unidade de consumo “Grama”, conteúdo 1000 e porção 80 por aluno.</div>
    <label className="block font-semibold">Buscar produto<input className="mt-1 w-full rounded-xl border border-line bg-white p-3" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite o nome do produto" /></label>
    {erro && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{erro}</p>}
    {carregando && <p role="status">Carregando produtos…</p>}
    {!carregando && !filtrados.length && <p>Nenhum produto encontrado.</p>}
    {filtrados.map((produto) => <ProdutoNutricao key={produto.id} produto={produto} aoSalvar={(atualizado) => setProdutos((atuais) => atuais.map((item) => item.id === atualizado.id ? atualizado : item))} />)}
  </main>
}
