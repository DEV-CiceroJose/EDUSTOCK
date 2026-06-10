# Frontend UI Bugs Fix Design

## Overview

This design addresses five distinct UI bugs in the EduStock frontend that affect layout, navigation, and user interactions. The fixes are minimal and targeted, ensuring no changes to unrelated functionality:

1. **Search icon overlap** - Apply proper z-index to prevent icon from overlapping search text
2. **"Adicionar Item" button** - Implement navigation to `/inventario` using React Router
3. **"Relatório" button** - Implement navigation to `/relatorios` using React Router
4. **Alertas horizontal scroll** - Add overflow containment to AlertTicker's parent container
5. **Sidebar hover behavior** - Implement collapsed-by-default with hover-expand on large screens

The approach follows the bug condition methodology: identify each bug condition, define the fix, and ensure preservation of existing behavior.

## Glossary

- **Bug_Condition (C)**: The specific conditions under which each of the five UI bugs manifests
- **Property (P)**: The desired correct behavior when the bug condition is met
- **Preservation**: All existing navigation, display, and interaction behaviors that must remain unchanged
- **MainLayout**: The component in `frontend/src/layouts/MainLayout.jsx` that renders the main application layout with Sidebar, Header, and page content
- **Header**: The component in `frontend/src/layouts/Header.jsx` that displays the search bar and action buttons
- **Sidebar**: The component in `frontend/src/layouts/Sidebar.jsx` that displays navigation links
- **AlertasPage**: The page component in `frontend/src/pages/AlertasPage.jsx` that renders the alerts view
- **AlertTicker**: The component in `frontend/src/features/alertas/AlertTicker.jsx` that displays a marquee of scrolling alerts
- **handleAddItem**: Empty function in MainLayout.jsx that should navigate to `/inventario`
- **handleReport**: Empty function in MainLayout.jsx that should navigate to `/relatorios`

## Bug Details

### Bug Condition 1: Search Icon Overlap

The search icon overlaps with input text when the user types in the search field.

**Formal Specification:**
```
FUNCTION isBugCondition1(input)
  INPUT: input of type SearchInteraction
  OUTPUT: boolean
  
  RETURN input.searchFieldHasText = true
         AND searchIconIsAbsolute = true
         AND searchIconZIndexNotSet = true
END FUNCTION
```

**Root Cause**: In Header.jsx, the search icon is positioned absolutely within the relative container but lacks proper z-index layering. The icon's z-index may interfere with text rendering in the input field.

### Bug Condition 2: "Adicionar Item" Button

The "Adicionar Item" button does nothing when clicked.

**Formal Specification:**
```
FUNCTION isBugCondition2(input)
  INPUT: input of type ButtonClick
  OUTPUT: boolean
  
  RETURN input.buttonId = "addItem"
         AND handleAddItemFunction = emptyFunction
END FUNCTION
```

**Root Cause**: In MainLayout.jsx, the `handleAddItem` function is empty with a TODO comment. The function is passed to Header.jsx as the `onAddItem` prop but does not implement navigation.

### Bug Condition 3: "Relatório" Button

The "Relatório" button does nothing when clicked.

**Formal Specification:**
```
FUNCTION isBugCondition3(input)
  INPUT: input of type ButtonClick
  OUTPUT: boolean
  
  RETURN input.buttonId = "reportButton"
         AND handleReportFunction = emptyFunction
END FUNCTION
```

**Root Cause**: In MainLayout.jsx, the `handleReport` function is empty with a TODO comment. The function is passed to Header.jsx as the `onReport` prop but does not implement navigation.

### Bug Condition 4: Alertas Horizontal Scroll

The AlertasPage displays a horizontal scrollbar due to the marquee animation.

**Formal Specification:**
```
FUNCTION isBugCondition4(input)
  INPUT: input of type PageNavigation
  OUTPUT: boolean
  
  RETURN input.currentPage = "/alertas"
         AND alertTickerMarqueeWidth > viewportWidth
         AND alertTickerParentOverflowX NOT "hidden"
END FUNCTION
```

**Root Cause**: In AlertTicker.jsx, the marquee container has `w-max` (width: max-content) which extends beyond the viewport. The parent container in AlertasPage.jsx does not have `overflow-x: hidden` to contain the marquee within the viewport.

### Bug Condition 5: Sidebar Not Collapsible

The sidebar is always at full width (w-56) on large screens instead of being collapsed by default with hover-expand behavior.

**Formal Specification:**
```
FUNCTION isBugCondition5(input)
  INPUT: input of type ViewportState
  OUTPUT: boolean
  
  RETURN input.screenSize >= lg_breakpoint
         AND sidebarWidth = "w-56"
         AND sidebarHoverBehavior = false
END FUNCTION
```

**Root Cause**: In Sidebar.jsx, the sidebar has a fixed width class `w-16 lg:w-56` which sets it to full width on large screens. There is no hover state management or transition logic to implement the collapsed-by-default, expand-on-hover behavior.

### Examples

**Bug 1 - Search Icon Overlap:**
- User types "arroz" into search field → search icon may visually overlap with the first letter
- Expected: Icon should stay behind text with proper layering

**Bug 2 - Add Item Button:**
- User clicks "Adicionar Item" button → nothing happens
- Expected: Navigate to `/inventario` page

**Bug 3 - Report Button:**
- User clicks "Relatório" button → nothing happens
- Expected: Navigate to `/relatorios` page

**Bug 4 - Horizontal Scroll:**
- User navigates to `/alertas` → horizontal scrollbar appears at bottom of page
- Expected: No horizontal scrollbar, marquee contained within viewport

**Bug 5 - Sidebar Hover:**
- User views app on large screen → sidebar is always full width (w-56)
- Expected: Sidebar collapsed (w-16, icons only) by default, expands to w-56 on hover

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing navigation via sidebar links must continue to work exactly as before
- Search input state management and text display must remain unchanged
- Mobile search input display must remain unchanged
- Alert cards and summary metrics display must remain unchanged
- Alert ticker scrolling animation and alert click behavior must remain unchanged
- Sidebar visibility on small/medium screens (hidden below lg breakpoint) must remain unchanged
- Header layout and mobile responsive behavior must remain unchanged
- User profile display and navigation must remain unchanged

**Scope:**
All inputs and interactions that do NOT involve:
1. Typing text in the search field (Bug 1)
2. Clicking the "Adicionar Item" button (Bug 2)
3. Clicking the "Relatório" button (Bug 3)
4. Viewing the AlertasPage (Bug 4)
5. Hovering over the sidebar on large screens (Bug 5)

should be completely unaffected by these fixes.

## Hypothesized Root Cause

Based on the bug analysis and code review:

1. **Search Icon Z-Index Issue**: The absolutely positioned search icon in Header.jsx lacks explicit z-index or pointer-events styling, potentially causing visual overlap with input text.

2. **Empty Button Handlers**: Both `handleAddItem()` and `handleReport()` in MainLayout.jsx are placeholder functions with TODO comments. They need to be implemented with React Router's `useNavigate` hook.

3. **Marquee Overflow**: The AlertTicker component uses `w-max` on the marquee element, which extends beyond viewport width. The parent container lacks `overflow-x: hidden` to clip the content.

4. **Fixed Sidebar Width**: The Sidebar component uses fixed Tailwind width classes `w-16 lg:w-56` without any hover state management. Implementing hover-expand requires:
   - State management for hover detection
   - Conditional width classes based on hover state
   - CSS transitions for smooth width changes
   - Conditional rendering of labels based on expanded state

## Correctness Properties

Property 1: Bug Condition - Search Icon Visual Layering

_For any_ search interaction where text is entered into the search field, the fixed Header component SHALL ensure the search icon never visually overlaps with the input text by applying proper CSS layering (z-index or pointer-events).

**Validates: Requirements 2.1**

Property 2: Bug Condition - Add Item Navigation

_For any_ button click on the "Adicionar Item" button, the fixed handleAddItem function SHALL navigate the user to the `/inventario` route using React Router's useNavigate hook.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Report Navigation

_For any_ button click on the "Relatório" button, the fixed handleReport function SHALL navigate the user to the `/relatorios` route using React Router's useNavigate hook.

**Validates: Requirements 2.3**

Property 4: Bug Condition - Marquee Containment

_For any_ page navigation to `/alertas`, the fixed AlertTicker or its parent container SHALL contain the marquee animation within the viewport width by applying `overflow-x: hidden`, preventing horizontal scrollbars.

**Validates: Requirements 2.4**

Property 5: Bug Condition - Sidebar Hover Behavior

_For any_ viewport at large screen size (lg breakpoint), the fixed Sidebar component SHALL display collapsed (w-16, icons only) by default and SHALL expand to full width (w-56) when the user hovers over it, with smooth transitions and label visibility based on expanded state.

**Validates: Requirements 2.5**

Property 6: Preservation - Existing Navigation

_For any_ interaction that is NOT clicking the "Adicionar Item" or "Relatório" buttons, the fixed code SHALL produce exactly the same navigation behavior as the original code, preserving all sidebar navigation, profile navigation, and routing.

**Validates: Requirements 3.2**

Property 7: Preservation - Search Functionality

_For any_ search input interaction, the fixed code SHALL continue to update the search state and display typed text correctly, preserving the existing search state management.

**Validates: Requirements 3.1, 3.3**

Property 8: Preservation - Alertas Display

_For any_ viewing of the AlertasPage, the fixed code SHALL continue to display alert cards, summary metrics, and ticker scrolling exactly as before, preserving all alert display and click behaviors.

**Validates: Requirements 3.4, 3.5**

Property 9: Preservation - Sidebar Responsive Behavior

_For any_ viewport at small or medium screen size (below lg breakpoint), the fixed Sidebar SHALL remain hidden exactly as the original implementation, preserving mobile/tablet behavior.

**Validates: Requirements 3.6**

## Fix Implementation

### Changes Required

**Bug 1: Search Icon Overlap**

**File**: `frontend/src/layouts/Header.jsx`

**Specific Changes**:
1. Add `pointer-events-none` class to the search icon spans (already present, verify no removal)
2. Optionally add explicit `z-index: -1` or ensure the icon stays behind the input field
3. Alternative: Add `relative z-10` to the input field itself to ensure text renders above

**Implementation Approach**: Minimal CSS adjustment - add `z-10` class to the input field to ensure text layer is above the icon layer.

---

**Bug 2: "Adicionar Item" Button**

**File**: `frontend/src/layouts/MainLayout.jsx`

**Specific Changes**:
1. Import `useNavigate` from `react-router-dom` at the top of the file
2. Inside the MainLayout component, call `const navigate = useNavigate()`
3. Replace the empty `handleAddItem` function with:
   ```javascript
   const handleAddItem = () => {
     navigate('/inventario')
   }
   ```

---

**Bug 3: "Relatório" Button**

**File**: `frontend/src/layouts/MainLayout.jsx`

**Specific Changes**:
1. (useNavigate already imported from Bug 2 fix)
2. Replace the empty `handleReport` function with:
   ```javascript
   const handleReport = () => {
     navigate('/relatorios')
   }
   ```

---

**Bug 4: Alertas Horizontal Scroll**

**File**: `frontend/src/features/alertas/AlertTicker.jsx`

**Specific Changes**:
1. Add `overflow-hidden` class to the parent div that contains the marquee
2. The div with `className="relative min-w-0 flex-1 overflow-hidden"` already has `overflow-hidden`
3. Verify this applies `overflow-x: hidden` correctly
4. If horizontal scroll persists, add explicit `overflow-x-hidden` class

**Alternative Approach**: If the issue is in the AlertasPage wrapper, add `overflow-x-hidden` to the page's main container div.

---

**Bug 5: Sidebar Hover Behavior**

**File**: `frontend/src/layouts/Sidebar.jsx`

**Specific Changes**:
1. Import `useState` from React: `import { useState } from "react"`
2. Add hover state management inside the Sidebar component:
   ```javascript
   const [isExpanded, setIsExpanded] = useState(false)
   ```
3. Update the `<aside>` element:
   - Remove `lg:w-56` from the className
   - Add conditional width: `${isExpanded ? 'lg:w-56' : 'lg:w-16'}`
   - Add hover handlers: `onMouseEnter={() => setIsExpanded(true)}` and `onMouseLeave={() => setIsExpanded(false)}`
   - Add transition class: `transition-all duration-300 ease-in-out`
4. Update label display logic:
   - Change `hidden lg:inline` to `${isExpanded ? 'lg:inline' : 'lg:hidden'}`
   - Apply to all text elements: section headers and navigation labels
5. Ensure the sidebar stays hidden on small/medium screens (keep existing `hidden ... lg:flex` logic)

**Full className for aside**:
```javascript
className={`sticky top-0 hidden h-screen ${isExpanded ? 'lg:w-56' : 'lg:w-16'} shrink-0 flex-col gap-4 border-r border-line bg-surface/60 py-4 px-2 lg:flex transition-all duration-300 ease-in-out`}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify each fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fixes. Confirm or refute the root cause analysis for each bug.

**Test Plan**: Write visual regression tests, interaction tests, and navigation tests that demonstrate each bug. Run these tests on the UNFIXED code to observe failures and understand root causes.

**Test Cases**:

1. **Search Icon Overlap Test**: Type long text into search field and verify icon does not overlap (will fail on unfixed code - requires visual inspection or DOM z-index checking)

2. **Add Item Button Test**: Click "Adicionar Item" button and assert navigation to `/inventario` occurs (will fail on unfixed code - button does nothing)

3. **Report Button Test**: Click "Relatório" button and assert navigation to `/relatorios` occurs (will fail on unfixed code - button does nothing)

4. **Horizontal Scroll Test**: Navigate to `/alertas` page and check for horizontal scrollbar or document.body.scrollWidth > window.innerWidth (will fail on unfixed code - horizontal scroll exists)

5. **Sidebar Hover Test**: On large screen, verify sidebar is w-16 by default, hover over it and verify width becomes w-56 (will fail on unfixed code - sidebar is always w-56)

**Expected Counterexamples**:
- Search icon may have same z-index as input text
- Button handlers are empty functions with no navigation logic
- AlertTicker marquee extends beyond viewport without overflow containment
- Sidebar has fixed width with no hover state management

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed functions/components produce the expected behavior.

**Pseudocode for each bug:**

```
// Bug 1: Search Icon
FOR ALL input WHERE userTypesInSearchField(input) DO
  result := renderHeader_fixed(input)
  ASSERT searchIconDoesNotOverlapText(result)
END FOR

// Bug 2: Add Item Button
FOR ALL input WHERE userClicksAddItemButton(input) DO
  result := handleAddItem_fixed()
  ASSERT navigationOccurred(result, "/inventario")
END FOR

// Bug 3: Report Button
FOR ALL input WHERE userClicksReportButton(input) DO
  result := handleReport_fixed()
  ASSERT navigationOccurred(result, "/relatorios")
END FOR

// Bug 4: Horizontal Scroll
FOR ALL input WHERE userNavigatesToAlertas(input) DO
  result := renderAlertasPage_fixed()
  ASSERT noHorizontalScroll(result)
END FOR

// Bug 5: Sidebar Hover
FOR ALL input WHERE largeScreenAndHoverSidebar(input) DO
  result := renderSidebar_fixed(input)
  ASSERT sidebarCollapsedByDefault(result)
  ASSERT sidebarExpandsOnHover(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed components produce the same results as the original components.

**Pseudocode:**
```
// Preservation: Existing Navigation
FOR ALL input WHERE NOT (clicksAddItem OR clicksReport) DO
  ASSERT MainLayout_original(input) = MainLayout_fixed(input)
END FOR

// Preservation: Search Functionality
FOR ALL input WHERE NOT (visualOverlapCheck) DO
  ASSERT Header_original(input).searchState = Header_fixed(input).searchState
END FOR

// Preservation: Alertas Display
FOR ALL input WHERE NOT (checkingHorizontalScroll) DO
  ASSERT AlertasPage_original(input).display = AlertasPage_fixed(input).display
END FOR

// Preservation: Sidebar Mobile Behavior
FOR ALL input WHERE screenSize < lg_breakpoint DO
  ASSERT Sidebar_original(input) = Sidebar_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (different screen sizes, different interactions)
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: 
1. Observe behavior on UNFIXED code for non-bug interactions (sidebar navigation, search state updates, mobile displays)
2. Write property-based tests capturing those observed behavior patterns
3. Verify tests PASS on unfixed code
4. After fixes, verify tests still PASS (no regressions)

**Preservation Test Cases**:

1. **Sidebar Navigation Preservation**: Click each sidebar link and verify navigation to correct routes continues to work (observe on unfixed, test after fix)

2. **Search State Preservation**: Type in search field and verify state updates correctly (observe on unfixed, test after fix)

3. **Mobile Header Preservation**: View header on mobile viewport and verify search input appears below main header (observe on unfixed, test after fix)

4. **Alert Display Preservation**: View AlertasPage and verify alert cards, metrics, and ticker display correctly (observe on unfixed, test after fix)

5. **Alert Click Preservation**: Click alert in ticker and verify details modal opens correctly (observe on unfixed, test after fix)

6. **Sidebar Mobile Hidden Preservation**: View sidebar on small/medium screens and verify it stays hidden (observe on unfixed, test after fix)

### Unit Tests

- Test Header component renders search field with correct z-index layering
- Test MainLayout handleAddItem navigates to `/inventario`
- Test MainLayout handleReport navigates to `/relatorios`
- Test AlertTicker parent container has overflow-x: hidden
- Test Sidebar component has hover state management on large screens
- Test Sidebar component stays hidden on small/medium screens

### Property-Based Tests

- Generate random text inputs for search field and verify no visual overlap across all cases
- Generate random viewport sizes and verify sidebar behaves correctly (collapsed/expanded on large, hidden on small)
- Generate random navigation events and verify all existing routes continue to work
- Generate random alert data and verify no horizontal scroll occurs with any alert count

### Integration Tests

- Test full navigation flow: click "Adicionar Item" → arrives at inventario page → can navigate back
- Test full navigation flow: click "Relatório" → arrives at relatorios page → can navigate back
- Test AlertasPage full render with alerts → verify no horizontal scroll → click alert → modal opens
- Test Sidebar on large screen → hover → expands → unhover → collapses → click link → navigates
- Test responsive behavior across breakpoints: sidebar hidden on mobile, search displays correctly, buttons work
