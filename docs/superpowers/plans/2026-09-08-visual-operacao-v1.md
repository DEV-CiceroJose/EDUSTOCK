# Visual e Operação em Movimento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a landing comercial, o dashboard operacional e o shell visual aprovados, sempre alimentados por dados reais e preservando os fluxos existentes.

**Architecture:** Um novo serviço Django monta um resumo somente leitura e restrito à escola do token; uma única view expõe esse contrato. O frontend consome o resumo por uma camada tipada, divide a tela em componentes pequenos e mantém rotas, permissões e ações existentes como fontes de verdade.

**Tech Stack:** Django 6, Django REST Framework, PostgreSQL/SQLite, React 19, TypeScript progressivo, Tailwind CSS 4, Vitest, Testing Library e Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-visual-operacao-v1-design.md`

## Global Constraints

- Não adicionar dependências de produção.
- Não criar nem alterar migrations nesta fase.
- A escola vem exclusivamente de `escola_do_request(request)`; ignorar qualquer `escola_id` do cliente.
- Seções sem módulo autorizado são `null` no backend e não aparecem no frontend.
- Não inventar economia, impacto, presença, produção ou consumo.
- Tendência: exatamente sete dias consecutivos encerrados na data solicitada.
- Atividade recente: no máximo oito registros, sem `detalhes` sensíveis.
- CTA de piloto: `VITE_PILOT_CONTACT_URL`; desabilitado e explicado quando ausente.
- Preservar os contratos de Inventário, Distribuição, Movimentações, Alertas, Fornecedores, Relatórios, Merenda, Rede e Administração.
- Preservar loading, sem dados, falha completa, sessão expirada, teclado, contraste WCAG AA e redução de movimento.
- Validar as suítes frontend serialmente no Windows para evitar contenção de memória.
- Commits devem usar `DEV-CiceroJose <danielamorimk095@gmail.com>` e mensagens naturais em português.

---

## File Map

**Backend**

- Create `core/dashboard.py`: consultas e transformação do resumo operacional.
- Create `core/dashboard_views.py`: validação da data, autenticação e resposta HTTP.
- Create `core/tests/test_dashboard_operacional.py`: contrato, isolamento, ações, auditoria e desempenho.
- Modify `core/api_urls.py`: registrar `GET /api/dashboard/operacao/`.

**Frontend data layer**

- Modify `frontend/src/api/types.ts`: tipos do contrato.
- Modify `frontend/src/api/http.ts`: cliente do endpoint.
- Modify `frontend/src/api/mock.js`: fixture demonstrativa explicitamente sintética.
- Modify `frontend/src/api/index.ts`: exportar `dashboardApi`.
- Create `frontend/src/hooks/useOperationalDashboard.ts`: carregamento, atualização e erro.
- Create `frontend/src/hooks/useOperationalDashboard.test.tsx`: ciclo do hook.

**Frontend UI**

- Create `frontend/src/pages/DashboardOperacionalPage.jsx`: composição da tela.
- Create `frontend/src/pages/DashboardOperacionalPage.test.jsx`: estados, permissões e links.
- Create `frontend/src/features/dashboard/OperationalSummaryCards.jsx`: KPIs.
- Create `frontend/src/features/dashboard/DailyFlow.jsx`: etapas da refeição.
- Create `frontend/src/features/dashboard/NextActions.jsx`: ações determinísticas.
- Create `frontend/src/features/dashboard/ProductionTrend.jsx`: barras e resumo textual.
- Create `frontend/src/features/dashboard/StockHealth.jsx`: distribuição de estoque.
- Create `frontend/src/features/dashboard/RecentActivity.jsx`: auditoria resumida.
- Create `frontend/src/features/dashboard/DashboardStates.jsx`: skeleton, vazio e erro.
- Modify `frontend/src/App.jsx`: rota real `/app`.
- Modify `frontend/src/pages/LoginPage.jsx`: destino pós-login.
- Modify `frontend/src/pages/LandingPage.jsx`: nova landing.
- Modify `frontend/src/pages/LandingPage.test.jsx`: conteúdo, destinos e CTA.
- Create `frontend/src/lib/landingConfig.ts`: leitura testável da URL de contato.
- Create `frontend/src/lib/landingConfig.test.ts`: configuração presente e ausente.
- Modify `frontend/src/layouts/Sidebar.jsx`: agrupamento e item Visão geral.
- Modify `frontend/src/layouts/Sidebar.test.jsx`: permissões e geometria.
- Modify `frontend/src/layouts/Header.jsx`: contexto da página e ações condicionais.
- Modify `frontend/src/layouts/MainLayout.jsx`: shell aprovado.
- Modify `frontend/src/layouts/MainLayout.test.jsx`: menu e cabeçalho por rota.
- Modify `frontend/src/lib/icons.jsx`: ícones necessários ao dashboard.
- Modify `frontend/src/index.css`: landing, dashboard e superfícies compartilhadas.
- Modify `packages/operacao-shared/src/design-tokens.css`: paleta aprovada.

**Configuration and verification**

- Create `frontend/.env.example`: variáveis documentadas do dashboard.
- Modify `render.yaml`: `VITE_PILOT_CONTACT_URL` no site estático.
- Modify `frontend/e2e/dashboard.spec.ts`: login, dashboard, navegação e celular.
- Modify `frontend/playwright.config.ts`: projeto tablet do dashboard.
- Modify `README.md`: posicionamento e variáveis novas.

---

### Task 1: Contrato base do resumo operacional

**Files:**
- Create: `core/dashboard.py`
- Create: `core/dashboard_views.py`
- Create: `core/tests/test_dashboard_operacional.py`
- Modify: `core/api_urls.py`

**Interfaces:**
- Consumes: `escola_do_request(request)`, `slugs_modulos_do_usuario(user)`, `calcular_resumo_dia(data, escola)`, `coletar_alertas(escola=...)` e os modelos atuais.
- Produces: `montar_dashboard_operacional(*, escola, data, user) -> dict` e `GET /api/dashboard/operacao/?data=YYYY-MM-DD`.

- [ ] **Step 1: Write the failing API contract tests**

Create `core/tests/test_dashboard_operacional.py` with authentication, date and empty-state coverage:

```python
from datetime import date

from core.tests.utils import AutenticadoAPITestCase


class DashboardOperacionalApiTest(AutenticadoAPITestCase):
    def test_exige_autenticacao(self):
        self.client.credentials()
        resposta = self.client.get("/api/dashboard/operacao/")
        self.assertEqual(resposta.status_code, 401)

    def test_rejeita_data_invalida(self):
        resposta = self.client.get("/api/dashboard/operacao/?data=08-09-2026")
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(resposta.json()["detail"], "Data inválida. Use YYYY-MM-DD.")

    def test_retorna_contrato_vazio_da_escola_autenticada(self):
        resposta = self.client.get("/api/dashboard/operacao/?data=2026-09-08")
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(corpo["data"], date(2026, 9, 8).isoformat())
        self.assertEqual(corpo["presenca"]["total_alunos"], 0)
        self.assertEqual(corpo["refeicoes"]["previstas"], 0)
        self.assertEqual(corpo["estoque"]["itens"], 0)
        self.assertEqual(corpo["proximas_acoes"], [])
        self.assertEqual(corpo["tendencia"], [])
        self.assertEqual(corpo["atividade_recente"], [])
```

- [ ] **Step 2: Run the new tests and verify the route is missing**

Run:

```powershell
python manage.py test core.tests.test_dashboard_operacional -v 2
```

Expected: FAIL with `404` for `/api/dashboard/operacao/`.

- [ ] **Step 3: Implement date validation and the base service**

Create `core/dashboard_views.py` with `DashboardOperacionalView(APIView)`. Use `date.fromisoformat`, `timezone.localdate()` and return the exact invalid-date message from the test. Resolve the school only with `escola_do_request`; return `403` with `{"detail": "Nenhuma escola autorizada para este usuário."}` when absent.

Create `core/dashboard.py` with this public entry point and helpers:

```python
def montar_dashboard_operacional(*, escola, data, user):
    modulos = sorted(slugs_modulos_do_usuario(user))
    presenca = _resumo_presenca(escola=escola, data=data)
    refeicoes = _resumo_refeicoes(escola=escola, data=data)
    estoque = _resumo_estoque(escola=escola)
    return {
        "data": data.isoformat(),
        "escola": {"id": escola.id, "nome": escola.nome},
        "modulos": modulos,
        "presenca": presenca,
        "refeicoes": refeicoes,
        "estoque": estoque,
        "proximas_acoes": [],
        "tendencia": [],
        "atividade_recente": [],
        "atualizado_em": timezone.localtime().isoformat(),
    }
```

`_resumo_presenca` must return `total_alunos`, `turmas_registradas`, `turmas_esperadas`, `media_historica` and `variacao_pct`. Count expected classes from `Turma.objects.filter(escola=escola, ativo=True)`. Return `presenca=None` and `refeicoes=None` without querying their models when `merenda` is not in `modulos`.

`_resumo_refeicoes` must aggregate `RegistroRefeicao` for the date and return `previstas`, `produzidas`, `servidas`, `descarte_kg` as a three-decimal string, plus one `etapas` item for each of `OperacaoBaixaProducao.REFEICAO_CHOICES`. Each stage uses `SEM_REGISTRO`, `AGUARDANDO_BAIXA`, `CONCLUIDA` or `PARCIAL` based on the existing record and operation.

`_resumo_estoque` must call `coletar_alertas`, deduplicate product IDs between alert lists and return `itens`, `adequados`, `atencao`, `criticos`, `vencidos` and `proximos_vencimento` without producing negative counts. Return `estoque=None` without querying products when the user has neither `inventario` nor `alertas`.

Register the view in `core/api_urls.py`:

```python
path("dashboard/operacao/", DashboardOperacionalView.as_view(), name="dashboard-operacao"),
```

- [ ] **Step 4: Add populated and tenant-isolation tests**

Add an explicit school-scoping setup:

```python
from core.models import Categoria, FrequenciaDiaria, Grupo, Produto, Turma
from plataforma.models import Escola, Municipio, VinculoUsuario, escola_padrao_id

self.escola = Escola.objects.get(pk=escola_padrao_id())
VinculoUsuario.objects.filter(user=self.user).delete()
VinculoUsuario.objects.create(
    user=self.user,
    municipio=self.escola.municipio,
    escola=self.escola,
    papel=VinculoUsuario.GESTOR_ESCOLA,
)
self.token.escola = self.escola
self.token.municipio = self.escola.municipio
self.token.papel_rede = VinculoUsuario.GESTOR_ESCOLA
self.token.save(update_fields=["escola", "municipio", "papel_rede"])
self.outra_escola = Escola.objects.create(
    municipio=self.escola.municipio,
    nome="Escola Fora do Escopo",
    slug="fora-do-escopo",
)
```

Create one active `Turma`, its `FrequenciaDiaria`, a category/group/product and a meal record for each school. Assert that the response totals and product counts include only `self.escola`. Request `/api/dashboard/operacao/?data=2026-09-08&escola_id=<outra_escola.id>` and assert the returned `escola.id` still equals `self.escola.id`.

Change the test profile to `OPERADOR`, authorize only the `inventario` module, and assert `presenca` and `refeicoes` are `null`. Then authorize only `merenda` and assert `estoque` is `null`. This proves module visibility is enforced in the API, not only with CSS.

- [ ] **Step 5: Run focused backend tests**

```powershell
python manage.py test core.tests.test_dashboard_operacional core.tests.test_rede_multi_escola core.tests.test_alerts -v 2
```

Expected: all tests PASS.

- [ ] **Step 6: Commit the base endpoint**

```powershell
git add core/dashboard.py core/dashboard_views.py core/tests/test_dashboard_operacional.py core/api_urls.py
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Cria resumo operacional do dashboard"
```

---

### Task 2: Próximas ações, tendência e atividade segura

**Files:**
- Modify: `core/dashboard.py`
- Modify: `core/tests/test_dashboard_operacional.py`

**Interfaces:**
- Consumes: `montar_dashboard_operacional` from Task 1.
- Produces: `_proximas_acoes`, `_tendencia_sete_dias` and `_atividade_recente`, included in the existing response contract.

- [ ] **Step 1: Write failing tests for deterministic actions**

Add tests that create: an active class without frequency, a pending lunch card, a critical product and a latest physical count with non-zero divergence. Assert ordered action codes:

```python
self.assertEqual(
    [item["codigo"] for item in resposta.json()["proximas_acoes"]],
    ["TURMAS_PENDENTES", "REFEICAO_PENDENTE", "ESTOQUE_CRITICO", "DIVERGENCIA_ESTOQUE"],
)
```

Assert every item has `codigo`, `prioridade`, `titulo`, `descricao` and `href`. Valid destinations are `/merenda`, `/alertas` and `/rede`.

- [ ] **Step 2: Write failing seven-day trend and audit tests**

Create meal records on the requested date, six days before it and eight days before it. Assert the response contains exactly seven consecutive points: the first two in-window records have their values, missing dates contain zeros, and the eight-day-old record is excluded. Update the empty-contract test from Task 1 to expect seven zero-valued points after this task. Create ten `RegistroAuditoria` rows plus one from another school; assert at most eight current-school rows and assert serialized entries contain only `id`, `acao`, `recurso`, `ator` and `criado_em`.

- [ ] **Step 3: Run tests and verify missing behavior**

```powershell
python manage.py test core.tests.test_dashboard_operacional -v 2
```

Expected: FAIL because the three response arrays are empty.

- [ ] **Step 4: Implement actions, trend and audit**

Use explicit priority order `alta`, then `media`, then `baixa`. A class is pending when it is active and has no `FrequenciaDiaria` on the requested date. A meal is pending when a `Cardapio` exists for the date/refeição and there is no completed `OperacaoBaixaProducao` for it. A physical divergence is relevant only when the latest count for a product occurred inside the seven-day window and `quantidade_fisica != quantidade_sistema`.

Trend items have this exact shape:

```python
{
    "data": dia.isoformat(),
    "planejadas": planejadas,
    "produzidas": produzidas,
    "servidas": servidas,
}
```

Audit serialization must never include `detalhes` or `objeto_id`. Use `select_related("user")[:8]` and render the actor as the user's full name, username fallback, or `"Sistema"`.

- [ ] **Step 5: Add a query-count regression test**

Compare the query count before and after adding ten products and audit rows:

```python
from django.db import connection
from django.test.utils import CaptureQueriesContext

with CaptureQueriesContext(connection) as base_queries:
    self.client.get("/api/dashboard/operacao/?data=2026-09-08")

self._criar_dez_produtos_e_auditorias()

with CaptureQueriesContext(connection) as expanded_queries:
    self.client.get("/api/dashboard/operacao/?data=2026-09-08")

self.assertLessEqual(len(expanded_queries), len(base_queries) + 2)
```

Implement `_criar_dez_produtos_e_auditorias` in the test class using the same category/group and authenticated school created in `setUp`. This proves the endpoint has no per-row query growth without fixing the test to an environment-specific absolute count.

- [ ] **Step 6: Run focused tests**

```powershell
python manage.py test core.tests.test_dashboard_operacional -v 2
python manage.py check
python manage.py makemigrations --check --dry-run
```

Expected: tests PASS, Django reports no issues, and no model changes are detected.

- [ ] **Step 7: Commit the completed backend summary**

```powershell
git add core/dashboard.py core/tests/test_dashboard_operacional.py
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Completa sinais e ações do painel diário"
```

---

### Task 3: Client, types and dashboard loading hook

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/http.ts`
- Modify: `frontend/src/api/mock.js`
- Modify: `frontend/src/api/index.ts`
- Create: `frontend/src/hooks/useOperationalDashboard.ts`
- Create: `frontend/src/hooks/useOperationalDashboard.test.tsx`

**Interfaces:**
- Consumes: `GET /api/dashboard/operacao/?data=YYYY-MM-DD` from Tasks 1-2.
- Produces: `DashboardOperacional`, `DashboardAction`, `DashboardTrendPoint`, `dashboardApi.get(data?)` and `useOperationalDashboard(data?)`.

- [ ] **Step 1: Define the exact TypeScript contract**

Add interfaces matching the spec. Use unions:

```typescript
export type DashboardStageStatus = "SEM_REGISTRO" | "AGUARDANDO_BAIXA" | "CONCLUIDA" | "PARCIAL"
export type DashboardActionCode = "TURMAS_PENDENTES" | "REFEICAO_PENDENTE" | "ESTOQUE_CRITICO" | "DIVERGENCIA_ESTOQUE"
export type DashboardActionPriority = "alta" | "media" | "baixa"
```

Define every object property returned by the backend; do not use `any` or `Record<string, unknown>` for this endpoint. Type `presenca`, `refeicoes` and `estoque` as their object interface or `null`.

- [ ] **Step 2: Write failing HTTP client and hook tests**

In `frontend/src/api/http.test.js`, assert `httpDashboard.get("2026-09-08")` requests `/dashboard/operacao/?data=2026-09-08` with the current token.

In the hook test, mock `dashboardApi.get` and assert initial loading, resolved data, rejected error and `reload()` recovery:

```tsx
const { result } = renderHook(() => useOperationalDashboard("2026-09-08"))
expect(result.current.loading).toBe(true)
await waitFor(() => expect(result.current.loading).toBe(false))
expect(result.current.data?.data).toBe("2026-09-08")
```

- [ ] **Step 3: Run tests and verify missing exports**

```powershell
Set-Location frontend
npx vitest run src/api/http.test.js src/hooks/useOperationalDashboard.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because `httpDashboard`, `dashboardApi` and the hook do not exist.

- [ ] **Step 4: Implement the client and hook**

Add:

```typescript
export const httpDashboard = {
  get: (data?: string) => req<DashboardOperacional>(
    `/dashboard/operacao/${data ? `?data=${encodeURIComponent(data)}` : ""}`,
  ),
}
```

Provide a matching `mockDashboard.get()` that returns a synthetic fixture whose `escola.nome` is `"Escola Demonstrativa"`. The hook owns `{data, loading, error, reload}` and ignores results after unmount using the same `active` pattern already used in the repository.

- [ ] **Step 5: Run client and hook tests plus typecheck**

```powershell
npx vitest run src/api/http.test.js src/hooks/useOperationalDashboard.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the typed data layer**

```powershell
Set-Location ..
git add frontend/src/api/types.ts frontend/src/api/http.ts frontend/src/api/http.test.js frontend/src/api/mock.js frontend/src/api/index.ts frontend/src/hooks/useOperationalDashboard.ts frontend/src/hooks/useOperationalDashboard.test.tsx
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Conecta o painel ao resumo operacional"
```

---

### Task 4: Dashboard page and default route

**Files:**
- Create: `frontend/src/pages/DashboardOperacionalPage.jsx`
- Create: `frontend/src/pages/DashboardOperacionalPage.test.jsx`
- Create: `frontend/src/features/dashboard/OperationalSummaryCards.jsx`
- Create: `frontend/src/features/dashboard/DailyFlow.jsx`
- Create: `frontend/src/features/dashboard/NextActions.jsx`
- Create: `frontend/src/features/dashboard/ProductionTrend.jsx`
- Create: `frontend/src/features/dashboard/StockHealth.jsx`
- Create: `frontend/src/features/dashboard/RecentActivity.jsx`
- Create: `frontend/src/features/dashboard/DashboardStates.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/LoginPage.jsx`
- Modify: `frontend/src/lib/icons.jsx`

**Interfaces:**
- Consumes: `useOperationalDashboard` and types from Task 3.
- Produces: authenticated `/app`, semantic dashboard regions and action links.

- [ ] **Step 1: Write failing page tests**

Mock the hook with complete, empty, partial-error and loading states. Assert:

```jsx
expect(screen.getByRole("heading", { name: /Bom dia/i })).toBeInTheDocument()
expect(screen.getByRole("region", { name: "Fluxo do dia" })).toBeInTheDocument()
expect(screen.getByRole("list", { name: "Próximas ações" })).toBeInTheDocument()
expect(screen.getByText("426")).toBeInTheDocument()
expect(screen.getByRole("link", { name: /Abrir plano/i })).toHaveAttribute("href", "/merenda")
```

For empty data, assert the page says what to register next. For a disabled `merenda` module, assert meal actions are absent. For chart data, assert the textual summary is available to assistive technology.

- [ ] **Step 2: Run the page tests and verify the page is absent**

```powershell
Set-Location frontend
npx vitest run src/pages/DashboardOperacionalPage.test.jsx --pool=threads --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement small dashboard components**

Each component receives data through props and returns one semantic region. `ProductionTrend` uses CSS bars and includes a visible or screen-reader summary; do not add a chart library. `NextActions` renders backend-provided text and `href` only after checking the associated module is present. `DashboardStates` exports `DashboardSkeleton`, `DashboardEmptyState` and `DashboardSectionError`.

- [ ] **Step 4: Compose the page**

`DashboardOperacionalPage` obtains the current user's display name from `getNome()`/`getUsername()`, calls the hook, and renders the approved order: header, summary, daily flow, next actions, trend, stock health and activity. The retry button calls `reload`.

- [ ] **Step 5: Make `/app` the real authenticated home**

Lazy-load `DashboardOperacionalPage` in `App.jsx` and replace the redirect with:

```jsx
<Route path="app" element={<DashboardOperacionalPage />} />
```

Change successful login to `navigate("/app")`. Change authenticated landing CTAs from `/inventario` to `/app`. Keep authorization redirects for forbidden admin routes unchanged.

- [ ] **Step 6: Run focused tests**

```powershell
npx vitest run src/pages/DashboardOperacionalPage.test.jsx src/pages/LoginPage.test.jsx src/pages/LandingPage.test.jsx --pool=threads --maxWorkers=1 --no-file-parallelism
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the dashboard UI**

```powershell
Set-Location ..
git add frontend/src/pages/DashboardOperacionalPage.jsx frontend/src/pages/DashboardOperacionalPage.test.jsx frontend/src/pages/LoginPage.jsx frontend/src/pages/LoginPage.test.jsx frontend/src/pages/LandingPage.jsx frontend/src/pages/LandingPage.test.jsx frontend/src/features/dashboard frontend/src/App.jsx frontend/src/lib/icons.jsx
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Transforma o painel diário na entrada do sistema"
```

---

### Task 5: Navigation and authenticated shell

**Files:**
- Modify: `frontend/src/layouts/Sidebar.jsx`
- Modify: `frontend/src/layouts/Sidebar.test.jsx`
- Modify: `frontend/src/layouts/Sidebar.permissions.test.jsx`
- Modify: `frontend/src/layouts/Header.jsx`
- Modify: `frontend/src/layouts/Header.permissions.test.jsx`
- Modify: `frontend/src/layouts/MainLayout.jsx`
- Modify: `frontend/src/layouts/MainLayout.test.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: routes and permission helpers already present.
- Produces: stable navigation sections `Visão geral`, `Operação`, `Gestão` and `Administração`.

- [ ] **Step 1: Write failing navigation tests**

Assert `/app` is the first visible item and active as `Operação do dia`. Assert the exact group placement of Merenda, Inventário, Distribuição, Movimentações, Alertas, Relatórios, Rede municipal and Fornecedores. Preserve current visibility rules for modules, `somenteGestaoEscolar`, `somenteRede` and `somenteAdmin`.

Render collapsed and expanded desktop states and assert every navigation link keeps `h-11` and every section heading keeps `h-6`. Keep the existing mobile close and Escape tests.

- [ ] **Step 2: Run layout tests and verify the new grouping fails**

```powershell
Set-Location frontend
npx vitest run src/layouts/Sidebar.test.jsx src/layouts/Sidebar.permissions.test.jsx src/layouts/Header.permissions.test.jsx src/layouts/MainLayout.test.jsx --pool=threads --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because Visão geral and `/app` are missing.

- [ ] **Step 3: Reorganize sidebar data without changing permission logic**

Use these section names in order:

```javascript
const sections = ["Visão geral", "Operação", "Gestão", "Administração"]
```

Move Perfil and Configurações to a fixed account area above Logout rather than mixing them with operational navigation. Keep mobile width and desktop hover/focus expansion behavior.

- [ ] **Step 4: Make the header route-aware**

Show search only on inventory, keep New entry and Report actions permission-aware, and render the page title plus current school name. On `/app`, the primary action is `Nova entrada` only for managers; on read-only profiles, no write action appears.

- [ ] **Step 5: Apply the approved shell styling**

Use deep green sidebar, cream canvas, white data surfaces and orange only for current progress/primary action. Add visible focus states and ensure reduced motion remains respected. Keep existing class contracts used by tests.

- [ ] **Step 6: Run focused layout tests and lint**

```powershell
npx vitest run src/layouts --pool=threads --maxWorkers=1 --no-file-parallelism
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit the shell**

```powershell
Set-Location ..
git add frontend/src/layouts frontend/src/index.css
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Organiza a navegação pela rotina da escola"
```

---

### Task 6: Landing and pilot contact configuration

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx`
- Modify: `frontend/src/pages/LandingPage.test.jsx`
- Create: `frontend/src/lib/landingConfig.ts`
- Create: `frontend/src/lib/landingConfig.test.ts`
- Create: `frontend/.env.example`
- Modify: `frontend/src/index.css`
- Modify: `render.yaml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `estaAutenticado()` and `VITE_PILOT_CONTACT_URL`.
- Produces: approved public narrative, `/app` destination for authenticated users, and a safe configured pilot CTA.

- [ ] **Step 1: Write failing landing and configuration tests**

Assert the public heading is `Da presença do aluno à decisão da Secretaria`, the operational sequence is visible in DOM order, all preview data is inside a region labelled `Exemplo demonstrativo`, and authenticated access points to `/app`.

Test configuration:

```typescript
vi.stubEnv("VITE_PILOT_CONTACT_URL", "https://example.org/piloto")
expect(getPilotContactUrl()).toBe("https://example.org/piloto")
vi.stubEnv("VITE_PILOT_CONTACT_URL", "javascript:alert(1)")
expect(getPilotContactUrl()).toBeNull()
```

Accept only `https:` and `mailto:` URLs. With no valid URL, assert the CTA is a disabled button with accessible explanation instead of a dead link.

- [ ] **Step 2: Run landing tests and verify the approved copy is absent**

```powershell
Set-Location frontend
npx vitest run src/pages/LandingPage.test.jsx src/lib/landingConfig.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL.

- [ ] **Step 3: Implement `landingConfig` and the new page structure**

Build semantic sections for header, hero, operational flow, three interfaces, offline/security, municipal view and final CTA. Reuse inline SVG/CSS UI previews; do not add stock photography or fabricated testimonials. Mark every illustrative metric with `Exemplo demonstrativo`.

- [ ] **Step 4: Add responsive landing styles**

Use the approved deep green, orange, cream and white. At `940px`, collapse two-column sections. At `620px`, stack CTAs, keep access visible, prevent floating preview elements from overflowing and maintain a minimum 44px touch target.

- [ ] **Step 5: Document and configure contact URL**

Create `frontend/.env.example`:

```dotenv
VITE_API_URL=http://localhost:8000/api
VITE_USE_MOCK=false
VITE_DEMO_MODE=false
VITE_PILOT_CONTACT_URL=
```

Add `VITE_PILOT_CONTACT_URL` with `sync: false` to the dashboard service in `render.yaml`. Document that production/homologation must set an HTTPS or mailto destination and that the frontend collects no contact form data.

- [ ] **Step 6: Run landing tests, build and inspect the Blueprint diff**

```powershell
npx vitest run src/pages/LandingPage.test.jsx src/lib/landingConfig.test.ts --pool=threads --maxWorkers=1 --no-file-parallelism
npm run build
Set-Location ..
git diff --check -- render.yaml
Select-String -Path render.yaml -Pattern "VITE_PILOT_CONTACT_URL" -Context 2,2
```

Expected: tests PASS, Vite build succeeds, no whitespace error, and the new variable appears once under `edustock-demo-dashboard.envVars` with `sync: false`.

- [ ] **Step 7: Commit the public experience**

```powershell
git add frontend/src/pages/LandingPage.jsx frontend/src/pages/LandingPage.test.jsx frontend/src/lib/landingConfig.ts frontend/src/lib/landingConfig.test.ts frontend/src/index.css frontend/.env.example render.yaml README.md
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Apresenta a operação integrada na página pública"
```

---

### Task 7: Shared visual system and existing-page consistency

**Files:**
- Modify: `packages/operacao-shared/src/design-tokens.css`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/ui/DataLoadError.jsx`
- Modify: `frontend/src/components/ui/Modal.jsx`
- Modify: `frontend/src/components/ui/Toast.jsx`
- Modify: `frontend/src/pages/InventarioPage.jsx`
- Modify: `frontend/src/pages/MovimentacoesPage.jsx`
- Modify: `frontend/src/pages/MerendaPage.jsx`
- Modify: `frontend/src/pages/RelatoriosPage.jsx`
- Modify: `frontend/src/pages/RedeMunicipalPage.jsx`
- Create: `frontend/src/pages/PageShells.test.jsx`
- Test: existing component/page tests adjacent to these files.

**Interfaces:**
- Consumes: existing `card`, `field`, `btn`, `tag` and shared token classes.
- Produces: consistent visual foundation without changing feature APIs or form behavior.

- [ ] **Step 1: Add failing visual-contract assertions**

Extend existing tests to assert shared accessible structure rather than pixel values: page `h1`, labelled primary action, `role="alert"` for failures, visible retry, labelled dialogs, and preserved focusable controls.

Create `frontend/src/pages/PageShells.test.jsx`. Mock data and large child views before importing the pages:

```jsx
vi.mock("../hooks/useDashboardData", () => ({
  useDashboardData: () => ({
    produtos: [], categorias: [], grupos: [], fornecedores: [], movimentacoes: [],
    loading: false, error: null, carregar: vi.fn(), counts: { cat: {}, grupo: {} },
    visiveis: () => [], search: "", resumo: { valor: 0, baixo: 0, vencidos: 0, total: 0 },
  }),
}))
vi.mock("../api", () => ({
  operacaoApi: { resumo: vi.fn().mockResolvedValue({ total_alunos: 0, turmas: [] }) },
  redeApi: { indicadores: vi.fn().mockResolvedValue({ consolidado: {}, por_escola: [] }) },
  produtosApi: {}, movimentacoesApi: {}, categoriasApi: {}, gruposApi: {}, relatoriosApi: {},
}))
vi.mock("../features/merenda/ContagemView", () => ({ default: () => <div>Contagem</div> }))
vi.mock("../features/merenda/ContagemWidget", () => ({ default: () => <div>Resumo</div> }))
vi.mock("../features/merenda/KitchenProductionView", () => ({ default: () => <div>Produção</div> }))
vi.mock("../features/movimentacoes/MovimentacoesView", () => ({ default: () => <div>Movimentos</div> }))
vi.mock("../features/relatorios/RelatoriosView", () => ({ default: () => <div>Relatório</div> }))
```

Then render the five pages inside `MemoryRouter` with one table-driven assertion:

```jsx
it.each([
  ["Inventário", InventarioPage],
  ["Movimentações", MovimentacoesPage],
  ["Merenda Escolar", MerendaPage],
  ["Relatórios", RelatoriosPage],
  ["Painel municipal", RedeMunicipalPage],
])("%s usa o shell visual compartilhado", async (heading, Page) => {
  const { container } = render(<MemoryRouter><Page /></MemoryRouter>)
  expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument()
  expect(container.querySelector(".page-shell")).toBeInTheDocument()
  expect(container.querySelector(".page-heading")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the affected tests and verify shared classes are absent**

```powershell
Set-Location frontend
npx vitest run src/components/ui src/pages/InventarioPage.test.jsx src/pages/PageShells.test.jsx --pool=threads --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because `page-shell` and `page-heading` are absent.

- [ ] **Step 3: Consolidate tokens and base classes**

Keep current token names for compatibility, update values to the approved palette, and add reusable `page-shell`, `page-heading`, `page-subtitle`, `metric-card`, `section-card` and `action-card` classes. Preserve `prefers-reduced-motion`, focus outlines and existing state colors.

- [ ] **Step 4: Apply classes to the main existing pages**

Change only layout wrappers, headings, spacing and surface classes. Do not alter data fetching, validation, modal submission, inventory calculations, reports or meal operations. Keep existing text used by functional tests unless the approved information architecture requires a label change.

- [ ] **Step 5: Run component and page regressions**

```powershell
npx vitest run src/components src/pages src/features --pool=threads --maxWorkers=1 --no-file-parallelism
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the visual foundation**

```powershell
Set-Location ..
git add packages/operacao-shared/src/design-tokens.css frontend/src/index.css frontend/src/components/ui/DataLoadError.jsx frontend/src/components/ui/Modal.jsx frontend/src/components/ui/Toast.jsx frontend/src/pages/InventarioPage.jsx frontend/src/pages/MovimentacoesPage.jsx frontend/src/pages/MerendaPage.jsx frontend/src/pages/RelatoriosPage.jsx frontend/src/pages/RedeMunicipalPage.jsx frontend/src/pages/InventarioPage.test.jsx frontend/src/pages/PageShells.test.jsx
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Unifica a linguagem visual das áreas de gestão"
```

---

### Task 8: Browser validation across sizes and roles

**Files:**
- Modify: `frontend/e2e/dashboard.spec.ts`
- Modify: `frontend/playwright.config.ts`
- Create: `frontend/e2e/dashboard.spec.ts-snapshots/*.png`

**Interfaces:**
- Consumes: public landing, `/app`, API mock contract and navigation from Tasks 3-7.
- Produces: browser evidence for desktop, tablet, mobile, roles, error and navigation flows.

- [ ] **Step 1: Update the mocked API contract**

Add `/dashboard/operacao/` to `prepararApi` with a complete current-school fixture. Include `escola`, module slugs, summary values, three meal stages, at least two actions, seven trend points and two audit rows.

- [ ] **Step 2: Update login expectations**

Change `entrar(page)` to expect `/app` and the `Operação do dia` heading. Existing inventory and entry tests must navigate explicitly to Inventário before interacting with product controls.

- [ ] **Step 3: Add end-to-end dashboard scenarios**

Add tests for:

```typescript
test("gestor percorre dashboard, merenda, inventário e retorna ao início", async ({ page }) => {
  await prepararApi(page)
  await entrar(page)
  await page.getByRole("link", { name: "Merenda" }).click()
  await expect(page.getByRole("heading", { name: "Merenda Escolar" })).toBeVisible()
  await page.getByRole("link", { name: "Inventário" }).click()
  await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible()
  await page.getByRole("link", { name: "Operação do dia" }).click()
  await expect(page).toHaveURL(/\/app$/)
})

test("dashboard mantém leitura e ação principal no celular", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await prepararApi(page)
  await entrar(page)
  await expect(page.getByText("Próximas ações")).toBeVisible()
  await page.getByRole("button", { name: "Abrir menu" }).click()
  await expect(page.getByRole("complementary", { name: "Navegação principal" })).toBeVisible()
  const largura = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(largura).toBeLessThanOrEqual(375)
})

test("perfil sem módulo de merenda não recebe ação de produção", async ({ page }) => {
  await prepararApi(page, {}, { papel: "OPERADOR", is_staff: false, modulos: ["inventario", "alertas"] })
  await entrar(page)
  await expect(page.getByText("Confirmar produção do almoço")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Merenda" })).toHaveCount(0)
})

test("falha no resumo permite tentar novamente", async ({ page }) => {
  await prepararApi(page)
  let primeira = true
  await page.route("**/api/dashboard/operacao/**", async (route) => {
    if (primeira) {
      primeira = false
      return json(route, { detail: "Indisponível" }, 503)
    }
    return route.fallback()
  })
  await entrar(page)
  await page.getByRole("button", { name: "Tentar novamente" }).click()
  await expect(page.getByText("426")).toBeVisible()
})
```

Extend `Sessao` with `modulos?: string[]` and make both login and dashboard fixtures use `sessao.modulos ?? MODULOS`.

Add keyboard coverage: press `Tab` from the top of the authenticated page, assert focus reaches the first navigation control, open and close mobile navigation with keyboard controls, and verify the focused element has a visible outline.

- [ ] **Step 4: Add a tablet project**

In `frontend/playwright.config.ts`, add `dashboard-tablet` using the dashboard spec, base URL `http://127.0.0.1:4173` and viewport `{ width: 768, height: 1024 }`. Keep workers serial in CI.

- [ ] **Step 5: Run focused browser tests**

```powershell
Set-Location frontend
npx playwright test e2e/dashboard.spec.ts --project=dashboard --workers=1
npx playwright test e2e/dashboard.spec.ts --project=dashboard-tablet --workers=1
```

Expected: PASS with no console errors or horizontal overflow assertions.

- [ ] **Step 6: Capture and review deterministic visual baselines**

Add assertions after the complete landing and dashboard have loaded:

```typescript
await expect(page).toHaveScreenshot("landing-desktop.png", { fullPage: true, animations: "disabled" })
await expect(page).toHaveScreenshot("dashboard-desktop.png", { fullPage: true, animations: "disabled" })
```

Generate the baselines once, open both PNGs and compare them with the approved mockups, then rerun without updating:

```powershell
npx playwright test e2e/dashboard.spec.ts --project=dashboard --workers=1 --update-snapshots
npx playwright test e2e/dashboard.spec.ts --project=dashboard --workers=1
```

Expected: both images are legible, only the public preview carries the demonstrative label, and the second run PASSes without pixel differences.

- [ ] **Step 7: Commit browser coverage**

```powershell
Set-Location ..
git add frontend/e2e/dashboard.spec.ts frontend/e2e/dashboard.spec.ts-snapshots frontend/playwright.config.ts
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Valida o novo painel nos tamanhos de uso escolar"
```

---

### Task 9: Full regression and delivery evidence

**Files:**
- Modify only files needed to fix regressions caused by Tasks 1-8.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified implementation with no pending migration or unrelated work.

- [ ] **Step 1: Inspect the final diff and working tree**

```powershell
git status --short
git diff origin/main...HEAD --stat
git diff --check
```

Expected: only scoped files, no whitespace errors, no `.env` secrets, build output or `.superpowers` session files.

- [ ] **Step 2: Run complete backend validation**

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Expected: all PASS and no migration generated.

- [ ] **Step 3: Run dashboard frontend validation serially**

```powershell
Set-Location frontend
npm run lint
npm run typecheck
npx vitest run --pool=threads --maxWorkers=1 --no-file-parallelism
npm run build
```

Expected: all PASS.

- [ ] **Step 4: Run both operational apps serially**

```powershell
Set-Location ..\app-alunos
npx vitest run --pool=threads --maxWorkers=1 --no-file-parallelism
npm run build
Set-Location ..\app-cozinha
npx vitest run --pool=threads --maxWorkers=1 --no-file-parallelism
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Run complete browser regression with one worker**

```powershell
Set-Location ..\frontend
npx playwright test --workers=1
```

Expected: all configured projects PASS.

- [ ] **Step 6: Verify production-sensitive configuration**

Confirm `VITE_PILOT_CONTACT_URL` has no secret value committed, preview data is labelled demonstrative, the authenticated dashboard contains no synthetic fallback, and endpoint responses contain no audit `detalhes`, token, PIN or financial value without permission.

- [ ] **Step 7: Commit scoped regression fixes when present**

When `git status --short` lists a scoped regression fix, stage those exact files and commit:

```powershell
git -c user.name="DEV-CiceroJose" -c user.email="danielamorimk095@gmail.com" commit -m "Consolida a experiência visual e operacional"
```

When the working tree is already clean, mark this step complete without creating an empty commit.

- [ ] **Step 8: Record delivery evidence**

Report branch, commit list, exact test counts, build results, remaining operational configuration (`VITE_PILOT_CONTACT_URL`) and any item that was not validated. Do not claim deployment, pilot results or production readiness without direct evidence.
