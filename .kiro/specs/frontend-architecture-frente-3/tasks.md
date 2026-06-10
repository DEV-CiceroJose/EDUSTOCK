# Implementation Plan: Frontend Architecture Refactor - Frente 3

## Overview

Este plano detalha as tarefas executáveis para implementar a Frente 3: simplificação do ProductCard, expansão do DetailsModal, criação das páginas de Perfil e Configurações, e melhorias de espaçamento/legibilidade.

**Linguagem:** JavaScript/JSX (React 19)  
**Escopo:** ProductCard simplificado + DetailsModal expandido + Perfil + Configurações + Melhorias de CSS  
**Validação:** Build + testes + validação visual

**Pré-requisito:** Frente 1 e 2 concluídas ✅

---

## Tasks - Frente 3

- [x] 1. Melhorias de Espaçamento Global
  - Adicionar padding adequado em todas as páginas
  - Aumentar espaçamento entre elementos (mb-4, mb-6, gap-4, gap-6)
  - Melhorar padding interno de cards e containers
  - Aplicar max-width para melhor legibilidade de texto
  - _Requirements: User feedback - legibilidade_

- [x] 2. Simplificar ProductCard
  - Remover botões "Adicionar" (+) e "Retirar" (-) do card
  - Manter apenas botão "Ver detalhes"
  - Remover props onAdd e onRemove da interface
  - Manter todas as informações visuais (thumbnail, quantidade, barra, tags)
  - Preservar animações motion
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Expandir DetailsModal
  - Adicionar seção de botões de ação no modal
  - Implementar botão "Adicionar" (verde, ícone +)
  - Implementar botão "Retirar" (vermelho, ícone -, desabilitado se qty=0)
  - Botão "Editar" (azul, ícone edit)
  - Botão "Excluir" (vermelho, ícone trash)
  - Adicionar props onAdd e onRemove
  - Layout horizontal com espaçamento adequado
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 4. Atualizar InventarioPage
  - Remover props onAdd e onRemove de ProductCard
  - Adicionar props onAdd e onRemove para DetailsModal
  - Implementar função ajustar() que será chamada pelo modal
  - Validar que modais continuam funcionando
  - _Requirements: 8.3, 8.4_

- [x] 5. Criar PerfilPage
  - Criar arquivo pages/PerfilPage.jsx
  - Avatar circular com primeira letra do nome
  - Exibir VITE_USER_NAME ou "Usuário Dev" (read-only)
  - Exibir VITE_USER_EMAIL ou "dev@edustock.local" (read-only)
  - Badge "Modo Desenvolvimento" (visual destacado)
  - Botão "Sair" que limpa LocalStorage e navega para /inventario
  - Espaçamento adequado (padding, margins, gaps)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 6. Criar ConfiguracoesPage
  - Criar arquivo pages/ConfiguracoesPage.jsx
  - Toggle "Usar dados mock" com LocalStorage + reload
  - Input numérico "Prazo de alerta de validade (dias)" (default: 30)
  - Chips "Densidade de cards": Confortável, Compacto, Denso
  - Persistir em LocalStorage com chave "edustock:config"
  - Schema JSON: {useMock, validityAlertDays, cardDensity}
  - Carregar configurações existentes no mount
  - Espaçamento adequado entre seções
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

- [x] 7. Criar helper de configuração
  - Criar lib/config.js com funções:
    - getConfig() - Lê e valida LocalStorage
    - setConfig(updates) - Merge e persiste
    - DEFAULT_CONFIG constante
  - Schema: {useMock: false, validityAlertDays: 30, cardDensity: "confortavel"}
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Atualizar Header
  - Tornar seção de avatar clicável (usar Link ou navigate)
  - Adicionar hover state visível
  - Navegar para /perfil ao clicar
  - Manter design visual existente
  - Preservar todas as outras funcionalidades
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Atualizar Sidebar
  - Verificar se itens "Perfil" e "Configurações" já existem
  - Se não, adicionar na seção "Sistema"
  - Usar ícones apropriados (home para perfil, gear para config)
  - NavLink com estilo ativo
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 10. Configurar rotas em main.jsx
  - Adicionar Route para /perfil com PerfilPage
  - Adicionar Route para /configuracoes com ConfiguracoesPage
  - Ambas dentro de MainLayout
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [-] 11. Checkpoint 1 - Validação de build
  - Executar npm run build
  - Build deve completar sem erros
  - Verificar que todas as importações estão corretas
  - _Requirements: 10.1, 10.2, 10.3_

- [-] 12. Validação de testes
  - Executar npm test no frontend
  - Todos os testes devem passar
  - Executar python manage.py test
  - Backend deve permanecer intacto
  - _Requirements: 8.1, 8.2_

- [x] 13. Validação visual - Espaçamento
  - Verificar padding em todas as páginas (mínimo 20-24px)
  - Verificar espaçamento entre cards e elementos
  - Verificar max-width de conteúdo (não muito largo)
  - Testar em desktop e mobile
  - Ajustar conforme necessário

- [x] 14. Validação funcional - ProductCard e Modal
  - Verificar que ProductCard não tem mais botões +/-
  - Verificar que DetailsModal tem os 4 botões
  - Testar "Adicionar" no modal
  - Testar "Retirar" no modal (e desabilitado quando qty=0)
  - Testar "Editar" e "Excluir"

- [x] 15. Validação funcional - Perfil
  - Acessar /perfil via Sidebar ou URL
  - Verificar exibição de nome e email
  - Verificar badge de desenvolvimento
  - Testar botão "Sair"
  - Verificar navegação para /inventario após logout

- [-] 16. Validação funcional - Configurações
  - Acessar /configuracoes
  - Testar toggle mock (verificar reload)
  - Testar input de dias de alerta
  - Testar chips de densidade
  - Verificar persistência em LocalStorage
  - Recarregar página e verificar que configs foram mantidas

- [-] 17. Validação funcional - Header
  - Clicar no avatar do Header
  - Verificar navegação para /perfil
  - Verificar hover state

- [ ] 18. Checkpoint Final - Frente 3 Completa
  - Todas as páginas com espaçamento adequado
  - ProductCard simplificado funcionando
  - DetailsModal expandido funcionando
  - PerfilPage funcional
  - ConfiguracoesPage funcional
  - Header navegável
  - Build passando
  - Testes passando (frontend + backend)
  - Legibilidade melhorada

---

## Notes

### Prioridade de Espaçamento

Para melhorar legibilidade:
- **Padding interno de páginas:** `px-6 py-8` ou `p-6`
- **Espaçamento entre seções:** `mb-6` ou `mb-8`
- **Espaçamento entre elementos:** `gap-4` ou `gap-6`
- **Padding interno de cards:** `p-4` ou `p-5`
- **Max-width de conteúdo:** `max-w-7xl mx-auto` para páginas
- **Line-height:** Garantir que texto tenha `leading-relaxed` ou similar

### Ordem de Execução

1. Task 1 (Espaçamento global) - Aplicar em todas as páginas existentes
2. Tasks 2-4 (ProductCard e Modal) - Refatoração de componentes
3. Task 7 (Helper de config) - Criar utilitário
4. Tasks 5-6 (Novas páginas) - Criar com espaçamento adequado
5. Tasks 8-10 (Header, Sidebar, Routes) - Conectar tudo
6. Tasks 11-18 (Validações) - Garantir qualidade

### Comandos Úteis

```bash
# Dev server
cd frontend
npm run dev

# Build
npm run build

# Testes frontend
npm test

# Testes backend
cd ..
python manage.py test

# Verificar LocalStorage (navegador)
localStorage.getItem('edustock:config')
```

---

**Status:** Pronto para execução  
**Estimativa:** 2-3 horas
