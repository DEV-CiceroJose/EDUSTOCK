import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import NewUserModal from "./NewUserModal"

afterEach(cleanup)

describe("NewUserModal", () => {
  it("não renderiza nada quando open é false", () => {
    render(<NewUserModal open={false} onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.queryByText("Novo usuário")).not.toBeInTheDocument()
  })

  it("botão Criar usuário começa desabilitado e só habilita com usuário e senha preenchidos", async () => {
    const user = userEvent.setup()
    render(<NewUserModal open onClose={vi.fn()} onCreated={vi.fn()} />)
    const botao = screen.getByRole("button", { name: /criar usuário/i })
    expect(botao).toBeDisabled()
    await user.type(screen.getByLabelText(/^usuário$/i), "maria")
    expect(botao).toBeDisabled()
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    expect(botao).toBeEnabled()
  })

  it("cria o usuário e chama onCreated com os dados retornados pela API", async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onClose = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 7, username: "maria", papel: "OPERADOR" }),
    })
    render(<NewUserModal open onClose={onClose} onCreated={onCreated} />)
    await user.type(screen.getByLabelText(/^usuário$/i), "maria")
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    await user.click(screen.getByRole("button", { name: /criar usuário/i }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 7, username: "maria", papel: "OPERADOR" }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("mostra o erro da API e mantém o modal aberto quando a criação falha", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ username: ["user with this username already exists."] }),
    })
    render(<NewUserModal open onClose={onClose} onCreated={vi.fn()} />)
    await user.type(screen.getByLabelText(/^usuário$/i), "maria")
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    await user.click(screen.getByRole("button", { name: /criar usuário/i }))
    await waitFor(() => expect(screen.getByText("user with this username already exists.")).toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
  })

  it("mostra erro genérico e mantém o modal aberto quando a chamada de rede falha", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"))
    render(<NewUserModal open onClose={onClose} onCreated={vi.fn()} />)
    await user.type(screen.getByLabelText(/^usuário$/i), "maria")
    await user.type(screen.getByLabelText(/senha/i), "senha-boa-123")
    await user.click(screen.getByRole("button", { name: /criar usuário/i }))
    await waitFor(() => expect(screen.getByText("Falha na conexão. Tente novamente.")).toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
  })
})
