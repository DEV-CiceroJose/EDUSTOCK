import { expect, test, type Page } from "@playwright/test"

const plano = {
  data: "2026-08-01",
  turno: "MANHA",
  total_alunos: 40,
  previsao: null,
  itens: [
    {
      produto_id: 1,
      produto_nome: "Arroz",
      categoria_nome: "Alimentos",
      unidade: "KG",
      quantidade: "4.000",
      quantidade_legivel: "4,0 kg",
      saldo_atual: "20.000",
      estoque_insuficiente: false,
    },
    {
      produto_id: 2,
      produto_nome: "Feijão",
      categoria_nome: "Alimentos",
      unidade: "KG",
      quantidade: "2.400",
      quantidade_legivel: "2,4 kg",
      saldo_atual: "1.000",
      estoque_insuficiente: true,
    },
  ],
}

async function informarPin(page: Page) {
  for (const digito of ["4", "3", "2", "1"]) {
    await page.getByRole("button", { name: digito, exact: true }).click()
  }
}

test("cozinha entra, confere a ordem e conclui uma baixa parcial", async ({ page }) => {
  let operacaoId = ""
  await page.route("**/api/operacao/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith("/auth/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "token-cozinha-e2e", perfil: "COZINHA" }),
      })
    }
    if (path.endsWith("/plano-do-dia/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(plano),
      })
    }

    const body = request.postDataJSON()
    operacaoId = body.operacao_id
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        operacao_id: operacaoId,
        status_operacao: "PARCIAL",
        repetida: false,
        sucesso: 1,
        falhas: 1,
        resultados: [
          { ok: true, produto_id: 1, produto_nome: "Arroz", quantidade: "4.000" },
          { ok: false, produto_id: 2, produto_nome: "Feijão", erro: "Saldo insuficiente." },
        ],
      }),
    })
  })

  await page.goto("/login")
  await informarPin(page)
  await expect(page).toHaveURL(/\/producao$/)
  await expect(page.getByText("Arroz")).toBeVisible()

  await page.getByRole("button", { name: "Dar Baixa de Produção" }).click()
  const dialogo = page.getByRole("dialog", { name: "Confirmar baixa de produção" })
  await expect(dialogo).toContainText("Arroz")
  await expect(dialogo).toContainText("Feijão")
  await expect(dialogo).toContainText("A baixa é parcial")
  await dialogo.getByRole("button", { name: "Dar baixa" }).click()

  await expect(page.getByRole("dialog", { name: "Baixa concluída" })).toContainText("1")
  expect(operacaoId).toMatch(/^[0-9a-f-]{36}$/)
})

test("resposta perdida é reconciliada sem repetir a baixa", async ({ page }) => {
  await page.route("**/api/operacao/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith("/auth/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "token-cozinha-e2e", perfil: "COZINHA" }),
      })
    }
    if (path.endsWith("/plano-do-dia/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plano) })
    }
    if (request.method() === "POST") return route.abort("connectionfailed")
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        operacao_id: new URL(request.url()).searchParams.get("operacao_id"),
        status_operacao: "CONCLUIDA",
        repetida: true,
        consultada: true,
        sucesso: 1,
        falhas: 0,
        resultados: [],
      }),
    })
  })

  await page.goto("/login")
  await informarPin(page)
  await page.getByRole("button", { name: "Dar Baixa de Produção" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Dar baixa" }).click()

  await expect(page.getByText("Resultado recuperado sem repetir movimentações.")).toBeVisible()
})

test("sessão expirada ao carregar o plano retorna ao PIN com orientação", async ({ page }) => {
  await page.route("**/api/operacao/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/auth/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "token-expirado-e2e", perfil: "COZINHA" }),
      })
    }
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Token expirado." }),
    })
  })

  await page.goto("/login")
  await informarPin(page)

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("status")).toContainText("Sua sessão expirou")
})
