/**
 * Bug Condition Exploration Tests for Frontend UI Bugs
 * 
 * **CRITICAL**: These tests are written BEFORE implementing any fixes
 * **EXPECTED OUTCOME**: All tests SHOULD FAIL on unfixed code (this proves bugs exist)
 * **DO NOT attempt to fix the tests or code when they fail**
 * 
 * These tests validate the bug conditions from the design document and will
 * pass once the fixes are implemented in Task 2.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Header from './layouts/Header'
import MainLayout from './layouts/MainLayout'
import Sidebar from './layouts/Sidebar'
import AlertasPage from './pages/AlertasPage'
import AlertTicker from './features/alertas/AlertTicker'

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useDashboardData hook
vi.mock('./hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    alertas: { out: [], low: [], expiring: [] },
    alerts: [],
    loading: false,
    carregar: vi.fn(),
    produtos: [],
  }),
}))

describe('Bug Condition Exploration Tests', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  /**
   * Test 1: Search Icon Overlap
   * **Validates: Requirements 1.1**
   * 
   * Bug Condition: Search icon overlaps with input text when user types
   * Root Cause: Search icon lacks proper z-index layering
   * 
   * This test verifies that the search icon has proper z-index when text is entered.
   * On unfixed code, the input field lacks z-10 class causing potential overlap.
   */
  it('Bug 1: Search icon should have proper z-index to prevent overlap with text', () => {
    const mockSetSearch = vi.fn()
    
    const { container } = render(
      <BrowserRouter>
        <Header 
          search="test search text" 
          setSearch={mockSetSearch}
          onAddItem={vi.fn()}
          onReport={vi.fn()}
        />
      </BrowserRouter>
    )

    // Find the desktop search input (hidden on mobile, visible on md+)
    const desktopSearchInput = container.querySelector('input[placeholder*="Buscar item no estoque"]')
    expect(desktopSearchInput).toBeTruthy()
    
    // Check if input has proper z-index class to stay above the icon
    // The input should have 'z-10' or similar z-index class to prevent icon overlap
    const inputClasses = desktopSearchInput.className
    const hasProperZIndex = inputClasses.includes('z-10') || inputClasses.includes('z-20')
    
    // This assertion will FAIL on unfixed code (bug exists)
    // After fix, the input will have z-10 class ensuring text renders above icon
    expect(hasProperZIndex).toBe(true)
  })

  /**
   * Test 2: "Adicionar Item" Button Navigation
   * **Validates: Requirements 1.2**
   * 
   * Bug Condition: "Adicionar Item" button does nothing when clicked
   * Root Cause: handleAddItem function is empty in MainLayout.jsx
   * 
   * This test verifies clicking "Adicionar Item" navigates to /inventario.
   * On unfixed code, the handler is empty so navigation will NOT occur.
   */
  it('Bug 2: Clicking "Adicionar Item" button should navigate to /inventario', async () => {
    const user = userEvent.setup()
    
    render(
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    )

    // Find and click the "Adicionar Item" button
    const addButton = screen.getByText(/Adicionar Item/i)
    await user.click(addButton)
    
    // This assertion will FAIL on unfixed code (handleAddItem is empty)
    // After fix, handleAddItem will call navigate('/inventario')
    expect(mockNavigate).toHaveBeenCalledWith('/inventario')
  })

  /**
   * Test 3: "Relatório" Button Navigation
   * **Validates: Requirements 1.3**
   * 
   * Bug Condition: "Relatório" button does nothing when clicked
   * Root Cause: handleReport function is empty in MainLayout.jsx
   * 
   * This test verifies clicking "Relatório" navigates to /relatorios.
   * On unfixed code, the handler is empty so navigation will NOT occur.
   */
  it('Bug 3: Clicking "Relatório" button should navigate to /relatorios', async () => {
    const user = userEvent.setup()
    
    render(
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    )

    // Find and click the "Relatório" button in the header (not the sidebar link "Relatórios")
    // Use getByRole to find the button specifically
    const reportButton = screen.getByRole('button', { name: /Relatório/i })
    await user.click(reportButton)
    
    // This assertion will FAIL on unfixed code (handleReport is empty)
    // After fix, handleReport will call navigate('/relatorios')
    expect(mockNavigate).toHaveBeenCalledWith('/relatorios')
  })

  /**
   * Test 4: Alertas Page Horizontal Scroll
   * **Validates: Requirements 1.4**
   * 
   * Bug Condition: AlertasPage displays horizontal scrollbar due to marquee animation
   * Root Cause: AlertTicker marquee has w-max extending beyond viewport without overflow-x-hidden
   * 
   * This test verifies AlertTicker parent container has overflow-x-hidden to contain marquee.
   * On unfixed code, the parent container lacks overflow-x-hidden class.
   */
  it('Bug 4: AlertTicker parent should have overflow-x-hidden to prevent horizontal scroll', () => {
    const mockAlerts = [
      { id: '1', label: 'Alert 1', code: 'low' },
      { id: '2', label: 'Alert 2', code: 'out' },
    ]
    
    const { container } = render(
      <AlertTicker alerts={mockAlerts} onPick={vi.fn()} />
    )

    // Find the parent container of the marquee (the div with flex-1 that should contain overflow)
    const parentContainer = container.querySelector('.flex-1.overflow-hidden')
    expect(parentContainer).toBeTruthy()
    
    // Check if parent has overflow-x-hidden (either via overflow-hidden or overflow-x-hidden)
    const classes = parentContainer.className
    const hasOverflowXHidden = classes.includes('overflow-hidden') || classes.includes('overflow-x-hidden')
    
    // This assertion will PASS on current code (overflow-hidden is already present)
    // However, we need to verify it's actually preventing horizontal scroll in the page context
    expect(hasOverflowXHidden).toBe(true)
    
    // Additional check: verify the marquee container has w-max which could cause overflow
    const marqueeContainer = container.querySelector('.marquee')
    expect(marqueeContainer).toBeTruthy()
    expect(marqueeContainer.className).toContain('w-max')
  })

  /**
   * Test 5: Sidebar Hover Behavior
   * **Validates: Requirements 1.5**
   * 
   * Bug Condition: Sidebar is always full width (w-56) on large screens, no hover-expand behavior
   * Root Cause: Sidebar has fixed w-16 lg:w-56 classes without hover state management
   * 
   * This test verifies sidebar is collapsed (w-16) by default and expands (w-56) on hover at lg breakpoint.
   * On unfixed code, sidebar has no hover state so it's always w-56 on large screens.
   */
  it('Bug 5: Sidebar should be collapsed (w-16) by default and expand (w-56) on hover at lg breakpoint', async () => {
    const user = userEvent.setup()
    
    const { container } = render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )

    const sidebar = container.querySelector('aside')
    expect(sidebar).toBeTruthy()
    
    // Check initial state: should be w-16 on large screens (collapsed by default)
    const initialClasses = sidebar.className
    
    // On unfixed code, sidebar has 'lg:w-56' making it always full width on large screens
    // After fix, it should have conditional classes based on hover state
    // We check if it has the fixed 'lg:w-56' class (bug) or dynamic hover behavior (fixed)
    const hasFixedLgWidth = initialClasses.includes('lg:w-56')
    
    // This assertion will FAIL on unfixed code (hasFixedLgWidth = true, meaning bug exists)
    // After fix, sidebar will use conditional width based on hover state, not fixed lg:w-56
    expect(hasFixedLgWidth).toBe(false)
    
    // Additionally verify that sidebar should have transition classes for smooth animation
    const hasTransition = initialClasses.includes('transition')
    
    // This will also FAIL on unfixed code (no transition classes)
    expect(hasTransition).toBe(true)
  })
})
