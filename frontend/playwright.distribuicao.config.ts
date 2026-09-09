import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: /distribuicao\.spec\.ts/, workers: 1,
  timeout: 60000, expect: { timeout: 15000 },
  use: { headless: true },
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 120000 },
    { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174', cwd: '../app-alunos', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI, timeout: 120000 },
  ],
})
