import { dataBR } from "./format"
import { getModulosAtivos } from "./auth"
import { dataLocalISO } from "./date"

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export function isoHoje() {
  return dataLocalISO()
}

export function periodoMesAtual() {
  const hoje = new Date()
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return { inicio: dataLocalISO(inicio), fim: isoHoje() }
}

export function periodoTrimestre() {
  const hoje = new Date()
  const trimInicio = Math.floor(hoje.getMonth() / 3) * 3
  const inicio = new Date(hoje.getFullYear(), trimInicio, 1)
  return { inicio: dataLocalISO(inicio), fim: isoHoje() }
}

export function formatPeriodoLabel(inicio, fim) {
  if (inicio.slice(0, 7) === fim.slice(0, 7)) {
    const d = new Date(inicio + "T00:00:00")
    return `${MESES[d.getMonth()]}/${d.getFullYear()}`
  }
  return `${dataBR(inicio)} a ${dataBR(fim)}`
}

export function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function toCsv(rows, sep = ";") {
  const escape = (v) => {
    const s = String(v ?? "")
    if (s.includes(sep) || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  return rows.map((row) => row.map(escape).join(sep)).join("\n")
}

export function prestacaoContasToCsv(dados) {
  const mostrarPreco = getModulosAtivos().includes("financeiro")
  const header = mostrarPreco
    ? ["Fornecedor", "CNPJ", "NF", "Data", "Produto", "Qtd", "Preço Unit.", "Subtotal", "Categoria"]
    : ["Fornecedor", "CNPJ", "NF", "Data", "Produto", "Qtd", "Categoria"]
  const rows = [header]
  for (const f of dados.fornecedores ?? []) {
    for (const doc of f.documentos ?? []) {
      for (const it of doc.itens ?? []) {
        const linha = [
          f.fornecedor_nome,
          f.documento || "",
          doc.numero_nota_fiscal || "",
          dataBR(doc.data),
          it.produto_nome,
          it.quantidade,
        ]
        if (mostrarPreco) linha.push(it.preco_unitario ?? "", it.subtotal)
        linha.push("")
        rows.push(linha)
      }
    }
  }
  if (mostrarPreco) {
    for (const c of dados.resumo_financeiro?.por_categoria ?? []) {
      rows.push(["", "", "", "", "", "", "", c.total, c.categoria_nome, "Resumo"])
    }
  }
  return "\uFEFF" + toCsv(rows)
}
