import { useEffect, useMemo, useState } from "react"
import { produtosApi, categoriasApi, gruposApi, fornecedoresApi, movimentacoesApi, alertasApi } from "../api"

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

/**
 * Hook para gerenciar dados do dashboard (produtos, categorias, grupos, fornecedores, movimentações, alertas)
 * Implementa debounce de 300ms na busca e executa Promise.all de 6 endpoints
 * 
 * @returns {Object} Objeto contendo:
 *   - produtos: Array de produtos
 *   - categorias: Array de categorias
 *   - grupos: Array de grupos
 *   - fornecedores: Array de fornecedores
 *   - movimentacoes: Array de movimentações
 *   - alertas: Objeto com alertas de validade e estoque
 *   - search: String com termo de busca atual
 *   - setSearch: Função para atualizar termo de busca
 *   - loading: Boolean indicando carregamento
 *   - carregar: Função para forçar refresh dos dados
 *   - counts: Objeto com contagens por categoria e grupo
 *   - visiveis: Função para filtrar produtos por categoria/grupo
 *   - alerts: Array de alertas formatados (flattened)
 *   - resumo: Objeto com resumo consolidado (valor total, itens baixo estoque, vencidos, total)
 */
export function useDashboardData() {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [alertas, setAlertas] = useState(ALERTAS_VAZIO)
  const [loading, setLoading] = useState(true)
  
  const [search, setSearch] = useState("")
  const [termo, setTermo] = useState("")

  // Debounce da busca (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setTermo(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Função de carregamento de dados
  async function carregar() {
    setLoading(true)
    try {
      const [p, c, g, f, mv, al] = await Promise.all([
        produtosApi.list(termo),
        categoriasApi.list(),
        gruposApi.list(),
        fornecedoresApi.list(),
        movimentacoesApi.list(),
        alertasApi.list(),
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

  // Recarregar quando termo de busca muda
  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo])

  // Cálculo de counts por categoria e grupo
  const counts = useMemo(() => {
    const cat = {}
    const grupo = {}
    for (const p of produtos) {
      if (p.categoria != null) cat[p.categoria] = (cat[p.categoria] || 0) + 1
      grupo[p.grupo] = (grupo[p.grupo] || 0) + 1
    }
    return { cat, grupo }
  }, [produtos])

  // Função auxiliar para filtrar produtos por categoria ou grupo
  const visiveis = useMemo(() => {
    // Retorna função que pode ser chamada com filtro { tipo, id }
    return (cat) => {
      if (!cat || cat.tipo === "all") return produtos
      if (cat.tipo === "cat") return produtos.filter((p) => p.categoria === cat.id)
      if (cat.tipo === "grupo") return produtos.filter((p) => p.grupo === cat.id)
      return produtos
    }
  }, [produtos])

  // Alertas formatados (flattened)
  const alerts = useMemo(() => flattenAlertas(alertas), [alertas])

  // Resumo consolidado
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

  return {
    // Dados brutos
    produtos,
    categorias,
    grupos,
    fornecedores,
    movimentacoes,
    alertas,
    
    // Estado de busca
    search,
    setSearch,
    
    // Estado de carregamento
    loading,
    
    // Função de refresh
    carregar,
    
    // Valores computados
    counts,
    visiveis,
    alerts,
    resumo,
  }
}
