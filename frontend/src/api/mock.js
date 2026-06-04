/* ------------------------------------------------------------------
   Mock que ESPELHA o contrato da API REST do Django (DRF).
   Hierarquia: Categoria -> Grupo -> Produto. Persiste em localStorage.
------------------------------------------------------------------ */

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
    { id: 1, nome: "Arroz Branco Tipo 1", numero_nota_fiscal: "NF-00231", grupo: 1, fornecedor: 1, quantidade: 48, unidade: "KG", estoque_minimo: 20, perecivel: true, periodicidade: "MENSAL", validade: emDias(95), preco: "5.40" },
    { id: 2, nome: "Feijão Carioca", numero_nota_fiscal: "NF-00231", grupo: 2, fornecedor: 1, quantidade: 12, unidade: "KG", estoque_minimo: 15, perecivel: true, periodicidade: "MENSAL", validade: emDias(20), preco: "8.20" },
    { id: 3, nome: "Detergente Neutro", numero_nota_fiscal: "NF-00198", grupo: 3, fornecedor: 2, quantidade: 64, unidade: "UN", estoque_minimo: 20, perecivel: false, periodicidade: "EVENTUAL", validade: emDias(310), preco: "2.15" },
    { id: 4, nome: "Resma Papel A4", numero_nota_fiscal: "NF-00210", grupo: 4, fornecedor: null, quantidade: 25, unidade: "PC", estoque_minimo: 10, perecivel: false, periodicidade: "EVENTUAL", validade: null, preco: "23.00" },
  ]
  return {
    categorias, grupos, fornecedores, produtos,
    movimentacoes: [], entradas: [],
    seqC: 4, seqG: 5, seqF: 3, seqP: 5, seqM: 1, seqE: 1,
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
    const { quantidade, ...semSaldo } = normalize(data)
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

function normalize(data) {
  return {
    nome: data.nome,
    numero_nota_fiscal: data.numero_nota_fiscal || null,
    grupo: Number(data.grupo),
    fornecedor: data.fornecedor ? Number(data.fornecedor) : null,
    quantidade: Number(data.quantidade),
    unidade: data.unidade,
    estoque_minimo: Number(data.estoque_minimo) || 0,
    perecivel: Boolean(data.perecivel),
    periodicidade: data.periodicidade || "EVENTUAL",
    validade: data.validade || null,
    preco: data.preco === "" || data.preco == null ? null : String(data.preco),
  }
}
