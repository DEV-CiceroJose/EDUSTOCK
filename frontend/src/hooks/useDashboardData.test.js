import { describe, it, expect } from 'vitest'
import { useDashboardData } from './useDashboardData'

describe('useDashboardData', () => {
  it('should export a function', () => {
    expect(typeof useDashboardData).toBe('function')
  })

  it('should be named useDashboardData', () => {
    expect(useDashboardData.name).toBe('useDashboardData')
  })

  it('should be importable from the hooks directory', () => {
    // This test passes if the import statement above succeeded
    expect(useDashboardData).toBeDefined()
  })
})
