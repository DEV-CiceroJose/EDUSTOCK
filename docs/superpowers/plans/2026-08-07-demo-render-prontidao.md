# EduStock Demo Endurecida na Render Free Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os bloqueadores críticos do EduStock, publicar uma demonstração descartável com dados fictícios na Render Free e abrir um PR validado para `main`.

**Architecture:** Manter o monólito Django/DRF e os três frontends React existentes. Endurecer os limites já presentes — serviços transacionais, cliente compartilhado dos subaplicativos, autenticação própria e Blueprint da Render — sem reescrever a arquitetura. Cada tarefa entrega um comportamento verificável e um commit independente.

**Tech Stack:** Python 3.13, Django 6.0, Django REST Framework, PostgreSQL, React 19, Vite 8, Vitest 4, Playwright, GitHub Actions e Render Blueprint.

## Global Constraints

- A demonstração usa somente dados fictícios e credenciais temporárias.
- A entrega permanece single-school; multi-escola e MFA ficam fora do escopo.
- O backend usa Render Web Service Free; os três frontends usam Static Sites; o banco usa Render PostgreSQL Free.
- Redis não é obrigatório; o cache compartilhado em PostgreSQL permanece como fallback da demonstração.
- Nenhuma credencial, senha ou PIN pode ser gravado no Git ou emitido em logs.
- Toda alteração de comportamento segue TDD: teste falhando, implementação mínima e teste passando.
- Nenhuma funcionalidade existente pode ser removida fora das mudanças explicitamente aprovadas na especificação.
- Commits devem ser humanizados e atribuídos a `DEV-CiceroJose`.
- O PR final parte de `new/demo-render-prontidao` e tem `main` como base.

---

### Task 1: Restaurar a proteção E2E e a instalação completa do CI

**Files:**
- Modify: `frontend/e2e/dashboard.spec.ts:111-118`
- Modify: `.github/workflows/ci.yml:68-90`
- Test: `frontend/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: campo de senha acessível `#login-password` e três projetos Vite.
- Produces: helper E2E `entrar(page)` sem ambiguidade e job E2E com dependências dos três aplicativos.

- [ ] **Step 1: Reproduzir as duas causas atuais**

Run:

```powershell
npm run test:e2e -- --project=dashboard
gh run view 30872562416 --job 91877375155 --log-failed
```

Expected: Playwright falha porque `getByLabel("Senha")` encontra o input e o botão; o log remoto mostra ausência de `app-cozinha/node_modules`.

- [ ] **Step 2: Tornar o seletor do campo inequívoco**

Replace the password lookup in `entrar` with:

```ts
await page.getByRole("textbox", { name: "Senha", exact: true }).fill("segredo")
```

- [ ] **Step 3: Instalar Cozinha no job E2E**

Add the lockfile to `cache-dependency-path` and the install command:

```yaml
cache-dependency-path: |
  frontend/package-lock.json
  app-alunos/package-lock.json
  app-cozinha/package-lock.json

- name: Instalar dependências
  run: |
    npm ci --prefix frontend
    npm ci --prefix app-alunos
    npm ci --prefix app-cozinha
```

- [ ] **Step 4: Verificar todos os fluxos E2E**

Run:

```powershell
npm run test:e2e
```

Expected: 18 testes passam, 0 falhas.

- [ ] **Step 5: Commit**

```powershell
git add -- .github/workflows/ci.yml frontend/e2e/dashboard.spec.ts
git commit -m "test: restaura cobertura dos fluxos críticos"
```

### Task 2: Impedir dados simulados em builds de produção

**Files:**
- Create: `frontend/src/lib/runtimeMode.ts`
- Create: `frontend/src/lib/runtimeMode.test.ts`
- Create: `frontend/src/pages/ConfiguracoesPage.test.jsx`
- Modify: `frontend/src/api/index.ts:1-21`
- Modify: `frontend/src/pages/ConfiguracoesPage.jsx:1-84`
- Modify: `frontend/src/layouts/Header.jsx`
- Test: `frontend/src/lib/runtimeMode.test.ts`
- Test: `frontend/src/pages/ConfiguracoesPage.test.jsx`

**Interfaces:**
- Produces: `resolveRuntimeMode({ production, demo, requestedMock }): { useMock: boolean; demo: boolean }`.
- Produces: `RuntimeMode` usado pela seleção de API e pela interface.

- [ ] **Step 1: Escrever os testes falhando do modo de execução**

```ts
import { describe, expect, it } from "vitest"
import { resolveRuntimeMode } from "./runtimeMode"

describe("resolveRuntimeMode", () => {
  it("ignora mock solicitado em produção", () => {
    expect(resolveRuntimeMode({ production: true, demo: true, requestedMock: true }))
      .toEqual({ useMock: false, demo: true })
  })

  it("permite mock somente fora de produção", () => {
    expect(resolveRuntimeMode({ production: false, demo: false, requestedMock: true }).useMock)
      .toBe(true)
  })
})
```

- [ ] **Step 2: Confirmar RED**

Run:

```powershell
npm test -- --run src/lib/runtimeMode.test.ts
```

Expected: FAIL porque `runtimeMode.ts` não existe.

- [ ] **Step 3: Implementar o resolvedor mínimo**

```ts
export type RuntimeMode = { useMock: boolean; demo: boolean }

export function resolveRuntimeMode(input: {
  production: boolean
  demo: boolean
  requestedMock: boolean
}): RuntimeMode {
  return {
    useMock: input.production ? false : input.requestedMock,
    demo: input.demo,
  }
}
```

- [ ] **Step 4: Usar o resolvedor na API real**

In `frontend/src/api/index.ts`:

```ts
const runtimeMode = resolveRuntimeMode({
  production: import.meta.env.PROD,
  demo: import.meta.env.VITE_DEMO_MODE === "true",
  requestedMock: (getConfig() as { useMock: boolean }).useMock,
})
const USE_MOCK = runtimeMode.useMock
```

- [ ] **Step 5: Escrever o teste falhando da tela de configurações**

```jsx
it("não mostra o controle de dados mock em produção", () => {
  vi.stubEnv("PROD", true)
  render(<ConfiguracoesPage />)
  expect(screen.queryByRole("switch", { name: "Usar dados mock" })).not.toBeInTheDocument()
})
```

- [ ] **Step 6: Ocultar o controle e mostrar o selo de demonstração**

Renderizar a seção mock somente quando `!import.meta.env.PROD`. No Header,
mostrar `Demonstração` somente quando `VITE_DEMO_MODE === "true"`.

- [ ] **Step 7: Verificar testes, lint, tipos e build de produção**

```powershell
npm test -- --run src/lib/runtimeMode.test.ts src/pages/ConfiguracoesPage.test.jsx
npm run lint
npm run typecheck
$env:VITE_DEMO_MODE='true'; npm run build
```

Expected: todos os comandos terminam com exit code 0 e o build não inclui o controle mock.

- [ ] **Step 8: Commit**

```powershell
git add -- frontend/src/lib/runtimeMode.ts frontend/src/lib/runtimeMode.test.ts frontend/src/pages/ConfiguracoesPage.jsx frontend/src/pages/ConfiguracoesPage.test.jsx frontend/src/api/index.ts frontend/src/layouts/Header.jsx
git commit -m "fix: impede dados simulados na demonstração"
```

### Task 3: Tornar a fila offline recuperável e visível

**Files:**
- Modify: `packages/operacao-shared/src/offlineQueue.js`
- Create: `packages/operacao-shared/src/OfflineQueueStatus.jsx`
- Modify: `packages/operacao-shared/src/index.js`
- Create: `app-alunos/src/offlineQueue.test.js`
- Create: `app-cozinha/src/offlineQueue.test.js`
- Modify: `app-alunos/src/api.js`
- Modify: `app-cozinha/src/api.js`
- Modify: `app-alunos/src/ContagemView.jsx`
- Modify: `app-cozinha/src/ProducaoView.jsx`
- Modify: `app-alunos/src/ContagemView.test.jsx`
- Modify: `app-cozinha/src/ProducaoView.test.jsx`

**Interfaces:**
- Produces: `createOfflineQueue({ storageKey, send, now? })` com `add`, `flush`, `list`, `retry`, `remove`, `subscribe` e `clear`.
- Produces: entradas `{ id, payload, status, attempts, createdAt, retryAt, lastError }`.
- Produces: `<OfflineQueueStatus entries onRetry onRemove />`.

- [ ] **Step 1: Escrever regressões para os erros hoje descartados**

```js
it.each([429, 500, 503])("mantém HTTP %s como pendente", async (status) => {
  const queue = createOfflineQueue({ storageKey: "fila", send: async () => {
    const error = new Error("falhou")
    error.status = status
    throw error
  }})
  queue.add({ operacao_id: crypto.randomUUID(), quantidade_alunos: 20 })
  await queue.flush()
  expect(queue.list()).toHaveLength(1)
  expect(queue.list()[0].status).toBe("pending")
})

it.each([400, 404, 409, 422])("marca HTTP %s para atenção", async (status) => {
  const queue = createOfflineQueue({ storageKey: "fila", send: async () => {
    const error = new Error("rejeitado")
    error.status = status
    throw error
  }})
  queue.add({ operacao_id: crypto.randomUUID(), quantidade_alunos: 20 })
  await queue.flush()
  expect(queue.list()).toHaveLength(1)
  expect(queue.list()[0].status).toBe("attention")
})
```

- [ ] **Step 2: Confirmar RED nos dois consumidores**

```powershell
npm test -- --run src/offlineQueue.test.js
```

Run once in `app-alunos` and once in `app-cozinha`.
Expected: FAIL porque a fila atual remove respostas HTTP diferentes de 401/403.

- [ ] **Step 3: Implementar persistência versionada e classificação**

```js
export function classifyOfflineError(error) {
  if (!error.status || error.status === 429 || error.status >= 500) return "pending"
  if (error.status === 401 || error.status === 403) return "auth"
  return "attention"
}
```

`flush` deve atualizar a entrada, nunca remover uma falha, incrementar
`attempts`, salvar `lastError` e calcular `retryAt` para 429/5xx. O estado
`auth` pausa o processamento e permanece persistido como `pending`.

- [ ] **Step 4: Adicionar observação da fila**

`subscribe(listener)` deve registrar listeners em memória e retornar uma
função de unsubscribe. Toda escrita chama os listeners com `list()`.

- [ ] **Step 5: Adaptar Alunos e Cozinha ao envelope `payload`**

Os callbacks `send` recebem somente `entry.payload`. O isolamento por turma
continua verificando `_turma` antes do POST.

- [ ] **Step 6: Criar o componente de status**

```jsx
export function OfflineQueueStatus({ entries, onRetry, onRemove }) {
  const attention = entries.filter((entry) => entry.status === "attention")
  const pending = entries.filter((entry) => entry.status === "pending")
  if (!entries.length) return null
  return (
    <section aria-label="Sincronização pendente">
      <p>{pending.length} pendente(s) · {attention.length} requer(em) atenção</p>
      <button type="button" onClick={onRetry}>Tentar novamente</button>
      {attention.map((entry) => (
        <button key={entry.id} type="button" onClick={() => onRemove(entry.id)}>
          Remover registro rejeitado
        </button>
      ))}
    </section>
  )
}
```

- [ ] **Step 7: Integrar o resumo e confirmação de remoção nos dois apps**

As views assinam a fila no `useEffect`, chamam `retry` e usam
`window.confirm` antes de `remove`.

- [ ] **Step 8: Verificar regressões e builds**

```powershell
npm test -- --run
npm run build
```

Run in `app-alunos` and `app-cozinha`.
Expected: todos os testes passam e os dois builds terminam com exit code 0.

- [ ] **Step 9: Commit**

```powershell
git add -- packages/operacao-shared/src app-alunos/src app-cozinha/src
git commit -m "fix: preserva e exibe operações offline pendentes"
```

### Task 4: Modelar conversões corretas de unidade

**Files:**
- Modify: `core/models.py`
- Modify: `core/operacao.py`
- Modify: `core/serializers.py`
- Modify: `core/admin.py`
- Create: `core/migrations/0022_unidades_de_consumo.py`
- Create: `core/tests/test_unidades_consumo.py`
- Modify: `core/tests/test_operacao.py`
- Modify: `core/tests/test_operacao_spec.py`
- Modify: `core/tests/test_improvements.py`

**Interfaces:**
- Produces: `Produto.unidade_consumo: G | ML | UN | null`.
- Produces: `Produto.conteudo_por_unidade: Decimal | null`.
- Produces: `FatorConsumo.quantidade_por_aluno` e `ReceitaIngrediente.quantidade_por_aluno`.
- Produces: `converter_consumo_para_estoque(produto, quantidade_consumo) -> Decimal`.

- [ ] **Step 1: Escrever testes falhando de conversão**

```python
class ConversaoConsumoTest(TestCase):
    def test_pacote_de_500g_converte_100g_em_02_pacote(self):
        produto = Produto(unidade="PC", unidade_consumo="G", conteudo_por_unidade=Decimal("500"))
        self.assertEqual(
            converter_consumo_para_estoque(produto, Decimal("100")),
            Decimal("0.2"),
        )

    def test_produto_sem_conversao_e_rejeitado(self):
        produto = Produto(unidade="CX", unidade_consumo=None, conteudo_por_unidade=None)
        with self.assertRaises(ValidationError):
            converter_consumo_para_estoque(produto, Decimal("12"))
```

- [ ] **Step 2: Confirmar RED**

```powershell
python manage.py test core.tests.test_unidades_consumo
```

Expected: FAIL por campos e função inexistentes.

- [ ] **Step 3: Adicionar campos e renomear quantidades**

```python
UNIDADE_CONSUMO_CHOICES = [("G", "Grama"), ("ML", "Mililitro"), ("UN", "Unidade")]
unidade_consumo = models.CharField(max_length=2, choices=UNIDADE_CONSUMO_CHOICES, null=True, blank=True)
conteudo_por_unidade = models.DecimalField(
    max_digits=12, decimal_places=3, null=True, blank=True,
    validators=[MinValueValidator(Decimal("0.001"))],
)
```

Use `RenameField` para os dois campos `gramas_por_aluno` e uma operação de
dados que preenche `KG/G/1000`, `L/ML/1000` e `UN/UN/1`; `CX` e `PC`
permanecem sem conversão.

- [ ] **Step 4: Implementar conversão e validação**

```python
def converter_consumo_para_estoque(produto, quantidade_consumo):
    if not produto.unidade_consumo or not produto.conteudo_por_unidade:
        raise ValidationError(f"Configure a conversão de unidade de '{produto.nome}'.")
    return Decimal(quantidade_consumo) / produto.conteudo_por_unidade
```

`gerar_plano_do_dia` usa a função para fator legado e ingrediente de receita.

- [ ] **Step 5: Atualizar serializers e Admin**

Expor `unidade_consumo`, `conteudo_por_unidade` e
`quantidade_por_aluno`. Validar que ingrediente e produto têm conversão
configurada antes de salvar.

- [ ] **Step 6: Atualizar testes existentes para os novos nomes**

Substituir todas as construções `gramas_por_aluno=` por
`quantidade_por_aluno=` e definir conversões nos produtos usados pelos testes.

- [ ] **Step 7: Verificar migração e domínio**

```powershell
python manage.py makemigrations --check --dry-run
python manage.py test core.tests.test_unidades_consumo core.tests.test_operacao core.tests.test_operacao_spec core.tests.test_improvements
```

Expected: nenhuma migração pendente e todos os testes passam.

- [ ] **Step 8: Commit**

```powershell
git add -- core/models.py core/operacao.py core/serializers.py core/admin.py core/migrations/0022_unidades_de_consumo.py core/tests
git commit -m "feat: corrige conversões de consumo do estoque"
```

### Task 5: Proteger saldo e implementar estorno auditável

**Files:**
- Modify: `core/models.py`
- Modify: `core/services.py`
- Modify: `core/api_views.py`
- Modify: `core/serializers.py`
- Modify: `core/admin.py`
- Modify: `frontend/src/features/movimentacoes/MovimentacoesView.jsx`
- Create: `core/migrations/0023_estorno_movimentacao.py`
- Create: `core/tests/test_estornos.py`
- Modify: `core/tests/test_admin.py`

**Interfaces:**
- Produces: `Movimentacao.corrige_movimentacao` como relação opcional e única.
- Produces: `registrar_estorno(*, movimentacao, motivo, user) -> Movimentacao`.
- Produces: `POST /api/movimentacoes/{id}/estornar/ { motivo }`, exclusivo de admin.

- [ ] **Step 1: Escrever testes falhando de proteção e estorno**

```python
def test_estorno_cria_movimento_oposto_e_restaura_saldo(self):
    original = registrar_movimentacao(
        produto=self.produto, tipo=Movimentacao.SAIDA,
        quantidade=Decimal("2"), motivo="consumo", user=self.admin,
    )
    estorno = registrar_estorno(
        movimentacao=original, motivo="lançamento incorreto", user=self.admin,
    )
    self.assertEqual(estorno.tipo, Movimentacao.ENTRADA)
    self.assertEqual(estorno.corrige_movimentacao, original)
    self.produto.refresh_from_db()
    self.assertEqual(self.produto.quantidade, Decimal("10"))

def test_nao_permite_estornar_duas_vezes(self):
    original = registrar_movimentacao(
        produto=self.produto, tipo=Movimentacao.SAIDA,
        quantidade=Decimal("2"), motivo="consumo", user=self.admin,
    )
    registrar_estorno(
        movimentacao=original, motivo="lançamento incorreto", user=self.admin,
    )
    with self.assertRaises(ValidationError):
        registrar_estorno(
            movimentacao=original, motivo="nova tentativa", user=self.admin,
        )
```

- [ ] **Step 2: Confirmar RED**

```powershell
python manage.py test core.tests.test_estornos core.tests.test_admin
```

Expected: FAIL porque o serviço e a relação não existem e saldo ainda é editável no Admin.

- [ ] **Step 3: Criar relação e serviço transacional**

Adicionar o campo e usar `transaction.atomic` com `select_for_update` na
movimentação e no produto:

```python
corrige_movimentacao = models.OneToOneField(
    "self",
    on_delete=models.PROTECT,
    null=True,
    blank=True,
    related_name="estorno",
)
```

O motivo deve ter pelo menos cinco caracteres e o tipo criado deve ser o
oposto do original.

- [ ] **Step 4: Criar ação REST administrativa**

```python
@action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, EhAdmin])
def estornar(self, request, pk=None):
    movimento = registrar_estorno(
        movimentacao=self.get_object(),
        motivo=str(request.data.get("motivo", "")).strip(),
        user=request.user,
    )
    return Response(self.get_serializer(movimento).data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 5: Tornar saldo e validade derivados somente leitura no Admin**

Adicionar `quantidade` e `validade` a `ProdutoAdmin.readonly_fields`.

- [ ] **Step 6: Adicionar ação de estorno na lista do Dashboard**

Somente administradores veem a ação. Pedir motivo em modal e atualizar a
lista/saldo após HTTP 201.

- [ ] **Step 7: Verificar domínio, API, Admin e frontend**

```powershell
python manage.py test core.tests.test_estornos core.tests.test_admin core.tests.test_api
npm test -- --run
npm run build
```

Expected: todos passam.

- [ ] **Step 8: Commit**

```powershell
git add -- core frontend/src/features/movimentacoes
git commit -m "feat: adiciona estorno auditável de movimentações"
```

### Task 6: Completar o ciclo de vida das contas administrativas

**Files:**
- Modify: `plataforma/authentication.py`
- Modify: `plataforma/serializers.py`
- Modify: `plataforma/views.py`
- Modify: `plataforma/management/commands/criar_admin.py`
- Modify: `plataforma/tests/test_authentication.py`
- Modify: `plataforma/tests/test_views.py`
- Modify: `plataforma/tests/test_management_command.py`
- Modify: `frontend/src/pages/AdminUsuariosPage.jsx`
- Modify: `frontend/src/pages/AdminUsuariosPage.test.jsx`
- Create: `frontend/src/features/usuarios/ResetPasswordModal.jsx`
- Create: `frontend/src/features/usuarios/ResetPasswordModal.test.jsx`

**Interfaces:**
- Extends: `UsuarioSerializer` com `is_active`.
- Produces: `POST /api/usuarios/{id}/senha/` e `POST /api/usuarios/{id}/revogar-sessoes/`.
- Changes: token de usuário inativo é apagado e rejeitado.

- [ ] **Step 1: Escrever testes falhando do backend**

```python
def test_token_de_usuario_inativo_e_revogado(self):
    self.user.is_active = False
    self.user.save(update_fields=["is_active"])
    resposta = self.client.get("/api/produtos/", HTTP_AUTHORIZATION=f"Token {self.raw_token}")
    self.assertEqual(resposta.status_code, 401)
    self.assertFalse(TokenAcesso.objects.filter(pk=self.token.pk).exists())

def test_admin_redefine_senha_sem_auditar_segredo(self):
    resposta = self.client.post(
        f"/api/usuarios/{self.operador.pk}/senha/", {"password": "Nova-Senha-123"}, format="json"
    )
    self.assertEqual(resposta.status_code, 204)
    self.assertNotIn("Nova-Senha-123", str(RegistroAuditoria.objects.latest("id").detalhes))
```

- [ ] **Step 2: Confirmar RED**

```powershell
python manage.py test plataforma.tests.test_authentication plataforma.tests.test_views plataforma.tests.test_management_command
```

Expected: FAIL nos comportamentos novos.

- [ ] **Step 3: Rejeitar usuário inativo na autenticação**

Em `TokenAcessoAuthentication.authenticate`, apagar o token e lançar
`AuthenticationFailed("Usuário inativo.")` antes de retornar o usuário.

- [ ] **Step 4: Adicionar estado, senha e revogação à API**

`UsuarioSerializer` expõe `is_active`. Desativação revoga todos os tokens.
A ação `senha` chama `validate_password`, `set_password`, salva, revoga tokens
e audita somente `campos: ["password"]`. Bloquear auto-desativação do último
admin ativo.

- [ ] **Step 5: Exigir módulos explícitos para novo operador**

No `validate`, uma criação com `papel=OPERADOR` e `modulos=[]` retorna erro.
Perfis antigos vazios continuam sendo interpretados como legado.

- [ ] **Step 6: Proteger o comando `criar_admin`**

Aceitar `--password-env EDUSTOCK_ADMIN_PASSWORD`; sem a variável, usar
`getpass.getpass("Senha: ")`. Remover a senha posicional.

- [ ] **Step 7: Escrever os testes falhando da interface**

Cobrir desativação, reativação, redefinição de senha e revogação de sessões
em `AdminUsuariosPage.test.jsx` e `ResetPasswordModal.test.jsx`.

- [ ] **Step 8: Implementar controles administrativos**

Adicionar ações com confirmação, mensagens de erro específicas e atualização
otimista somente para ativação; senha e revogação aguardam confirmação HTTP.

- [ ] **Step 9: Verificar backend e Dashboard**

```powershell
python manage.py test plataforma
npm test -- --run src/pages/AdminUsuariosPage.test.jsx src/features/usuarios/ResetPasswordModal.test.jsx
npm run lint
npm run typecheck
npm run build
```

Expected: todos passam.

- [ ] **Step 10: Commit**

```powershell
git add -- plataforma frontend/src/pages/AdminUsuariosPage.jsx frontend/src/pages/AdminUsuariosPage.test.jsx frontend/src/features/usuarios/ResetPasswordModal.jsx frontend/src/features/usuarios/ResetPasswordModal.test.jsx
git commit -m "feat: completa gestão segura de usuários"
```

### Task 7: Endurecer produção e preparar dados fictícios

**Files:**
- Modify: `easystock/settings.py`
- Create: `easystock/security.py`
- Create: `plataforma/management/commands/preparar_demo.py`
- Create: `plataforma/tests/test_demo_command.py`
- Create: `easystock/tests/__init__.py`
- Create: `easystock/tests/test_production_settings.py`
- Modify: `build.sh`
- Modify: `render.yaml`
- Delete: `frontend/.env.production`
- Delete: `app-alunos/.env.production`
- Delete: `app-cozinha/.env.production`

**Interfaces:**
- Produces: `csv_env(name, env=os.environ) -> list[str]` em `easystock.security`.
- Produces: `validate_production_env(env) -> dict[str, object]` sem importar as settings.
- Produces: comando `python manage.py preparar_demo`.
- Changes: `OPERACAO_TOKEN_TTL_HORAS` e `LOGIN_TOKEN_TTL_HORAS` passam a aceitar ambiente.
- Requires in production: `DATABASE_URL`, `SECRET_KEY`, `PIN_LOOKUP_SECRET`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`.

- [ ] **Step 1: Escrever testes falhando de configuração**

```python
def test_producao_sem_database_url_falha(self):
    env = {
        "APP_ENV": "production",
        "SECRET_KEY": "x" * 64,
        "PIN_LOOKUP_SECRET": "y" * 64,
        "ALLOWED_HOSTS": "demo.invalid",
        "CORS_ALLOWED_ORIGINS": "https://demo.invalid",
    }
    with self.assertRaisesMessage(ImproperlyConfigured, "DATABASE_URL"):
        validate_production_env(env)

def test_producao_rejeita_debug(self):
    env = {
        "APP_ENV": "production",
        "DEBUG": "true",
        "DATABASE_URL": "postgresql://u:p@db.invalid:5432/demo",
        "SECRET_KEY": "x" * 64,
        "PIN_LOOKUP_SECRET": "y" * 64,
        "ALLOWED_HOSTS": "demo.invalid",
        "CORS_ALLOWED_ORIGINS": "https://demo.invalid",
    }
    with self.assertRaisesMessage(ImproperlyConfigured, "DEBUG"):
        validate_production_env(env)
```

- [ ] **Step 2: Escrever testes falhando do comando idempotente**

```python
DEMO_ENV = {
    "DEMO_ADMIN_USERNAME": "admin.demo",
    "DEMO_ADMIN_PASSWORD": "Senha-Ficticia-123",
    "DEMO_OPERATOR_USERNAME": "operador.demo",
    "DEMO_OPERATOR_PASSWORD": "Senha-Ficticia-456",
    "DEMO_ALUNOS_PIN": "1357",
    "DEMO_COZINHA_PIN": "2468",
    "DEMO_EXPIRES_AT": "2026-09-06T23:59:59-03:00",
}

@override_settings(DEMO_MODE=True)
@patch.dict(os.environ, DEMO_ENV, clear=False)
def test_preparar_demo_pode_rodar_duas_vezes(self):
    call_command("preparar_demo")
    call_command("preparar_demo")
    self.assertEqual(User.objects.filter(username=DEMO_ENV["DEMO_ADMIN_USERNAME"]).count(), 1)
    self.assertEqual(PinAcesso.objects.filter(papel=PinAcesso.COZINHA).count(), 1)
```

- [ ] **Step 3: Confirmar RED**

```powershell
python manage.py test easystock.tests.test_production_settings plataforma.tests.test_demo_command
```

Expected: FAIL porque as validações e o comando não existem.

- [ ] **Step 4: Implementar leitura segura de ambiente**

`csv_env` separa vírgulas, remove espaços e descarta vazios.
`validate_production_env` recebe um mapping, exige todos os campos obrigatórios,
rejeita DEBUG e localhost em CORS/CSRF e devolve valores já normalizados. As
settings chamam esse helper quando `APP_ENV=production`. Adicionar
`django.middleware.csp.ContentSecurityPolicyMiddleware` e `SECURE_CSP` com
`CSP.SELF` para scripts, estilos, imagens e conexões aos hosts explicitamente
permitidos.

- [ ] **Step 5: Implementar `preparar_demo` com transação atômica**

O comando verifica `settings.DEMO_MODE`, lê as sete variáveis:

```text
DEMO_ADMIN_USERNAME
DEMO_ADMIN_PASSWORD
DEMO_OPERATOR_USERNAME
DEMO_OPERATOR_PASSWORD
DEMO_ALUNOS_PIN
DEMO_COZINHA_PIN
DEMO_EXPIRES_AT
```

Usar `get_or_create` por chaves naturais e serviços reais de entrada para
formar saldo/lotes. Aplicar `set_password` quando a credencial fornecida não
corresponder ao hash atual, permitindo rotação idempotente. Recusar execução
quando `DEMO_EXPIRES_AT` já tiver passado e nunca imprimir segredos.

- [ ] **Step 6: Atualizar o processo de build**

`build.sh` executa, com `set -o errexit`, instalação, `collectstatic`, migrações
e, quando `DEMO_MODE=True`, `preparar_demo`. O comando é idempotente, portanto
um novo build não duplica os dados fictícios. O `startCommand` permanece apenas
com Gunicorn; qualquer falha de migração ou seed interrompe o build.

- [ ] **Step 7: Declarar o Blueprint gratuito**

O `render.yaml` deve conter `plan: free` no backend e no banco, nomes
`edustock-demo-*`, PostgreSQL 18, health check, `sync: false` nas credenciais
da demo, `LOGIN_TOKEN_TTL_HORAS=2`, `OPERACAO_TOKEN_TTL_HORAS=2` e variáveis
de build nos três sites estáticos. Declarar cabeçalhos `Content-Security-Policy`,
`Referrer-Policy`, `X-Content-Type-Options` e `Permissions-Policy` nos três
sites. Não usar interpolação YAML; informar URLs completas previsíveis dos
serviços.

- [ ] **Step 8: Remover URLs antigas compiladas do Git**

Excluir os três `.env.production`; a Render passa todas as URLs pelo Blueprint.

- [ ] **Step 9: Verificar configurações e Blueprint localmente**

```powershell
python manage.py test easystock.tests.test_production_settings plataforma.tests.test_demo_command
python manage.py makemigrations --check --dry-run
$env:APP_ENV='production'; $env:SECRET_KEY=('s' * 64); $env:PIN_LOOKUP_SECRET=('p' * 64); $env:DATABASE_URL='postgresql://u:p@127.0.0.1:5432/test'; $env:ALLOWED_HOSTS='demo.invalid'; $env:CORS_ALLOWED_ORIGINS='https://demo.invalid'; python manage.py check --deploy
render blueprints validate .\render.yaml
```

Expected: testes e Django check passam; Blueprint é válido. Se a Render CLI
não estiver disponível, validar o YAML com o schema oficial e repetir a
validação no fluxo de criação do Blueprint.

- [ ] **Step 10: Commit**

```powershell
git add -- easystock plataforma/management/commands/preparar_demo.py plataforma/tests/test_demo_command.py build.sh render.yaml frontend/.env.production app-alunos/.env.production app-cozinha/.env.production
git commit -m "feat: prepara demonstração segura na Render"
```

### Task 8: Atualizar dependências e tornar segurança obrigatória no CI

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `app-alunos/package.json`
- Modify: `app-alunos/package-lock.json`
- Modify: `app-cozinha/package.json`
- Modify: `app-cozinha/package-lock.json`
- Modify: `requirements.txt`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: job `Segurança de dependências`.
- Produces: job `Backend PostgreSQL` com serviço PostgreSQL 18.

- [ ] **Step 1: Registrar o baseline vulnerável**

```powershell
npm audit --omit=dev
```

Run in all three apps.
Expected: Dashboard informa 2 altas; Alunos e Cozinha informam 2 altas e 1 moderada.

- [ ] **Step 2: Atualizar somente cadeias vulneráveis**

Usar versões corrigidas indicadas pelo advisory atual para `react-router-dom`,
`postcss` e `undici`. Atualizar lockfiles com `npm install`, sem `--force`, e
revisar o diff para impedir downgrades incompatíveis.

- [ ] **Step 3: Confirmar auditoria JavaScript limpa**

```powershell
npm audit --omit=dev
npm test -- --run
npm run build
```

Run in each frontend.
Expected: 0 vulnerabilidades de produção e todos os testes/builds passam.

- [ ] **Step 4: Auditar Python antes de alterar versões**

```powershell
python -m pip install pip-audit
python -m pip_audit -r requirements.txt
```

Atualizar somente pacotes reportados, respeitando Python 3.13 e Django 6.0,
depois repetir a auditoria até 0 vulnerabilidades conhecidas.

- [ ] **Step 5: Adicionar job de segurança**

```yaml
security:
  name: Segurança de dependências
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: "3.13"
    - run: pip install pip-audit
    - run: pip-audit -r requirements.txt
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - run: npm ci --prefix frontend && npm audit --omit=dev --prefix frontend
    - run: npm ci --prefix app-alunos && npm audit --omit=dev --prefix app-alunos
    - run: npm ci --prefix app-cozinha && npm audit --omit=dev --prefix app-cozinha
```

- [ ] **Step 6: Adicionar integração com PostgreSQL**

Criar job com `postgres:18`, health check `pg_isready`, `DATABASE_URL` e a
suíte backend completa. Isso valida migrações, constraints e bloqueios no
mesmo mecanismo de banco usado na Render.

- [ ] **Step 7: Verificar CI local equivalente**

```powershell
python manage.py test
npm test -- --run
npm run lint
npm run typecheck
npm run build
```

Executar os comandos Node nos três projetos conforme os scripts disponíveis.
Expected: todos terminam com exit code 0.

- [ ] **Step 8: Commit**

```powershell
git add -- requirements.txt frontend/package.json frontend/package-lock.json app-alunos/package.json app-alunos/package-lock.json app-cozinha/package.json app-cozinha/package-lock.json .github/workflows/ci.yml
git commit -m "chore: atualiza dependências e valida PostgreSQL no CI"
```

### Task 9: Documentar, verificar, publicar PR e implantar a demonstração

**Files:**
- Modify: `README.md`
- Modify: `DEPLOY.md`
- Modify: `COMO_RODAR.md`
- Modify: `APPs_ALUNO_E_COZINHA.md`
- Modify: `docs/OPERACAO_MONITORAMENTO_E_BACKUP.md`
- Create: `docs/DEPLOY_RENDER_FREE_DEMO.md`
- Create: `docs/CHECKLIST_GO_LIVE_DEMO.md`

**Interfaces:**
- Produces: guia reproduzível de criação, validação e expiração da demo.
- Produces: URLs públicas e credenciais temporárias entregues fora do Git.

- [ ] **Step 1: Atualizar versões e remover instruções antigas**

Padronizar Python 3.13, Node 22, novos nomes dos serviços, variáveis de
ambiente e ausência dos `.env.production` versionados.

- [ ] **Step 2: Escrever o guia da Render Free**

O guia deve conter:

```text
1. Criar Blueprint a partir da branch new/demo-render-prontidao.
2. Informar as sete variáveis secretas da demo.
3. Confirmar plano free do backend e do PostgreSQL.
4. Aguardar backend, banco e três sites estáticos.
5. Validar /api/health/ e os três logins.
6. Registrar a data de expiração do banco em 30 dias.
7. Não inserir dados reais e não depender de backup.
8. Migrar para instâncias pagas antes de uso institucional.
```

- [ ] **Step 3: Criar checklist operacional**

Incluir checkboxes para health, login, inventário, entrada, estorno, Alunos,
Cozinha, offline, mock bloqueado, logs sem segredos e aviso de expiração.

- [ ] **Step 4: Verificar documentação e árvore Git**

```powershell
rg -n "Python 3\.11|Node 18|edustock-backend\.onrender\.com" README.md DEPLOY.md COMO_RODAR.md APPs_ALUNO_E_COZINHA.md docs
git diff --check
git status -sb
```

Expected: nenhuma instrução ativa aponta para runtime/URLs antigos; histórico
arquivado pode manter referências quando estiver claramente datado.

- [ ] **Step 5: Executar a verificação completa fresca**

```powershell
python manage.py test 2>&1 | Tee-Object "$env:TEMP\edustock-backend-tests.txt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
python manage.py makemigrations --check --dry-run

Push-Location frontend
npm test -- --run 2>&1 | Tee-Object "$env:TEMP\edustock-dashboard-tests.txt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run lint
npm run typecheck
npm run build
npm run test:e2e 2>&1 | Tee-Object "$env:TEMP\edustock-e2e-tests.txt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm audit --omit=dev
Pop-Location

Push-Location app-alunos
npm test -- --run 2>&1 | Tee-Object "$env:TEMP\edustock-alunos-tests.txt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build
npm audit --omit=dev
Pop-Location

Push-Location app-cozinha
npm test -- --run 2>&1 | Tee-Object "$env:TEMP\edustock-cozinha-tests.txt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build
npm audit --omit=dev
Pop-Location

python -m pip_audit -r requirements.txt
```

Expected: 0 falhas, 0 migrações pendentes e 0 vulnerabilidades conhecidas de produção.

- [ ] **Step 6: Commit da documentação**

```powershell
git add -- README.md DEPLOY.md COMO_RODAR.md APPs_ALUNO_E_COZINHA.md docs/OPERACAO_MONITORAMENTO_E_BACKUP.md docs/DEPLOY_RENDER_FREE_DEMO.md docs/CHECKLIST_GO_LIVE_DEMO.md
git commit -m "docs: orienta publicação da demonstração gratuita"
```

- [ ] **Step 7: Revisar requisitos e diff acumulado**

Comparar cada seção de
`docs/superpowers/specs/2026-08-07-demo-render-prontidao-design.md` com os
commits. Corrigir qualquer requisito ausente antes de publicar.

- [ ] **Step 8: Enviar branch e abrir PR para `main`**

```powershell
git push -u origin new/demo-render-prontidao
$backendResult = (Select-String -Path "$env:TEMP\edustock-backend-tests.txt" -Pattern "Ran \d+ tests").Line.Trim()
$dashboardResult = (Select-String -Path "$env:TEMP\edustock-dashboard-tests.txt" -Pattern "Tests\s+\d+ passed").Line.Trim()
$alunosResult = (Select-String -Path "$env:TEMP\edustock-alunos-tests.txt" -Pattern "Tests\s+\d+ passed").Line.Trim()
$cozinhaResult = (Select-String -Path "$env:TEMP\edustock-cozinha-tests.txt" -Pattern "Tests\s+\d+ passed").Line.Trim()
$e2eResult = (Select-String -Path "$env:TEMP\edustock-e2e-tests.txt" -Pattern "\d+ passed").Line.Trim()
$prBody = @"
## Resumo
- endurece autenticação, estoque e fila offline
- prepara dados fictícios e Blueprint Render Free
- atualiza CI, dependências e documentação operacional

## Validação
- Backend: $backendResult
- Dashboard: $dashboardResult
- Alunos: $alunosResult
- Cozinha: $cozinhaResult
- E2E: $e2eResult

## Limitações da demo
- serviço gratuito pode adormecer após inatividade
- PostgreSQL gratuito expira em 30 dias e não oferece backup
- uso exclusivo de dados fictícios
"@
gh pr create --base main --head new/demo-render-prontidao --title "feat: prepara demonstração segura do EduStock" --body $prBody
```

Na Step 5, salvar as cinco saídas nos caminhos temporários lidos acima com
`Tee-Object`, preservando e verificando `$LASTEXITCODE`. O corpo do PR lista
escopo, migrações, riscos do Free, comandos e resultados extraídos dessa
verificação fresca.

- [ ] **Step 9: Proteger `main` depois dos checks verdes**

Configurar pull request obrigatório e exigir os checks `Backend Django`,
`Frontend Dashboard`, `Frontend Alunos`, `Frontend Cozinha`,
`Fluxos críticos E2E`, `Segurança de dependências` e `Backend PostgreSQL`.
Confirmar primeiro que esses sete nomes aparecem no PR e então aplicar a regra
de proteção à `main` pela API do GitHub.

- [ ] **Step 10: Criar o Blueprint e informar segredos temporários**

No Dashboard da Render, conectar o repositório, selecionar a branch
`new/demo-render-prontidao`, criar o Blueprint e preencher as sete variáveis
`sync: false` com valores aleatórios. Não reutilizar credenciais locais.

- [ ] **Step 11: Acompanhar o deploy até estado terminal**

Confirmar que banco, backend e três sites estáticos estão ativos. Se algum
deploy falhar, ler o log completo, reproduzir a etapa localmente e corrigir a
causa com um teste antes de novo envio.

- [ ] **Step 12: Executar smoke test público**

Verificar, pelas URLs reais:

```text
GET  /api/health/ -> 200 e database/cache true
POST /api/auth/login/ -> 200 com conta demo
POST /api/operacao/auth/ ALUNO_REP -> 200
POST /api/operacao/auth/ COZINHA -> 200
Dashboard -> /inventario
Alunos -> /registrar
Cozinha -> /producao
```

Executar também entrada fictícia, estorno, contagem e baixa de produção.

- [ ] **Step 13: Registrar os resultados sem expor segredos**

Atualizar o PR com URLs, contagens de testes, data de expiração e limitações.
Entregar credenciais temporárias somente ao usuário nesta conversa.
