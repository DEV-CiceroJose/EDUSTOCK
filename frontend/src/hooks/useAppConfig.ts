import { useEffect, useState } from "react"
import { CONFIG_CHANGED_EVENT, getConfig } from "../lib/config"

export interface AppConfig {
  useMock: boolean
  validityAlertDays: number
  cardDensity: "confortavel" | "compacto" | "denso"
}

export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(() => getConfig() as AppConfig)

  useEffect(() => {
    const atualizar = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : undefined
      setConfig((detail ?? getConfig()) as AppConfig)
    }
    window.addEventListener(CONFIG_CHANGED_EVENT, atualizar)
    window.addEventListener("storage", atualizar)
    return () => {
      window.removeEventListener(CONFIG_CHANGED_EVENT, atualizar)
      window.removeEventListener("storage", atualizar)
    }
  }, [])

  return config
}
