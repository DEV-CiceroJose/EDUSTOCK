import { describe, it, expect, vi } from "vitest"
import { prestacaoContasToCsv } from "./export"
import * as auth from "./auth"

const DADOS = {
  fornecedores: [{
    fornecedor_nome: "Mercadinho do Zé", documento: "",
    documentos: [{
      numero_nota_fiscal: "NF-001", data: "2026-07-10",
      itens: [{ produto_nome: "Arroz", quantidade: "10", preco_unitario: "10.00", subtotal: "100.00" }],
    }],
  }],
  resumo_financeiro: { por_categoria: [{ categoria_nome: "Alimentos", total: "100.00" }] },
}

describe("prestacaoContasToCsv — colunas de preço", () => {
  it("omite cabeçalho e valores de preço quando mostrarPreco é false", () => {
    vi.spyOn(auth, "getModulosAtivos").mockReturnValue([])
    const csv = prestacaoContasToCsv(DADOS)
    expect(csv).not.toContain("Preço Unit.")
    expect(csv).not.toContain("10.00")
  })

  it("inclui cabeçalho e valores de preço quando mostrarPreco é true", () => {
    vi.spyOn(auth, "getModulosAtivos").mockReturnValue(["financeiro"])
    const csv = prestacaoContasToCsv(DADOS)
    expect(csv).toContain("Preço Unit.")
    expect(csv).toContain("10.00")
  })
})
