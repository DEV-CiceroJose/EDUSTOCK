import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useDashboardData } from "../hooks/useDashboardData"
import { movimentacoesApi, categoriasApi, produtosApi } from "../api"
import { Icon } from "../lib/icons.jsx"
import CategoryRail from "../features/inventario/CategoryRail"
import ProductCard from "../features/inventario/ProductCard"
import ProductFormModal from "../features/inventario/ProductFormModal"
import DetailsModal from "../features/inventario/DetailsModal"
import NewCategoryModal from "../features/inventario/NewCategoryModal"
import ConfirmDialog from "../components/ui/ConfirmDialog"
import { useToast } from "../components/ui/Toast"
import { useLocation, useNavigate } from "react-router-dom"
import { podeGerenciarCadastros } from "../lib/auth"

export default function InventarioPage() {
  const { produtos, categorias, grupos, fornecedores, loading, carregar, counts, visiveis, search } = useDashboardData()
  const location = useLocation()
  const navigate = useNavigate()
  const canManage = podeGerenciarCadastros()
  const [cat, setCat] = useState({ tipo: "all" })
  const [addOpen, setAddOpen] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editProduto, setEditProduto] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [aExcluir, setAExcluir] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const toast = useToast(); const produtosFiltrados = visiveis(cat)

  useEffect(() => {
    if (location.state?.openAdd && canManage) {
      setAddOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate, canManage])

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

  const criarCategoria = async (nome) => {
    await categoriasApi.create({ name: nome })
    toast("Categoria criada")
    carregar()
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <CategoryRail categorias={categorias} grupos={grupos} counts={counts} total={produtos.length} active={cat} onPick={setCat} onAddCategory={() => setCatModalOpen(true)} canManage={canManage} />
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">Inventário</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-faint">{produtosFiltrados.length} {produtosFiltrados.length === 1 ? "item" : "itens"}{cat.tipo !== "all" && " no filtro"}{search && ` para "${search}"`}</p>
          </div>
          {canManage && <button onClick={() => setAddOpen(true)} className="btn btn-brand">{Icon.plus(16)} Adicionar</button>}
        </div>
        {loading ? <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-ink-faint">Carregando inventário…</div> :
         produtosFiltrados.length === 0 ? <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-center"><span className="mb-2 text-ink-faint">{Icon.box(40)}</span><p className="font-display text-lg font-bold">Nenhum item por aqui</p><p className="text-sm text-ink-faint">{search ? "Tente outra busca." : "Adicione o primeiro item do estoque."}</p></div> :
         <motion.div layout className="product-grid grid gap-4"><AnimatePresence>{produtosFiltrados.map((p, i) => <ProductCard key={p.id} produto={p} index={i} onDetails={setDetalhe} />)}</AnimatePresence></motion.div>}
      </section>
      </div>
      {canManage && <ProductFormModal open={addOpen || !!editProduto} produto={editProduto} grupos={grupos} fornecedores={fornecedores.filter(f => f.ativo)} onClose={() => { setAddOpen(false); setEditProduto(null) }} onSaved={carregar} />}
      <DetailsModal produto={detalhe} onClose={() => setDetalhe(null)} onEdit={(p) => { setDetalhe(null); setEditProduto(p) }} onDelete={setAExcluir} onAdd={(p) => ajustar(p, +1)} onRemove={(p) => ajustar(p, -1)} canManage={canManage} />
      <ConfirmDialog open={!!aExcluir} title="Excluir item" message={aExcluir ? `Remover "${aExcluir.nome}" do estoque? Esta ação não pode ser desfeita.` : ""} onConfirm={excluir} onCancel={() => setAExcluir(null)} />
      {canManage && <NewCategoryModal open={catModalOpen} onClose={() => setCatModalOpen(false)} onCreate={criarCategoria} />}
    </div>
  )
}
