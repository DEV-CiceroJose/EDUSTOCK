import { useEffect, useState } from "react"
import { redeApi } from "../api"
import { atualizarEscola, getEscola, getEscolas } from "../lib/auth"

function Numero({ valor, sufixo = "" }) {
  return <strong className="mt-2 block font-display text-2xl">{valor ?? "—"}{valor != null ? sufixo : ""}</strong>
}

export default function RedeMunicipalPage() {
  const escolas = getEscolas()
  const [selecionada, setSelecionada] = useState(getEscola()?.id || escolas[0]?.id || "")
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState("")
  const [mensagem, setMensagem] = useState("")

  async function carregar() {
    setErro("")
    try { setDados(await redeApi.indicadores()) } catch { setErro("Não foi possível carregar os indicadores da rede.") }
  }

  useEffect(() => {
    let ativo = true
    redeApi.indicadores()
      .then((resultado) => { if (ativo) setDados(resultado) })
      .catch(() => { if (ativo) setErro("Não foi possível carregar os indicadores da rede.") })
    return () => { ativo = false }
  }, [])

  async function usarEscola() {
    setErro("")
    setMensagem("")
    try {
      const resposta = await redeApi.trocarEscola(Number(selecionada))
      atualizarEscola(resposta.escola)
      setMensagem("Escola operacional alterada com segurança.")
    } catch {
      setErro("Não foi possível trocar de escola. Tente novamente.")
    }
  }

  async function importar(evento) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    setErro("")
    try {
      const resultado = await redeApi.importarProdutos(arquivo, Number(selecionada))
      setMensagem(`${resultado.criados} produtos criados e ${resultado.atualizados} atualizados.`)
      await carregar()
    } catch (e) { setErro(e.message) }
    evento.target.value = ""
  }

  const total = dados?.consolidado
  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Painel municipal</h1>
          <p className="mt-2 text-sm text-ink-faint">Presença → produção → consumo → estoque → indicadores</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field min-w-56" value={selecionada} onChange={(e) => setSelecionada(e.target.value)} aria-label="Escola">
            {escolas.map((escola) => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
          </select>
          <button className="btn" onClick={usarEscola}>Usar esta escola</button>
          <label className="btn cursor-pointer">
            Importar CSV
            <input className="sr-only" type="file" accept=".csv,text/csv" onChange={importar} />
          </label>
        </div>
      </div>
      {erro && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {mensagem && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="card p-5 text-sm text-ink-soft">Escolas<Numero valor={total?.escolas} /></div>
        <div className="card p-5 text-sm text-ink-soft">Refeições planejadas<Numero valor={total?.planejadas} /></div>
        <div className="card p-5 text-sm text-ink-soft">Refeições servidas<Numero valor={total?.servidas} /></div>
        <div className="card p-5 text-sm text-ink-soft">Descarte<Numero valor={total?.descarte_kg} sufixo=" kg" /></div>
        <div className="card p-5 text-sm text-ink-soft">Custo por refeição<Numero valor={total?.custo_por_refeicao} sufixo=" R$" /></div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {dados?.por_escola.map((item) => (
          <article className="card p-5" key={item.escola.id}>
            <h2 className="font-display text-lg font-bold">{item.escola.nome}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>Itens<Numero valor={item.estoque.itens} /></div>
              <div>Críticos<Numero valor={item.estoque.criticos} /></div>
              <div>Produzidas<Numero valor={item.refeicoes.produzidas} /></div>
              <div>Servidas<Numero valor={item.refeicoes.servidas} /></div>
            </div>
            <p className="mt-4 text-xs text-ink-faint">Economia estimada: {item.economia_observacao}</p>
            <p className="mt-1 text-xs text-ink-faint">
              Divergências: {item.divergencias.itens_divergentes} de {item.divergencias.conferencias} conferências
              ({item.divergencias.quantidade_absoluta} em valor absoluto).
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {item.origens.registros_refeicao.length + item.origens.contagens_estoque.length} registros de origem rastreáveis.
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
