import { describe, it, expect, beforeEach } from "vitest"
import {
  salvarSessao, limparSessao, getToken, getPapel,
  getModulosAtivos, estaAutenticado, ehAdmin,
} from "./auth"

describe("auth", () => {
  beforeEach(() => sessionStorage.clear())

  it("salva e recupera a sessão", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", modulos_ativos: ["inventario", "merenda"] })
    expect(getToken()).toBe("abc-123")
    expect(getPapel()).toBe("ADMIN")
    expect(getModulosAtivos()).toEqual(["inventario", "merenda"])
    expect(estaAutenticado()).toBe(true)
    expect(ehAdmin()).toBe(true)
  })

  it("limparSessao remove tudo", () => {
    salvarSessao({ token: "abc-123", papel: "OPERADOR", modulos_ativos: [] })
    limparSessao()
    expect(getToken()).toBeNull()
    expect(estaAutenticado()).toBe(false)
    expect(ehAdmin()).toBe(false)
  })

  it("getModulosAtivos retorna array vazio sem sessão", () => {
    expect(getModulosAtivos()).toEqual([])
  })
})
