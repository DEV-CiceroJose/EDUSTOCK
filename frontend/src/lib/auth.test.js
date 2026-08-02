import { describe, it, expect, beforeEach } from "vitest"
import {
  salvarSessao, limparSessao, getToken, getPapel,
  getModulosAtivos, estaAutenticado, ehAdmin, podeGerenciarCadastros,
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

  it("papel ADMIN libera as áreas administrativas mesmo sem is_staff", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", is_staff: false, modulos_ativos: [] })
    expect(ehAdmin()).toBe(true)
    expect(podeGerenciarCadastros()).toBe(true)
  })

  it("operador comum não pode gerenciar cadastros", () => {
    salvarSessao({ token: "abc-123", papel: "OPERADOR", is_staff: false, modulos_ativos: [] })
    expect(ehAdmin()).toBe(false)
    expect(podeGerenciarCadastros()).toBe(false)
  })

  it("operador staff gerencia estoque sem acessar áreas de sistema", () => {
    salvarSessao({ token: "abc-123", papel: "OPERADOR", is_staff: true, modulos_ativos: [] })
    expect(ehAdmin()).toBe(false)
    expect(podeGerenciarCadastros()).toBe(true)
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
