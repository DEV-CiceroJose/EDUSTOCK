import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AdminUsuariosPage from "./AdminUsuariosPage"
import { salvarSessao } from "../lib/auth"
import { ToastProvider } from "../components/ui/Toast"

describe("AdminUsuariosPage", () => {
  beforeEach(() => {
    sessionStorage.clear()
    salvarSessao({ token: "abc", papel: "ADMIN", is_staff: true, modulos_ativos: [] })
  })
  afterEach(() => vi.restoreAllMocks())

  it("informa falha de rede ao carregar e permite tentar novamente", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR" }]) })
    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await screen.findByRole("alert")
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }))
    expect(await screen.findByText("maria")).toBeInTheDocument()
  })

  it("lista usuários e permite trocar o papel", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR" }]),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await waitFor(() => expect(screen.getByText("maria")).toBeInTheDocument())
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ADMIN" } })
    await waitFor(() => expect(screen.getByRole("combobox").value).toBe("ADMIN"))
  })

  it("reverte o select e mostra toast quando a troca de papel falha", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR" }]),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await waitFor(() => expect(screen.getByText("maria")).toBeInTheDocument())
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ADMIN" } })
    await waitFor(() => expect(screen.getByRole("combobox").value).toBe("OPERADOR"))
  })

  it("mostra mensagem para quem não é admin", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", is_staff: false, modulos_ativos: [] })
    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    expect(screen.getByText(/apenas administradores/i)).toBeInTheDocument()
  })

  it("adiciona o usuário criado à lista ao concluir o modal", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 2, username: "joao", papel: "OPERADOR" }) })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await waitFor(() => expect(screen.getByRole("button", { name: /novo usuário/i })).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /novo usuário/i }))
    await user.type(screen.getByLabelText(/^usuário$/i), "joao")
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    await user.click(screen.getByRole("button", { name: /^criar usuário$/i }))
    await waitFor(() => expect(screen.getByText("joao")).toBeInTheDocument())
  })
})
