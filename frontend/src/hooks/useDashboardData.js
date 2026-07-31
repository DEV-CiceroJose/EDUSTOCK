import { useCallback, useEffect, useMemo, useState } from "react"
import {
  alertasApi,
  categoriasApi,
  fornecedoresApi,
  gruposApi,
  movimentacoesApi,
  produtosApi,
} from "../api"
import { getConfig } from "../lib/config"

const ALERTAS_VAZIO = { resumo: {}, validade: [], estoque_critico: [] }

function flattenAlertas(alertas) {
  const mapUrgencia = (urgencia) => (urgencia === "critico" ? "out" : "low")
  return [
    ...(alertas.validade ?? []).map((alerta) => ({
      id: `v${alerta.produto_id}`,
      code: mapUrgencia(alerta.urgencia),
      label: `${alerta.motivo} — ${alerta.nome}`,
      produtoId: alerta.produto_id,
    })),
    ...(alertas.estoque_critico ?? []).map((alerta) => ({
      id: `e${alerta.produto_id}`,
      code: mapUrgencia(alerta.urgencia),
      label: `${alerta.motivo} — ${alerta.nome}`,
      produtoId: alerta.produto_id,
    })),
  ]
}

export function useDashboardData() {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [grupos, setGrupos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [alertas, setAlertas] = useState(ALERTAS_VAZIO)
  const [loadingProdutos, setLoadingProdutos] = useState(true)
  const [loadingBase, setLoadingBase] = useState(true)
  const [error, setError] = useState(null)
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState("")
  const [termo, setTermo] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() === termo) return
      setLoadingProdutos(true)
      setTermo(search.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [search, termo])

  const carregar = useCallback(() => {
    setError(null)
    setLoadingProdutos(true)
    setLoadingBase(true)
    setRevision((current) => current + 1)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      categoriasApi.list(),
      gruposApi.list(),
      fornecedoresApi.list(),
      movimentacoesApi.list(),
      alertasApi.list({ dias_validade: getConfig().validityAlertDays }),
    ])
      .then(([categoriasData, gruposData, fornecedoresData, movimentacoesData, alertasData]) => {
        if (!active) return
        setCategorias(categoriasData)
        setGrupos(gruposData)
        setFornecedores(fornecedoresData)
        setMovimentacoes(movimentacoesData)
        setAlertas(alertasData)
      })
      .catch((cause) => {
        if (active) setError(cause)
      })
      .finally(() => {
        if (active) setLoadingBase(false)
      })
    return () => { active = false }
  }, [revision])

  useEffect(() => {
    let active = true
    produtosApi.list(termo)
      .then((items) => {
        if (active) setProdutos(items)
      })
      .catch((cause) => {
        if (active) setError(cause)
      })
      .finally(() => {
        if (active) setLoadingProdutos(false)
      })
    return () => { active = false }
  }, [revision, termo])

  const counts = useMemo(() => {
    const cat = {}
    const grupo = {}
    for (const produto of produtos) {
      if (produto.categoria != null) {
        cat[produto.categoria] = (cat[produto.categoria] || 0) + 1
      }
      grupo[produto.grupo] = (grupo[produto.grupo] || 0) + 1
    }
    return { cat, grupo }
  }, [produtos])

  const visiveis = useMemo(() => (filtro) => {
    if (!filtro || filtro.tipo === "all") return produtos
    if (filtro.tipo === "cat") {
      return produtos.filter((produto) => produto.categoria === filtro.id)
    }
    if (filtro.tipo === "grupo") {
      return produtos.filter((produto) => produto.grupo === filtro.id)
    }
    return produtos
  }, [produtos])

  const alerts = useMemo(() => flattenAlertas(alertas), [alertas])

  const resumo = useMemo(() => {
    let valor = 0
    for (const produto of produtos) {
      if (produto.preco) valor += Number(produto.preco) * Number(produto.quantidade)
    }
    return {
      valor,
      baixo: alertas.resumo?.total_estoque_critico ?? 0,
      vencidos: alertas.resumo?.vencidos ?? 0,
      total: produtos.length,
    }
  }, [produtos, alertas])

  return {
    produtos,
    categorias,
    grupos,
    fornecedores,
    movimentacoes,
    alertas,
    search,
    setSearch,
    loading: loadingProdutos || loadingBase,
    error,
    carregar,
    counts,
    visiveis,
    alerts,
    resumo,
  }
}
