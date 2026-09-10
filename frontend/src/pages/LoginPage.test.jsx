import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import LoginPage from "./LoginPage"

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<p>Painel operacional carregado</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe("LoginPage", () => {
  it("permite mostrar e ocultar a senha", () => {
    renderLogin()
    const senha = screen.getByLabelText("Senha")

    expect(senha).toHaveAttribute("type", "password")
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }))
    expect(senha).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }))
    expect(senha).toHaveAttribute("type", "password")
  })

  it("mostra a mensagem devolvida quando o acesso está temporariamente bloqueado", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ detail: "Muitas tentativas. Aguarde antes de tentar novamente." }),
    })
    renderLogin()

    await user.type(screen.getByLabelText("Usuário"), "operador.teste")
    await user.type(screen.getByLabelText("Senha"), "Operador@123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Muitas tentativas. Aguarde antes de tentar novamente.")).toBeInTheDocument()
  })

  it("não apresenta falha do servidor como senha inválida", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error("Resposta sem JSON") },
    })
    renderLogin()

    await user.type(screen.getByLabelText("Usuário"), "operador.teste")
    await user.type(screen.getByLabelText("Senha"), "Operador@123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("O servidor encontrou um erro. Aguarde um instante e tente novamente.")).toBeInTheDocument()
  })

  it("abre o painel operacional após autenticar", async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "token-valido",
        papel: "OPERADOR",
        is_staff: false,
        username: "operador.teste",
        nome: "Operador Teste",
        modulos_ativos: ["inventario"],
      }),
    })
    renderLogin()

    await user.type(screen.getByLabelText("Usuário"), "operador.teste")
    await user.type(screen.getByLabelText("Senha"), "Operador@123")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Painel operacional carregado")).toBeInTheDocument()
  })
})
