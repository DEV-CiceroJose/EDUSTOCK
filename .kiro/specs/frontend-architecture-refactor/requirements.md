# Requirements Document

## Introduction

Este documento especifica os requisitos para a refatoração completa da arquitetura do frontend do sistema EduStock. O EduStock é um sistema de gestão de estoque escolar com stack Django (DRF) + React 19 (Vite, Tailwind CSS v4, Motion, React Router DOM v7). O projeto possui três apps independentes: frontend/, app-alunos/ e app-cozinha/. Esta refatoração foca exclusivamente no frontend/.

A refatoração aborda três problemas principais:
1. **Arquitetura plana**: 20+ componentes em src/components/ sem separação por domínio
2. **Navegação por abas**: navegação principal usa Tabs.jsx com 8 abas controladas por useState, sem roteamento real
3. **ProductCard sobrecarregado**: exibe simultaneamente thumbnail, nome, categoria, grupo, quantidade, barra de nível, tags, validade, NF e dois botões

A solução está organizada em três frentes:
- **Frente 1**: Reestruturação de pastas para estrutura modular
- **Frente 2**: Substituição de navegação por abas por Sidebar + React Router
- **Frente 3**: ProductCard simplificado + páginas pendentes (Perfil e Configurações)

## Glossary

- **Frontend_App**: O aplicativo React localizado em frontend/src/ do projeto EduStock
- **DashboardPage**: Componente monolítico de ~300 linhas que gerencia todo o estado e renderização da aplicação atual
- **Tabs_Component**: Componente de navegação baseado em abas controladas por useState
- **Sidebar_Component**: Barra lateral com 4 botões decorativos não funcionais
- **ProductCard**: Componente de exibição de item de estoque
- **MainLayout**: Layout principal contendo Sidebar + Header + área de conteúdo (Outlet)
- **Feature_Module**: Módulo de domínio específico (inventario, movimentacoes, fornecedores, alertas, relatorios, merenda)
- **React_Router**: Biblioteca react-router-dom v7 já instalada no projeto
- **UI_Component**: Componente reutilizável sem lógica de negócio (botões, modais, cards)
- **Design_Token**: Variável CSS personalizada definida em index.css @theme
- **Test_Suite**: Conjunto de testes automatizados (npm test para frontend, python manage.py test para backend)
- **LocalStorage**: API do navegador para armazenamento persistente local
- **ENV_Var**: Variável de ambiente acessível via import.meta.env
- **Debounce**: Técnica de atraso de execução de função (300ms para busca)

## Requirements

### Requirement 1: Reestruturação de Diretórios

**User Story:** Como desenvolvedor, quero uma estrutura de pastas modular, para que eu possa localizar e manter componentes facilmente por domínio de negócio.

#### Acceptance Criteria

1. THE Frontend_App SHALL reorganizar src/ para incluir os diretórios: components/ui/, features/{inventario,movimentacoes,fornecedores,alertas,relatorios,merenda}/, layouts/, pages/, hooks/
2. WHEN um componente é reutilizável e sem lógica de negócio, THE Frontend_App SHALL mover o componente para components/ui/
3. WHEN um componente pertence a um domínio específico, THE Frontend_App SHALL mover o componente para features/{dominio}/
4. THE Frontend_App SHALL preservar a lógica interna de todos os componentes movidos (nenhuma alteração no código interno)
5. THE Test_Suite SHALL continuar passando após a reorganização (npm test e python manage.py test)

### Requirement 2: Configuração de React Router

**User Story:** Como usuário, quero navegar entre diferentes seções do sistema usando URLs, para que eu possa usar o botão voltar do navegador e compartilhar links específicos.

#### Acceptance Criteria

1. THE Frontend_App SHALL configurar BrowserRouter em main.jsx
2. THE Frontend_App SHALL definir 8 rotas principais: /inventario, /movimentacoes, /alertas, /fornecedores, /relatorios, /merenda, /perfil, /configuracoes
3. THE Frontend_App SHALL criar MainLayout.jsx contendo Sidebar_Component + Header + Outlet do React_Router
4. WHEN a aplicação é carregada sem rota específica, THE Frontend_App SHALL redirecionar para /inventario
5. THE Frontend_App SHALL remover Tabs_Component da navegação principal

### Requirement 3: Refatoração de Sidebar para Navegação Real

**User Story:** Como usuário, quero clicar nos itens da sidebar e navegar para diferentes seções, para que eu possa acessar funcionalidades através de um menu lateral funcional.

#### Acceptance Criteria

1. THE Sidebar_Component SHALL usar NavLink do React_Router para navegação
2. THE Sidebar_Component SHALL exibir 8 itens de navegação: Inventário, Movimentações, Alertas, Fornecedores, Relatórios, Merenda, Perfil, Configurações
3. WHEN a viewport é desktop (≥1024px), THE Sidebar_Component SHALL ter largura de 14rem (w-56)
4. WHEN a viewport é mobile (<1024px), THE Sidebar_Component SHALL ter largura de 4rem (w-16)
5. WHEN um item de navegação está ativo, THE Sidebar_Component SHALL aplicar estilo visual de destaque (fundo brand, texto claro)

### Requirement 4: Extração de Hook de Dados do Dashboard

**User Story:** Como desenvolvedor, quero separar a lógica de busca de dados da apresentação, para que eu possa reutilizar essa lógica em múltiplas páginas.

#### Acceptance Criteria

1. THE Frontend_App SHALL criar useDashboardData.js em hooks/
2. THE useDashboardData SHALL executar Promise.all de 6 endpoints (produtos, categorias, grupos, fornecedores, movimentações, alertas)
3. WHEN o termo de busca muda, THE useDashboardData SHALL aplicar debounce de 300ms antes de executar a busca
4. THE useDashboardData SHALL retornar: produtos, categorias, grupos, fornecedores, movimentacoes, alertas, loading, carregar (função de refresh)
5. THE useDashboardData SHALL aceitar termo de busca como parâmetro

### Requirement 5: Criação de Páginas Finas

**User Story:** Como desenvolvedor, quero páginas específicas para cada seção, para que eu possa ter componentes focados e fáceis de manter.

#### Acceptance Criteria

1. THE Frontend_App SHALL criar páginas em pages/: InventarioPage.jsx, MovimentacoesPage.jsx, AlertasPage.jsx, FornecedoresPage.jsx, RelatoriosPage.jsx, MerendaPage.jsx, PerfilPage.jsx, ConfiguracoesPage.jsx
2. WHEN uma página é criada, THE Frontend_App SHALL limitar o tamanho a no máximo 60 linhas de código
3. THE Frontend_App SHALL fazer cada página consumir useDashboardData para obter dados
4. WHEN DashboardPage.jsx é substituído pelas novas páginas, THE Frontend_App SHALL deletar DashboardPage.jsx
5. THE Frontend_App SHALL extrair componentes de view existentes (AlertasView, FornecedoresView, etc.) para seus respectivos feature modules antes de usá-los nas páginas

### Requirement 6: Simplificação do ProductCard

**User Story:** Como usuário, quero ver informações essenciais do produto no card, para que eu possa escanear rapidamente o inventário sem sobrecarga visual.

#### Acceptance Criteria

1. THE ProductCard SHALL exibir apenas: thumbnail, nome, quantidade, barra de nível de estoque, tag de status (ok/low/out)
2. THE ProductCard SHALL exibir um único botão "Ver detalhes"
3. WHEN o botão "Ver detalhes" é clicado, THE ProductCard SHALL abrir DetailsModal.jsx
4. THE ProductCard SHALL remover botões de ação rápida (+/-) da visualização do card
5. THE ProductCard SHALL preservar as animações existentes (motion/react)

### Requirement 7: Movimentação de Botões de Ação para Modal

**User Story:** Como usuário, quero realizar ações sobre produtos no modal de detalhes, para que eu possa ter controle completo sem poluir a interface principal.

#### Acceptance Criteria

1. THE DetailsModal SHALL exibir os botões de ação: Adicionar Quantidade (+), Remover Quantidade (-), Editar, Excluir
2. THE DetailsModal SHALL exibir todas as informações do produto: thumbnail, nome, categoria, grupo, quantidade, validade, nota fiscal, fornecedor
3. WHEN um botão de ação é clicado, THE DetailsModal SHALL executar a ação correspondente
4. THE DetailsModal SHALL preservar a lógica de ajuste de quantidade existente (movimentacoesApi.create)
5. WHEN uma ação é concluída, THE DetailsModal SHALL atualizar os dados via hook useDashboardData

### Requirement 8: Criação de Página de Perfil

**User Story:** Como usuário, quero visualizar meu perfil e fazer logout, para que eu possa verificar minhas informações e sair do sistema.

#### Acceptance Criteria

1. THE Frontend_App SHALL criar PerfilPage.jsx acessível via rota /perfil
2. THE PerfilPage SHALL exibir avatar do usuário
3. THE PerfilPage SHALL exibir campos read-only: VITE_USER_NAME, VITE_USER_EMAIL obtidos de ENV_Var
4. THE PerfilPage SHALL exibir badge indicando modo de desenvolvimento (VITE_MODE === 'development')
5. THE PerfilPage SHALL exibir botão "Sair" que limpa sessão e redireciona para página de login

### Requirement 9: Criação de Página de Configurações

**User Story:** Como usuário, quero configurar preferências da interface, para que eu possa personalizar minha experiência no sistema.

#### Acceptance Criteria

1. THE Frontend_App SHALL criar ConfiguracoesPage.jsx acessível via rota /configuracoes
2. THE ConfiguracoesPage SHALL exibir toggle para alternar fonte de dados (mock/real) que persiste via LocalStorage
3. THE ConfiguracoesPage SHALL exibir campo numérico para configurar prazo de alerta de validade (padrão: 30 dias)
4. THE ConfiguracoesPage SHALL exibir chips de seleção para densidade de cards (confortável/compacto/denso)
5. WHEN uma configuração muda, THE ConfiguracoesPage SHALL persistir no LocalStorage com chave 'edustock:config'

### Requirement 10: Atualização do Header com Avatar Clicável

**User Story:** Como usuário, quero clicar no meu avatar e acessar meu perfil, para que eu possa navegar rapidamente para minhas informações.

#### Acceptance Criteria

1. THE Header SHALL substituir avatar hardcoded por componente clicável
2. WHEN o avatar é clicado, THE Header SHALL navegar para /perfil usando React_Router
3. THE Header SHALL preservar funcionalidades existentes: busca, botão adicionar item, botão relatórios
4. THE Header SHALL exibir avatar usando primeira letra de VITE_USER_NAME quando não houver imagem
5. THE Header SHALL manter os estilos visuais existentes (Tailwind CSS classes)

### Requirement 11: Preservação de Tokens de Design

**User Story:** Como desenvolvedor, quero manter a identidade visual existente, para que a refatoração não altere a aparência do sistema.

#### Acceptance Criteria

1. THE Frontend_App SHALL preservar todos os Design_Token definidos em index.css @theme
2. THE Frontend_App SHALL não modificar cores, fontes, sombras ou variáveis CSS personalizadas
3. THE Frontend_App SHALL manter classes utilitárias customizadas (.card, .field, .btn, .tag, .meter, etc.)
4. THE Frontend_App SHALL preservar keyframes e animações CSS existentes (@keyframes marquee)
5. THE Frontend_App SHALL manter os estilos de scrollbar personalizados

### Requirement 12: Restrição de Instalação de Dependências

**User Story:** Como desenvolvedor, quero utilizar apenas dependências já instaladas, para que eu evite conflitos de versão e aumento desnecessário do bundle.

#### Acceptance Criteria

1. THE Frontend_App SHALL usar apenas dependências listadas em package.json
2. THE Frontend_App SHALL não executar npm install ou yarn add de novas dependências
3. THE Frontend_App SHALL utilizar react-router-dom v7 já instalado para roteamento
4. THE Frontend_App SHALL utilizar motion já instalado para animações
5. THE Frontend_App SHALL utilizar tailwindcss v4 já instalado para estilização

### Requirement 13: Preservação de Apps Independentes

**User Story:** Como desenvolvedor, quero garantir que outros apps não sejam afetados, para que eu possa refatorar o frontend sem riscos para app-alunos e app-cozinha.

#### Acceptance Criteria

1. THE Frontend_App SHALL modificar apenas arquivos dentro de frontend/
2. THE Frontend_App SHALL não modificar arquivos em app-alunos/
3. THE Frontend_App SHALL não modificar arquivos em app-cozinha/
4. THE Frontend_App SHALL não modificar arquivos em core/ (backend Django)
5. THE Frontend_App SHALL não modificar arquivos de configuração global (package.json raiz, vite.config.js de outros apps)

### Requirement 14: Garantia de Compatibilidade com Testes

**User Story:** Como desenvolvedor, quero que todos os testes continuem passando, para que eu garanta que a refatoração não quebrou funcionalidades existentes.

#### Acceptance Criteria

1. WHEN npm test é executado em frontend/, THE Test_Suite SHALL passar 100% dos testes
2. WHEN python manage.py test é executado na raiz, THE Test_Suite SHALL passar 100% dos testes
3. THE Frontend_App SHALL preservar todos os data-testid existentes em componentes
4. THE Frontend_App SHALL manter as assinaturas de funções e props de componentes testados
5. WHEN um componente é movido de diretório, THE Frontend_App SHALL atualizar imports nos arquivos de teste correspondentes
