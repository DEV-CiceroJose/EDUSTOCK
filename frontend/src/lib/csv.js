// Gera e baixa um CSV (separador ';' para abrir no Excel pt-BR). BOM p/ acentos.
export function baixarCSV(nomeArquivo, colunas, linhas) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const head = colunas.map((c) => esc(c.label)).join(";")
  const corpo = linhas.map((l) => colunas.map((c) => esc(l[c.key])).join(";")).join("\r\n")
  const conteudo = "﻿" + head + "\r\n" + corpo
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
