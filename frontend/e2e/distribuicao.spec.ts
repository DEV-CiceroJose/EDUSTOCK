import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`gestão: relatório e exportação em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.addInitScript(() => {
      sessionStorage.setItem('edustock:auth:token', 'teste-distribuicao')
      sessionStorage.setItem('edustock:auth:papel', 'ADMIN')
      sessionStorage.setItem('edustock:auth:papel_rede', 'GESTOR_ESCOLA')
      sessionStorage.setItem('edustock:auth:modulos', JSON.stringify(['inventario']))
      sessionStorage.setItem('edustock:auth:escola', JSON.stringify({ id: 1, nome: 'Escola de teste' }))
    })
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('exportar') === 'csv') return route.fulfill({ contentType: 'text/csv', body: 'Nome;Situação\nAna;Pendente' })
      let body: unknown = {}
      if (url.pathname.endsWith('/alunos/')) body = { alunos: [], total_ativos: 2, por_turma: [{ turma_id: 1, turma__nome: '1 A', total: 2 }], turmas: [{ id: 1, nome: '1 A' }], produtos: [] }
      if (url.pathname.endsWith('/rodadas/')) body = [{ id: 1, titulo: 'Kit setembro', tipo: 'KIT_ESCOLAR', estado: 'LIBERADA', total: 2, entregues: 1, itens: [] }]
      if (url.pathname.endsWith('/relatorio/')) body = { escola: 'Escola de teste', total: 2, entregues: 1, pendentes: 1, percentual: 50, resultados: [{ id: 1, aluno_id: 3, nome: 'Ana', turma_nome: '1 A', serie: '1', rodada_titulo: 'Kit setembro', tipo: 'KIT_ESCOLAR', entregue_em: null }] }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.goto('http://127.0.0.1:4173/distribuicao')
    await expect(page.getByText('2 alunos ativos na escola')).toBeVisible()
    await page.getByRole('navigation', { name: 'Seções de distribuição' }).getByRole('button', { name: 'Relatório', exact: true }).click()
    await page.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('PENDENTE')
    await page.getByRole('button', { name: 'Gerar relatório' }).click()
    await expect(page.getByRole('cell', { name: 'Ana · #3' })).toBeVisible()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar CSV' }).click()
    expect((await download).suggestedFilename()).toBe('relatorio-entregas.csv')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/entregas-gestao-${width}.png`, fullPage: true })
  })

  test(`protagonista: confirmar sem duplicar em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.addInitScript(() => {
      sessionStorage.setItem('operacao_token', 'pin-teste')
      sessionStorage.setItem('operacao_sessao', JSON.stringify({ turma: '1 A', turno: 'INTEGRAL', perfil: 'ALUNO_REP', escola: { id: 1, nome: 'Escola de teste' } }))
    })
    let entregas = 0
    const aluno = { id: 1, aluno_id: 3, nome: 'Ana', turma_nome: '1 A', serie: '1', rodada_id: 1, rodada_titulo: 'Kit setembro', entregue_em: null as string | null }
    await page.route('**/api/distribuicao/operacao/', async route => {
      if (route.request().method() === 'POST') {
        entregas++
        aluno.entregue_em = '2026-09-06T12:00:00Z'
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(aluno) })
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ rodadas: [{ id: 1, titulo: 'Kit setembro', itens: [{ produto: 1, produto_nome: 'Caderno', quantidade: '1', unidade: 'UN' }] }], alunos: [aluno] }) })
    })
    await page.goto('http://127.0.0.1:4174/entregas')
    await page.getByRole('button', { name: 'Registrar entrega' }).click()
    await expect(page.getByRole('dialog')).toContainText('Ana · #3')
    await page.getByRole('button', { name: 'Confirmar recebimento' }).click()
    await expect(page.getByRole('status')).toContainText('Entrega registrada para Ana')
    await expect(page.getByRole('button', { name: 'Registrar entrega' })).toHaveCount(0)
    expect(entregas).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/entregas-protagonista-${width}.png`, fullPage: true })
  })
}
