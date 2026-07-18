import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdleLogout } from './useIdleLogout.js'

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('chama aoExpirar depois do tempo configurado sem interação', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })

  it('não chama aoExpirar se houver interação antes do prazo', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(4 * 60 * 1000)

    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('reseta o timer a cada evento e só expira depois do último', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar, 5))

    vi.advanceTimersByTime(4 * 60 * 1000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })

  it('desliga os listeners ao desmontar', () => {
    const aoExpirar = vi.fn()
    const { unmount } = renderHook(() => useIdleLogout(aoExpirar, 5))

    unmount()
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('usa default de 5 minutos quando VITE_IDLE_TIMEOUT_MIN não está setada', () => {
    const aoExpirar = vi.fn()
    renderHook(() => useIdleLogout(aoExpirar))

    vi.advanceTimersByTime(5 * 60 * 1000 - 1)
    expect(aoExpirar).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })
})
