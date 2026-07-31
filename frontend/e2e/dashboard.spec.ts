import { expect, test, type Page, type Route } from "@playwright/test"

const MODULOS = [
  "inventario",
  "movimentacoes",
  "fornecedores",
  "alertas",
  "relatorios",
  "merenda",
  "financeiro",
]

const produto = {
  id: 1,
  nome: "Arroz",
  grupo: 1,
  grupo_nome: "Grãos",
  categoria: 1,
  categoria_nome: "Alimentos",
  fornecedor: 1,
  fornecedor_nome: "Fornecedor Escola",
  quantidade: "10.000",
  unidade: "KG",
  estoque_minimo: "2.000",
  perecivel: false,
  periodicidade: "MENSAL",
  validade: null,
  ultimo_preco: "5.00",
}

type Capturas = {
  produto?: Record<string, unknown>
  movimento?: Record<string, unknown>
  entrada?: Record<string, unknown>
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

async function prepararApi(page: Page, capturas: Capturas = {}) {
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()

    if (path.endsWith("/auth/login/") && method === "POST") {
      return json(route, {
        token: "token-e2e",
        papel: "ADMIN",
        is_staff: true,
        username: "gestor",
        nome: "Gestor Escolar",
        modulos_ativos: MODULOS,
      })
    }
    if (path.endsWith("/categorias/")) return json(route, [{ id: 1, name: "Alimentos" }])
    if (path.endsWith("/grupos/")) {
      return json(route, [{ id: 1, nome: "Grãos", categoria: 1, categoria_nome: "Alimentos" }])
    }
    if (path.endsWith("/fornecedores/")) {
      return json(route, [{ id: 1, nome: "Fornecedor Escola", ativo: true }])
    }
    if (path.endsWith("/alertas/")) {
      return json(route, { resumo: {}, validade: [], estoque_critico: [] })
    }
    if (path.endsWith("/produtos/") && method === "POST") {
      capturas.produto = request.postDataJSON()
      return json(route, { ...produto, id: 2, ...capturas.produto }, 201)
    }
    if (path.endsWith("/produtos/")) return json(route, [produto])
    if (path.endsWith("/movimentacoes/") && method === "POST") {
      capturas.movimento = request.postDataJSON()
      return json(route, { id: 2, produto_nome: "Novo produto", ...capturas.movimento }, 201)
    }
    if (path.endsWith("/movimentacoes/")) return json(route, [])
    if (path.endsWith("/entradas/") && method === "POST") {
      capturas.entrada = request.postDataJSON()
      return json(route, { id: 10, ...capturas.entrada }, 201)
    }
    if (path.endsWith("/entradas/")) return json(route, [])
    return json(route, {})
  })
}

async function entrar(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "Acessar sistema" }).first().click()
  await page.getByLabel("Usuário").fill("gestor")
  await page.getByLabel("Senha").fill("segredo")
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page).toHaveURL(/\/inventario$/)
  await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible()
}

test("landing pública e login do gestor", async ({ page }) => {
  await prepararApi(page)
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /Mais alimento na mesa/i })).toBeVisible()
  await expect(page.getByText("Estoque sob controle")).toBeVisible()

  await entrar(page)
})

test("cria produto e registra o saldo inicial", async ({ page }) => {
  const capturas: Capturas = {}
  await prepararApi(page, capturas)
  await entrar(page)

  await page.getByRole("button", { name: "Adicionar", exact: true }).click()
  await page.getByLabel("Nome do item").fill("Macarrão")
  await page.getByRole("dialog").getByRole("combobox").first().selectOption("1")
  await page.getByLabel("Quantidade inicial").fill("12")
  await page.getByRole("button", { name: "Cadastrar item" }).click()

  await expect(page.getByText("Item cadastrado")).toBeVisible()
  expect(capturas.produto?.nome).toBe("Macarrão")
  expect(capturas.movimento).toMatchObject({
    produto: 2,
    tipo: "ENTRADA",
    quantidade: 12,
  })
})

test("registra uma entrada de estoque com nota fiscal", async ({ page }) => {
  const capturas: Capturas = {}
  await prepararApi(page, capturas)
  await entrar(page)

  await page.getByTitle("Movimentações").click()
  await expect(page.getByRole("heading", { name: "Movimentações" })).toBeVisible()
  await page.getByRole("button", { name: "Nova entrada" }).click()
  await page.getByLabel("Fornecedor").selectOption("1")
  await page.getByLabel("Nota Fiscal").fill("NF-E2E-01")
  await page.locator("select").filter({ has: page.locator('option[value="1"]') }).last().selectOption("1")
  await page.getByPlaceholder("Qtd").fill("4")
  await page.getByPlaceholder("R$").fill("5.50")
  await page.getByRole("button", { name: "Registrar entrada" }).click()

  await expect(page.getByText("Entrada registrada")).toBeVisible()
  expect(capturas.entrada).toMatchObject({
    fornecedor: 1,
    numero_nota_fiscal: "NF-E2E-01",
    itens: [{ produto: 1, quantidade: 4, preco_unitario: 5.5 }],
  })
})

test("landing mantém a ação principal disponível no celular", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/")

  await expect(page.getByRole("heading", { name: /Mais alimento na mesa/i })).toBeVisible()
  await expect(page.getByRole("link", { name: "Acessar sistema" }).first()).toBeVisible()
})
