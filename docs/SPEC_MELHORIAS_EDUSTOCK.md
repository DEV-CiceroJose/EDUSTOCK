# SPEC — Melhorias EduStock (segurança, produto e landing page)

> Documento de implementação autocontido, derivado de uma auditoria técnica completa do repositório (backend Django, 3 frontends React, banco de dados, APIs e ausência de landing page). Escrito para ser executado por outro modelo/desenvolvedor sem precisar reler a análise original. Todas as referências de arquivo:linha foram verificadas diretamente no código-fonte no momento da auditoria (2026-07-15) — confirme que ainda são válidas antes de editar, pois o código pode ter mudado.

## 1. Contexto

O EduStock é um sistema de gestão de estoque e merenda escolar composto por:
- **Backend**: Django 6.0 + Django REST Framework, app único `core`, projeto `easystock`.
- **Frontend admin**: `frontend/` — dashboard React 19 + Vite + Tailwind v4 + React Router.
- **App-alunos**: `app-alunos/` — SPA React independente, login por PIN, contagem de presença por turma.
- **App-cozinha**: `app-cozinha/` — SPA React independente, login por PIN, registro de produção diária.
- Deploy: Render (blueprint `render.yaml`), Postgres em produção, SQLite em desenvolvimento.

A auditoria encontrou uma base de domínio sólida (transações corretas, ledger append-only testado, migrations bem feitas) combinada com **falhas de segurança críticas confirmadas em código** (API totalmente aberta, dashboard sem login, PIN sem rate-limit) e um conjunto de bugs de produto reais no frontend (botão que apaga dados sem confirmação, configurações que não fazem nada, navegação mobile quebrada). Não existe nenhuma landing page no projeto — um protótipo foi desenhado como parte desta análise e deve ser portado para o código real na Fase 4.

## 2. Objetivo

Elevar o EduStock de "funcional mas aberto" para "seguro, confiável e completo", em quatro fases sequenciais, sem reescrever a arquitetura existente — a base de domínio deve ser preservada (ver §12 do relatório de auditoria). Cada fase deve deixar o sistema em estado deployável.

## 3. Requisitos funcionais

### RF-01 — Autenticação de API
O backend deve exigir autenticação para todas as operações de escrita (POST/PUT/PATCH/DELETE) nos endpoints administrativos (`/api/produtos/`, `/api/categorias/`, `/api/grupos/`, `/api/bens-permanentes/`, `/api/fornecedores/`, `/api/movimentacoes/`, `/api/entradas/`, `/api/alertas/`, `/api/relatorios/prestacao-contas/`). Leitura pode permanecer pública apenas se for uma decisão de produto explícita — o padrão deve ser `IsAuthenticated`.

### RF-02 — Login no dashboard admin
O frontend `frontend/` deve ter uma tela de login antes de qualquer rota do dashboard. Deve usar o mecanismo de autenticação de sessão/token que o RF-01 implementar (ex. `dj-rest-auth`, `SessionAuthentication` + endpoint de login, ou token simples).

### RF-03 — Rate limiting no login por PIN
`POST /api/operacao/auth/` deve rejeitar após N tentativas falhas por IP/janela de tempo (ex. 5 tentativas / 5 minutos), usando `rest_framework.throttling` ou `django-ratelimit`.

### RF-04 — Sessões de operação em armazenamento compartilhado
O dicionário em memória `_SESSOES` (`core/operacao_auth.py:33`) deve ser substituído por um backend de cache compartilhado entre processos (Redis via `django-redis`, ou uma tabela de banco).

### RF-05 — Confirmação antes de ações destrutivas no frontend
Toda ação que apaga dados (incluindo `localStorage.clear()` em `PerfilPage.jsx:15`) deve passar pelo componente `ConfirmDialog` já existente no sistema.

### RF-06 — Navegação mobile funcional
O botão de menu (`Header.jsx:9-11`) deve abrir um drawer/menu real com os mesmos links da Sidebar, funcional abaixo do breakpoint `lg` (1024px).

### RF-07 — Página de Configurações funcional
Os três controles de `ConfiguracoesPage.jsx` (mock toggle, dias de alerta de validade, densidade de cards) devem ser lidos de fato pela camada que controlam (`api/index.js`, `alerts.py`/`mock.js`), ou removidos/rotulados como "em breve" até serem implementados.

### RF-08 — Landing page pública
Implementar a landing page institucional (protótipo já entregue como artifact nesta análise) como uma página real do sistema — recomenda-se um novo mini-app estático (`landing/`, Vite + React ou HTML puro) ou uma rota pública dentro do `frontend/` antes do guard de autenticação do RF-02.

### RF-09 — Painel administrativo completo
Registrar no Django admin (`core/admin.py`) todos os models que ainda faltam: `Grupo`, `Fornecedor`, `BemPermanente`, `Entrada`, `Movimentacao`, `FrequenciaDiaria`, `FatorConsumo`.

## 4. Requisitos não funcionais

### RNF-01 — Segurança
- `SECRET_KEY` sem fallback hardcoded funcional (deve falhar explicitamente se ausente em produção, não silenciosamente usar uma chave pública).
- `DEBUG` deve ter default `False`; só `True` quando explicitamente setado.
- Cookies de sessão/CSRF com `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` em produção.
- Nenhuma credencial (PIN, chave) deve ser republicada em texto puro em `README.md`/`DEPLOY.md`.

### RNF-02 — Performance
- Paginação obrigatória (`DEFAULT_PAGINATION_CLASS`) em todos os `ModelViewSet`.
- Índices de banco (`db_index=True` ou `Meta.indexes`) em `Movimentacao.data`, `Movimentacao.tipo`, `Produto.validade`.
- `useDashboardData` não deve refazer fetch de endpoints não afetados pelo termo de busca.

### RNF-03 — Observabilidade
- Logging estruturado (`logging` padrão do Python) para: tentativas de login por PIN falhas, exceções da camada de serviço, rejeições de validação de negócio.
- Testes automatizados (`manage.py test`, `npm test`) devem rodar em CI antes de qualquer deploy.

### RNF-04 — Acessibilidade
- `Modal.jsx` deve ter `role="dialog"`, `aria-modal="true"`, trap de foco e fechar com Esc.
- Toasts devem ter `aria-live="polite"`.
- Sidebar deve expor rótulos em `:focus-within`, não só `:hover`.

### RNF-05 — Compatibilidade
Nenhuma mudança deve quebrar os testes existentes em `core/tests/` (1.405 linhas) sem justificativa explícita e atualização correspondente do teste.

## 5. Critérios de aceitação

| # | Critério | Como verificar |
|---|----------|-----------------|
| 1 | `POST/PUT/PATCH/DELETE` em qualquer endpoint de `/api/` sem header de autenticação retorna 401/403 | Teste automatizado + chamada manual via curl sem token |
| 2 | Acessar `/` do dashboard sem sessão válida redireciona para `/login` | Teste E2E ou manual no navegador |
| 3 | 6ª tentativa de PIN errado em menos de 5 minutos retorna 429 ou mensagem de bloqueio | Teste automatizado no `OperacaoLoginView` |
| 4 | Reiniciar o processo do backend não invalida sessões de operação ativas | Teste manual: login, restart do processo, requisição autenticada continua válida |
| 5 | Clicar em "Sair" no Perfil exige confirmação antes de apagar dados | Teste manual/E2E |
| 6 | Redimensionar o navegador para 375px permite navegar entre todas as páginas | Teste manual/E2E em viewport mobile |
| 7 | Alterar "dias de alerta de validade" em Configurações muda de fato quais produtos aparecem em Alertas | Teste manual/E2E |
| 8 | Landing page acessível em `/` (ou domínio próprio) sem exigir login | Teste manual no navegador |
| 9 | Todos os 10 models aparecem listados no Django admin | Inspeção manual em `/admin/` |
| 10 | `npm run build` e `python manage.py test` rodam automaticamente e bloqueiam o deploy em caso de falha | Inspeção do pipeline de CI/`build.sh` |

## 6. Tarefas e subtarefas (por fase)

### Fase 1 — Segurança crítica (1–2 semanas)

**T1.1 — Autenticação na API**
- T1.1.1 Escolher mecanismo (recomendado: `SessionAuthentication` + `TokenAuthentication` do DRF, já que o app React já usa `credentials:"include"` em `frontend/src/api/http.js:19`)
- T1.1.2 Alterar `easystock/settings.py:152-154` para `DEFAULT_PERMISSION_CLASSES: ["rest_framework.permissions.IsAuthenticated"]`
- T1.1.3 Criar endpoint de login/logout para o dashboard admin (distinto do módulo de PIN em `operacao_auth.py`, que já tem seu próprio isolamento)
- T1.1.4 Atualizar `core/tests/test_api.py` para autenticar antes de cada chamada (hoje todos os testes assumem acesso anônimo)

**T1.2 — Login no dashboard**
- T1.2.1 Criar página `LoginPage.jsx` em `frontend/src/pages/`
- T1.2.2 Adicionar guard de rota em `frontend/src/main.jsx:15-33` (redirecionar para `/login` se não autenticado)
- T1.2.3 Persistir sessão/token no client (seguir padrão já usado em `app-cozinha`/`app-alunos`: `sessionStorage`, não `localStorage`)

**T1.3 — Rate limit no PIN**
- T1.3.1 Adicionar `throttle_classes` em `OperacaoLoginView` (`core/operacao_views.py:41`)
- T1.3.2 Remover PINs reais de `README.md:143-153` e `DEPLOY.md:143-144,180-181`, substituir por instrução de onde configurá-los

**T1.4 — Corrigir defaults inseguros**
- T1.4.1 `easystock/settings.py:25` — remover fallback funcional de `SECRET_KEY` (lançar erro se ausente fora de dev)
- T1.4.2 `easystock/settings.py:28` — inverter default de `DEBUG` para `False`

**T1.5 — Corrigir botão "Sair" destrutivo**
- T1.5.1 Envolver `handleLogout` em `frontend/src/pages/PerfilPage.jsx:15-18` com `ConfirmDialog`
- T1.5.2 Considerar não usar `localStorage.clear()` genérico — limpar só as chaves de sessão, preservando dados mock

**T1.6 — Navegação mobile**
- T1.6.1 Implementar drawer mobile reutilizando os itens de `Sidebar.jsx:5-19`
- T1.6.2 Conectar `onClick` do botão em `Header.jsx:9-11` para abrir/fechar o drawer

### Fase 2 — Estabilização de produto (2–3 semanas)

**T2.1 — Sessões de operação em Redis**
- T2.1.1 Adicionar `django-redis` a `requirements.txt`
- T2.1.2 Substituir `_SESSOES` dict (`core/operacao_auth.py:33`) por `django.core.cache.cache` com TTL igual a `OPERACAO_TOKEN_TTL_HORAS`

**T2.2 — CI rodando testes**
- T2.2.1 Criar `.github/workflows/ci.yml` (ou equivalente) rodando `python manage.py test` e `npm test`/`npm run build` nos 3 frontends
- T2.2.2 Gatear o deploy do Render a esse pipeline (branch protection ou manual approval)

**T2.3 — Corrigir `useDashboardData`**
- T2.3.1 Adicionar `AbortController`/flag de resposta obsoleta em `frontend/src/hooks/useDashboardData.js:63-89`
- T2.3.2 Separar o `useEffect` de `produtos` (depende de `termo`) dos outros 5 endpoints (mount-only + refresh manual)
- T2.3.3 Adicionar tratamento de erro (`catch`) e um campo `error` no retorno do hook, consumido pelas páginas

**T2.4 — Página de Configurações real**
- T2.4.1 Conectar `getConfig().useMock` a `frontend/src/api/index.js:4` (ou remover o controle)
- T2.4.2 Conectar `validityAlertDays` ao cálculo de alertas (`mock.js` e/ou `core/alerts.py` via parâmetro configurável)

**T2.5 — Acessibilidade do Modal**
- T2.5.1 Adicionar `role="dialog"` e `aria-modal="true"` em `frontend/src/components/ui/Modal.jsx:6-38`
- T2.5.2 Adicionar listener de `Escape` para fechar
- T2.5.3 Implementar trap de foco simples (mover foco ao abrir, restaurar ao fechar)
- T2.5.4 Adicionar `aria-live="polite"` ao container de `Toast.jsx`

### Fase 3 — Redução de dívida técnica (3–4 semanas)

**T3.1 — Remover código morto**
- T3.1.1 Remover ou corrigir `core/views.py`, `core/forms.py`, `core/templates/` e as rotas correspondentes em `easystock/urls.py:30-37` (decidir: deletar ou consertar o bug de `AnonymousUser`)
- T3.1.2 Remover model `Perfil` (`core/models.py:6-11`) com migration de remoção
- T3.1.3 Remover `frontend/src/components/ui/Tabs.jsx` e `frontend/src/lib/config-demo.js`
- T3.1.4 Remover ou conectar de verdade o `KitchenPanel.jsx` decorativo

**T3.2 — Unificar frontends**
- T3.2.1 Extrair tokens de design (`@theme` do `index.css`) para um arquivo único compartilhado ou pacote local
- T3.2.2 Extrair `PinLogin` para um componente compartilhado entre `app-alunos` e `app-cozinha`
- T3.2.3 Extrair cliente HTTP comum (`api.js`) para os dois mini-apps

**T3.3 — Performance de banco**
- T3.3.1 Adicionar paginação DRF (`PageNumberPagination`) em todos os `ModelViewSet`
- T3.3.2 Adicionar `db_index=True` em `Movimentacao.data`, `Movimentacao.tipo`, `Produto.validade`

**T3.4 — Admin completo e logging**
- T3.4.1 Registrar `Grupo`, `Fornecedor`, `BemPermanente`, `Entrada`, `Movimentacao`, `FrequenciaDiaria`, `FatorConsumo` em `core/admin.py`
- T3.4.2 Adicionar `logging.getLogger(__name__)` e logar falhas de autenticação por PIN e exceções de `services.py`

### Fase 4 — Crescimento e polimento (contínuo)

**T4.1 — Publicar a landing page**
- T4.1.1 Portar o protótipo (artifact entregue nesta análise) para um projeto React/Vite real ou página estática
- T4.1.2 Servir em `/` público, antes do guard de autenticação do dashboard

**T4.2 — Melhorias incrementais**
- T4.2.1 Adotar TypeScript progressivamente, começando por `api/` e `hooks/`
- T4.2.2 Adicionar testes E2E (Playwright) para os fluxos críticos (login, criar produto, registrar movimentação, contagem de presença)
- T4.2.3 Tornar `CRITICO_DIAS`/`ALERTA_DIAS`/limiar de 20% (`core/alerts.py:10-11,30`) configuráveis via settings ou admin
- T4.2.4 Migração de dados definitiva para eliminar os campos legados `Produto.numero_nota_fiscal`/`preco` e a lógica de reconciliação em `core/relatorios.py:19-135`

## 7. Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Ativar `IsAuthenticated` quebra os testes existentes que assumem acesso anônimo | Alto — CI vermelho até corrigir | Atualizar `test_api.py` no mesmo PR que muda a permissão (T1.1.4) |
| Adicionar login ao dashboard sem coordenar com os apps operacionais pode confundir usuários finais (professores/cozinha) que já usam o sistema | Médio | Comunicar a mudança antes do deploy da Fase 1; manter os apps de PIN inalterados |
| Mover sessões para Redis exige provisionar um novo serviço na Render | Médio | Avaliar custo/complexidade antes; alternativa mais simples é uma tabela de banco (`django.core.cache` com backend de DB) |
| Remover código legado (`core/views.py`) sem confirmar que nada em produção depende dele | Baixo-Médio | Confirmar com o time se `/produtos/`, `/categorias/` são acessados por alguém antes de remover |
| Mudanças de acessibilidade no `Modal` podem alterar comportamento visual sutil (z-index, animação) | Baixo | Testar manualmente todos os 8+ usos do `Modal` após a mudança |

## 8. Dependências

- Fase 2 (Redis) depende da Fase 1 (autenticação) estar concluída, para não misturar dois esquemas de sessão diferentes ao mesmo tempo.
- Fase 3 (unificação de frontends) deve vir depois da Fase 2 para não competir por atenção com a correção de bugs de produto mais urgentes.
- Fase 4 (landing page em produção) pode ser paralela às fases 2–3, já que é um artefato novo e isolado, sem dependência do dashboard existente.
- T2.2 (CI) deve ser feito antes ou junto de qualquer tarefa da Fase 3, para que as remoções de código morto sejam validadas automaticamente.

## 9. Plano de implementação sugerido

1. Abrir uma branch por fase (`fase-1-seguranca`, `fase-2-estabilizacao`, ...), não uma branch única para tudo.
2. Dentro de cada fase, implementar tarefas em ordem de menor para maior risco de regressão: primeiro settings/config (T1.4), depois autenticação de API (T1.1), depois login no frontend (T1.2), depois os itens de UX (T1.5, T1.6).
3. Cada tarefa deve vir acompanhada de teste automatizado antes de ser considerada concluída — o projeto já tem uma cultura de teste forte no backend (1.405 linhas); manter esse padrão nas mudanças novas.
4. Rodar a suíte completa (`python manage.py test`, `npm test` nos 3 frontends) antes de merge de cada fase.
5. Fazer o deploy de cada fase isoladamente na Render (o `render.yaml` já sobe os 4 serviços) e validar manualmente os critérios de aceitação da §5 correspondentes antes de iniciar a fase seguinte.
