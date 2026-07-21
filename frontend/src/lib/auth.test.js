import { describe, it, expect, beforeEach } from "vitest"
import {
  salvarSessao, limparSessao, getToken, getPapel,
  getModulosAtivos, estaAutenticado, ehAdmin,
  getUsername, getNome, atualizarNome,
} from "./auth"

describe("auth", () => {
  beforeEach(() => sessionStorage.clear())

  it("salva e recupera a sessão", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", is_staff: true, modulos_ativos: ["inventario", "merenda"] })
    expect(getToken()).toBe("abc-123")
    expect(getPapel()).toBe("ADMIN")
    expect(getModulosAtivos()).toEqual(["inventario", "merenda"])
    expect(estaAutenticado()).toBe(true)
    expect(ehAdmin()).toBe(true)
  })

  it("ehAdmin depende de is_staff, não do papel da aplicação", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", is_staff: false, modulos_ativos: [] })
    expect(ehAdmin()).toBe(false)
  })

  it("limparSessao remove tudo", () => {
    salvarSessao({ token: "abc-123", papel: "OPERADOR", is_staff: false, modulos_ativos: [] })
    limparSessao()
    expect(getToken()).toBeNull()
    expect(estaAutenticado()).toBe(false)
    expect(ehAdmin()).toBe(false)
  })

  it("getModulosAtivos retorna array vazio sem sessão", () => {
    expect(getModulosAtivos()).toEqual([])
  })

  it("salva e recupera username e nome", () => {
    salvarSessao({ token: "abc-123", papel: "OPERADOR", is_staff: false, username: "joao", nome: "João Silva", modulos_ativos: [] })
    expect(getUsername()).toBe("joao")
    expect(getNome()).toBe("João Silva")
  })

  it("atualizarNome troca só o nome, sem afetar o resto da sessão", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", is_staff: true, username: "joao", nome: "João", modulos_ativos: ["inventario"] })
    atualizarNome("João Pereira")
    expect(getNome()).toBe("João Pereira")
    expect(getUsername()).toBe("joao")
    expect(getToken()).toBe("abc-123")
    expect(ehAdmin()).toBe(true)
  })
})
