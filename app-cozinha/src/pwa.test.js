import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const raiz = process.cwd()
const ler = (arquivo) => readFileSync(resolve(raiz, arquivo), "utf8")

describe("PWA do App Cozinha", () => {
  it("possui manifesto instalável ligado ao HTML", () => {
    const manifest = JSON.parse(ler("public/manifest.webmanifest"))
    const html = ler("index.html")

    expect(manifest.name).toBe("EasyStock Cozinha")
    expect(manifest.start_url).toBe("/login")
    expect(manifest.display).toBe("standalone")
    expect(manifest.icons.map((icone) => icone.sizes)).toEqual(["192x192", "512x512"])
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
  })

  it("não armazena chamadas da API no service worker", () => {
    const serviceWorker = ler("public/service-worker.js")

    expect(serviceWorker).toContain("url.pathname.startsWith('/api/')")
    expect(serviceWorker).toContain("request.method !== 'GET'")
  })
})
