/* ------------------------------------------------------------------
   Mock que ESPELHA o contrato da API REST do Django (DRF).
   Hierarquia: Categoria -> Grupo -> Produto. Persiste em localStorage.
------------------------------------------------------------------ */

import { getConfig } from "../lib/config"

const KEY = "easystock:db:v4"
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))

function seed() {
  const hoje = new Date()
  const emDias = (d) => {
    const x = new Date(hoje)
    x.setDate(x.getDate() + d)
    return x.toISOString().slice(0, 10)
  }
  const categorias = [
    { id: 1, name: "Alimentos" },
    { id: 2, name: "Limpeza" },
    { id: 3, name: "Papelaria" },
  ]
  const grupos = [
    { id: 1, nome: "Carboidratos", categoria: 1 },
    { id: 2, nome: "Leguminosas", categoria: 1 },
    { id: 3, nome: "Geral", categoria: 2 },
    { id: 4, nome: "Geral", categoria: 3 },
  ]
  const fornecedores = [
    { id: 1, nome: "Atacadão Escolar", documento: "12.345.678/0001-99", endereco: "Av. Central, 100", telefone: "(81) 99999-0000", email: "vendas@atacadao.com", emite_nota_fiscal: true, aceita_fiado: false, ativo: true, observacao: "" },
    { id: 2, nome: "Mercadinho do Zé", documento: "", endereco: "Rua 5, 23", telefone: "(81) 98888-1111", email: "", emite_nota_fiscal: false, aceita_fiado: true, ativo: true, observacao: "Aceita fiado quando a verba atrasa." },
  ]
  const produtos = [
    { id: 1, nome: "Arroz Branco Tipo 1", grupo: 1, fornecedor: 1, quantidade: 48, unidade: "KG", estoque_minimo: 20, perecivel: true, periodicidade: "MENSAL", validade: emDias(95), ultimo_preco: "5.40" },
    { id: 2, nome: "Feijão Carioca", grupo: 2, fornecedor: 1, quantidade: 12, unidade: "KG", estoque_minimo: 15, perecivel: true, periodicidade: "MENSAL", validade: emDias(20), ultimo_preco: "8.20" },
    { id: 3, nome: "Detergente Neutro", grupo: 3, fornecedor: 2, quantidade: 64, unidade: "UN", estoque_minimo: 20, perecivel: false, periodicidade: "EVENTUAL", validade: emDias(310), ultimo_preco: null },
    { id: 4, nome: "Resma Papel A4", grupo: 4, fornecedor: null, quantidade: 25, unidade: "PC", estoque_minimo: 10, perecivel: false, periodicidade: "EVENTUAL", validade: null, ultimo_preco: null },
  ]
  const dataHoje = hoje.toISOString().slice(0, 10)
  const entradas = [
    {
      id: 1, fornecedor: 1, fornecedor_nome: "Atacadão Escolar",
      numero_nota_fiscal: "NF-9001", data: dataHoje, observacao: "",
      itens: [
        { produto: 1, produto_nome: "Arroz Branco Tipo 1", quantidade: 10, preco_unitario: 5.4 },
        { produto: 2, produto_nome: "Feijão Carioca", quantidade: 5, preco_unitario: 8.2 },
      ],
      total: "95.00", criado_em: hoje.toISOString(),
    },
  ]
  const movimentacoes = [
    { id: 1, produto: 1, tipo: "ENTRADA", quantidade: 10, preco_unitario: 5.4, entrada: 1, motivo: "entrada", data: dataHoje, criado_em: hoje.toISOString() },
    { id: 2, produto: 2, tipo: "ENTRADA", quantidade: 5, preco_unitario: 8.2, entrada: 1, motivo: "entrada", data: dataHoje, criado_em: hoje.toISOString() },
  ]
  const fatores = [
    { produto: 1, gramas_por_aluno: 80, ativo: true },
    { produto: 2, gramas_por_aluno: 60, ativo: true },
  ]
  return {
    categorias, grupos, fornecedores, produtos,
    movimentacoes, entradas, frequencias: [], fatores,
    seqC: 4, seqG: 5, seqF: 3, seqP: 5, seqM: 3, seqE: 2, seqFreq: 1,
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignora */ }
  const s = seed()
  localStorage.setItem(KEY, JSON.stringify(s))
  return s
}

function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db))
}

function expand(p, db) {
  const grupo = db.grupos.find((g) => g.id === Number(p.grupo))
  const cat = grupo ? db.categorias.find((c) => c.id === Number(grupo.categoria)) : null
  const forn = p.fornecedor ? db.fornecedores.find((f) => f.id === Number(p.fornecedor)) : null
  return {
    ...p,
    grupo_nome: grupo ? grupo.nome : "—",
    categoria: cat ? cat.id : null,
    categoria_nome: cat ? cat.name : "—",
    fornecedor: p.fornecedor ?? null,
    fornecedor_nome: forn ? forn.nome : null,
    criado_por_nome: "voce",
    criado_em: p.criado_em ?? new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }
}

export const mockProdutos = {
  async list(q) {
    await delay()
    const db = load()
    let itens = db.produtos.map((p) => expand(p, db))
    if (q) {
      const t = q.toLowerCase()
      itens = itens.filter((p) => p.nome.toLowerCase().includes(t))
    }
    return itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  },
  async get(id) {
    await delay(120)
    const db = load()
    const p = db.produtos.find((x) => x.id === Number(id))
    if (!p) throw new Error("Produto não encontrado")
    return expand(p, db)
  },
  async create(data) {
    await delay()
    const db = load()
    const novo = { id: db.seqP++, ...normalize(data), quantidade: 0 }
    db.produtos.push(novo)
    save(db)
    return expand(novo, db)
  },
  async update(id, data) {
    await delay()
    const db = load()
    const i = db.produtos.findIndex((x) => x.id === Number(id))
    if (i === -1) throw new Error("Produto não encontrado")
    const semSaldo = normalize(data)
    delete semSaldo.quantidade
    db.produtos[i] = { ...db.produtos[i], ...semSaldo }
    save(db)
    return expand(db.produtos[i], db)
  },
  async remove(id) {
    await delay()
    const db = load()
    db.produtos = db.produtos.filter((x) => x.id !== Number(id))
    save(db)
  },
}

export const mockGrupos = {
  async list() {
    await delay(120)
    const db = load()
    return db.grupos
      .map((g) => ({ ...g, categoria_nome: db.categorias.find((c) => c.id === g.categoria)?.name ?? "—" }))
      .sort((a, b) => (a.categoria_nome + a.nome).localeCompare(b.categoria_nome + b.nome, "pt-BR"))
  },
  async create(data) {
    await delay()
    const db = load()
    const novo = { id: db.seqG++, nome: String(data.nome).trim(), categoria: Number(data.categoria) }
    db.grupos.push(novo)
    save(db)
    return novo
  },
  async remove(id) {
    await delay()
    const db = load()
    db.grupos = db.grupos.filter((g) => g.id !== Number(id))
    save(db)
  },
}

export const mockFornecedores = {
  async list() {
    await delay(120)
    const db = load()
    return [...db.fornecedores].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  },
  async create(data) {
    await delay()
    const db = load()
    const novo = {
      id: db.seqF++,
      nome: String(data.nome).trim(),
      documento: data.documento || "",
      endereco: data.endereco || "",
      telefone: data.telefone || "",
      email: data.email || "",
      emite_nota_fiscal: data.emite_nota_fiscal ?? true,
      aceita_fiado: Boolean(data.aceita_fiado),
      ativo: data.ativo ?? true,
      observacao: data.observacao || "",
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    }
    db.fornecedores.push(novo)
    save(db)
    return novo
  },
  async update(id, data) {
    await delay()
    const db = load()
    const i = db.fornecedores.findIndex((f) => f.id === Number(id))
    if (i === -1) throw new Error("Fornecedor não encontrado")
    db.fornecedores[i] = { ...db.fornecedores[i], ...data }
    save(db)
    return db.fornecedores[i]
  },
  async remove(id) {
    await delay()
    const db = load()
    const emUso = db.produtos.some((p) => Number(p.fornecedor) === Number(id))
    if (emUso) throw new Error("Fornecedor vinculado a produtos — desative em vez de excluir.")
    db.fornecedores = db.fornecedores.filter((f) => f.id !== Number(id))
    save(db)
  },
}

function ajustarSaldo(db, produtoId, tipo, quantidade) {
  const p = db.produtos.find((x) => x.id === Number(produtoId))
  if (!p) throw new Error("Produto não encontrado")
  const q = Number(quantidade)
  if (q <= 0) throw new Error("A quantidade deve ser maior que zero.")
  if (tipo === "SAIDA") {
    if (q > Number(p.quantidade)) throw new Error(`Saída de ${q} excede o saldo (${p.quantidade}).`)
    p.quantidade = Number(p.quantidade) - q
  } else {
    p.quantidade = Number(p.quantidade) + q
  }
  return p
}

export const mockMovimentacoes = {
  async list(qs = "") {
    await delay(120)
    const db = load()
    const params = new URLSearchParams(qs)
    let itens = db.movimentacoes.map((m) => ({
      ...m,
      produto_nome: db.produtos.find((p) => p.id === Number(m.produto))?.nome ?? "—",
    }))
    if (params.get("produto")) itens = itens.filter((m) => Number(m.produto) === Number(params.get("produto")))
    if (params.get("tipo")) itens = itens.filter((m) => m.tipo === params.get("tipo"))
    return itens.sort((a, b) => (b.data + String(b.id)).localeCompare(a.data + String(a.id)))
  },
  async create(data) {
    await delay()
    const db = load()
    ajustarSaldo(db, data.produto, data.tipo, data.quantidade)
    const nova = {
      id: db.seqM++, produto: Number(data.produto), tipo: data.tipo,
      quantidade: Number(data.quantidade), preco_unitario: data.preco_unitario ?? null,
      entrada: data.entrada ?? null, motivo: data.motivo || "",
      data: data.data || new Date().toISOString().slice(0, 10),
      criado_em: new Date().toISOString(),
    }
    db.movimentacoes.push(nova)
    save(db)
    return nova
  },
}

export const mockEntradas = {
  async list() {
    await delay(120)
    const db = load()
    return [...db.entradas].sort((a, b) => (b.data + String(b.id)).localeCompare(a.data + String(a.id)))
  },
  async create(data) {
    await delay()
    const db = load()
    const itens = data.itens || []
    if (itens.length === 0) throw new Error("Informe ao menos um item.")
    const hoje = data.data || new Date().toISOString().slice(0, 10)
    const entradaId = db.seqE++
    let total = 0
    const itensOut = []
    for (const it of itens) {
      ajustarSaldo(db, it.produto, "ENTRADA", it.quantidade)
      const preco = it.preco_unitario != null && it.preco_unitario !== "" ? Number(it.preco_unitario) : null
      if (preco != null) total += preco * Number(it.quantidade)
      const produto = db.produtos.find((p) => p.id === Number(it.produto))
      if (produto && preco != null) produto.ultimo_preco = String(preco)
      db.movimentacoes.push({
        id: db.seqM++, produto: Number(it.produto), tipo: "ENTRADA",
        quantidade: Number(it.quantidade), preco_unitario: preco, entrada: entradaId,
        motivo: "entrada", data: hoje, criado_em: new Date().toISOString(),
      })
      itensOut.push({
        produto: Number(it.produto),
        produto_nome: db.produtos.find((p) => p.id === Number(it.produto))?.nome ?? "—",
        quantidade: Number(it.quantidade), preco_unitario: preco,
      })
    }
    const forn = data.fornecedor ? db.fornecedores.find((f) => f.id === Number(data.fornecedor)) : null
    const entrada = {
      id: entradaId, fornecedor: data.fornecedor ? Number(data.fornecedor) : null,
      fornecedor_nome: forn ? forn.nome : null, numero_nota_fiscal: data.numero_nota_fiscal || "",
      data: hoje, observacao: data.observacao || "", itens: itensOut,
      total: total.toFixed(2), criado_em: new Date().toISOString(),
    }
    db.entradas.push(entrada)
    save(db)
    return entrada
  },
}

export const mockCategorias = {
  async list() {
    await delay(120)
    const db = load()
    return [...db.categorias].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  },
  async create(data) {
    await delay()
    const db = load()
    const novo = { id: db.seqC++, name: String(data.name).trim() }
    db.categorias.push(novo)
    save(db)
    return novo
  },
  async remove(id) {
    await delay()
    const db = load()
    db.categorias = db.categorias.filter((c) => c.id !== Number(id))
    save(db)
  },
}

const CRITICO_DIAS = 7
function diasAteValidade(iso, hoje = new Date()) {
  const h = new Date(hoje)
  h.setHours(0, 0, 0, 0)
  const alvo = new Date(iso + "T00:00:00")
  return Math.round((alvo - h) / 86400000)
}

function urgenciaValidade(dias) {
  return dias < CRITICO_DIAS ? "critico" : "alerta"
}

function isEstoqueCritico(quantidade, estoqueMinimo) {
  const q = Number(quantidade)
  const m = Number(estoqueMinimo) || 0
  if (q <= 0) return { critico: true, urgencia: "critico" }
  if (m > 0 && q < m * 0.2) return { critico: true, urgencia: "alerta" }
  return { critico: false, urgencia: null }
}

function motivoValidade(dias) {
  if (dias < 0) return "Vencido"
  if (dias === 0) return "Vence hoje"
  return `Vence em ${dias} dias`
}

const UNIDADE_LABEL = { UN: "unidade", KG: "quilograma", L: "litro", CX: "caixa", PC: "pacote" }

function motivoEstoque(quantidade, unidade) {
  const q = Number(quantidade)
  if (q <= 0) return "Esgotado"
  const label = UNIDADE_LABEL[unidade] || unidade
  const qtdFmt = Number.isInteger(q) ? String(q) : String(q)
  return `Saldo: ${qtdFmt} ${label}`
}

export function coletarAlertasMock(produtos, { tipo, urgencia, dias_validade } = {}) {
  const alertaDias = Number(dias_validade ?? getConfig().validityAlertDays)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const validade = []
  const estoque_critico = []

  if (!tipo || tipo === "validade") {
    for (const p of produtos) {
      if (!p.validade) continue
      const dias = diasAteValidade(p.validade, hoje)
      if (dias > alertaDias) continue
      const item = {
        produto_id: p.id,
        nome: p.nome,
        grupo_nome: p.grupo_nome,
        fornecedor_nome: p.fornecedor_nome ?? null,
        motivo: motivoValidade(dias),
        urgencia: urgenciaValidade(dias),
        dias_validade: dias,
      }
      if (!urgencia || item.urgencia === urgencia) validade.push(item)
    }
  }

  if (!tipo || tipo === "estoque") {
    for (const p of produtos) {
      const { critico, urgencia: urg } = isEstoqueCritico(p.quantidade, p.estoque_minimo)
      if (!critico) continue
      const item = {
        produto_id: p.id,
        nome: p.nome,
        grupo_nome: p.grupo_nome,
        fornecedor_nome: p.fornecedor_nome ?? null,
        motivo: motivoEstoque(p.quantidade, p.unidade),
        urgencia: urg,
        quantidade: String(p.quantidade),
        estoque_minimo: String(p.estoque_minimo ?? 0),
      }
      if (!urgencia || item.urgencia === urgencia) estoque_critico.push(item)
    }
  }

  const vencidos = validade.filter((a) => a.urgencia === "critico").length
  const esgotados = estoque_critico.filter((a) => a.urgencia === "critico").length

  return {
    resumo: {
      vencidos,
      esgotados,
      total_validade: validade.length,
      total_estoque_critico: estoque_critico.length,
    },
    validade,
    estoque_critico,
  }
}

export const mockAlertas = {
  async list(params = {}) {
    await delay()
    const db = load()
    const produtos = db.produtos.map((p) => expand(p, db))
    return coletarAlertasMock(produtos, params)
  },
}

function money(val) {
  return Number(val).toFixed(2)
}

function gerarPrestacaoContasMock(db, inicio, fim) {
  const entradas = db.entradas.filter((e) => e.data >= inicio && e.data <= fim)
  const porFornecedor = new Map()

  for (const e of entradas) {
    const fid = e.fornecedor ?? null
    if (!porFornecedor.has(fid)) {
      porFornecedor.set(fid, {
        fornecedor_id: fid,
        fornecedor_nome: e.fornecedor_nome || "Sem fornecedor",
        documento: fid ? (db.fornecedores.find((f) => f.id === fid)?.documento || "") : "",
        documentos: [],
        total_fornecedor: 0,
      })
    }
    const bloco = porFornecedor.get(fid)
    const itens = (e.itens || []).map((it) => {
      const sub = it.preco_unitario != null ? Number(it.quantidade) * Number(it.preco_unitario) : 0
      return {
        produto_nome: it.produto_nome,
        quantidade: String(it.quantidade),
        preco_unitario: it.preco_unitario != null ? String(it.preco_unitario) : null,
        subtotal: money(sub),
      }
    })
    const doc = {
      entrada_id: e.id,
      numero_nota_fiscal: e.numero_nota_fiscal || "",
      data: e.data,
      total: e.total || money(itens.reduce((s, i) => s + Number(i.subtotal), 0)),
      itens,
    }
    bloco.documentos.push(doc)
    bloco.total_fornecedor += Number(doc.total)
  }

  const catTotals = new Map()
  const catNames = new Map()
  for (const e of entradas) {
    for (const it of e.itens || []) {
      const prod = db.produtos.find((p) => p.id === Number(it.produto))
      const grupo = prod ? db.grupos.find((g) => g.id === prod.grupo) : null
      const cat = grupo ? db.categorias.find((c) => c.id === grupo.categoria) : null
      if (!cat || it.preco_unitario == null) continue
      const sub = Number(it.quantidade) * Number(it.preco_unitario)
      catTotals.set(cat.id, (catTotals.get(cat.id) || 0) + sub)
      catNames.set(cat.id, cat.name)
    }
  }

  let totalGeral = 0
  const porCategoria = [...catTotals.entries()]
    .sort((a, b) => (catNames.get(a[0]) || "").localeCompare(catNames.get(b[0]) || ""))
    .map(([cid, total]) => {
      totalGeral += total
      return { categoria_id: cid, categoria_nome: catNames.get(cid), total: money(total) }
    })

  const fornecedores = [...porFornecedor.values()]
    .map((f) => ({
      ...f,
      total_fornecedor: money(f.total_fornecedor),
      documentos: f.documentos.sort((a, b) => a.data.localeCompare(b.data)),
    }))
    .sort((a, b) => (a.fornecedor_nome || "").localeCompare(b.fornecedor_nome || ""))

  return {
    periodo: { inicio, fim },
    resumo_financeiro: { total_geral: money(totalGeral), por_categoria: porCategoria },
    fornecedores,
  }
}

export const mockRelatorios = {
  async prestacaoContas({ inicio, fim }) {
    await delay(280)
    const db = load()
    return gerarPrestacaoContasMock(db, inicio, fim)
  },
}

function totalFreq(db, data, turno) {
  return db.frequencias
    .filter((f) => f.data === data && (!turno || f.turno === turno))
    .reduce((s, f) => s + f.quantidade_alunos, 0)
}

function mediaHistoricaMock(db, data, turno) {
  const inicio = new Date(data + "T00:00:00")
  inicio.setDate(inicio.getDate() - 30)
  const limite = inicio.toISOString().slice(0, 10)
  const porDia = {}
  for (const f of db.frequencias) {
    if (f.data >= limite && f.data < data && (!turno || f.turno === turno)) {
      porDia[f.data] = (porDia[f.data] || 0) + f.quantidade_alunos
    }
  }
  const vals = Object.values(porDia)
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function previsaoMock(db, data, turno) {
  const total = totalFreq(db, data, turno)
  const media = mediaHistoricaMock(db, data, turno)
  return {
    total_alunos: total,
    media_historica: Math.round(media * 100) / 100,
    alerta_reducao: media > 0 && total < media * 0.5,
  }
}

function planoMock(db, data, turno) {
  const total = totalFreq(db, data, turno)
  const previsao = previsaoMock(db, data, turno)
  const itens = []
  for (const f of db.fatores || []) {
    if (!f.ativo) continue
    const p = db.produtos.find((x) => x.id === f.produto)
    if (!p) continue
    const exp = expand(p, db)
    const base = f.gramas_por_aluno * total
    const qtd = (p.unidade === "KG" || p.unidade === "L") ? base / 1000 : base
    if (qtd <= 0) continue
    const qtdStr = qtd.toFixed(3)
    itens.push({
      produto_id: p.id,
      produto_nome: p.nome,
      categoria_nome: exp.categoria_nome,
      unidade: p.unidade,
      quantidade: qtdStr,
      quantidade_legivel: p.unidade === "KG" ? `${qtd.toFixed(1).replace(".", ",")} kg` : `${Math.round(qtd)} unidades`,
      saldo_atual: String(p.quantidade),
      estoque_insuficiente: Number(p.quantidade) < qtd,
      gramas_por_aluno: String(f.gramas_por_aluno),
    })
  }
  return { data, turno, total_alunos: total, previsao, itens }
}

export const mockOperacao = {
  async registrarContagem(payload) {
    await delay(150)
    const db = load()
    const data = payload.data || new Date().toISOString().slice(0, 10)
    const dup = db.frequencias.some(
      (f) => f.data === data && f.turno === payload.turno && f.turma === payload.turma
    )
    if (dup) {
      throw new Error(
        `Já existe contagem para a turma '${payload.turma}' no turno ${payload.turno} em ${data}.`
      )
    }
    const freq = {
      id: db.seqFreq++,
      data,
      turno: payload.turno,
      turma: payload.turma,
      quantidade_alunos: Number(payload.quantidade_alunos),
    }
    db.frequencias.push(freq)
    save(db)
    return {
      ...freq,
      previsao: previsaoMock(db, data, payload.turno),
    }
  },
  async resumo(data) {
    await delay(100)
    const db = load()
    const d = data || new Date().toISOString().slice(0, 10)
    const total = totalFreq(db, d)
    const media = mediaHistoricaMock(db, d)
    return {
      data: d,
      total_alunos: total,
      media_historica: Math.round(media * 100) / 100,
      variacao_pct: media > 0 ? Math.round(((total - media) / media) * 1000) / 10 : null,
      alerta_reducao: media > 0 && total < media * 0.5,
    }
  },
  async planoDoDia({ data, turno }) {
    await delay(180)
    const db = load()
    const d = data || new Date().toISOString().slice(0, 10)
    return planoMock(db, d, turno)
  },
  async baixaProducao({ data, turno, itens }) {
    await delay(200)
    const db = load()
    const d = data || new Date().toISOString().slice(0, 10)
    const plano = planoMock(db, d, turno)
    const overrides = {}
    for (const it of itens || []) overrides[it.produto_id] = it
    const resultados = []
    for (const item of plano.itens) {
      const qtd = Number(overrides[item.produto_id]?.quantidade_override ?? item.quantidade)
      const p = db.produtos.find((x) => x.id === item.produto_id)
      if (!p || p.quantidade < qtd) {
        resultados.push({ ok: false, produto_id: item.produto_id, produto_nome: item.produto_nome, quantidade: String(qtd), erro: "Saldo insuficiente" })
        continue
      }
      p.quantidade = Number(p.quantidade) - qtd
      db.movimentacoes.push({
        id: db.seqM++, produto: p.id, tipo: "SAIDA", quantidade: qtd,
        preco_unitario: null, entrada: null, motivo: "consumo", data: d,
        criado_em: new Date().toISOString(),
      })
      resultados.push({ ok: true, produto_id: item.produto_id, produto_nome: item.produto_nome, quantidade: String(qtd), movimentacao_id: db.seqM - 1 })
    }
    save(db)
    return {
      data: d, turno, resultados,
      sucesso: resultados.filter((r) => r.ok).length,
      falhas: resultados.filter((r) => !r.ok).length,
    }
  },
}

function normalize(data) {
  return {
    nome: data.nome,
    grupo: Number(data.grupo),
    fornecedor: data.fornecedor ? Number(data.fornecedor) : null,
    quantidade: Number(data.quantidade),
    unidade: data.unidade,
    estoque_minimo: Number(data.estoque_minimo) || 0,
    perecivel: Boolean(data.perecivel),
    periodicidade: data.periodicidade || "EVENTUAL",
    validade: data.validade || null,
    ultimo_preco: null,
  }
}
