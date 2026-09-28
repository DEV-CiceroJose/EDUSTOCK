import { useEffect, useState } from "react"
import { operacaoApi } from "../../api"

function hoje() {
  const data = new Date()
  const doisDigitos = (valor) => String(valor).padStart(2, "0")
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

function formatarData(data) {
  if (!data) return ""
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
}

export default function FrequenciaHistoricoView() {
  const [data, setData] = useState(hoje)
  const [relatorio, setRelatorio] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")

  useEffect(() => {
    let ativo = true
    operacaoApi.historicoFrequencia(data)
      .then((resultado) => { if (ativo) setRelatorio(resultado) })
      .catch((e) => { if (ativo) setErro(e.message || "Não foi possível carregar o relatório.") })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [data])

  function alterarData(valor) {
    setErro("")
    setCarregando(true)
    setData(valor)
  }

  return <section className="space-y-5" aria-labelledby="titulo-historico-frequencia">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 id="titulo-historico-frequencia" className="font-display text-2xl font-bold">Histórico de presença por turma</h2><p className="mt-1 text-sm text-ink-faint">Consulte quantos alunos compareceram em qualquer dia.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-sm font-semibold">Data<input aria-label="Data do relatório" className="field mt-1" type="date" value={data} onChange={(e) => alterarData(e.target.value)} /></label>
        <button type="button" className="btn btn-outline" onClick={() => window.print()}>Imprimir</button>
      </div>
    </div>

    {erro && <div role="alert" className="rounded-2xl border border-out/30 bg-out-tint p-4 text-out">{erro}</div>}
    {carregando && <div role="status" className="card p-8 text-center text-ink-faint">Carregando relatório…</div>}
    {!carregando && relatorio && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Data consultada</p><strong className="mt-2 block text-2xl text-ink">{formatarData(relatorio.data)}</strong></div>
        <div className="card p-5"><p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Total de alunos</p><strong className="mt-2 block text-3xl text-brand">{relatorio.total_alunos}</strong></div>
        <div className="card p-5"><p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Turmas registradas</p><strong className="mt-2 block text-2xl text-ink">{relatorio.turmas_registradas} de {relatorio.turmas_esperadas}</strong></div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4"><h3 className="font-display font-bold">Presença registrada</h3></div>
        {relatorio.registros.length ? <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-faint"><tr><th className="px-5 py-3">Turma</th><th className="px-5 py-3">Turno</th><th className="px-5 py-3 text-right">Alunos presentes</th></tr></thead><tbody>{relatorio.registros.map((registro) => <tr className="border-t border-line" key={registro.id}><td className="px-5 py-4 font-semibold">{registro.turma}</td><td className="px-5 py-4 text-ink-soft">{registro.turno_label}</td><td className="px-5 py-4 text-right text-lg font-bold text-brand">{registro.quantidade_alunos}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-ink-faint">Nenhuma turma registrou presença nesta data.</p>}
      </div>

      {relatorio.turmas_sem_registro.length > 0 && <div className="rounded-2xl border border-low/30 bg-low-tint p-5"><h3 className="font-display font-bold text-low">Turmas sem registro</h3><p className="mt-2 text-sm text-ink-soft">{relatorio.turmas_sem_registro.join(", ")}</p></div>}
    </>}
  </section>
}
