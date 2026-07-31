import { beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
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

    expect(screen.getAllByRole("link", { name: "Abrir painel" })[0]).toHaveAttribute("href", "/inventario")
  })
})
