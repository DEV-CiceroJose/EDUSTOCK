import { useCallback, useEffect, useRef, useState } from "react"

function estaInstalado() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator?.standalone === true
  )
}

export function usePwaLifecycle() {
  const [online, setOnline] = useState(() => (
    typeof navigator === "undefined" ? true : navigator.onLine
  ))
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(estaInstalado)
  const [waitingWorker, setWaitingWorker] = useState(null)
  const reloadRequested = useRef(false)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    const handleInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("beforeinstallprompt", handleInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)

    let registration
    let installingWorker

    const watchRegistration = (currentRegistration) => {
      registration = currentRegistration
      if (registration.waiting) setWaitingWorker(registration.waiting)

      const handleUpdateFound = () => {
        installingWorker = registration.installing
        if (!installingWorker) return
        installingWorker.addEventListener("statechange", () => {
          if (
            installingWorker.state === "installed"
            && navigator.serviceWorker.controller
          ) {
            setWaitingWorker(installingWorker)
          }
        })
      }

      registration.addEventListener("updatefound", handleUpdateFound)
      return handleUpdateFound
    }

    let handleUpdateFound
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((currentRegistration) => {
        if (!currentRegistration) return
        handleUpdateFound = watchRegistration(currentRegistration)
        void currentRegistration.update()
      }).catch(() => null)

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!reloadRequested.current) return
        window.location.reload()
      })
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
      if (registration && handleUpdateFound) {
        registration.removeEventListener("updatefound", handleUpdateFound)
      }
    }
  }, [])

  const install = useCallback(async () => {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice?.outcome === "accepted") {
      setInstallPrompt(null)
      return true
    }
    return false
  }, [installPrompt])

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return false
    reloadRequested.current = true
    waitingWorker.postMessage({ type: "SKIP_WAITING" })
    return true
  }, [waitingWorker])

  return {
    online,
    installed,
    canInstall: Boolean(installPrompt) && !installed,
    updateAvailable: Boolean(waitingWorker),
    install,
    applyUpdate,
  }
}
