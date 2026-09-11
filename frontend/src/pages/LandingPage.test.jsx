import { beforeEach, describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import LandingPage from "./LandingPage"

describe("LandingPage", () => {
  beforeEach(() => sessionStorage.clear())

  it("é pública e direciona visitantes para o login", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    expect(screen.getByRole("heading", { name: /Mais alimento na mesa/i })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Acessar sistema" })[0]).toHaveAttribute("href", "/login")
  })

  it("direciona uma sessão ativa para o painel", () => {
    sessionStorage.setItem("edustock:auth:token", "token-valido")
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    expect(screen.getAllByRole("link", { name: "Abrir painel" })[0]).toHaveAttribute("href", "/dashboard")
  })

  it("oferece contato direto com a EduStock pelo WhatsApp", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    expect(screen.getByRole("link", { name: "Fale conosco" })).toHaveAttribute("href", "#contato")
    const titulo = screen.getByRole("heading", { name: "Vamos transformar a rotina da sua escola?" })
    const contato = titulo.closest("section")
    const whatsapp = within(contato).getByRole("link", { name: "Conversar no WhatsApp" })

    expect(whatsapp).toHaveAttribute(
      "href",
      "https://wa.me/5581991816899?text=Ol%C3%A1%21%20Gostaria%20de%20conhecer%20melhor%20a%20EduStock.",
    )
    expect(whatsapp).toHaveAttribute("target", "_blank")
    expect(whatsapp).toHaveAttribute("rel", "noreferrer")
  })

  it("identifica os números da prévia como dados demonstrativos", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    const preview = screen.getByRole("region", { name: "Prévia demonstrativa do painel EduStock" })
    expect(within(preview).getByText("Exemplo demonstrativo")).toBeVisible()
  })
})
