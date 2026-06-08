# Implementation Plan: Frontend Architecture Refactor - Frente 1

## Overview

Este plano detalha as tarefas executáveis para reorganizar a estrutura de diretórios do frontend do EduStock, movendo 22 componentes de `src/components/` para uma arquitetura modular baseada em domínios de negócio. A estratégia segue movimentação incremental em lotes com validação após cada etapa crítica.

**Linguagem:** JavaScript/JSX (React 19)  
**Escopo:** Apenas reorganização física de arquivos (sem alteração de lógica interna)  
**Validação:** Build + testes automatizados após cada lote

---

## Tasks

- [x] 1. Preparação - Criar estrutura de diretórios
  - Criar diretórios: `components/ui/`, `features/{inventario,movimentacoes,fornecedores,alertas,relatorios,merenda}/`, `layouts/`, `hooks/`
  - Executar comandos na raiz de `frontend/src/`
  - _Requirements: 1.1_

- [x] 2. Validação inicial - Garantir estado limpo
  - Executar `npm run build` no diretório `frontend/`
  - Executar `npm test` no diretório `frontend/`
  - Confirmar que build e testes passam antes de iniciar migração
  - _Requirements: 1.5, 14.1, 14.2_

- [x] 3. Lote 1 - Mover componentes UI puros
  - [x] 3.1 Mover componentes para components/ui/
    - Mover `Modal.jsx`, `Toast.jsx`, `ConfirmDialog.jsx`, `Tabs.jsx` para `components/ui/`
    - Total: 4 arquivos
    - _Requirements: 1.2_
  
  - [x] 3.2 Atualizar imports em DashboardPage.jsx (UI components)
    - Substituir `from '../components/Modal'` por `from '../components/ui/Modal'`
    - Substituir `from '../components/Toast'` por `from '../components/ui/Toast'`
    - Substituir `from '../components/ConfirmDialog'` por `from '../components/ui/ConfirmDialog'`
    - Substituir `from '../components/Tabs'` por `from '../components/ui/Tabs'`
    - _Requirements: 1.4_
  
  - [x] 3.3 Atualizar imports internos de ConfirmDialog
    - Verificar se `components/ui/ConfirmDialog.jsx` importa `Modal` corretamente do mesmo diretório
    - Ajustar path relativo se necessário: `import Modal from './Modal'`
    - _Requirements: 1.4_

- [x] 4. Lote 2 - Mover componentes de layout
  - [x] 4.1 Mover componentes para layouts/
    - Mover `Header.jsx` e `Sidebar.jsx` para `layouts/`
    - Total: 2 arquivos
    - _Requirements: 1.3_
  
  - [x] 4.2 Atualizar imports em DashboardPage.jsx (layouts)
    - Substituir `from '../components/Header'` por `from '../layouts/Header'`
    - Substituir `from '../components/Sidebar'` por `from '../layouts/Sidebar'`
    - _Requirements: 1.4_

- [x] 5. Lote 3 - Mover feature Inventário
  - [x] 5.1 Mover componentes para features/inventario/
    - Mover `ProductCard.jsx`, `CategoryRail.jsx`, `ProductFormModal.jsx`, `DetailsModal.jsx` para `features/inventario/`
    - Total: 4 arquivos
    - _Requirements: 1.3_
  
  - [x] 5.2 Atualizar imports em DashboardPage.jsx (inventário)
    - Substituir `from '../components/ProductCard'` por `from '../features/inventario/ProductCard'`
    - Substituir `from '../components/CategoryRail'` por `from '../features/inventario/CategoryRail'`
    - Substituir `from '../components/ProductFormModal'` por `from '../features/inventario/ProductFormModal'`
    - Substituir `from '../components/DetailsModal'` por `from '../features/inventario/DetailsModal'`
    - _Requirements: 1.4_
  
  - [x] 5.3 Atualizar imports de Modal nos modais de inventário
    - Em `ProductFormModal.jsx` e `DetailsModal.jsx`, ajustar import de Modal
    - Substituir `from './Modal'` ou `from '../Modal'` por `from '../../components/ui/Modal'`
    - _Requirements: 1.4_

- [x] 6. Checkpoint 1 - Validação após migração de UI e Inventário
  - Executar `npm run build` no diretório `frontend/`
  - Build deve completar sem erros de import
  - Anotar quaisquer problemas encontrados
  - _Requirements: 1.5_

- [x] 7. Lote 4 - Mover feature Movimentações
  - [x] 7.1 Mover componentes para features/movimentacoes/
    - Mover `MovimentacoesView.jsx`, `EntradaFormModal.jsx`, `SaidaFormModal.jsx` para `features/movimentacoes/`
    - Total: 3 arquivos
    - _Requirements: 1.3_
  
  - [x] 7.2 Atualizar imports em DashboardPage.jsx (movimentações)
    - Substituir `from '../components/MovimentacoesView'` por `from '../features/movimentacoes/MovimentacoesView'`
    - Substituir `from '../components/EntradaFormModal'` por `from '../features/movimentacoes/EntradaFormModal'`
    - Substituir `from '../components/SaidaFormModal'` por `from '../features/movimentacoes/SaidaFormModal'`
    - _Requirements: 1.4_
  
  - [x] 7.3 Atualizar imports de Modal nos modais de movimentações
    - Em `EntradaFormModal.jsx` e `SaidaFormModal.jsx`, ajustar import de Modal
    - Substituir `from './Modal'` ou `from '../Modal'` por `from '../../components/ui/Modal'`
    - _Requirements: 1.4_

- [x] 8. Lote 5 - Mover feature Fornecedores
  - [x] 8.1 Mover componentes para features/fornecedores/
    - Mover `FornecedoresView.jsx` e `FornecedorFormModal.jsx` para `features/fornecedores/`
    - Total: 2 arquivos
    - _Requirements: 1.3_
  
  - [x] 8.2 Atualizar imports em DashboardPage.jsx (fornecedores)
    - Substituir `from '../components/FornecedoresView'` por `from '../features/fornecedores/FornecedoresView'`
    - Substituir `from '../components/FornecedorFormModal'` por `from '../features/fornecedores/FornecedorFormModal'`
    - _Requirements: 1.4_
  
  - [x] 8.3 Atualizar imports de Modal em FornecedorFormModal
    - Em `FornecedorFormModal.jsx`, ajustar import de Modal
    - Substituir `from './Modal'` ou `from '../Modal'` por `from '../../components/ui/Modal'`
    - _Requirements: 1.4_

- [x] 9. Lote 6 - Mover feature Alertas
  - [x] 9.1 Mover componentes para features/alertas/
    - Mover `AlertasView.jsx` e `AlertTicker.jsx` para `features/alertas/`
    - Total: 2 arquivos
    - _Requirements: 1.3_
  
  - [x] 9.2 Atualizar imports em DashboardPage.jsx (alertas)
    - Substituir `from '../components/AlertasView'` por `from '../features/alertas/AlertasView'`
    - Substituir `from '../components/AlertTicker'` por `from '../features/alertas/AlertTicker'`
    - _Requirements: 1.4_

- [x] 10. Lote 7 - Mover feature Relatórios
  - [x] 10.1 Mover componente para features/relatorios/
    - Mover `RelatoriosView.jsx` para `features/relatorios/`
    - Total: 1 arquivo
    - _Requirements: 1.3_
  
  - [x] 10.2 Atualizar imports em DashboardPage.jsx (relatórios)
    - Substituir `from '../components/RelatoriosView'` por `from '../features/relatorios/RelatoriosView'`
    - _Requirements: 1.4_

- [ ] 11. Lote 8 - Mover feature Merenda
  - [x] 11.1 Mover componentes para features/merenda/
    - Mover `ContagemView.jsx`, `ContagemWidget.jsx`, `KitchenPanel.jsx`, `KitchenProductionView.jsx` para `features/merenda/`
    - Total: 4 arquivos
    - _Requirements: 1.3_
  
  - [x] 11.2 Atualizar imports em DashboardPage.jsx (merenda)
    - Substituir `from '../components/ContagemView'` por `from '../features/merenda/ContagemView'`
    - Substituir `from '../components/ContagemWidget'` por `from '../features/merenda/ContagemWidget'`
    - Substituir `from '../components/KitchenPanel'` por `from '../features/merenda/KitchenPanel'`
    - Substituir `from '../components/KitchenProductionView'` por `from '../features/merenda/KitchenProductionView'`
    - _Requirements: 1.4_

- [x] 12. Checkpoint 2 - Validação completa de build
  - Executar `npm run build` no diretório `frontend/`
  - Build deve completar 100% sem erros ou warnings de import
  - Confirmar que diretório `components/` original está vazio (exceto `ui/`)
  - _Requirements: 1.5_

- [x] 13. Verificar e corrigir imports de useToast em features
  - Buscar por imports de `useToast` em todos os arquivos de `features/`
  - Atualizar paths para apontar corretamente para `../../components/ui/Toast`
  - Exemplo: `import { useToast } from '../../components/ui/Toast'`
  - _Requirements: 1.4_

- [x] 14. Validação de testes automatizados
  - Executar `npm test` no diretório `frontend/`
  - Todos os testes devem passar (100%)
  - Executar `python manage.py test` na raiz do projeto
  - Testes de backend devem permanecer passando
  - _Requirements: 14.1, 14.2, 14.3_

- [x] 15. Validação manual de funcionalidades
  - Iniciar dev server: `npm run dev` no diretório `frontend/`
  - Verificar console do navegador (sem erros de import)
  - Testar abertura de modais: ProductFormModal, DetailsModal, EntradaFormModal, SaidaFormModal, FornecedorFormModal
  - Testar sistema de Toast (criar produto, editar, etc.)
  - Testar renderização de todas as views: Inventário, Movimentações, Alertas, Fornecedores, Relatórios, Merenda
  - _Requirements: 1.5_

- [x] 16. Limpeza e finalização
  - Verificar que diretório `components/` contém apenas subdiretório `ui/`
  - Verificar que todos os 22 componentes foram movidos corretamente
  - Confirmar estrutura final: `components/ui/` (4), `layouts/` (2), `features/inventario/` (4), `features/movimentacoes/` (3), `features/fornecedores/` (2), `features/alertas/` (2), `features/relatorios/` (1), `features/merenda/` (4)
  - _Requirements: 1.1, 1.3_

- [x] 17. Checkpoint Final - Confirmação completa
  - Build passa: `npm run build` ✓
  - Testes passam: `npm test` ✓
  - Backend intacto: `python manage.py test` ✓
  - Dev server funcional sem erros de console
  - Todas as funcionalidades testadas manualmente
  - Estrutura de diretórios conforme design
  - _Requirements: 1.5, 14.1, 14.2, 14.4_

---

## Notes

### Estratégia de Execução

- **Movimentação física primeiro, ajuste de imports depois**: Cada lote move arquivos e imediatamente atualiza os imports relacionados
- **Validação incremental**: Checkpoints após lotes críticos (UI + Inventário, Final)
- **Sem alteração de código interno**: Nenhum componente tem sua lógica modificada
- **Preservação de dependências**: Apps `app-alunos/` e `app-cozinha/` não são tocados

### Dependências entre Tasks

- Tasks 3-11: Devem ser executadas em ordem sequencial (cada lote depende da estrutura criada)
- Checkpoints 6, 12, 17: Validam blocos de trabalho completos
- Task 13: Pode ser executada após task 11 (quando todos os componentes estiverem movidos)
- Tasks 14-15: Validação final, executadas após todos os lotes

### Comandos Úteis

```bash
# Criar estrutura de diretórios (Task 1)
cd frontend/src
mkdir -p components/ui features/inventario features/movimentacoes features/fornecedores features/alertas features/relatorios features/merenda layouts hooks

# Exemplo de movimentação (Task 3.1)
mv components/Modal.jsx components/ui/
mv components/Toast.jsx components/ui/
mv components/ConfirmDialog.jsx components/ui/
mv components/Tabs.jsx components/ui/

# Build e testes
cd frontend
npm run build
npm test

# Testes backend
cd ..
python manage.py test
```

### Critérios de Aceitação

- ✅ 22 componentes movidos para estrutura modular
- ✅ Nenhum erro de import no build
- ✅ 100% dos testes passando (frontend e backend)
- ✅ Dev server funcional sem erros de console
- ✅ Todas as funcionalidades preservadas

### Arquivos Principais Afetados

- **DashboardPage.jsx**: Requer atualização de ~22 imports
- **Modais de features**: Requerem atualização de import de Modal (path relativo)
- **Componentes que usam Toast**: Requerem atualização de import de useToast

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.2"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["6"] },
    { "id": 7, "tasks": ["7.1", "8.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "8.2", "8.3"] },
    { "id": 9, "tasks": ["9.1", "10.1", "11.1"] },
    { "id": 10, "tasks": ["9.2", "10.2", "11.2"] },
    { "id": 11, "tasks": ["12"] },
    { "id": 12, "tasks": ["13"] },
    { "id": 13, "tasks": ["14"] },
    { "id": 14, "tasks": ["15"] },
    { "id": 15, "tasks": ["16"] },
    { "id": 16, "tasks": ["17"] }
  ]
}
```


---

# Implementation Plan: Frontend Architecture Refactor - Frente 2

## Overview

Este plano detalha as tarefas executáveis para implementar navegação baseada em React Router DOM, substituindo a navegação por abas do DashboardPage. A estratégia segue criação incremental: hook → layout → rotas → sidebar → páginas finas.

**Linguagem:** JavaScript/JSX (React 19)  
**Escopo:** React Router + Sidebar funcional + Hook reutilizável + Páginas finas  
**Validação:** Build + testes + navegação funcional

**Pré-requisito:** Frente 1 concluída ✅

---

## Tasks - Frente 2

- [ ] 18. Criar hook useDashboardData
  - Criar arquivo `hooks/useDashboardData.js`
  - Extrair lógica de fetch do DashboardPage (Promise.all de 6 endpoints)
  - Implementar debounce de busca (300ms)
  - Implementar useMemo para cálculos (counts, visiveis, alerts, resumo)
  - Retornar interface completa: produtos, categorias, grupos, fornecedores, movimentacoes, alertas, loading, search, setSearch, carregar, counts, visiveis, alerts, resumo
  - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 19. Validar hook useDashboardData
  - Executar `npm run build` para verificar sintaxe
  - Criar teste unitário básico (opcional)
  - Verificar que hook exporta interface esperada
  - _Requirements: 4.1_

- [ ] 20. Criar MainLayout
  - Criar arquivo `layouts/MainLayout.jsx`
  - Implementar estrutura: ToastProvider > div > Sidebar + div > Header + main > Outlet
  - Importar Sidebar, Header, ToastProvider, Outlet
  - Aplicar classes Tailwind para layout flex
  - _Requirements: 2.3_

- [ ] 21. Configurar rotas em main.jsx
  - [ ] 21.1 Atualizar imports em main.jsx
    - Importar BrowserRouter, Routes, Route, Navigate de react-router-dom
    - Importar MainLayout
    - Importar 6 páginas (a serem criadas): InventarioPage, MovimentacoesPage, AlertasPage, FornecedoresPage, RelatoriosPage, MerendaPage
    - _Requirements: 2.1_
  
  - [ ] 21.2 Configurar estrutura de rotas
    - Envolver com BrowserRouter
    - Criar Route raiz com element={<MainLayout />}
    - Adicionar Route index com Navigate to="/inventario" replace
    - Adicionar 6 Routes filhas: inventario, movimentacoes, alertas, fornecedores, relatorios, merenda
    - _Requirements: 2.2, 2.4_

- [ ] 22. Refatorar Sidebar para navegação real
  - [ ] 22.1 Atualizar imports de Sidebar
    - Importar NavLink de react-router-dom
    - Importar Icon de ../lib/icons
    - _Requirements: 3.1_
  
  - [ ] 22.2 Implementar estrutura de navegação
    - Definir array navItems com 8 itens (to, label, icon, section)
    - Organizar em 3 seções: Operacional, Gestão, Sistema
    - Renderizar seções com títulos
    - _Requirements: 3.2_
  
  - [ ] 22.3 Implementar NavLink funcional
    - Usar NavLink com prop to para cada item
    - Implementar className como função ({ isActive }) => ...
    - Aplicar estilo ativo: bg-brand text-[#f4f1e7]
    - Aplicar estilo inativo: text-neutral-600 hover:bg-neutral-100
    - _Requirements: 3.1, 3.5_
  
  - [ ] 22.4 Implementar responsividade
    - Aplicar classe w-56 para desktop (≥1024px)
    - Aplicar classe w-16 para mobile (<1024px)
    - Esconder labels em mobile: hidden lg:inline
    - _Requirements: 3.3, 3.4_

- [ ] 23. Checkpoint 1 - Validar estrutura básica
  - Executar `npm run build`
  - Executar `npm run dev`
  - Acessar http://localhost:5173
  - Verificar redirecionamento para /inventario
  - Verificar que Sidebar e Header renderizam
  - Verificar que Outlet está vazio (páginas não criadas ainda)
  - _Requirements: 2.1, 2.4_

- [ ] 24. Criar InventarioPage
  - [ ] 24.1 Criar arquivo pages/InventarioPage.jsx
    - Importar useDashboardData
    - Importar componentes: CategoryRail, ProductCard, ProductFormModal, DetailsModal
    - _Requirements: 5.1_
  
  - [ ] 24.2 Implementar lógica da página
    - Consumir useDashboardData (visiveis, categorias, grupos, fornecedores, loading, carregar)
    - Implementar useState para modais e categoria ativa
    - Implementar filtro por categoria
    - Implementar loading state
    - _Requirements: 5.2, 5.3_
  
  - [ ] 24.3 Implementar renderização
    - Renderizar título + botão "Adicionar Item"
    - Renderizar CategoryRail
    - Renderizar grid de ProductCard
    - Renderizar modais condicionalmente
    - _Requirements: 5.1_
  
  - [ ] 24.4 Validar tamanho da página
    - Verificar que arquivo tem ≤60 linhas
    - Se > 60 linhas, refatorar extraindo sub-componentes
    - _Requirements: 5.2_

- [ ] 25. Criar MovimentacoesPage
  - Criar arquivo `pages/MovimentacoesPage.jsx`
  - Consumir useDashboardData (movimentacoes, produtos, loading, carregar)
  - Implementar useState para modais (entrada, saída)
  - Renderizar MovimentacoesView
  - Renderizar botões "Registrar Entrada" e "Registrar Saída"
  - Renderizar EntradaFormModal e SaidaFormModal condicionalmente
  - Validar ≤60 linhas
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 26. Criar AlertasPage
  - Criar arquivo `pages/AlertasPage.jsx`
  - Consumir useDashboardData (alertas, alerts, loading, carregar)
  - Renderizar AlertasView
  - Renderizar AlertTicker
  - Validar ≤60 linhas
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 27. Criar FornecedoresPage
  - Criar arquivo `pages/FornecedoresPage.jsx`
  - Consumir useDashboardData (fornecedores, loading, carregar)
  - Implementar useState para modal
  - Renderizar FornecedoresView
  - Renderizar botão "Adicionar Fornecedor"
  - Renderizar FornecedorFormModal condicionalmente
  - Validar ≤60 linhas
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 28. Criar RelatoriosPage
  - Criar arquivo `pages/RelatoriosPage.jsx`
  - Consumir useDashboardData (produtos, movimentacoes, fornecedores, loading)
  - Renderizar RelatoriosView
  - Validar ≤60 linhas
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 29. Criar MerendaPage
  - Criar arquivo `pages/MerendaPage.jsx`
  - Consumir useDashboardData (produtos, loading, carregar)
  - Filtrar produtos por categoria merenda
  - Renderizar ContagemView, ContagemWidget, KitchenPanel, KitchenProductionView
  - Validar ≤60 linhas
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 30. Checkpoint 2 - Validar navegação e páginas
  - Executar `npm run build`
  - Executar `npm run dev`
  - Acessar cada rota manualmente: /inventario, /movimentacoes, /alertas, /fornecedores, /relatorios, /merenda
  - Verificar que cada página renderiza conteúdo esperado
  - Clicar em itens da Sidebar e verificar navegação
  - Verificar que NavLink aplica estilo ativo corretamente
  - _Requirements: 2.1, 2.2, 3.5, 5.1_

- [ ] 31. Testar busca e debounce
  - Acessar /inventario
  - Digitar termo de busca no Header
  - Verificar que resultados filtrados aparecem após 300ms
  - Digitar rapidamente vários termos
  - Verificar que apenas última busca é executada (debounce funciona)
  - _Requirements: 4.3_

- [ ] 32. Testar modais em páginas
  - [ ] 32.1 Testar modais de InventarioPage
    - Clicar em "Adicionar Item" → ProductFormModal abre
    - Clicar em ProductCard → DetailsModal abre
    - _Requirements: 5.1_
  
  - [ ] 32.2 Testar modais de MovimentacoesPage
    - Clicar em "Registrar Entrada" → EntradaFormModal abre
    - Clicar em "Registrar Saída" → SaidaFormModal abre
    - _Requirements: 5.1_
  
  - [ ] 32.3 Testar modal de FornecedoresPage
    - Clicar em "Adicionar Fornecedor" → FornecedorFormModal abre
    - _Requirements: 5.1_

- [ ] 33. Validar responsividade da Sidebar
  - Abrir dev server em desktop (≥1024px)
  - Verificar que Sidebar tem largura w-56 (14rem)
  - Verificar que labels estão visíveis
  - Redimensionar para mobile (<1024px)
  - Verificar que Sidebar tem largura w-16 (4rem)
  - Verificar que labels estão escondidas (apenas ícones)
  - _Requirements: 3.3, 3.4_

- [ ] 34. Deletar DashboardPage.jsx
  - **ATENÇÃO**: Executar SOMENTE após validação completa das tasks 18-33
  - Verificar checklist pré-remoção:
    - [ ] 6 páginas criadas e testadas
    - [ ] useDashboardData validado
    - [ ] Navegação funcional em todas as rotas
    - [ ] Modais funcionando
    - [ ] Busca funcionando
    - [ ] Nenhuma funcionalidade perdida
  - Deletar arquivo `frontend/src/pages/DashboardPage.jsx`
  - Verificar que nenhum arquivo importa DashboardPage (grep search)
  - _Requirements: 5.4_

- [ ] 35. Checkpoint 3 - Validação completa de build
  - Executar `npm run build`
  - Build deve completar 100% sem erros ou warnings de import
  - Verificar bundle size (não deve aumentar significativamente)
  - _Requirements: 14.1_

- [ ] 36. Validação de testes automatizados
  - Executar `npm test` no diretório `frontend/`
  - Todos os testes devem passar (100%)
  - Executar `python manage.py test` na raiz do projeto
  - Testes de backend devem permanecer passando
  - _Requirements: 14.1, 14.2_

- [ ] 37. Validação manual completa
  - Iniciar dev server: `npm run dev`
  - Testar fluxo completo:
    - [ ] URL "/" redireciona para "/inventario"
    - [ ] Navegação via Sidebar funciona (todas as 6 rotas)
    - [ ] Navegação via URL direta funciona
    - [ ] Botão voltar do navegador funciona
    - [ ] Estado ativo do NavLink está correto
    - [ ] Busca funciona com debounce em InventarioPage
    - [ ] Todos os modais abrem e fecham corretamente
    - [ ] Dados carregam em todas as páginas
    - [ ] Loading state exibido durante fetch
    - [ ] Responsividade da Sidebar funciona (desktop + mobile)
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.3, 3.4, 3.5, 4.3, 5.1_

- [ ] 38. Checkpoint Final - Confirmação completa Frente 2
  - Verificar entregáveis:
    - [ ] useDashboardData.js criado e funcional
    - [ ] MainLayout.jsx criado
    - [ ] main.jsx configurado com rotas
    - [ ] Sidebar.jsx refatorado com NavLink
    - [ ] 6 páginas criadas (≤60 linhas cada)
    - [ ] DashboardPage.jsx deletado
  - Verificar critérios de aceitação:
    - [ ] Build passa: `npm run build` ✓
    - [ ] Testes passam: `npm test` ✓
    - [ ] Backend intacto: `python manage.py test` ✓
    - [ ] Dev server funcional sem erros de console
    - [ ] Navegação funcional em todas as rotas
    - [ ] Tabs.jsx removido da navegação principal
    - [ ] Apps app-alunos/ e app-cozinha/ não afetados
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 14.1, 14.2_

---

## Notes - Frente 2

### Estratégia de Execução

- **Ordem rigorosa**: Tasks devem ser executadas sequencialmente (18 → 38)
- **Validação incremental**: Checkpoints após criação de estrutura (23), páginas (30) e final (38)
- **Não pular task 34**: DashboardPage só deve ser deletado após validação completa
- **Preservação de componentes**: Componentes de features/ (já movidos na Frente 1) não são alterados

### Dependências entre Tasks

- Tasks 18-20: Podem ser executadas em paralelo (hook, layout)
- Task 21: Depende de task 20 (MainLayout)
- Task 22: Depende de task 21 (rotas configuradas)
- Tasks 24-29: Podem ser executadas em paralelo APÓS task 22 (páginas independentes)
- Task 34: Depende de tasks 18-33 completas e validadas

### Comandos Úteis

```bash
# Criar arquivos (PowerShell)
New-Item -ItemType File -Path frontend/src/hooks/useDashboardData.js
New-Item -ItemType File -Path frontend/src/layouts/MainLayout.jsx
New-Item -ItemType File -Path frontend/src/pages/InventarioPage.jsx
New-Item -ItemType File -Path frontend/src/pages/MovimentacoesPage.jsx
New-Item -ItemType File -Path frontend/src/pages/AlertasPage.jsx
New-Item -ItemType File -Path frontend/src/pages/FornecedoresPage.jsx
New-Item -ItemType File -Path frontend/src/pages/RelatoriosPage.jsx
New-Item -ItemType File -Path frontend/src/pages/MerendaPage.jsx

# Build e testes
cd frontend
npm run build
npm test

# Testes backend
cd ..
python manage.py test

# Dev server
cd frontend
npm run dev

# Deletar DashboardPage (SOMENTE após validação completa)
Remove-Item frontend/src/pages/DashboardPage.jsx

# Buscar referências a DashboardPage (antes de deletar)
cd frontend/src
Select-String -Pattern "DashboardPage" -Recurse
```

### Critérios de Aceitação

- ✅ Hook useDashboardData retorna interface completa
- ✅ MainLayout renderiza Sidebar + Header + Outlet
- ✅ Rotas configuradas e funcionais (8 rotas)
- ✅ Sidebar com NavLink funcional e estilo ativo
- ✅ 6 páginas finas criadas (≤60 linhas cada)
- ✅ DashboardPage.jsx deletado
- ✅ Navegação funcional via Sidebar e URL
- ✅ Busca com debounce de 300ms funciona
- ✅ Todos os modais funcionam nas páginas
- ✅ Responsividade da Sidebar (w-56 desktop, w-16 mobile)
- ✅ Build e testes passando (100%)

### Arquivos Criados na Frente 2

```
frontend/src/
├── hooks/
│   └── useDashboardData.js        [NOVO]
├── layouts/
│   ├── MainLayout.jsx             [NOVO]
│   ├── Header.jsx                 [MANTIDO - já movido na Frente 1]
│   └── Sidebar.jsx                [REFATORADO]
├── pages/
│   ├── InventarioPage.jsx         [NOVO]
│   ├── MovimentacoesPage.jsx      [NOVO]
│   ├── AlertasPage.jsx            [NOVO]
│   ├── FornecedoresPage.jsx       [NOVO]
│   ├── RelatoriosPage.jsx         [NOVO]
│   ├── MerendaPage.jsx            [NOVO]
│   └── DashboardPage.jsx          [DELETADO]
└── main.jsx                        [REFATORADO]
```

### Arquivos Refatorados na Frente 2

- **main.jsx**: Adicionar BrowserRouter e rotas
- **Sidebar.jsx**: Substituir botões por NavLink
- **Header.jsx**: Nenhuma mudança (será refatorado na Frente 3)

### Componentes Reutilizados (sem alteração)

Componentes já existentes em features/ (movidos na Frente 1):
- features/inventario/: ProductCard, CategoryRail, ProductFormModal, DetailsModal
- features/movimentacoes/: MovimentacoesView, EntradaFormModal, SaidaFormModal
- features/fornecedores/: FornecedoresView, FornecedorFormModal
- features/alertas/: AlertasView, AlertTicker
- features/relatorios/: RelatoriosView
- features/merenda/: ContagemView, ContagemWidget, KitchenPanel, KitchenProductionView

## Task Dependency Graph - Frente 2

```json
{
  "waves": [
    { "id": 0, "tasks": ["18", "20"] },
    { "id": 1, "tasks": ["19"] },
    { "id": 2, "tasks": ["21.1"] },
    { "id": 3, "tasks": ["21.2"] },
    { "id": 4, "tasks": ["22.1", "22.2"] },
    { "id": 5, "tasks": ["22.3", "22.4"] },
    { "id": 6, "tasks": ["23"] },
    { "id": 7, "tasks": ["24.1", "24.2", "24.3"] },
    { "id": 8, "tasks": ["24.4"] },
    { "id": 9, "tasks": ["25", "26", "27", "28", "29"] },
    { "id": 10, "tasks": ["30"] },
    { "id": 11, "tasks": ["31", "32.1", "32.2", "32.3", "33"] },
    { "id": 12, "tasks": ["34"] },
    { "id": 13, "tasks": ["35"] },
    { "id": 14, "tasks": ["36"] },
    { "id": 15, "tasks": ["37"] },
    { "id": 16, "tasks": ["38"] }
  ]
}
```

---

**Status da Frente 2:** Tarefas especificadas e prontas para execução  
**Total de tasks Frente 2:** 21 tasks principais (38 sub-tasks contando decomposições)  
**Estimativa de tempo:** 3-5 horas
