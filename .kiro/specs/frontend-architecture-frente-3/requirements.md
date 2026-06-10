# Requirements Document

## Introduction

This document specifies the requirements for Frente 3 of the EduStock frontend refactoring. This phase focuses on simplifying the ProductCard component, expanding the DetailsModal with action controls, and adding user profile and configuration pages. The changes improve user experience by consolidating actions into contextual locations and providing personalized configuration options.

## Glossary

- **ProductCard**: React component that displays a product summary in a grid layout
- **DetailsModal**: React modal component that shows detailed information about a selected product
- **Header**: Top navigation bar component containing branding, search, and user avatar
- **PerfilPage**: User profile page displaying read-only user information and session controls
- **ConfiguracoesPage**: Settings page for managing application preferences
- **LocalStorage**: Browser-based persistent storage mechanism for user preferences
- **Mock_Mode**: Development mode using mock data instead of real API calls
- **Card_Density**: Visual density setting for ProductCard display (confortável/compacto/denso)
- **Router**: React Router DOM v7 navigation system
- **Environment_Variables**: Configuration values from .env file (VITE_USER_NAME, VITE_USER_EMAIL)

## Requirements

### Requirement 1: Simplified ProductCard Component

**User Story:** As a user, I want ProductCard to focus on viewing product information, so that the interface is cleaner and actions are contextual.

#### Acceptance Criteria

1. THE ProductCard SHALL remove the "Adicionar" and "Retirar" action buttons from its layout
2. THE ProductCard SHALL retain the "Ver detalhes" button for opening the DetailsModal
3. THE ProductCard SHALL maintain all existing visual elements (thumbnail, category, quantity, meter, tags, NF number)
4. THE ProductCard SHALL preserve motion animations and transition effects
5. THE ProductCard SHALL no longer accept onAdd and onRemove callback props

### Requirement 2: Expanded DetailsModal Component

**User Story:** As a user, I want to perform actions on products from the details modal, so that I can view complete information and take actions in the same context.

#### Acceptance Criteria

1. THE DetailsModal SHALL display four action buttons: "Adicionar", "Retirar", "Editar", and "Excluir"
2. WHEN the "Adicionar" button is clicked, THE DetailsModal SHALL invoke the onAdd callback with the product
3. WHEN the "Retirar" button is clicked, THE DetailsModal SHALL invoke the onRemove callback with the product
4. WHEN the "Retirar" button is displayed AND product quantity is zero or less, THE DetailsModal SHALL disable the button
5. THE DetailsModal SHALL accept new callback props: onAdd and onRemove
6. THE DetailsModal SHALL maintain existing onEdit and onDelete callbacks
7. THE DetailsModal SHALL display buttons in a horizontal layout with proper spacing and styling
8. THE DetailsModal SHALL apply the same color scheme to "Retirar" button as previously used in ProductCard (out color)

### Requirement 3: PerfilPage Implementation

**User Story:** As a user, I want to view my profile information and manage my session, so that I can verify my identity and log out when needed.

#### Acceptance Criteria

1. THE PerfilPage SHALL be accessible at the route "/perfil"
2. THE PerfilPage SHALL display a circular avatar with the first letter of the user's name
3. THE PerfilPage SHALL display the user's name from environment variable VITE_USER_NAME in read-only format
4. THE PerfilPage SHALL display the user's email from environment variable VITE_USER_EMAIL in read-only format
5. WHEN VITE_USER_NAME or VITE_USER_EMAIL are not defined, THE PerfilPage SHALL display "Usuário Dev" and "dev@edustock.local" as defaults
6. THE PerfilPage SHALL display a badge labeled "Modo Desenvolvimento" with visual distinction
7. THE PerfilPage SHALL provide a "Sair" (logout) button
8. WHEN the "Sair" button is clicked, THE PerfilPage SHALL clear any session data from LocalStorage
9. WHEN the "Sair" button is clicked, THE PerfilPage SHALL navigate to the "/inventario" route
10. THE PerfilPage SHALL use consistent styling with existing design tokens and Tailwind CSS v4

### Requirement 4: ConfiguracoesPage Implementation

**User Story:** As a user, I want to configure application preferences, so that I can customize my experience and control data sources.

#### Acceptance Criteria

1. THE ConfiguracoesPage SHALL be accessible at the route "/configuracoes"
2. THE ConfiguracoesPage SHALL display a toggle control labeled "Usar dados mock" for switching between mock and real data
3. WHEN the mock toggle is changed, THE ConfiguracoesPage SHALL persist the value to LocalStorage with key "edustock:config"
4. WHEN the mock toggle is changed, THE ConfiguracoesPage SHALL trigger a page reload to apply the new data source
5. THE ConfiguracoesPage SHALL display a numeric input field labeled "Prazo de alerta de validade (dias)" with default value 30
6. THE ConfiguracoesPage SHALL validate that the validity alert threshold is a positive integer
7. WHEN the validity alert threshold is changed, THE ConfiguracoesPage SHALL persist the value to LocalStorage with key "edustock:config"
8. THE ConfiguracoesPage SHALL display three chip-style options for card density: "Confortável", "Compacto", and "Denso"
9. WHEN a card density chip is selected, THE ConfiguracoesPage SHALL persist the value to LocalStorage with key "edustock:config"
10. THE ConfiguracoesPage SHALL load existing preferences from LocalStorage on mount
11. THE ConfiguracoesPage SHALL use consistent styling with existing design tokens and Tailwind CSS v4
12. THE ConfiguracoesPage SHALL store all settings in a single JSON object under "edustock:config" key

### Requirement 5: Header Navigation Enhancement

**User Story:** As a user, I want to access my profile from the header, so that I can quickly navigate to profile settings.

#### Acceptance Criteria

1. THE Header SHALL replace the hardcoded user avatar section with a clickable button
2. WHEN the avatar button is clicked, THE Header SHALL navigate to "/perfil" route using React Router
3. THE Header SHALL maintain the existing avatar visual design (circular badge with initial, name, and role)
4. THE Header SHALL display hover state on the avatar button to indicate interactivity
5. THE Header SHALL preserve all other existing header functionality (search, add item, report buttons)

### Requirement 6: Router Configuration

**User Story:** As a developer, I want proper routing for new pages, so that users can navigate to profile and settings.

#### Acceptance Criteria

1. THE Router SHALL register "/perfil" route that renders PerfilPage component
2. THE Router SHALL register "/configuracoes" route that renders ConfiguracoesPage component
3. THE Router SHALL include both routes within the MainLayout wrapper for consistent header and sidebar
4. THE Router SHALL preserve all existing routes (inventario, movimentacoes, alertas, fornecedores, relatorios, merenda)

### Requirement 7: LocalStorage Configuration Schema

**User Story:** As a developer, I want a consistent configuration storage format, so that settings are reliably persisted and retrieved.

#### Acceptance Criteria

1. THE Application SHALL store configuration in LocalStorage under the key "edustock:config"
2. THE Configuration SHALL be stored as a JSON object with the following structure:
   ```
   {
     "useMock": boolean,
     "validityAlertDays": number,
     "cardDensity": "confortavel" | "compacto" | "denso"
   }
   ```
3. WHEN reading configuration AND the key does not exist, THE Application SHALL use default values: useMock=false, validityAlertDays=30, cardDensity="confortavel"
4. WHEN writing configuration, THE Application SHALL merge new values with existing configuration object
5. THE Application SHALL validate that stored JSON is parseable before using stored configuration

### Requirement 8: Test Preservation

**User Story:** As a developer, I want existing tests to pass after refactoring, so that I can verify no regressions were introduced.

#### Acceptance Criteria

1. THE Refactoring SHALL NOT break existing test suites
2. WHEN tests are executed with "npm run test", THE Application SHALL pass all existing tests
3. THE InventarioPage SHALL update prop passing to ProductCard (removing onAdd and onRemove)
4. THE InventarioPage SHALL update prop passing to DetailsModal (adding onAdd and onRemove)

### Requirement 9: Sidebar Navigation Extension

**User Story:** As a user, I want to access profile and settings from the sidebar, so that I can navigate to these pages from any location.

#### Acceptance Criteria

1. THE Sidebar SHALL add a navigation link to "/perfil" labeled "Perfil" with an appropriate icon
2. THE Sidebar SHALL add a navigation link to "/configuracoes" labeled "Configurações" with an appropriate icon
3. THE Sidebar SHALL highlight the active route for "/perfil" and "/configuracoes" links
4. THE Sidebar SHALL maintain existing navigation links and styling patterns
5. THE Sidebar SHALL position profile and settings links in a logical location (e.g., at the bottom or in a settings section)

### Requirement 10: No New Dependencies

**User Story:** As a developer, I want to implement features using existing dependencies, so that the bundle size and complexity remain controlled.

#### Acceptance Criteria

1. THE Implementation SHALL use only dependencies already present in package.json
2. THE Implementation SHALL NOT add any new npm packages
3. THE Implementation SHALL use React 19, Vite, Tailwind CSS v4, React Router DOM v7, and Motion as existing tools
