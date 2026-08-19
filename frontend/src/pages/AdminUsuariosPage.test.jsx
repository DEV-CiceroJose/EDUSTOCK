import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AdminUsuariosPage from "./AdminUsuariosPage"
import { salvarSessao } from "../lib/auth"
import { ToastProvider } from "../components/ui/Toast"

describe("AdminUsuariosPage", () => {
  beforeEach(() => {
    sessionStorage.clear()
    salvarSessao({ token: "abc", papel: "ADMIN", is_staff: true, modulos_ativos: [] })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
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
    await user.click(screen.getByLabelText("inventario"))
    await user.click(screen.getByRole("button", { name: /^criar usuário$/i }))
    await waitFor(() => expect(screen.getByText("joao")).toBeInTheDocument())
  })

  it("desativa somente após a confirmação HTTP", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    let concluir
    const pendente = new Promise((resolve) => { concluir = resolve })
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR", is_active: true }]) })
      .mockReturnValueOnce(pendente)

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await user.click(await screen.findByRole("button", { name: /desativar maria/i }))

    expect(screen.getByRole("button", { name: /desativar maria/i })).toBeInTheDocument()
    concluir({ ok: true })
    await waitFor(() => expect(screen.getByRole("button", { name: /ativar maria/i })).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /ativar maria/i })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/usuarios\/1\/$/),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_active: false }) }),
    )
  })

  it("reativa de forma otimista e envia o estado ativo", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR", is_active: false }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await user.click(await screen.findByRole("button", { name: /ativar maria/i }))

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/usuarios\/1\/$/),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_active: true }) }),
    )
  })

  it("redefine a senha pelo modal e aguarda a confirmacao HTTP", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR", is_active: true }]) })
      .mockResolvedValueOnce({ ok: true })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await user.click(await screen.findByRole("button", { name: /redefinir senha de maria/i }))
    await user.type(screen.getByLabelText(/^nova senha$/i), "Nova-Senha-123")
    await user.type(screen.getByLabelText(/confirmar nova senha/i), "Nova-Senha-123")
    await user.click(screen.getByRole("button", { name: /confirmar redefiniç[aã]o/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/usuarios\/1\/senha\/$/),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "Nova-Senha-123" }) }),
    ))
  })

  it("revoga sessoes somente apos confirmacao", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 1, username: "maria", papel: "OPERADOR", is_active: true }]) })
      .mockResolvedValueOnce({ ok: true })

    render(<ToastProvider><AdminUsuariosPage /></ToastProvider>)
    await user.click(await screen.findByRole("button", { name: /revogar sess[õo]es de maria/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/usuarios\/1\/revogar-sessoes\/$/),
      expect.objectContaining({ method: "POST" }),
    ))
  })
})
