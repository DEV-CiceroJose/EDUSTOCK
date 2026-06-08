import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useDashboardData } from "../hooks/useDashboardData"
import { movimentacoesApi, categoriasApi, produtosApi } from "../api"
import { Icon } from "../lib/icons.jsx"
import CategoryRail from "../features/inventario/CategoryRail"
import ProductCard from "../features/inventario/ProductCard"
import ProductFormModal from "../features/inventario/ProductFormModal"
import DetailsModal from "../features/inventario/DetailsModal"
import ConfirmDialog from "../components/ui/ConfirmDialog"
import { useToast } from "../components/ui/Toast"

export default function InventarioPage() {
  const { produtos, categorias, grupos, fornecedores, loading, carregar, counts, visiveis, search } = useDashboardData()
  const [cat, setCat] = useState({ tipo: "all" })
  const [addOpen, setAddOpen] = useState(false)
  const [editProduto, setEditProduto] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [aExcluir, setAExcluir] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const toast = useToast(); const produtosFiltrados = visiveis(cat)

  const ajustar = async (produto, delta) => {
    setBusyId(produto.id)
    try {
      await movimentacoesApi.create({ produto: produto.id, tipo: delta > 0 ? "ENTRADA" : "SAIDA", quantidade: Math.abs(delta), motivo: "ajuste rápido" })
      await carregar()
    } catch (e) { toast(String(e.message || "Falha ao ajustar"), "danger") }
    finally { setBusyId(null) }
  }

  const excluir = async () => {
    await produtosApi.remove(aExcluir.id)
    toast(`"${aExcluir.nome}" excluído`, "danger")
    setAExcluir(null); setDetalhe(null); carregar()
  }

  const novaCategoria = async () => {
    const nome = window.prompt("Nome da nova categoria:")
    if (!nome?.trim()) return
    await categoriasApi.create({ name: nome.trim() })
    toast("Categoria criada"); carregar()
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
      <CategoryRail categorias={categorias} grupos={grupos} counts={counts} total={produtos.length} active={cat} onPick={setCat} onAddCategory={novaCategoria} />
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold leading-none">Inventário</h2>
            <p className="mt-1 text-sm text-ink-faint">{produtosFiltrados.length} {produtosFiltrados.length === 1 ? "item" : "itens"}{cat.tipo !== "all" && " no filtro"}{search && ` para "${search}"`}</p>
          </div>
          <button onClick={() => setAddOpen(true)} className="btn btn-brand">{Icon.plus(16)} Adicionar</button>
        </div>
        {loading ? <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-ink-faint">Carregando inventário…</div> :
         produtosFiltrados.length === 0 ? <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-center"><span className="mb-2 text-ink-faint">{Icon.box(40)}</span><p className="font-display text-lg font-bold">Nenhum item por aqui</p><p className="text-sm text-ink-faint">{search ? "Tente outra busca." : "Adicione o primeiro item do estoque."}</p></div> :
         <motion.div layout className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(214px, 1fr))" }}><AnimatePresence>{produtosFiltrados.map((p, i) => <ProductCard key={p.id} produto={p} index={i} busy={busyId === p.id} onAdd={() => ajustar(p, +1)} onRemove={() => ajustar(p, -1)} onDetails={setDetalhe} />)}</AnimatePresence></motion.div>}
      </section>
      <ProductFormModal open={addOpen || !!editProduto} produto={editProduto} grupos={grupos} fornecedores={fornecedores.filter(f => f.ativo)} onClose={() => { setAddOpen(false); setEditProduto(null) }} onSaved={carregar} />
      <DetailsModal produto={detalhe} onClose={() => setDetalhe(null)} onEdit={(p) => { setDetalhe(null); setEditProduto(p) }} onDelete={setAExcluir} />
      <ConfirmDialog open={!!aExcluir} title="Excluir item" message={aExcluir ? `Remover "${aExcluir.nome}" do estoque? Esta ação não pode ser desfeita.` : ""} onConfirm={excluir} onCancel={() => setAExcluir(null)} />
    </div>
  )
}
