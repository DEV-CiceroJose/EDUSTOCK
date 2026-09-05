# Integração EduStock VPS e Main — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reunir na `main` a estrutura municipal/multi-escola e a preparação para VPS sem perder as melhorias de demonstração, estoque, estorno, offline e segurança já presentes na linha principal.

**Architecture:** A integração parte de `origin/main` e recebe `origin/edustock-vps` por merge explícito. Conflitos devem ser resolvidos preservando os dois domínios; migrations paralelas são renumeradas em uma sequência linear validada em banco vazio, e mudanças de modelos/API/frontends são conciliadas pelo contrato mais completo, nunca escolhidas em bloco por uma única branch.

**Tech Stack:** Python 3.13/3.14, Django 6, DRF, PostgreSQL 16, React 19, Vite 8, Vitest e Playwright.

**Spec:** `docs/PREPARACAO_VPS_HOSTINGER.md`, `docs/HANDOFF_BRANCHES_E_CENTELHA_2026-08-18.md` e `docs/CHECKLIST_GO_LIVE_DEMO.md`.

## Global Constraints

- Preservar inventário, conversões de consumo, lotes FEFO, estornos e fila offline da `main`.
- Preservar Município → Escola, vínculos, escopo autenticado, painel de rede, catálogo municipal e contagens físicas da `edustock-vps`.
- Não reescrever a arquitetura nem remover funcionalidades existentes.
- Não alterar nem excluir os worktrees já existentes em `.worktrees/`.
- Não atualizar a `main` remota antes da validação completa do resultado integrado.
- Commits devem ser atribuídos a `DEV-CiceroJose` e usar mensagens naturais em português.

---

### Task 1: Fixar a base e registrar o baseline

**Files:**
- Create: `docs/superpowers/plans/2026-09-05-integracao-edustock-vps-main.md`
- Test: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `origin/main` em `4869f0e` e `origin/edustock-vps` em `c3a8e57`.
- Produces: branch isolada `new/integrate-edustock-vps-main` com baseline reproduzível.

- [x] **Step 1: Atualizar referências remotas e confirmar o grafo**

  Run: `git fetch --prune origin && git rev-list --left-right --count origin/main...origin/edustock-vps`

  Expected: `29 5`, com base comum `f45ae92`.

- [x] **Step 2: Criar worktree isolado a partir da main**

  Run: `git worktree add C:/CodexWorktrees/EDUSTOCK/integrate-edustock-vps-main -b new/integrate-edustock-vps-main origin/main`

  Expected: worktree limpo em `4869f0e`.

- [x] **Step 3: Validar o baseline da main**

  Run: backend completo, dashboard com testes/lint/typecheck/build e os dois PWAs com testes/build.

  Expected: backend 267 testes; dashboard 141 testes; Alunos 50 testes; Cozinha 40 testes; zero falhas.

- [ ] **Step 4: Commitar este plano**

  Run: `git add docs/superpowers/plans/2026-09-05-integracao-edustock-vps-main.md && git commit`

  Expected: um commit documental anterior ao merge.

### Task 2: Mesclar as branches e preservar os contratos

**Files:**
- Modify: `core/models.py`
- Modify: `core/services.py`
- Modify: `core/operacao.py`
- Modify: `core/operacao_views.py`
- Modify: `core/serializers.py`
- Modify: `plataforma/models.py`
- Modify: `plataforma/views.py`
- Modify: `plataforma/permissions.py`
- Modify: `easystock/settings.py`
- Modify: `frontend/src/api/http.ts`
- Modify: `frontend/src/pages/AdminUsuariosPage.jsx`
- Modify: `frontend/src/layouts/Sidebar.jsx`
- Test: `core/tests/`, `plataforma/tests/`, `easystock/tests/`, `frontend/src/**/*.test.*`

**Interfaces:**
- Consumes: contratos de inventário/unidades/estorno da `main` e escola/município da `edustock-vps`.
- Produces: modelos, permissões e APIs combinados, com todo acesso operacional limitado à escola autenticada.

- [ ] **Step 1: Executar o merge sem publicar**

  Run: `git merge --no-ff origin/edustock-vps`

  Expected: conflitos locais explícitos, sem alteração remota.

- [ ] **Step 2: Resolver cada conflito pelo contrato combinado**

  Para modelos e serviços, manter campos de unidade/conversão/estorno e acrescentar os campos `escola` e vínculos municipais. Para permissões, manter as restrições de demonstração e último administrador junto do escopo de rede. Para frontends, preservar tratamento de sessão/falhas da `edustock-vps` e recursos de estorno/configuração da `main`.

- [ ] **Step 3: Executar testes focados após cada grupo de conflitos**

  Run: `python manage.py test core.tests plataforma.tests easystock.tests`

  Expected: zero falhas antes de avançar para a suíte integral.

### Task 3: Linearizar migrations paralelas

**Files:**
- Preserve: `core/migrations/0022_unidades_de_consumo.py`
- Preserve: `core/migrations/0023_estorno_movimentacao.py`
- Preserve: `core/migrations/0024_materializa_lotes_legados.py`
- Preserve: `core/migrations/0025_amplia_nome_turma_frequencia.py`
- Rename: `core/migrations/0022_cardapiomodelomunicipal_catalogoprodutomunicipal_and_more.py` → `core/migrations/0026_rede_municipal_e_escopo_escola.py`
- Rename: `core/migrations/0023_contagemestoque.py` → `core/migrations/0027_contagemestoque.py`
- Preserve: `plataforma/migrations/0006_perfil_acesso_legado.py`
- Rename: `plataforma/migrations/0006_escola_municipio_tokenacesso_papel_rede_and_more.py` → `plataforma/migrations/0007_escola_municipio_tokenacesso_papel_rede_and_more.py`
- Test: `core/tests/test_migrations.py`
- Test: `plataforma/tests/test_migrations.py`

**Interfaces:**
- Consumes: bancos existentes que chegaram até `core.0025` e `plataforma.0006` pela `main`.
- Produces: um único grafo sem folhas concorrentes, aplicável em banco vazio e em atualização.

- [ ] **Step 1: Renomear as migrations municipais e atualizar dependências**

  `plataforma.0007` deve depender de `plataforma.0006_perfil_acesso_legado`; `core.0026` deve depender de `core.0025_amplia_nome_turma_frequencia` e `plataforma.0007`; `core.0027` deve depender de `core.0026` e `plataforma.0007`.

- [ ] **Step 2: Verificar o grafo**

  Run: `python manage.py makemigrations --check --dry-run && python manage.py showmigrations`

  Expected: nenhuma migration nova e uma única sequência terminal por app.

- [ ] **Step 3: Aplicar em banco vazio**

  Run: `python manage.py migrate --noinput`

  Expected: todas as migrations aplicadas sem conflito de estado ou constraint.

### Task 4: Consolidar deploy e documentação

**Files:**
- Modify: `render.yaml`
- Modify: `README.md`
- Modify: `DEPLOY.md`
- Modify: `docs/PREPARACAO_VPS_HOSTINGER.md`
- Create: `docs/HANDOFF_INTEGRACAO_MAIN_2026-09-05.md`

**Interfaces:**
- Consumes: Blueprint seguro da demonstração e configuração VPS por ambiente.
- Produces: documentação que separa claramente demonstração Render, piloto escolar e produção VPS.

- [ ] **Step 1: Preservar o Blueprint da demonstração na Render**

  Manter os quatro serviços, PostgreSQL, dados fictícios, cabeçalhos e variáveis `DEMO_*` da `main`.

- [ ] **Step 2: Preservar a preparação de produção VPS**

  Manter `deploy/vps.env.example`, variáveis CORS/CSRF, `DATABASE_URL`, proxy confiável, HTTPS, backup e restauração.

- [ ] **Step 3: Escrever o handoff final**

  Registrar commits integrados, conflitos resolvidos, testes executados, pendências de infraestrutura real, backup/restauração, LGPD, treinamento e piloto assistido.

### Task 5: Validar e publicar a main

**Files:**
- Test: `.github/workflows/ci.yml`
- Test: `frontend/e2e/*.spec.ts`

**Interfaces:**
- Consumes: árvore integrada e limpa.
- Produces: `main` remota avançada somente por fast-forward para a revisão aprovada.

- [ ] **Step 1: Executar a matriz completa local**

  Run: backend completo; dashboard testes/lint/typecheck/build; Alunos e Cozinha testes/build; Playwright com um worker.

  Expected: zero falhas em todas as suítes.

- [ ] **Step 2: Verificar produção e segurança de dependências**

  Run: `python manage.py check --deploy` com variáveis sintéticas de produção e `npm audit --omit=dev` nos três frontends.

  Expected: somente `security.W021` enquanto HSTS preload estiver deliberadamente desativado e zero vulnerabilidades de produção.

- [ ] **Step 3: Atualizar a main sem sobrescrever trabalho remoto**

  Run: `git fetch origin`, confirmar `origin/main` ainda em `4869f0e`, avançar `main` por fast-forward e executar `git push origin HEAD:main`.

  Expected: push não forçado aceito e CI iniciada para o commit integrado.

- [ ] **Step 4: Confirmar CI e registrar o resultado**

  Run: acompanhar a execução do GitHub Actions para o SHA publicado.

  Expected: jobs Backend Django, Backend PostgreSQL, frontend, app-alunos, app-cozinha e E2E concluídos com sucesso.
