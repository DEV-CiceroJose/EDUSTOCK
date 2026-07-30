import { useEffect, useState } from "react"
import { CONFIG_CHANGED_EVENT, getConfig } from "../lib/config"

export function useAppConfig() {
  const [config, setConfig] = useState(() => getConfig())

  useEffect(() => {
    const atualizar = (event) => {
      setConfig(event.detail ?? getConfig())
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
