/* ------------------------------------------------------------------
   Mock que ESPELHA o contrato da API REST do Django (DRF).
   Hierarquia: Categoria -> Grupo -> Produto. Persiste em localStorage.
------------------------------------------------------------------ */

const KEY = "easystock:db:v2"
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
  const produtos = [
    { id: 1, nome: "Arroz Branco Tipo 1", numero_nota_fiscal: "NF-00231", grupo: 1, quantidade: 48, unidade: "KG", estoque_minimo: 20, perecivel: true, periodicidade: "MENSAL", validade: emDias(95), preco: "5.40" },
    { id: 2, nome: "Feijão Carioca", numero_nota_fiscal: "NF-00231", grupo: 2, quantidade: 12, unidade: "KG", estoque_minimo: 15, perecivel: true, periodicidade: "MENSAL", validade: emDias(20), preco: "8.20" },
    { id: 3, nome: "Detergente Neutro", numero_nota_fiscal: "NF-00198", grupo: 3, quantidade: 64, unidade: "UN", estoque_minimo: 20, perecivel: false, periodicidade: "EVENTUAL", validade: emDias(310), preco: "2.15" },
    { id: 4, nome: "Resma Papel A4", numero_nota_fiscal: "NF-00210", grupo: 4, quantidade: 25, unidade: "PC", estoque_minimo: 10, perecivel: false, periodicidade: "EVENTUAL", validade: null, preco: "23.00" },
  ]
  return { categorias, grupos, produtos, seqC: 4, seqG: 5, seqP: 5 }
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
  return {
    ...p,
    grupo_nome: grupo ? grupo.nome : "—",
    categoria: cat ? cat.id : null,
    categoria_nome: cat ? cat.name : "—",
    criado_por_nome: "voce",
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
    const novo = { id: db.seqP++, ...normalize(data) }
    db.produtos.push(novo)
    save(db)
    return expand(novo, db)
  },
  async update(id, data) {
    await delay()
    const db = load()
    const i = db.produtos.findIndex((x) => x.id === Number(id))
    if (i === -1) throw new Error("Produto não encontrado")
    db.produtos[i] = { ...db.produtos[i], ...normalize(data) }
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
    quantidade: Number(data.quantidade),
    unidade: data.unidade,
    estoque_minimo: Number(data.estoque_minimo) || 0,
    perecivel: Boolean(data.perecivel),
    periodicidade: data.periodicidade || "EVENTUAL",
    validade: data.validade || null,
    preco: data.preco === "" || data.preco == null ? null : String(data.preco),
  }
}
