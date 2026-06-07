import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { produtosApi, categoriasApi, gruposApi, fornecedoresApi, movimentacoesApi, alertasApi } from "../api"
import { brl } from "../lib/format"
import { Icon } from "../lib/icons.jsx"

import Header from "../components/Header"
import Sidebar from "../components/Sidebar"
import Tabs from "../components/Tabs"
import CategoryRail from "../components/CategoryRail"
import ProductCard from "../components/ProductCard"
import KitchenPanel from "../components/KitchenPanel"
import ContagemWidget from "../components/ContagemWidget"
import ContagemView from "../components/ContagemView"
import KitchenProductionView from "../components/KitchenProductionView"
import AlertTicker from "../components/AlertTicker"
import AlertasView from "../components/AlertasView"
import RelatoriosView from "../components/RelatoriosView"
import DetailsModal from "../components/DetailsModal"
import ProductFormModal from "../components/ProductFormModal"
import FornecedoresView from "../components/FornecedoresView"
import FornecedorFormModal from "../components/FornecedorFormModal"
import MovimentacoesView from "../components/MovimentacoesView"
import SaidaFormModal from "../components/SaidaFormModal"
import EntradaFormModal from "../components/EntradaFormModal"
import ConfirmDialog from "../components/ConfirmDialog"
import { useToast } from "../components/Toast"

const TABS = [
  { key: "geral", label: "Visão Geral" },
  { key: "inv", label: "Inventário" },
  { key: "alert", label: "Alertas" },
  { key: "forn", label: "Fornecedores" },
  { key: "mov", label: "Movimentações" },
  { key: "rel", label: "Relatórios" },
  { key: "merenda", label: "Merenda" },
  { key: "sol", label: "Solicitações" },
]

const ALERTAS_VAZIO = { resumo: {}, validade: [], estoque_critico: [] }

function flattenAlertas(al) {
  const mapUrgencia = (u) => (u === "critico" ? "out" : "low")
  return [
    ...(al.validade ?? []).map((a) => ({
      id: `v${a.produto_id}`,
      code: mapUrgencia(a.urgencia),
      label: `${a.motivo} — ${a.nome}`,
      produtoId: a.produto_id,
    })),
    ...(al.estoque_critico ?? []).map((a) => ({
      id: `e${a.produto_id}`,
      code: mapUrgencia(a.urgencia),
      label: `${a.motivo} — ${a.nome}`,
      produtoId: a.produto_id,
    })),
  ]
}

export default function DashboardPage() {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [alertas, setAlertas] = useState(ALERTAS_VAZIO)
  const [saidaOpen, setSaidaOpen] = useState(false)
  const [entradaOpen, setEntradaOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState("inv")
  const [cat, setCat] = useState({ tipo: "all" })
  const [search, setSearch] = useState("")
  const [termo, setTermo] = useState("")

  const [busyId, setBusyId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editProduto, setEditProduto] = useState(null)
  const [addFornOpen, setAddFornOpen] = useState(false)
  const [editFornecedor, setEditFornecedor] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [aExcluir, setAExcluir] = useState(null)
  const [merendaView, setMerendaView] = useState("producao")
  const [contagemKey, setContagemKey] = useState(0)

  const toast = useToast()
  const toastShown = useRef(false)

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setTermo(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  async function carregar() {
    setLoading(true)
    try {
      const [p, c, g, f, mv, al] = await Promise.all([
        produtosApi.list(termo), categoriasApi.list(), gruposApi.list(),
        fornecedoresApi.list(), movimentacoesApi.list(), alertasApi.list(),
      ])
      setProdutos(p)
      setCategorias(c)
      setGrupos(g)
      setFornecedores(f)
      setMovimentacoes(mv)
      setAlertas(al)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [termo]) // eslint-disable-line

  useEffect(() => {
    if (loading || toastShown.current) return
    const criticos = (alertas.resumo?.vencidos ?? 0) + (alertas.resumo?.esgotados ?? 0)
    if (criticos > 0) {
      toast(`${criticos} alerta(s) crítico(s) — confira a aba Alertas`, "danger")
      toastShown.current = true
    }
  }, [loading, alertas, toast])

  const counts = useMemo(() => {
    const cat = {}, grupo = {}
    for (const p of produtos) {
      if (p.categoria != null) cat[p.categoria] = (cat[p.categoria] || 0) + 1
      grupo[p.grupo] = (grupo[p.grupo] || 0) + 1
    }
    return { cat, grupo }
  }, [produtos])

  const visiveis = useMemo(() => {
    if (cat.tipo === "cat") return produtos.filter((p) => p.categoria === cat.id)
    if (cat.tipo === "grupo") return produtos.filter((p) => p.grupo === cat.id)
    return produtos
  }, [produtos, cat])

  const alerts = useMemo(() => flattenAlertas(alertas), [alertas])

  const resumo = useMemo(() => {
    let valor = 0
    for (const p of produtos) {
      if (p.preco) valor += Number(p.preco) * Number(p.quantidade)
    }
    return {
      valor,
      baixo: alertas.resumo?.total_estoque_critico ?? 0,
      vencidos: alertas.resumo?.vencidos ?? 0,
      total: produtos.length,
    }
  }, [produtos, alertas])

  async function ajustar(produto, delta) {
    setBusyId(produto.id)
    try {
      await movimentacoesApi.create({
        produto: produto.id,
        tipo: delta > 0 ? "ENTRADA" : "SAIDA",
        quantidade: Math.abs(delta),
        motivo: "ajuste rápido",
      })
      await carregar()
    } catch (e) {
      toast(String(e.message || "Falha ao ajustar"), "danger")
    } finally {
      setBusyId(null)
    }
  }

  async function excluir() {
    const p = aExcluir
    setAExcluir(null)
    setDetalhe(null)
    await produtosApi.remove(p.id)
    toast(`"${p.nome}" excluído`, "danger")
    carregar()
  }

  async function novaCategoria() {
    const nome = window.prompt("Nome da nova categoria:")
    if (!nome || !nome.trim()) return
    await categoriasApi.create({ name: nome.trim() })
    toast("Categoria criada")
    carregar()
  }

  function relatorio() {
    setTab("rel")
  }

  function refreshContagem() {
    setContagemKey((k) => k + 1)
    carregar()
  }

  function abrirAlerta(a) {
    const id = typeof a === "object" ? a.produtoId : a
    const p = produtos.find((x) => x.id === id)
    if (p) setDetalhe(p)
  }

  return (
    <div className="flex min-h-screen overflow-x-clip">
      <Sidebar active="inv" onPick={() => {}} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header search={search} setSearch={setSearch} onAddItem={() => setAddOpen(true)} onReport={relatorio} />

        <main className="mx-auto w-full min-w-0 max-w-[1500px] flex-1 px-4 py-5 sm:px-6">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="mt-5"
            >
              {tab === "inv" && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
                  {/* Categorias */}
                  <CategoryRail
                    categorias={categorias}
                    grupos={grupos}
                    counts={counts}
                    total={produtos.length}
                    active={cat}
                    onPick={setCat}
                    onAddCategory={novaCategoria}
                  />

                  {/* Grade de itens */}
                  <section>
                    <div className="mb-3 flex items-end justify-between">
                      <div>
                        <h2 className="font-display text-2xl font-bold leading-none">Inventário</h2>
                        <p className="mt-1 text-sm text-ink-faint">
                          {visiveis.length} {visiveis.length === 1 ? "item" : "itens"}
                          {cat.tipo !== "all" && " no filtro atual"}
                          {termo && ` para “${termo}”`}
                        </p>
                      </div>
                    </div>

                    {loading ? (
                      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-ink-faint">
                        Carregando inventário…
                      </div>
                    ) : visiveis.length === 0 ? (
                      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-20 text-center">
                        <span className="mb-2 text-ink-faint">{Icon.box(40)}</span>
                        <p className="font-display text-lg font-bold">Nenhum item por aqui</p>
                        <p className="text-sm text-ink-faint">
                          {termo ? "Tente outra busca." : "Adicione o primeiro item do estoque."}
                        </p>
                      </div>
                    ) : (
                      <motion.div
                        layout
                        className="grid gap-3.5"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(214px, 1fr))" }}
                      >
                        <AnimatePresence>
                          {visiveis.map((p, i) => (
                            <ProductCard
                              key={p.id}
                              produto={p}
                              index={i}
                              busy={busyId === p.id}
                              onAdd={() => ajustar(p, +1)}
                              onRemove={() => ajustar(p, -1)}
                              onDetails={setDetalhe}
                            />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </section>

                  {/* Cozinha */}
                  <aside className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-24 xl:self-start">
                    <KitchenPanel />
                  </aside>
                </div>
              )}

              {tab === "forn" && (
                <FornecedoresView
                  fornecedores={fornecedores}
                  onNew={() => setAddFornOpen(true)}
                  onEdit={(f) => setEditFornecedor(f)}
                  onChanged={carregar}
                />
              )}

              {tab === "geral" && (
                <VisaoGeral
                  resumo={resumo}
                  alerts={alerts}
                  onPick={abrirAlerta}
                  contagemKey={contagemKey}
                  onOpenContagem={() => { setMerendaView("contagem"); setTab("merenda") }}
                />
              )}

              {tab === "alert" && (
                <AlertasView alertas={alertas} onPick={abrirAlerta} />
              )}

              {tab === "mov" && (
                <MovimentacoesView
                  movimentacoes={movimentacoes}
                  onNovaEntrada={() => setEntradaOpen(true)}
                  onNovaSaida={() => setSaidaOpen(true)}
                />
              )}

              {tab === "rel" && <RelatoriosView />}

              {tab === "merenda" && (
                <div>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {[
                      { key: "contagem", label: "Contagem" },
                      { key: "producao", label: "Produção" },
                    ].map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => setMerendaView(v.key)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                          merendaView === v.key
                            ? "border-brand bg-brand text-[#f4f1e7]"
                            : "border-line bg-surface text-ink-soft"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  {merendaView === "contagem" ? (
                    <ContagemView onRegistrado={refreshContagem} />
                  ) : (
                    <KitchenProductionView onBaixaConcluida={carregar} />
                  )}
                </div>
              )}

              {tab === "sol" && (
                <EmptyTab
                  icon={Icon.report(40)}
                  titulo="Solicitações"
                  texto="Pedidos de reposição e requisições de materiais ficarão centralizados nesta aba."
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <AlertTicker alerts={alerts} onPick={abrirAlerta} />
      </div>

      {/* Modais */}
      <ProductFormModal
        open={addOpen || !!editProduto}
        produto={editProduto}
        grupos={grupos}
        fornecedores={fornecedores.filter((f) => f.ativo)}
        onClose={() => { setAddOpen(false); setEditProduto(null) }}
        onSaved={carregar}
      />
      <FornecedorFormModal
        open={addFornOpen || !!editFornecedor}
        fornecedor={editFornecedor}
        onClose={() => { setAddFornOpen(false); setEditFornecedor(null) }}
        onSaved={carregar}
      />
      <SaidaFormModal
        open={saidaOpen}
        produtos={produtos}
        onClose={() => setSaidaOpen(false)}
        onSaved={carregar}
      />
      <EntradaFormModal
        open={entradaOpen}
        produtos={produtos}
        fornecedores={fornecedores.filter((f) => f.ativo)}
        onClose={() => setEntradaOpen(false)}
        onSaved={carregar}
      />
      <DetailsModal
        produto={detalhe}
        onClose={() => setDetalhe(null)}
        onEdit={(p) => { setDetalhe(null); setEditProduto(p) }}
        onDelete={(p) => setAExcluir(p)}
      />
      <ConfirmDialog
        open={!!aExcluir}
        title="Excluir item"
        message={aExcluir ? `Remover "${aExcluir.nome}" do estoque? Esta ação não pode ser desfeita.` : ""}
        onConfirm={excluir}
        onCancel={() => setAExcluir(null)}
      />
    </div>
  )
}

/* ---------- Aba Visão Geral ---------- */
function VisaoGeral({ resumo, alerts, onPick, contagemKey, onOpenContagem }) {
  const cards = [
    { label: "Itens cadastrados", value: resumo.total, icon: Icon.box, tint: "var(--color-brand-tint)", fg: "var(--color-brand)" },
    { label: "Estoque crítico", value: resumo.baixo, icon: Icon.alert, tint: "var(--color-low-tint)", fg: "var(--color-low)" },
    { label: "Validade crítica", value: resumo.vencidos, icon: Icon.bell, tint: "var(--color-out-tint)", fg: "var(--color-out)" },
    { label: "Valor em estoque", value: brl(resumo.valor), icon: Icon.report, tint: "var(--color-accent-tint)", fg: "var(--color-accent)", small: true },
  ]
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="card p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: c.tint, color: c.fg }}>
                {c.icon(20)}
              </span>
              <div className={`mt-3 font-display font-bold ${c.small ? "text-xl" : "text-3xl"}`}>{c.value}</div>
              <div className="mt-0.5 text-xs text-ink-faint">{c.label}</div>
            </div>
          ))}
        </div>
        <div className="card mt-5 p-5">
          <h3 className="font-display text-lg font-bold">Central de alertas</h3>
          <p className="text-sm text-ink-faint">Itens com validade crítica ou estoque abaixo do limiar.</p>
          <div className="mt-3 divide-y divide-line">
            {alerts.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">Nenhum alerta. 🎉</p>}
            {alerts.map((a) => (
              <button key={a.id} onClick={() => onPick(a)} className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80">
                <span className={a.code === "out" ? "text-out" : "text-low"}>{Icon.alert(16)}</span>
                <span className="flex-1 text-sm font-medium">{a.label}</span>
                <span className="text-ink-faint">{Icon.chevronR(15)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <aside>
        <ContagemWidget refreshKey={contagemKey} onOpenContagem={onOpenContagem} />
      </aside>
    </div>
  )
}

/* ---------- Aba vazia genérica ---------- */
function EmptyTab({ icon, titulo, texto }) {
  return (
    <div className="card grid place-items-center px-6 py-20 text-center">
      <span className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-ink-faint">{icon}</span>
      <h2 className="font-display text-2xl font-bold">{titulo}</h2>
      <p className="mt-1 max-w-md text-sm text-ink-faint">{texto}</p>
      <span className="mt-4 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand">Em breve</span>
    </div>
  )
}
