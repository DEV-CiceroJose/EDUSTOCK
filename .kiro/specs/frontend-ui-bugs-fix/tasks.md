# Implementation Plan

## Exploration Tests (Run on UNFIXED Code)

- [x] 1. Write bug condition exploration tests for all five bugs
  - **Property 1: Bug Condition** - Five UI Bugs Validation
  - **CRITICAL**: Write these tests BEFORE implementing any fixes
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - Test 1: Search icon overlap - verify icon has proper z-index when text is entered (from Bug Condition 1 in design)
  - Test 2: Add Item button - verify clicking "Adicionar Item" navigates to `/inventario` (from Bug Condition 2 in design)
  - Test 3: Report button - verify clicking "Relatório" navigates to `/relatorios` (from Bug Condition 3 in design)
  - Test 4: Horizontal scroll - verify AlertasPage has no horizontal scrollbar (from Bug Condition 4 in design)
  - Test 5: Sidebar hover - verify sidebar is collapsed (w-16) by default and expands (w-56) on hover at lg breakpoint (from Bug Condition 5 in design)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root causes
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

## Preservation Tests (Run on UNFIXED Code)

- [x] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Existing UI Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Sidebar navigation links work correctly on unfixed code
  - Observe: Search input updates state correctly on unfixed code
  - Observe: Mobile header displays search input below main header on unfixed code
  - Observe: AlertasPage displays alert cards and metrics correctly on unfixed code
  - Observe: Alert ticker allows clicking alerts and opens details on unfixed code
  - Observe: Sidebar is hidden on small/medium screens (below lg breakpoint) on unfixed code
  - Write property-based tests: 
    - For all sidebar link clicks, navigation to correct routes occurs (from Preservation Requirements in design)
    - For all search input typing, state updates correctly (from Preservation Requirements in design)
    - For all mobile viewports, search displays below header (from Preservation Requirements in design)
    - For all AlertasPage views, alert cards and metrics display correctly (from Preservation Requirements in design)
    - For all alert ticker interactions, clicking alerts opens details modal (from Preservation Requirements in design)
    - For all small/medium screen sizes, sidebar remains hidden (from Preservation Requirements in design)
  - Verify tests pass on UNFIXED code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

## Implementation

- [x] 3. Fix all five UI bugs

  - [x] 3.1 Fix Bug 1: Search icon overlap in Header.jsx
    - Add `z-10` class to the search input field to ensure text renders above the icon
    - Verify the icon already has `pointer-events-none` class (no changes needed there)
    - _Bug_Condition: isBugCondition1(input) where input.searchFieldHasText = true from design_
    - _Expected_Behavior: Search icon never visually overlaps with input text_
    - _Preservation: Search state management and text display remain unchanged_
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 Fix Bug 2: "Adicionar Item" button in MainLayout.jsx
    - Import `useNavigate` from `react-router-dom` if not already imported
    - Call `const navigate = useNavigate()` inside MainLayout component
    - Replace empty `handleAddItem` function with: `const handleAddItem = () => { navigate('/inventario') }`
    - _Bug_Condition: isBugCondition2(input) where input.buttonId = "addItem" from design_
    - _Expected_Behavior: Clicking button navigates to /inventario_
    - _Preservation: All other navigation continues to work_
    - _Requirements: 2.2, 3.2_

  - [x] 3.3 Fix Bug 3: "Relatório" button in MainLayout.jsx
    - Replace empty `handleReport` function with: `const handleReport = () => { navigate('/relatorios') }`
    - (useNavigate already imported from Bug 2 fix)
    - _Bug_Condition: isBugCondition3(input) where input.buttonId = "reportButton" from design_
    - _Expected_Behavior: Clicking button navigates to /relatorios_
    - _Preservation: All other navigation continues to work_
    - _Requirements: 2.3, 3.2_

  - [x] 3.4 Fix Bug 4: Alertas horizontal scroll in AlertTicker.jsx or AlertasPage.jsx
    - Verify the parent div in AlertTicker already has `overflow-hidden` class
    - If horizontal scroll persists, add explicit `overflow-x-hidden` class to the parent container
    - Alternative: Add `overflow-x-hidden` to the AlertasPage main container div
    - Test by navigating to `/alertas` and checking for horizontal scrollbar
    - _Bug_Condition: isBugCondition4(input) where marqueeWidth > viewportWidth from design_
    - _Expected_Behavior: Marquee animation contained within viewport, no horizontal scroll_
    - _Preservation: Alert cards, metrics, and ticker scrolling display correctly_
    - _Requirements: 2.4, 3.4, 3.5_

  - [x] 3.5 Fix Bug 5: Sidebar hover behavior in Sidebar.jsx
    - Import `useState` from React: `import { useState } from "react"`
    - Add hover state management: `const [isExpanded, setIsExpanded] = useState(false)`
    - Update `<aside>` className:
      - Remove `lg:w-56` from the className
      - Add conditional width: `${isExpanded ? 'lg:w-56' : 'lg:w-16'}`
      - Add transition class: `transition-all duration-300 ease-in-out`
    - Add hover handlers to `<aside>`:
      - `onMouseEnter={() => setIsExpanded(true)}`
      - `onMouseLeave={() => setIsExpanded(false)}`
    - Update label display logic for all text elements (section headers and navigation labels):
      - Change `hidden lg:inline` to `${isExpanded ? 'lg:inline' : 'lg:hidden'}`
    - Ensure sidebar stays hidden on small/medium screens (keep existing `hidden ... lg:flex` logic)
    - _Bug_Condition: isBugCondition5(input) where screenSize >= lg_breakpoint from design_
    - _Expected_Behavior: Sidebar collapsed (w-16) by default, expands to w-56 on hover with smooth transitions_
    - _Preservation: Sidebar hidden on small/medium screens, all navigation links work_
    - _Requirements: 2.5, 3.6_

  - [x] 3.6 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Five UI Bugs Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, they confirm the expected behaviors are satisfied
    - Run exploration tests from step 1
    - **EXPECTED OUTCOME**: All tests PASS (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - No Regressions
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fixes

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all exploration tests - all should pass
  - Run all preservation tests - all should pass
  - Manually verify each fix in the browser:
    - Type in search field - icon should not overlap
    - Click "Adicionar Item" - should navigate to /inventario
    - Click "Relatório" - should navigate to /relatorios
    - Navigate to /alertas - should have no horizontal scrollbar
    - View sidebar on large screen - should be collapsed, expand on hover
  - Ask the user if questions arise
