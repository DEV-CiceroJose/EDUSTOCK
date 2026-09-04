import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useDashboardData } from "../hooks/useDashboardData"
import { movimentacoesApi, categoriasApi, gruposApi, produtosApi } from "../api"
import { Icon } from "../lib/icons.jsx"
import CategoryRail from "../features/inventario/CategoryRail"
import ProductCard from "../features/inventario/ProductCard"
import ProductFormModal from "../features/inventario/ProductFormModal"
import DetailsModal from "../features/inventario/DetailsModal"
import NewCategoryModal from "../features/inventario/NewCategoryModal"
import NewGroupModal from "../features/inventario/NewGroupModal"
import ConfirmDialog from "../components/ui/ConfirmDialog"
import { useToast } from "../components/ui/useToast"
import { useLocation, useNavigate, useOutletContext } from "react-router-dom"
import { podeGerenciarCadastros } from "../lib/auth"
import DataLoadError from "../components/ui/DataLoadError"

export default function InventarioPage() {
  const layout = useOutletContext()
  const { produtos, categorias, grupos, fornecedores, loading, error, carregar, counts, visiveis, search } = useDashboardData(layout?.search)
  const location = useLocation()
  const navigate = useNavigate()
  const canManage = podeGerenciarCadastros()
  const addRequested = Boolean(location.state?.openAdd && canManage)
  const [cat, setCat] = useState({ tipo: "all" })
  const [addOpen, setAddOpen] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [editProduto, setEditProduto] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [aExcluir, setAExcluir] = useState(null)
  const toast = useToast(); const produtosFiltrados = visiveis(cat)

  const fecharFormProduto = () => {
    setAddOpen(false)
    setEditProduto(null)
    if (addRequested) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }

  const ajustar = async (produto, delta) => {
    try {
      await movimentacoesApi.create({ produto: produto.id, tipo: delta > 0 ? "ENTRADA" : "SAIDA", quantidade: Math.abs(delta), motivo: "ajuste rápido" })
      await carregar()
    } catch (e) { toast(String(e.message || "Falha ao ajustar"), "danger") }
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

  const criarGrupo = async ({ nome, categoria }) => {
    await gruposApi.create({ nome, categoria })
    toast("Grupo criado")
    carregar()
  }

  const abrirCriacaoGrupo = () => {
    fecharFormProduto()
    setGroupModalOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <DataLoadError error={error} onRetry={carregar} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <CategoryRail categorias={categorias} grupos={grupos} counts={counts} total={produtos.length} active={cat} onPick={setCat} onAddCategory={() => setCatModalOpen(true)} onAddGroup={() => setGroupModalOpen(true)} canManage={canManage} />
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
      {canManage && <ProductFormModal open={addOpen || addRequested || !!editProduto} produto={editProduto} grupos={grupos} fornecedores={fornecedores.filter(f => f.ativo)} onClose={fecharFormProduto} onSaved={carregar} onCreateGroup={abrirCriacaoGrupo} />}
      <DetailsModal produto={detalhe} onClose={() => setDetalhe(null)} onEdit={(p) => { setDetalhe(null); setEditProduto(p) }} onDelete={setAExcluir} onAdd={(p) => ajustar(p, +1)} onRemove={(p) => ajustar(p, -1)} canManage={canManage} />
      <ConfirmDialog open={!!aExcluir} title="Excluir item" message={aExcluir ? `Remover "${aExcluir.nome}" do estoque? Esta ação não pode ser desfeita.` : ""} onConfirm={excluir} onCancel={() => setAExcluir(null)} />
      {canManage && <NewCategoryModal open={catModalOpen} onClose={() => setCatModalOpen(false)} onCreate={criarCategoria} />}
      {canManage && <NewGroupModal open={groupModalOpen} categorias={categorias} onClose={() => setGroupModalOpen(false)} onCreate={criarGrupo} />}
    </div>
  )
}
