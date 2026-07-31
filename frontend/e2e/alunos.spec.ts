import { expect, test } from "@playwright/test"

test("representante entra com PIN e registra a presença da turma", async ({ page }) => {
  await page.route("**/api/operacao/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith("/auth/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "token-alunos-e2e",
          turma: "3º DS",
          turno: "MANHA",
          perfil: "ALUNO_REP",
        }),
      })
    }
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        turma: "3º DS",
        turno: "MANHA",
        quantidade_alunos: 25,
        previsao: { total_alunos: 25, media_historica: 24, alerta_reducao: false },
      }),
    })
  })

  await page.goto("/login")
  for (const digito of ["1", "2", "3", "4"]) {
    await page.getByRole("button", { name: digito, exact: true }).click()
  }
  await expect(page).toHaveURL(/\/registrar$/)
  await expect(page.getByText("Turma 3º DS")).toBeVisible()

  await page.getByRole("button", { name: "2", exact: true }).click()
  await page.getByRole("button", { name: "5", exact: true }).click()
  await page.getByRole("button", { name: "Confirmar" }).click()

  await expect(page.getByText("25", { exact: true })).toBeVisible()
  await expect(page.getByText("alunos registrados")).toBeVisible()
})
