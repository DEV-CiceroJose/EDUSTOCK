import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ResetPasswordModal from "./ResetPasswordModal"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ResetPasswordModal", () => {
  it("nao renderiza quando fechado", () => {
    render(<ResetPasswordModal open={false} usuario={{ id: 1, username: "maria" }} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.queryByText(/redefinir senha/i)).not.toBeInTheDocument()
  })

  it("exige confirmacao igual antes de enviar a senha", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    global.fetch = fetchMock
    render(<ResetPasswordModal open usuario={{ id: 1, username: "maria" }} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await user.type(screen.getByLabelText(/^nova senha$/i), "Nova-Senha-123")
    await user.type(screen.getByLabelText(/confirmar nova senha/i), "diferente")
    await user.click(screen.getByRole("button", { name: /confirmar redefiniç[aã]o/i }))

    expect(screen.getByText(/senhas n[aã]o coincidem/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("envia a senha e fecha somente apos resposta HTTP", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    render(<ResetPasswordModal open usuario={{ id: 7, username: "maria" }} onClose={onClose} onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText(/^nova senha$/i), "Nova-Senha-123")
    await user.type(screen.getByLabelText(/confirmar nova senha/i), "Nova-Senha-123")
    await user.click(screen.getByRole("button", { name: /confirmar redefiniç[aã]o/i }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/usuarios\/7\/senha\/$/),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "Nova-Senha-123" }) }),
    ))
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("mostra a mensagem especifica da API sem fechar", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ password: ["A senha e muito comum."] }),
    })
    render(<ResetPasswordModal open usuario={{ id: 7, username: "maria" }} onClose={onClose} onSuccess={vi.fn()} />)
    await user.type(screen.getByLabelText(/^nova senha$/i), "Nova-Senha-123")
    await user.type(screen.getByLabelText(/confirmar nova senha/i), "Nova-Senha-123")
    await user.click(screen.getByRole("button", { name: /confirmar redefiniç[aã]o/i }))

    expect(await screen.findByText("A senha e muito comum.")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
