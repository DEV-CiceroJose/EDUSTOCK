# Bugfix Requirements Document

## Introduction

This document addresses five distinct UI bugs in the EduStock frontend that affect the main layout and navigation experience:

1. **Search icon overlapping text** - Visual z-index issue in Header.jsx
2. **"Adicionar Item" button doesn't work** - Empty handler with no navigation
3. **"Relatório" button doesn't work** - Empty handler with no navigation
4. **Alertas page has horizontal scroll** - Layout overflow caused by marquee animation
5. **Sidebar not collapsible with hover** - Fixed responsive width instead of hover-expand behavior

These bugs impact user experience by preventing essential navigation actions and causing layout issues.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user types text into the search input field in Header.jsx THEN the search icon may visually overlap with the input text

1.2 WHEN a user clicks the "Adicionar Item" button in the header THEN nothing happens (empty `handleAddItem()` function in MainLayout.jsx)

1.3 WHEN a user clicks the "Relatório" button in the header THEN nothing happens (empty `handleReport()` function in MainLayout.jsx)

1.4 WHEN a user navigates to the AlertasPage THEN the page displays a horizontal scrollbar due to the AlertTicker's marquee animation extending beyond the viewport width

1.5 WHEN a user views the sidebar on a large screen (lg breakpoint) THEN the sidebar is always at full width (w-56) with no hover-expand behavior

### Expected Behavior (Correct)

2.1 WHEN a user types text into the search input field THEN the system SHALL ensure the search icon never overlaps with the text by applying proper z-index layering

2.2 WHEN a user clicks the "Adicionar Item" button THEN the system SHALL navigate to the `/inventario` page using React Router navigation

2.3 WHEN a user clicks the "Relatório" button THEN the system SHALL navigate to the `/relatorios` page using React Router navigation

2.4 WHEN a user navigates to the AlertasPage THEN the system SHALL contain the AlertTicker marquee animation within the viewport width with `overflow-x: hidden` preventing horizontal scroll

2.5 WHEN a user views the sidebar THEN the system SHALL display it collapsed (w-16, icon-only) by default and SHALL expand to full width (w-56) when the user hovers over it, with smooth transitions

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user types in the search input field THEN the system SHALL CONTINUE TO update the search state and display the typed text correctly

3.2 WHEN a user clicks navigation links in the sidebar THEN the system SHALL CONTINUE TO navigate to the correct pages as before

3.3 WHEN a user views the header on mobile devices THEN the system SHALL CONTINUE TO display the mobile search input correctly below the main header

3.4 WHEN a user views alerts on the AlertasPage THEN the system SHALL CONTINUE TO display alert cards and summary metrics correctly without layout changes

3.5 WHEN a user interacts with the alert ticker THEN the system SHALL CONTINUE TO display scrolling alerts and allow clicking on alerts with product IDs

3.6 WHEN a user views the sidebar on small/medium screens (below lg breakpoint) THEN the system SHALL CONTINUE TO hide the sidebar as currently implemented
