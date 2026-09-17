import assert from "node:assert/strict"
import { test } from "node:test"

import { validateRenderEnv } from "../validate-render-env.mjs"

test("dashboard exige URL HTTPS terminada em /api", () => {
  assert.throws(() => validateRenderEnv("dashboard", {}), /VITE_API_URL/)
  assert.throws(
    () => validateRenderEnv("dashboard", { VITE_API_URL: "http://api.teste.gov.br/api" }),
    /HTTPS/,
  )
  assert.doesNotThrow(() => validateRenderEnv("dashboard", {
    VITE_API_URL: "https://api.teste.gov.br/api",
  }))
})

test("PWA exige apenas a origem HTTPS da API", () => {
  assert.throws(
    () => validateRenderEnv("pwa", { VITE_API_BASE: "https://api.teste.gov.br/api" }),
    /sem caminho/,
  )
  assert.doesNotThrow(() => validateRenderEnv("pwa", {
    VITE_API_BASE: "https://api.teste.gov.br",
  }))
})

test("rejeita credenciais, query, fragmento e hosts de exemplo", () => {
  for (const value of [
    "https://usuario:senha@api.teste.gov.br/api",
    "https://api.teste.gov.br/api?token=segredo",
    "https://api.teste.gov.br/api#config",
    "https://api.example.com/api",
    "https://localhost/api",
  ]) {
    assert.throws(() => validateRenderEnv("dashboard", { VITE_API_URL: value }))
  }
})
