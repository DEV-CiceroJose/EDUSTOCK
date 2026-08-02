import { beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { salvarSessao } from "../lib/auth"
import RequireAdmin from "./RequireAdmin"

function renderRotas() {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<p>Área administrativa</p>} />
        </Route>
        <Route path="/inventario" element={<p>Inventário</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("RequireAdmin", () => {
  beforeEach(() => sessionStorage.clear())

  it("redireciona operador staff para o inventário", () => {
    salvarSessao({
      token: "token",
      papel: "OPERADOR",
      is_staff: true,
      modulos_ativos: ["inventario"],
    })

    renderRotas()

    expect(screen.getByText("Inventário")).toBeInTheDocument()
    expect(screen.queryByText("Área administrativa")).not.toBeInTheDocument()
  })

  it("permite acesso ao papel ADMIN mesmo sem is_staff", () => {
    salvarSessao({
      token: "token",
      papel: "ADMIN",
      is_staff: false,
      modulos_ativos: ["inventario"],
    })

    renderRotas()

    expect(screen.getByText("Área administrativa")).toBeInTheDocument()
  })
})
