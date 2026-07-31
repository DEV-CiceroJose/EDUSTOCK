import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import MainLayout from "./MainLayout"
import { salvarSessao } from "../lib/auth"
import { setConfig } from "../lib/config"

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/inventario"]}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/inventario" element={<div>Conteúdo</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("MainLayout", () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    salvarSessao({
      token: "abc",
      papel: "OPERADOR",
      is_staff: false,
      modulos_ativos: ["inventario"],
    })
  })

  it("abre e fecha o menu mobile", () => {
    renderLayout()
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }))
    expect(
      screen.getByRole("complementary", { name: "Navegação principal" })
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(
      screen.queryByRole("complementary", { name: "Navegação principal" })
    ).not.toBeInTheDocument()
  })

  it("aplica alterações de densidade sem recarregar", async () => {
    const { container } = renderLayout()
    setConfig({ cardDensity: "denso" })
    await waitFor(() => {
      expect(container.firstChild).toHaveAttribute("data-card-density", "denso")
    })
  })
})
