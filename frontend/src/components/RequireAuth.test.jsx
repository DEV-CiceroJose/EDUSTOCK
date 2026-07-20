import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import RequireAuth from "./RequireAuth"
import { salvarSessao } from "../lib/auth"

function renderComGuarda(rota) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/login" element={<div>Tela de login</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/inventario" element={<div>Página protegida</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("RequireAuth", () => {
  beforeEach(() => sessionStorage.clear())

  it("redireciona para /login sem sessão", () => {
    renderComGuarda("/inventario")
    expect(screen.getByText("Tela de login")).toBeInTheDocument()
  })

  it("renderiza a rota protegida com sessão válida", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: [] })
    renderComGuarda("/inventario")
    expect(screen.getByText("Página protegida")).toBeInTheDocument()
  })
})
