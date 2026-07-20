import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RelatoriosView from "./RelatoriosView"
import * as auth from "../../lib/auth"

afterEach(cleanup)

const { DADOS } = vi.hoisted(() => ({
  DADOS: {
    periodo: { inicio: "2026-07-01", fim: "2026-07-18" },
    resumo_financeiro: { total_geral: "100.00", por_categoria: [{ categoria_id: 1, categoria_nome: "Alimentos", total: "100.00" }] },
    fornecedores: [{
      fornecedor_id: 1, fornecedor_nome: "Mercadinho do Zé", documento: "", total_fornecedor: "100.00",
      documentos: [{
        entrada_id: 1, numero_nota_fiscal: "NF-001", data: "2026-07-10", total: "100.00", legado: false,
        itens: [{ produto_nome: "Arroz", quantidade: "10", preco_unitario: "10.00", subtotal: "100.00", numero_nota_fiscal_legado: null }],
      }],
    }],
  },
}))

vi.mock("../../api", () => ({
  relatoriosApi: { prestacaoContas: vi.fn().mockResolvedValue(DADOS) },
}))

describe("RelatoriosView — colunas e resumo financeiro", () => {
  it("não renderiza Resumo financeiro nem colunas de preço quando mostrarPreco é false", async () => {
    vi.spyOn(auth, "getModulosAtivos").mockReturnValue([])
    const user = userEvent.setup()
    render(<RelatoriosView />)
    await user.click(screen.getByText("Gerar relatório"))
    await waitFor(() => expect(screen.getByText("Mercadinho do Zé")).toBeInTheDocument())

    expect(screen.queryByText("Resumo financeiro")).not.toBeInTheDocument()
    expect(screen.queryByText("Preço")).not.toBeInTheDocument()
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument()
  })

  it("renderiza Resumo financeiro e colunas de preço quando mostrarPreco é true", async () => {
    vi.spyOn(auth, "getModulosAtivos").mockReturnValue(["financeiro"])
    const user = userEvent.setup()
    render(<RelatoriosView />)
    await user.click(screen.getByText("Gerar relatório"))
    await waitFor(() => expect(screen.getByText("Mercadinho do Zé")).toBeInTheDocument())

    expect(screen.getByText("Resumo financeiro")).toBeInTheDocument()
    expect(screen.getByText("Preço")).toBeInTheDocument()
    expect(screen.getByText("Subtotal")).toBeInTheDocument()
  })
})
