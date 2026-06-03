/* ------------------------------------------------------------------
   Mock que ESPELHA o contrato da API REST do Django (DRF).
   Persiste em localStorage para o app funcionar sem backend.
   Quando o Django estiver no ar, basta VITE_USE_MOCK=false.
------------------------------------------------------------------ */

const KEY = "easystock:db:v1"
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))

function seed() {
  const hoje = new Date()
  const emDias = (d) => {
    const x = new Date(hoje)
    x.setDate(x.getDate() + d)
    return x.toISOString().slice(0, 10)
  }
  const categorias = [
    { id: 1, name: "Material de Limpeza" },
    { id: 2, name: "Gêneros Alimentícios" },
    { id: 3, name: "Material de Escritório" },
    { id: 4, name: "Higiene" },
  ]
  const produtos = [
    { id: 1, nome: "Arroz Branco Tipo 1", numero_nota_fiscal: "NF-00231", categoria: 2, quantidade: 48, unidade: "KG", validade: emDias(95), preco: "5.40" },
    { id: 2, nome: "Feijão Carioca", numero_nota_fiscal: "NF-00231", categoria: 2, quantidade: 30, unidade: "KG", validade: emDias(20), preco: "8.20" },
    { id: 3, nome: "Detergente Neutro", numero_nota_fiscal: "NF-00198", categoria: 1, quantidade: 64, unidade: "UN", validade: emDias(310), preco: "2.15" },
    { id: 4, nome: "Água Sanitária 5L", numero_nota_fiscal: "NF-00198", categoria: 1, quantidade: 12, unidade: "CX", validade: emDias(8), preco: "14.90" },
    { id: 5, nome: "Resma Papel A4", numero_nota_fiscal: "NF-00210", categoria: 3, quantidade: 25, unidade: "PC", validade: null, preco: "23.00" },
    { id: 6, nome: "Óleo de Soja 900ml", numero_nota_fiscal: "NF-00231", categoria: 2, quantidade: 40, unidade: "UN", validade: emDias(-3), preco: "6.75" },
    { id: 7, nome: "Sabonete Líquido", numero_nota_fiscal: "NF-00255", categoria: 4, quantidade: 18, unidade: "L", validade: emDias(140), preco: "11.30" },
    { id: 8, nome: "Caneta Esferográfica Azul", numero_nota_fiscal: "NF-00210", categoria: 3, quantidade: 200, unidade: "UN", validade: null, preco: "0.90" },
  ]
  return { categorias, produtos, seqC: 5, seqP: 9 }
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

// Acrescenta o nome da categoria (como um serializer DRF faria com source=)
function expand(p, db) {
  const cat = db.categorias.find((c) => c.id === Number(p.categoria))
  return { ...p, categoria_nome: cat ? cat.name : "—", criado_por_nome: "voce", atualizado_em: new Date().toISOString() }
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
    categoria: Number(data.categoria),
    quantidade: Number(data.quantidade),
    unidade: data.unidade,
    validade: data.validade || null,
    preco: data.preco === "" || data.preco == null ? null : String(data.preco),
  }
}
