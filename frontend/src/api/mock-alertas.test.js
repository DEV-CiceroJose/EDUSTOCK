import { beforeEach, describe, expect, it } from "vitest"
import { coletarAlertasMock } from "./mock"
import { setConfig } from "../lib/config"

const produto = {
  id: 1,
  nome: "Arroz",
  grupo_nome: "Geral",
  fornecedor_nome: null,
  quantidade: 10,
  estoque_minimo: 0,
  unidade: "KG",
}

function dataEmDias(dias) {
  const data = new Date()
  data.setHours(0, 0, 0, 0)
  data.setDate(data.getDate() + dias)
  return data.toISOString().slice(0, 10)
}

describe("alertas mock configuráveis", () => {
  beforeEach(() => localStorage.clear())

  it("usa o prazo salvo nas configurações", () => {
    setConfig({ validityAlertDays: 60 })
    const resultado = coletarAlertasMock([
      { ...produto, validade: dataEmDias(45) },
    ])
    expect(resultado.validade.map((item) => item.nome)).toEqual(["Arroz"])
  })

  it("mantém fora produtos além do prazo configurado", () => {
    setConfig({ validityAlertDays: 30 })
    const resultado = coletarAlertasMock([
      { ...produto, validade: dataEmDias(45) },
    ])
    expect(resultado.validade).toEqual([])
  })
  it("prioriza o prazo recebido pela API mock", () => {
    setConfig({ validityAlertDays: 30 })
    const resultado = coletarAlertasMock(
      [{ ...produto, validade: dataEmDias(45) }],
      { dias_validade: 60 },
    )
    expect(resultado.validade).toHaveLength(1)
  })
})
