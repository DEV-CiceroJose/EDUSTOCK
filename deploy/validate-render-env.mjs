import { pathToFileURL } from "node:url"

const configs = {
  dashboard: { key: "VITE_API_URL", apiPath: "/api" },
  pwa: { key: "VITE_API_BASE", apiPath: "" },
}

export function validateRenderEnv(kind, env = process.env) {
  const config = configs[kind]
  if (!config) throw new Error(`Tipo de frontend desconhecido: ${kind}`)

  const raw = env[config.key]?.trim()
  if (!raw) throw new Error(`${config.key} precisa ser configurada na Render.`)

  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`${config.key} precisa ser uma URL válida.`)
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${config.key} aceita somente HTTPS em produção.`)
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${config.key} não pode conter credenciais, query ou fragmento.`)
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "")
  if (
    hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname.endsWith(".localhost")
    || hostname === "example.com"
    || hostname.endsWith(".example.com")
  ) {
    throw new Error(`${config.key} precisa apontar para a API pública real.`)
  }

  const pathname = parsed.pathname.replace(/\/$/, "")
  if (config.apiPath && pathname !== config.apiPath) {
    throw new Error(`${config.key} precisa terminar em ${config.apiPath}.`)
  }
  if (!config.apiPath && pathname) {
    throw new Error(`${config.key} deve conter somente a origem, sem caminho.`)
  }

  return parsed.toString().replace(/\/$/, "")
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const validated = validateRenderEnv(process.argv[2])
    console.log(`Configuração de API validada: ${validated}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
