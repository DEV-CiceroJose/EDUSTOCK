import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import AdminModulosPage from "./AdminModulosPage"
import { salvarSessao } from "../lib/auth"
import { ToastProvider } from "../components/ui/Toast"

describe("AdminModulosPage", () => {
  beforeEach(() => {
    sessionStorage.clear()
    salvarSessao({ token: "abc", papel: "ADMIN", modulos_ativos: ["inventario"] })
  })
  afterEach(() => vi.restoreAllMocks())

  it("lista módulos e permite togglear", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ slug: "inventario", nome: "Inventário", descricao: "", ativo: true }]),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ slug: "inventario", nome: "Inventário", descricao: "", ativo: false }]),
      })

    render(<ToastProvider><AdminModulosPage /></ToastProvider>)
    await waitFor(() => expect(screen.getByText("Inventário")).toBeInTheDocument())
    fireEvent.click(screen.getByText("Ativo"))
    await waitFor(() => expect(screen.getByText("Inativo")).toBeInTheDocument())
  })

  it("mostra mensagem para quem não é admin", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: ["inventario"] })
    render(<ToastProvider><AdminModulosPage /></ToastProvider>)
    expect(screen.getByText(/apenas administradores/i)).toBeInTheDocument()
  })
})
