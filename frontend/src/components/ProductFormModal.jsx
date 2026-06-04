import { useEffect, useMemo, useState } from "react"
import { produtosApi } from "../api"
import { UNIDADES, PERIODICIDADES } from "../api/units"
import Modal from "./Modal"
import { useToast } from "./Toast"

const VAZIO = {
  nome: "", numero_nota_fiscal: "", grupo: "", fornecedor: "",
  quantidade: "", unidade: "UN", estoque_minimo: "",
  perecivel: false, periodicidade: "EVENTUAL", validade: "", preco: "",
}

function Campo({ label, hint, children, full }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold">
        {label}
        {hint && <span className="text-[0.66rem] font-normal text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export default function ProductFormModal({ open, produto, grupos, fornecedores = [], onClose, onSaved }) {
  const editando = Boolean(produto)
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  // Agrupa os grupos por categoria para o <optgroup>
  const porCategoria = useMemo(() => {
    const m = new Map()
    for (const g of grupos) {
      const k = g.categoria_nome || "Sem categoria"
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(g)
    }
    return [...m.entries()]
  }, [grupos])

  // Lista de opções de fornecedor: ativos + o fornecedor atual do produto
  // (mesmo inativo), para não desvincular silenciosamente ao editar.
  const opcoesFornecedor = useMemo(() => {
    const lista = [...fornecedores]
    if (produto?.fornecedor && !lista.some((f) => f.id === produto.fornecedor)) {
      lista.unshift({ id: produto.fornecedor, nome: `${produto.fornecedor_nome ?? "Fornecedor"} (inativo)` })
    }
    return lista
  }, [fornecedores, produto])

  useEffect(() => {
    if (!open) return
    if (produto) {
      setForm({
        nome: produto.nome ?? "",
        numero_nota_fiscal: produto.numero_nota_fiscal ?? "",
        grupo: String(produto.grupo ?? ""),
        fornecedor: String(produto.fornecedor ?? ""),
        quantidade: String(produto.quantidade ?? ""),
        unidade: produto.unidade ?? "UN",
        estoque_minimo: String(produto.estoque_minimo ?? ""),
        perecivel: Boolean(produto.perecivel),
        periodicidade: produto.periodicidade ?? "EVENTUAL",
        validade: produto.validade ?? "",
        preco: produto.preco ?? "",
      })
    } else {
      setForm({ ...VAZIO, grupo: grupos[0] ? String(grupos[0].id) : "" })
    }
    setErros({})
  }, [open, produto, grupos])

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))

  function validar() {
    const e = {}
    if (!form.nome.trim()) e.nome = "Informe o nome"
    if (!form.grupo) e.grupo = "Selecione um grupo"
    if (form.quantidade === "" || Number(form.quantidade) < 0) e.quantidade = "Inválida"
    if (form.estoque_minimo !== "" && Number(form.estoque_minimo) < 0) e.estoque_minimo = "Inválido"
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    if (!validar()) return
    setSalvando(true)
    try {
      const payload = { ...form, fornecedor: form.fornecedor || null }
      if (editando) {
        await produtosApi.update(produto.id, payload)
        toast("Item atualizado")
      } else {
        await produtosApi.create(payload)
        toast("Item cadastrado")
      }
      onSaved?.()
      onClose()
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? "Editar item" : "Adicionar novo item"}
      subtitle={editando ? produto?.nome : "Cadastre um produto no estoque"}
      maxW="max-w-xl"
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome do item" full>
          <input className="field" value={form.nome} onChange={set("nome")} placeholder="Ex.: Papel Sulfite A4" />
          {erros.nome && <p className="mt-1 text-xs text-out">{erros.nome}</p>}
        </Campo>

        <Campo label="Grupo">
          <select className="field" value={form.grupo} onChange={set("grupo")}>
            <option value="">— selecione —</option>
            {porCategoria.map(([cat, gs]) => (
              <optgroup key={cat} label={cat}>
                {gs.map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {erros.grupo && <p className="mt-1 text-xs text-out">{erros.grupo}</p>}
        </Campo>

        <Campo label="Nota Fiscal" hint="opcional">
          <input className="field" value={form.numero_nota_fiscal} onChange={set("numero_nota_fiscal")} placeholder="NF-00000" />
        </Campo>

        <Campo label="Quantidade">
          <input type="number" step="any" min="0" className="field" value={form.quantidade} onChange={set("quantidade")} placeholder="0" />
          {erros.quantidade && <p className="mt-1 text-xs text-out">{erros.quantidade}</p>}
        </Campo>

        <Campo label="Estoque mínimo" hint="alerta de reposição">
          <input type="number" step="any" min="0" className="field" value={form.estoque_minimo} onChange={set("estoque_minimo")} placeholder="0" />
          {erros.estoque_minimo && <p className="mt-1 text-xs text-out">{erros.estoque_minimo}</p>}
        </Campo>

        <Campo label="Unidade">
          <select className="field" value={form.unidade} onChange={set("unidade")}>
            {UNIDADES.map((u) => (
              <option key={u.value} value={u.value}>{u.value} · {u.label}</option>
            ))}
          </select>
        </Campo>

        <Campo label="Periodicidade">
          <select className="field" value={form.periodicidade} onChange={set("periodicidade")}>
            {PERIODICIDADES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Campo>

        <Campo label="Fornecedor" hint="opcional">
          <select className="field" value={form.fornecedor} onChange={set("fornecedor")}>
            <option value="">— sem fornecedor —</option>
            {opcoesFornecedor.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </Campo>

        <Campo label="Validade" hint="opcional">
          <input type="date" className="field" value={form.validade} onChange={set("validade")} />
        </Campo>

        <Campo label="Preço unitário" hint="R$ · opcional">
          <input type="number" step="0.01" min="0" className="field" value={form.preco} onChange={set("preco")} placeholder="0,00" />
        </Campo>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={form.perecivel} onChange={set("perecivel")} className="h-4 w-4" />
          <span className="text-sm font-semibold">Item perecível</span>
        </label>

        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar item"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
