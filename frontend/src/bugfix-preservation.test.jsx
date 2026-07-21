/**
 * Preservation Property Tests for Frontend UI Bugs Fix
 * 
 * **IMPORTANT**: These tests verify existing CORRECT behaviors that must NOT be broken
 * **EXPECTED OUTCOME**: All tests SHOULD PASS on unfixed code (proves current behavior works)
 * **After fixes are implemented**: All these tests should STILL PASS (no regressions)
 * 
 * These tests follow the observation-first methodology:
 * 1. Observe correct behavior on unfixed code
 * 2. Write tests capturing that behavior
 * 3. Verify tests pass on unfixed code
 * 4. After fixes, verify tests still pass (preservation check)
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Sidebar from './layouts/Sidebar'
import Header from './layouts/Header'
import AlertasPage from './pages/AlertasPage'
import AlertTicker from './features/alertas/AlertTicker'
import { salvarSessao } from './lib/auth'

// Mock react-router-dom's useNavigate for navigation tests
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useDashboardData hook for AlertasPage tests
vi.mock('./hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    alertas: {
      out: [{ id: '1', nome: 'Produto Esgotado' }],
      low: [{ id: '2', nome: 'Produto Baixo' }],
      expiring: [{ id: '3', nome: 'Produto Vencendo' }],
    },
    alerts: [
      { id: 'a1', label: 'Arroz esgotado', code: 'out', produtoId: '1' },
      { id: 'a2', label: 'Feijão baixo', code: 'low', produtoId: '2' },
    ],
    loading: false,
    carregar: vi.fn(),
    produtos: [
      { id: '1', nome: 'Arroz' },
      { id: '2', nome: 'Feijão' },
      { id: '3', nome: 'Óleo' },
    ],
  }),
}))

describe('Preservation Property Tests - Existing Correct Behaviors', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockNavigate.mockClear()
  })

  /**
   * Property: Sidebar Navigation Links Work Correctly
   * **Validates: Requirements 3.2**
   * 
   * For all sidebar navigation link clicks, the system SHALL navigate to the correct routes
   * exactly as it does on unfixed code (preservation of existing navigation behavior).
   */
  describe('Sidebar Navigation Preservation', () => {
    beforeEach(() => {
      salvarSessao({
        token: 'test-token',
        papel: 'ADMIN',
        is_staff: true,
        modulos_ativos: ['inventario', 'movimentacoes', 'fornecedores', 'alertas', 'relatorios', 'merenda'],
      })
    })

    const navigationItems = [
      { label: 'Inventário', expectedRoute: '/inventario' },
      { label: 'Movimentações', expectedRoute: '/movimentacoes' },
      { label: 'Alertas', expectedRoute: '/alertas' },
      { label: 'Fornecedores', expectedRoute: '/fornecedores' },
      { label: 'Relatórios', expectedRoute: '/relatorios' },
      { label: 'Merenda', expectedRoute: '/merenda' },
      { label: 'Perfil', expectedRoute: '/perfil' },
      { label: 'Configurações', expectedRoute: '/configuracoes' },
    ]

    it('should preserve navigation behavior for all sidebar links', () => {
      const { container } = render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      )

      const sidebar = container.querySelector('aside')
      expect(sidebar).toBeTruthy()

      // Verify all navigation links are present with correct routes
      navigationItems.forEach(({ label, expectedRoute }) => {
        const link = within(sidebar).getByText(label)
        expect(link).toBeTruthy()
        expect(link.closest('a')).toHaveAttribute('href', expectedRoute)
      })
    })

    it('should preserve navigation links structure and accessibility', () => {
      const { container } = render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      )

      // Verify links have proper structure (icon + label)
      const links = container.querySelectorAll('a[href]')
      expect(links.length).toBe(9) // All 8 navigation items + admin-only "Módulos" (papel: ADMIN in this suite)

      // Each link should have icon and label structure
      links.forEach((link) => {
        // Should have gap-3 items structure
        expect(link.classList.contains('flex')).toBe(true)
        expect(link.classList.contains('items-center')).toBe(true)
        
        // Should have title attribute for accessibility
        expect(link.hasAttribute('title')).toBe(true)
      })
    })
  })

  /**
   * Property: Search Input State Updates Correctly
   * **Validates: Requirements 3.1**
   * 
   * For all search input typing interactions, the system SHALL update the search state
   * and display typed text correctly, preserving existing search functionality.
   */
  describe('Search Input State Preservation', () => {
    it('should preserve search input state updates for desktop search', async () => {
      const user = userEvent.setup()
      const mockSetSearch = vi.fn()
      const searchValue = 'arroz'

      render(
        <BrowserRouter>
          <Header
            search=""
            setSearch={mockSetSearch}
            onAddItem={vi.fn()}
            onReport={vi.fn()}
          />
        </BrowserRouter>
      )

      // Find desktop search input (visible on md+ breakpoint)
      const desktopInput = screen.getByPlaceholderText(/Buscar item no estoque/i)
      expect(desktopInput).toBeTruthy()

      // Type in search field
      await user.type(desktopInput, searchValue)

      // Verify setSearch was called for each character
      expect(mockSetSearch).toHaveBeenCalledTimes(searchValue.length)
    })

    it('should preserve search input state updates for mobile search', async () => {
      const user = userEvent.setup()
      const mockSetSearch = vi.fn()
      const searchValue = 'feijão'

      render(
        <BrowserRouter>
          <Header
            search=""
            setSearch={mockSetSearch}
            onAddItem={vi.fn()}
            onReport={vi.fn()}
          />
        </BrowserRouter>
      )

      // Find mobile search input (different placeholder)
      const mobileInput = screen.getByPlaceholderText(/Buscar item…/i)
      expect(mobileInput).toBeTruthy()

      // Type in search field
      await user.type(mobileInput, searchValue)

      // Verify setSearch was called for each character
      expect(mockSetSearch).toHaveBeenCalledTimes(searchValue.length)
    })

    it('should preserve controlled input behavior with existing search value', () => {
      const mockSetSearch = vi.fn()
      const existingSearch = 'test query'

      render(
        <BrowserRouter>
          <Header
            search={existingSearch}
            setSearch={mockSetSearch}
            onAddItem={vi.fn()}
            onReport={vi.fn()}
          />
        </BrowserRouter>
      )

      // Both desktop and mobile inputs should display the existing value
      const desktopInput = screen.getByPlaceholderText(/Buscar item no estoque/i)
      const mobileInput = screen.getByPlaceholderText(/Buscar item…/i)

      expect(desktopInput.value).toBe(existingSearch)
      expect(mobileInput.value).toBe(existingSearch)
    })
  })

  /**
   * Property: Mobile Header Displays Search Below Main Header
   * **Validates: Requirements 3.3**
   * 
   * For all mobile viewports, the system SHALL display the search input below the main
   * header content, preserving the existing mobile responsive layout.
   */
  describe('Mobile Header Layout Preservation', () => {
    it('should preserve mobile search input structure below main header', () => {
      const mockSetSearch = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <Header
            search=""
            setSearch={mockSetSearch}
            onAddItem={vi.fn()}
            onReport={vi.fn()}
          />
        </BrowserRouter>
      )

      const header = container.querySelector('header')
      expect(header).toBeTruthy()

      // Header should have two main sections
      const sections = header.children
      expect(sections.length).toBeGreaterThanOrEqual(2)

      // First section: main header with brand, desktop search, and actions
      const mainSection = sections[0]
      expect(mainSection.classList.contains('flex')).toBe(true)
      expect(mainSection.classList.contains('items-center')).toBe(true)

      // Second section: mobile search (has md:hidden class)
      const mobileSearchSection = sections[1]
      expect(mobileSearchSection.classList.contains('md:hidden')).toBe(true)

      // Mobile search should have the mobile search input
      const mobileInput = within(mobileSearchSection).getByPlaceholderText(/Buscar item…/i)
      expect(mobileInput).toBeTruthy()
    })

    it('should preserve mobile search input visibility classes', () => {
      const mockSetSearch = vi.fn()

      const { container } = render(
        <BrowserRouter>
          <Header
            search=""
            setSearch={mockSetSearch}
            onAddItem={vi.fn()}
            onReport={vi.fn()}
          />
        </BrowserRouter>
      )

      // Desktop search should be hidden on mobile (hidden md:block)
      const desktopSearchContainer = container.querySelector('.md\\:block')
      expect(desktopSearchContainer).toBeTruthy()
      expect(desktopSearchContainer.classList.contains('hidden')).toBe(true)

      // Mobile search container should be visible on mobile but hidden on desktop
      const mobileSearchContainer = container.querySelector('.md\\:hidden')
      expect(mobileSearchContainer).toBeTruthy()
      
      // Verify it contains the mobile search input
      const mobileInput = within(mobileSearchContainer).getByPlaceholderText(/Buscar item…/i)
      expect(mobileInput).toBeTruthy()
    })
  })

  /**
   * Property: AlertasPage Displays Alert Cards and Metrics Correctly
   * **Validates: Requirements 3.4**
   * 
   * For all AlertasPage views, the system SHALL display alert cards, summary metrics,
   * and ticker scrolling exactly as before, preserving all alert display functionality.
   */
  describe('AlertasPage Display Preservation', () => {
    it('should preserve AlertasPage component rendering with alerts', () => {
      const { container } = render(
        <BrowserRouter>
          <AlertasPage />
        </BrowserRouter>
      )

      // Page should render without errors
      const pageContainer = container.querySelector('.mx-auto')
      expect(pageContainer).toBeTruthy()

      // Should have proper width constraint
      expect(pageContainer.classList.contains('max-w-[1500px]')).toBe(true)
    })

    it('should preserve alert ticker rendering with alerts', () => {
      const mockAlerts = [
        { id: 'a1', label: 'Arroz esgotado', code: 'out', produtoId: '1' },
        { id: 'a2', label: 'Feijão baixo', code: 'low', produtoId: '2' },
        { id: 'a3', label: 'Óleo vencendo', code: 'expiring', produtoId: '3' },
      ]

      render(
        <AlertTicker alerts={mockAlerts} onPick={vi.fn()} />
      )

      // Verify alert count badge displays correct number
      const badge = screen.getByText(mockAlerts.length.toString())
      expect(badge).toBeTruthy()

      // Verify all alert labels are rendered (doubled for loop)
      mockAlerts.forEach((alert) => {
        const elements = screen.getAllByText(alert.label)
        // Should appear twice (loop duplication for continuous marquee)
        expect(elements.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('should preserve alert ticker structure and styling', () => {
      const mockAlerts = [
        { id: 'a1', label: 'Test alert', code: 'out', produtoId: '1' },
      ]

      const { container } = render(
        <AlertTicker alerts={mockAlerts} onPick={vi.fn()} />
      )

      // Footer should have sticky positioning
      const footer = container.querySelector('footer')
      expect(footer).toBeTruthy()
      expect(footer.classList.contains('sticky')).toBe(true)
      expect(footer.classList.contains('bottom-0')).toBe(true)

      // Should have proper z-index
      expect(footer.classList.contains('z-30')).toBe(true)

      // Should have border and backdrop blur
      expect(footer.classList.contains('border-t')).toBe(true)
      expect(footer.classList.contains('backdrop-blur-md')).toBe(true)

      // Marquee container should have w-max for continuous scroll
      const marquee = container.querySelector('.marquee')
      expect(marquee).toBeTruthy()
      expect(marquee.classList.contains('w-max')).toBe(true)
    })

    it('should preserve empty state message when no alerts', () => {
      render(
        <AlertTicker alerts={[]} onPick={vi.fn()} />
      )

      // Should display default "all good" message (appears twice due to loop duplication)
      const okMessages = screen.getAllByText(/Tudo sob controle/i)
      expect(okMessages.length).toBeGreaterThanOrEqual(1)

      // Badge should not be present when no alerts
      const badge = screen.queryByText(/\d+/)
      // Should only find bullet separators, not a count badge
      expect(badge).toBeFalsy()
    })
  })

  /**
   * Property: Alert Ticker Allows Clicking Alerts with Product IDs
   * **Validates: Requirements 3.5**
   * 
   * For all alert ticker interactions, the system SHALL allow clicking on alerts
   * that have product IDs and trigger the onPick handler, preserving click behavior.
   */
  describe('Alert Ticker Click Behavior Preservation', () => {
    it('should preserve alert click handler invocation for alerts with product IDs', async () => {
      const user = userEvent.setup()
      const mockOnPick = vi.fn()
      const mockAlerts = [
        { id: 'a1', label: 'Arroz esgotado', code: 'out', produtoId: '1' },
        { id: 'a2', label: 'Feijão baixo', code: 'low', produtoId: '2' },
      ]

      render(
        <AlertTicker alerts={mockAlerts} onPick={mockOnPick} />
      )

      // Click on first alert (should be clickable because it has produtoId)
      const firstAlert = screen.getAllByText(mockAlerts[0].label)[0]
      expect(firstAlert).toBeTruthy()

      const firstAlertButton = firstAlert.closest('button')
      expect(firstAlertButton).toBeTruthy()

      await user.click(firstAlertButton)

      // Verify onPick was called with the correct alert
      expect(mockOnPick).toHaveBeenCalledWith(mockAlerts[0])
    })

    it('should preserve alert button structure with underline styling for clickable alerts', () => {
      const mockAlerts = [
        { id: 'a1', label: 'Clickable Alert', code: 'out', produtoId: '1' },
        { id: 'a2', label: 'Non-clickable Alert', code: 'ok' }, // No produtoId
      ]

      render(
        <AlertTicker alerts={mockAlerts} onPick={vi.fn()} />
      )

      // Clickable alert (with produtoId) should have underline on hover
      const clickableAlertText = screen.getAllByText(mockAlerts[0].label)[0]
      expect(clickableAlertText.classList.contains('hover:underline')).toBe(true)
      expect(clickableAlertText.classList.contains('font-medium')).toBe(true)

      // Non-clickable alert should have different styling
      const nonClickableAlertText = screen.getAllByText(mockAlerts[1].label)[0]
      expect(nonClickableAlertText.classList.contains('text-ink-soft')).toBe(true)
    })

    it('should preserve alert color coding based on alert code', () => {
      const mockAlerts = [
        { id: 'a1', label: 'Out Alert', code: 'out', produtoId: '1' },
        { id: 'a2', label: 'Low Alert', code: 'low', produtoId: '2' },
        { id: 'a3', label: 'OK Alert', code: 'ok' },
      ]

      const { container } = render(
        <AlertTicker alerts={mockAlerts} onPick={vi.fn()} />
      )

      // Find all buttons
      const buttons = container.querySelectorAll('button')

      // Check that different alert codes have different color classes
      // out -> text-out, low -> text-low, ok -> text-ok
      let foundOut = false
      let foundLow = false
      let foundOk = false

      buttons.forEach((button) => {
        const iconSpan = button.querySelector('span')
        if (iconSpan) {
          if (iconSpan.classList.contains('text-out')) foundOut = true
          if (iconSpan.classList.contains('text-low')) foundLow = true
          if (iconSpan.classList.contains('text-ok')) foundOk = true
        }
      })

      expect(foundOut).toBe(true)
      expect(foundLow).toBe(true)
      expect(foundOk).toBe(true)
    })
  })

  /**
   * Property: Sidebar Hidden on Small/Medium Screens
   * **Validates: Requirements 3.6**
   * 
   * For all small/medium screen sizes (below lg breakpoint), the sidebar SHALL remain
   * hidden exactly as the original implementation, preserving mobile/tablet behavior.
   */
  describe('Sidebar Responsive Behavior Preservation', () => {
    beforeEach(() => {
      salvarSessao({
        token: 'test-token',
        papel: 'ADMIN',
        is_staff: true,
        modulos_ativos: ['inventario', 'movimentacoes', 'fornecedores', 'alertas', 'relatorios', 'merenda'],
      })
    })

    it('should preserve sidebar hidden state on small/medium screens', () => {
      const { container } = render(
        <BrowserRouter>
          <Sidebar />
        </BrowserRouter>
      )

      const sidebar = container.querySelector('aside')
      expect(sidebar).toBeTruthy()

      // Sidebar should have 'hidden' class for mobile/tablet
      expect(sidebar.classList.contains('hidden')).toBe(true)

      // Sidebar should become visible only at lg breakpoint
      expect(sidebar.classList.contains('lg:flex')).toBe(true)
    })

    it('should preserve sidebar sticky positioning and height', () => {
      const { container } = render(
        <BrowserRouter>
          <Sidebar />
        </BrowserRouter>
      )

      const sidebar = container.querySelector('aside')
      expect(sidebar).toBeTruthy()

      // Should be sticky and full height
      expect(sidebar.classList.contains('sticky')).toBe(true)
      expect(sidebar.classList.contains('top-0')).toBe(true)
      expect(sidebar.classList.contains('h-screen')).toBe(true)
    })

    it('should preserve sidebar section headers hidden on small screens', () => {
      const { container } = render(
        <BrowserRouter>
          <Sidebar />
        </BrowserRouter>
      )

      // Find all section headers (h3 elements)
      const headers = container.querySelectorAll('h3')
      expect(headers.length).toBeGreaterThan(0)

      // After Bug 5 fix: Headers use conditional classes based on hover state
      // Preservation check: Headers should still control visibility appropriately
      // They now use dynamic classes: ${isExpanded ? 'lg:inline' : 'lg:hidden'}
      headers.forEach((header) => {
        // Check that header has visibility control classes (either lg:inline or lg:hidden)
        const classStr = header.className
        const hasVisibilityControl = classStr.includes('lg:inline') || classStr.includes('lg:hidden')
        expect(hasVisibilityControl).toBe(true)
      })
    })

    it('should preserve navigation label visibility behavior', () => {
      const { container } = render(
        <BrowserRouter>
          <Sidebar />
        </BrowserRouter>
      )

      // Find navigation labels (span elements with text inside links)
      const labels = container.querySelectorAll('a span:not(.shrink-0)')
      expect(labels.length).toBeGreaterThan(0)

      // After Bug 5 fix: Labels use conditional classes based on hover state
      // Preservation check: Labels should still have visibility control for responsive behavior
      // They now use dynamic classes: ${isExpanded ? 'lg:inline' : 'lg:hidden'}
      labels.forEach((label) => {
        const classStr = label.className
        const hasVisibilityControl = classStr.includes('lg:inline') || classStr.includes('lg:hidden')
        expect(hasVisibilityControl).toBe(true)
      })
    })
  })
})
