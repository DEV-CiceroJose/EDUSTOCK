import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { brl, dataBR } from "./format"
import { formatPeriodoLabel } from "./export"
import { getModulosAtivos } from "./auth"

export function gerarPdfPrestacaoContas(dados) {
  const mostrarPreco = getModulosAtivos().includes("financeiro")
  const { inicio, fim } = dados.periodo
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const titulo = formatPeriodoLabel(inicio, fim)

  doc.setFillColor(33, 77, 63)
  doc.rect(0, 0, 210, 28, "F")
  doc.setTextColor(244, 241, 231)
  doc.setFontSize(16)
  doc.text("Prestação de Contas — GRE", 14, 12)
  doc.setFontSize(10)
  doc.text(`Período: ${dataBR(inicio)} a ${dataBR(fim)}`, 14, 20)

  doc.setTextColor(30, 30, 30)
  let y = 36

  if (mostrarPreco) {
    doc.setFontSize(12)
    doc.text("Resumo por categoria", 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [["Categoria", "Total"]],
      body: (dados.resumo_financeiro?.por_categoria ?? []).map((c) => [
        c.categoria_nome,
        brl(c.total),
      ]),
      foot: [["Total geral", brl(dados.resumo_financeiro?.total_geral ?? 0)]],
      theme: "grid",
      headStyles: { fillColor: [33, 77, 63] },
      footStyles: { fillColor: [231, 239, 232], textColor: [33, 77, 63], fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    })

    y = doc.lastAutoTable.finalY + 10
  }

  for (const f of dados.fornecedores ?? []) {
    if (y > 250) {
      doc.addPage()
      y = 20
    }
    doc.setFontSize(11)
    doc.setTextColor(33, 77, 63)
    doc.text(`${f.fornecedor_nome}${f.documento ? ` — ${f.documento}` : ""}`, 14, y)
    y += 2
    if (mostrarPreco) {
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(`Subtotal fornecedor: ${brl(f.total_fornecedor)}`, 14, y + 4)
      y += 8
    } else {
      y += 2
    }

    for (const d of f.documentos ?? []) {
      const rows = (d.itens ?? []).map((it) => {
        const base = [
          d.numero_nota_fiscal || "—",
          dataBR(d.data),
          it.produto_nome,
          it.quantidade,
        ]
        if (mostrarPreco) {
          return [...base, it.preco_unitario ? brl(it.preco_unitario) : "—", brl(it.subtotal)]
        }
        return base
      })
      autoTable(doc, {
        startY: y,
        head: [mostrarPreco
          ? ["NF", "Data", "Produto", "Qtd", "Preço", "Subtotal"]
          : ["NF", "Data", "Produto", "Qtd"]],
        body: rows,
        foot: mostrarPreco
          ? [["Total do documento", "", "", "", "", brl(d.total)]]
          : undefined,
        theme: "striped",
        headStyles: { fillColor: [47, 122, 91] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 },
      })
      y = doc.lastAutoTable.finalY + 6
    }
    y += 4
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} — EasyStock — Página ${i}/${pageCount}`,
      14,
      290,
    )
  }

  doc.save(`prestacao-contas-${titulo.replace(/\//g, "-")}.pdf`)
}
