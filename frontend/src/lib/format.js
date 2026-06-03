export const brl = (v) => {
  if (v == null || v === "") return "—"
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export const qtd = (v) =>
  Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 })

export const dataBR = (iso) => {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

// Limiar (heurística de UI — o backend não tem campo estoque_minimo ainda)
export const LIMITE_BAIXO = 15

// Status de estoque a partir da quantidade: { code, label }
export function stockStatus(quantidade) {
  const q = Number(quantidade)
  if (q <= 0) return { code: "out", label: "Esgotado" }
  if (q <= LIMITE_BAIXO) return { code: "low", label: "Estoque Baixo" }
  return { code: "ok", label: "Em Estoque" }
}

// Percentual visual da barrinha (0–100), saturando em 2x o limiar
export function stockPercent(quantidade) {
  const q = Math.max(0, Number(quantidade))
  return Math.min(100, Math.round((q / (LIMITE_BAIXO * 2)) * 100))
}

// Status da validade: { code, label, dias }
export function validadeStatus(iso) {
  if (!iso) return { code: "none", label: "Sem validade", dias: null }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(iso + "T00:00:00")
  const dias = Math.round((alvo - hoje) / 86400000)
  if (dias < 0) return { code: "expired", label: "Vencido", dias }
  if (dias <= 30) return { code: "soon", label: `Vence em ${dias}d`, dias }
  return { code: "ok", label: "Em dia", dias }
}
