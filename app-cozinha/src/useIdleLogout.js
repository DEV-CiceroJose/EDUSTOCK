import { useEffect, useRef } from 'react'

const EVENTOS = ['pointerdown', 'touchstart', 'keydown']

function minutosConfigurados() {
  const raw = import.meta.env.VITE_IDLE_TIMEOUT_MIN
  const min = Number(raw)
  return Number.isFinite(min) && min > 0 ? min : 5
}

/**
 * Desloga automaticamente após N minutos sem interação do usuário
 * (pointerdown, touchstart, keydown). O timer reinicia a cada interação,
 * não a cada re-render — aoExpirar é lido de uma ref interna para não
 * precisar ser memoizado pelo chamador.
 *
 * @param {() => void} aoExpirar
 * @param {number} [minutos] — sobrescreve VITE_IDLE_TIMEOUT_MIN (default 5); usado nos testes
 */
export function useIdleLogout(aoExpirar, minutos = minutosConfigurados()) {
  const timerRef = useRef(null)
  const aoExpirarRef = useRef(aoExpirar)
  aoExpirarRef.current = aoExpirar

  useEffect(() => {
    function reiniciar() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => aoExpirarRef.current(), minutos * 60 * 1000)
    }

    reiniciar()
    EVENTOS.forEach((ev) => window.addEventListener(ev, reiniciar))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      EVENTOS.forEach((ev) => window.removeEventListener(ev, reiniciar))
    }
  }, [minutos])
}
