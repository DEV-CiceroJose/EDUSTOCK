import { describe, it, expect } from "vitest"
import { stockStatus, stockPercent } from "./format"

describe("stockStatus por estoque_minimo", () => {
  it("esgotado quando quantidade <= 0", () => {
    expect(stockStatus(0, 10).code).toBe("out")
  })
  it("baixo quando quantidade <= estoque_minimo", () => {
    expect(stockStatus(8, 10).code).toBe("low")
    expect(stockStatus(10, 10).code).toBe("low")
  })
  it("em estoque quando acima do minimo", () => {
    expect(stockStatus(11, 10).code).toBe("ok")
  })
  it("sem minimo definido: so esgota em 0", () => {
    expect(stockStatus(1, 0).code).toBe("ok")
  })
})

describe("stockPercent", () => {
  it("usa 2x o minimo como teto", () => {
    expect(stockPercent(10, 10)).toBe(50)
    expect(stockPercent(20, 10)).toBe(100)
  })
})
