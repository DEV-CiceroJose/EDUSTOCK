# Turmas reais, PINs administráveis e alternador de preço — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as turmas de demonstração pelas 12 turmas reais da escola, mover a gestão de PINs de `settings.py`/bundle JS para o banco de dados (geridos pelo Django Admin), e adicionar um alternador de exibição de preço/custo no dashboard admin.

**Architecture:** Dois modelos novos (`Turma`, `PinAcesso`) no app `core`, geridos exclusivamente pelo Django Admin (sem endpoint REST). `core/operacao_auth.py` passa a consultar esses modelos em vez de `settings.py`. O `app-alunos` para de guardar PINs no bundle JS e delega toda validação ao backend. O alternador de preço é 100% frontend, reaproveitando o padrão já existente (`useMock`) em `frontend/src/lib/config.js`.

**Tech Stack:** Django 6 / DRF (backend), React 19 + Vite (app-alunos, app-cozinha, frontend), Vitest + Testing Library (frontend, já configurado), Django `TestCase`/`APITestCase` (backend).

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-07-18-turmas-pins-preco-design.md`.
- `PinAcesso.pin` é único globalmente (não só por papel/turma).
- `Turma`/`PinAcesso` não são expostos via API REST — gestão só pelo Django Admin.
- As 12 turmas (todas `turno=INTEGRAL`): 1º/2º/3º DS-A/B, 1º/2º/3º TET-A/B — nomes exatos: `"1º DS-A"`, `"1º DS-B"`, `"2º DS-A"`, `"2º DS-B"`, `"3º DS-A"`, `"3º DS-B"`, `"1º TET-A"`, `"1º TET-B"`, `"2º TET-A"`, `"2º TET-B"`, `"3º TET-A"`, `"3º TET-B"`.
- `app-alunos` e `app-cozinha` já têm Vitest + Testing Library configurados (mergeados via PR #5 do plano `docs/superpowers/plans/2026-07-17-redesign-apps-pin.md`, que também adicionou ícones `lucide-react`, logout por inatividade e retry-safety em `api.js`) — confirme sempre o estado **atual** desses arquivos antes de aplicar qualquer diff deste plano, pois foram escritos após sincronizar com esse merge, mas podem ter mudado de novo desde então.
- `frontend/` já tem Vitest + Testing Library configurados — toda mudança lá ganha teste automatizado.
- `useDashboardData.js` calcula um `resumo.valor` (valor total em estoque) que **não é consumido em nenhuma página** (confirmado por busca em todo `frontend/src`) — não faz parte deste plano; gating nele seria trabalho sem efeito observável.

---

## Parte A — Turmas reais e PINs administráveis

### Task 1: Modelos `Turma` e `PinAcesso`

**Files:**
- Modify: `core/models.py`
- Test: `core/tests/test_turma_pin_acesso.py` (novo)

**Interfaces:**
- Produces: `Turma` (campos: `nome`, `curso`, `ano`, `turno`, `ativo`) e `PinAcesso` (campos: `papel`, `turma`, `pin`, `titular`, `ativo`, `criado_em`), usados pela Task 2 (seed), Task 3 (admin) e Task 4 (`operacao_auth.py`).

- [ ] **Step 1: Escrever os testes de constraint (falhando, pois os modelos ainda não existem)**

Create `core/tests/test_turma_pin_acesso.py`:

```python
from django.db import IntegrityError
from django.test import TestCase

from core.models import PinAcesso, Turma


class TurmaModelTest(TestCase):
    def test_cria_turma(self):
        t = Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1, turno=Turma.INTEGRAL)
        self.assertEqual(str(t), "1º DS-A")

    def test_nome_unico(self):
        Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1)
        with self.assertRaises(IntegrityError):
            Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1)


class PinAcessoModelTest(TestCase):
    def setUp(self):
        self.turma = Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1)

    def test_pin_de_turma_valido(self):
        p = PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=self.turma, pin="1234")
        self.assertEqual(str(p), "1º DS-A — 1234")

    def test_pin_de_cozinha_valido(self):
        p = PinAcesso.objects.create(papel=PinAcesso.COZINHA, turma=None, pin="9999")
        self.assertEqual(str(p), "Cozinha — 9999")

    def test_aluno_rep_sem_turma_falha(self):
        with self.assertRaises(IntegrityError):
            PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=None, pin="1111")

    def test_cozinha_com_turma_falha(self):
        with self.assertRaises(IntegrityError):
            PinAcesso.objects.create(papel=PinAcesso.COZINHA, turma=self.turma, pin="2222")

    def test_pin_duplicado_falha(self):
        PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=self.turma, pin="1234")
        outra_turma = Turma.objects.create(nome="1º DS-B", curso=Turma.DS, ano=1)
        with self.assertRaises(IntegrityError):
            PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=outra_turma, pin="1234")

    def test_papel_default_e_aluno_rep(self):
        p = PinAcesso(turma=self.turma, pin="5555")
        self.assertEqual(p.papel, PinAcesso.ALUNO_REP)
```

- [ ] **Step 2: Rodar os testes para confirmar que falham (modelos não existem)**

Run: `python manage.py test core.tests.test_turma_pin_acesso -v 2`
Expected: `ImportError: cannot import name 'PinAcesso' from 'core.models'` (ou `ImportError` para `Turma`)

- [ ] **Step 3: Adicionar os modelos**

Modify `core/models.py` — trocar a linha 1 (imports) por:

```python
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.contrib.auth.models import User
from django.utils import timezone
```

Adicionar ao final do arquivo (depois da classe `FatorConsumo`, que hoje termina na linha 269):

```python
class Turma(models.Model):
    DS = "DS"
    TET = "TET"
    CURSO_CHOICES = [(DS, "Desenvolvimento de Sistemas"), (TET, "Eletrotécnica")]

    MANHA = "MANHA"
    TARDE = "TARDE"
    INTEGRAL = "INTEGRAL"
    TURNO_CHOICES = [(MANHA, "Manhã"), (TARDE, "Tarde"), (INTEGRAL, "Integral")]

    nome = models.CharField(max_length=50, unique=True)
    curso = models.CharField(max_length=3, choices=CURSO_CHOICES)
    ano = models.PositiveSmallIntegerField()
    turno = models.CharField(max_length=10, choices=TURNO_CHOICES, default=INTEGRAL)
    ativo = models.BooleanField(default=True)

    class Meta:
        ordering = ["curso", "ano", "nome"]
        verbose_name = "Turma"
        verbose_name_plural = "Turmas"

    def __str__(self):
        return self.nome


class PinAcesso(models.Model):
    ALUNO_REP = "ALUNO_REP"
    COZINHA = "COZINHA"
    PAPEL_CHOICES = [(ALUNO_REP, "Representante de turma"), (COZINHA, "Equipe da cozinha")]

    papel = models.CharField(max_length=10, choices=PAPEL_CHOICES, default=ALUNO_REP)
    turma = models.ForeignKey(
        Turma, on_delete=models.CASCADE, null=True, blank=True, related_name="pins"
    )
    pin = models.CharField(
        max_length=4,
        unique=True,
        validators=[RegexValidator(r"^\d{4}$", "PIN deve ter exatamente 4 dígitos.")],
    )
    titular = models.CharField(
        "Nome de quem escolheu o PIN", max_length=100, blank=True, default=""
    )
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["turma__nome", "papel"]
        verbose_name = "PIN de acesso"
        verbose_name_plural = "PINs de acesso"
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(papel="ALUNO_REP", turma__isnull=False)
                    | Q(papel="COZINHA", turma__isnull=True)
                ),
                name="turma_obrigatoria_apenas_para_aluno_rep",
            )
        ]

    def __str__(self):
        alvo = self.turma.nome if self.turma else "Cozinha"
        return f"{alvo} — {self.pin}"
```

- [ ] **Step 4: Gerar a migração de schema**

Run: `python manage.py makemigrations core`
Expected: um novo arquivo `core/migrations/0012_<nome>.py` (o número `0012` é o próximo livre — a última migração hoje é `0011_frequencia_registrado_por_turma.py`), contendo `CreateModel` para `Turma` e `PinAcesso` com o `CheckConstraint` listado.

- [ ] **Step 5: Rodar as migrações e os testes**

Run: `python manage.py migrate && python manage.py test core.tests.test_turma_pin_acesso -v 2`
Expected: `OK` (6 testes passando)

- [ ] **Step 6: Commit**

```bash
git add core/models.py core/migrations/ core/tests/test_turma_pin_acesso.py
git commit -m "feat: adiciona modelos Turma e PinAcesso"
```

---

### Task 2: Migração de dados — seed das 12 turmas reais

**Files:**
- Create: `core/migrations/0013_seed_turmas.py`
- Test: `core/tests/test_turma_pin_acesso.py` (adiciona teste)

**Interfaces:**
- Consumes: `Turma` (Task 1).
- Produces: 12 linhas de `Turma` no banco, prontas para a Task 3 (admin) usar.

- [ ] **Step 1: Escrever o teste que verifica a migração aplicada**

Add to `core/tests/test_turma_pin_acesso.py`:

```python
class SeedTurmasTest(TestCase):
    def test_doze_turmas_criadas(self):
        self.assertEqual(Turma.objects.count(), 12)

    def test_turmas_reais_presentes(self):
        nomes = set(Turma.objects.values_list("nome", flat=True))
        esperado = {
            "1º DS-A", "1º DS-B", "2º DS-A", "2º DS-B", "3º DS-A", "3º DS-B",
            "1º TET-A", "1º TET-B", "2º TET-A", "2º TET-B", "3º TET-A", "3º TET-B",
        }
        self.assertEqual(nomes, esperado)

    def test_todas_integral(self):
        self.assertFalse(Turma.objects.exclude(turno=Turma.INTEGRAL).exists())
```

- [ ] **Step 2: Rodar o teste para confirmar que falha (sem seed ainda)**

Run: `python manage.py test core.tests.test_turma_pin_acesso.SeedTurmasTest -v 2`
Expected: `FAIL` — `AssertionError: 0 != 12`

- [ ] **Step 3: Criar a data migration**

Create `core/migrations/0013_seed_turmas.py` (o número deve seguir a migração criada na Task 1 — ajuste se o nome real gerado foi diferente de `0012`):

```python
from django.db import migrations

TURMAS = [
    ("1º DS-A", "DS", 1), ("1º DS-B", "DS", 1),
    ("2º DS-A", "DS", 2), ("2º DS-B", "DS", 2),
    ("3º DS-A", "DS", 3), ("3º DS-B", "DS", 3),
    ("1º TET-A", "TET", 1), ("1º TET-B", "TET", 1),
    ("2º TET-A", "TET", 2), ("2º TET-B", "TET", 2),
    ("3º TET-A", "TET", 3), ("3º TET-B", "TET", 3),
]


def criar_turmas(apps, schema_editor):
    Turma = apps.get_model("core", "Turma")
    for nome, curso, ano in TURMAS:
        Turma.objects.get_or_create(
            nome=nome, defaults={"curso": curso, "ano": ano, "turno": "INTEGRAL"}
        )


def remover_turmas(apps, schema_editor):
    Turma = apps.get_model("core", "Turma")
    Turma.objects.filter(nome__in=[nome for nome, _, _ in TURMAS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0012_turma_pinacesso"),  # ajuste para o nome real da migração da Task 1
    ]

    operations = [
        migrations.RunPython(criar_turmas, remover_turmas),
    ]
```

- [ ] **Step 4: Rodar a migração e os testes**

Run: `python manage.py migrate && python manage.py test core.tests.test_turma_pin_acesso -v 2`
Expected: `OK` (9 testes passando)

- [ ] **Step 5: Commit**

```bash
git add core/migrations/0013_seed_turmas.py core/tests/test_turma_pin_acesso.py
git commit -m "feat: popula as 12 turmas reais via data migration"
```

---

### Task 3: Django Admin — gestão de turmas e PINs

**Files:**
- Modify: `core/admin.py`

**Interfaces:**
- Consumes: `Turma`, `PinAcesso` (Task 1).

- [ ] **Step 1: Registrar os admins**

Modify `core/admin.py` — trocar a linha 2 por:

```python
from .models import Categoria, PinAcesso, Produto, Turma
```

Adicionar ao final do arquivo:

```python
class PinAcessoInline(admin.TabularInline):
    model = PinAcesso
    extra = 3
    fields = ("pin", "titular", "ativo")


@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display = ("nome", "curso", "ano", "turno", "ativo")
    list_filter = ("curso", "turno", "ativo")
    ordering = ("curso", "ano", "nome")
    inlines = [PinAcessoInline]


@admin.register(PinAcesso)
class PinAcessoAdmin(admin.ModelAdmin):
    list_display = ("pin", "papel", "turma", "titular", "ativo")
    list_filter = ("papel", "ativo")
    search_fields = ("pin", "titular", "turma__nome")
```

- [ ] **Step 2: Verificar manualmente no Django Admin**

Run: `python manage.py runserver` (em um terminal separado, deixe rodando)

No navegador, acesse `http://127.0.0.1:8000/admin/core/turma/`, faça login com o usuário admin (`admin` / `admin123`, criado nesta sessão), abra a turma "1º DS-A" e confirme que aparecem 3 linhas em branco para preencher PIN + titular. Acesse `http://127.0.0.1:8000/admin/core/pinacesso/add/`, selecione papel "Equipe da cozinha", confirme que o campo Turma pode ficar em branco e que salvar funciona.

Expected: as duas telas carregam sem erro 500 e os formulários descritos aparecem.

- [ ] **Step 3: Commit**

```bash
git add core/admin.py
git commit -m "feat: expoe Turma e PinAcesso no Django Admin com PINs inline"
```

---

### Task 4: `operacao_auth.py` valida PIN contra o banco

**Files:**
- Modify: `core/operacao_auth.py:81-120`
- Modify: `core/tests/test_operacao_spec.py:28-34,347-390` (substitui `TestLoginPorPin`)

**Interfaces:**
- Consumes: `PinAcesso`, `Turma` (Task 1).
- Produces: `autenticar_pin(perfil, pin)` mantém a mesma assinatura e retorno (`dict` com `perfil`, `turma`, `turno`, ou `None`) — nenhum consumidor (`operacao_views.py:61`) precisa mudar.

- [ ] **Step 1: Escrever o teste (falhando, pois `autenticar_pin` ainda lê `settings.py`)**

Replace in `core/tests/test_operacao_spec.py` — remover o bloco `PINS_TESTE`/`PIN_COZINHA_TESTE` (linhas 28-34) e a classe `TestLoginPorPin` (linhas 347-390) inteira, substituindo por:

```python
# ---------------------------------------------------------------------------
# Testes de login por PIN
# ---------------------------------------------------------------------------

from core.models import PinAcesso, Turma


class TestLoginPorPin(APITestCase):
    def setUp(self):
        self.turma = Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1)
        self.turma_b = Turma.objects.create(nome="1º DS-B", curso=Turma.DS, ano=1)
        PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=self.turma, pin="0001")
        PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=self.turma, pin="0002")
        PinAcesso.objects.create(papel=PinAcesso.COZINHA, pin="0099")
        PinAcesso.objects.create(
            papel=PinAcesso.ALUNO_REP, turma=self.turma_b, pin="0003", ativo=False
        )

    def test_login_aluno_pin_valido(self):
        resp = self.client.post("/api/operacao/auth/", {
            "pin": "0001", "perfil": "ALUNO_REP",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["turma"], "1º DS-A")
        self.assertEqual(resp.data["turno"], "INTEGRAL")

    def test_login_cozinha_pin_valido(self):
        resp = self.client.post("/api/operacao/auth/", {
            "pin": "0099", "perfil": "COZINHA",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["perfil"], "COZINHA")

    def test_login_pin_invalido_retorna_401(self):
        resp = self.client.post("/api/operacao/auth/", {
            "pin": "0000", "perfil": "ALUNO_REP",
        }, format="json")
        self.assertEqual(resp.status_code, 401, resp.content)

    def test_login_pin_inativo_retorna_401(self):
        resp = self.client.post("/api/operacao/auth/", {
            "pin": "0003", "perfil": "ALUNO_REP",
        }, format="json")
        self.assertEqual(resp.status_code, 401, resp.content)

    def test_dois_pins_da_mesma_turma_autenticam_com_mesmo_nome(self):
        r1 = self.client.post("/api/operacao/auth/", {
            "pin": "0001", "perfil": "ALUNO_REP",
        }, format="json")
        r2 = self.client.post("/api/operacao/auth/", {
            "pin": "0002", "perfil": "ALUNO_REP",
        }, format="json")
        self.assertEqual(r1.data["turma"], r2.data["turma"])

        # Regressão: o segundo aluno da mesma turma que tentar registrar
        # a contagem do mesmo turno/dia deve receber 409, não um novo registro.
        c1 = APIClient()
        c1.credentials(HTTP_X_OPERACAO_TOKEN=r1.data["token"])
        c2 = APIClient()
        c2.credentials(HTTP_X_OPERACAO_TOKEN=r2.data["token"])

        resp1 = c1.post("/api/operacao/contagem/", {"quantidade_alunos": 30}, format="json")
        resp2 = c2.post("/api/operacao/contagem/", {"quantidade_alunos": 31}, format="json")
        self.assertEqual(resp1.status_code, 201, resp1.content)
        self.assertEqual(resp2.status_code, 409, resp2.content)

    def test_logout_invalida_token(self):
        r_login = self.client.post("/api/operacao/auth/", {
            "pin": "0001", "perfil": "ALUNO_REP",
        }, format="json")
        token = r_login.data["token"]

        c = APIClient()
        c.credentials(HTTP_X_OPERACAO_TOKEN=token)
        c.delete("/api/operacao/auth/logout/")

        resp = c.post("/api/operacao/contagem/", {"quantidade_alunos": 30}, format="json")
        self.assertEqual(resp.status_code, 401, resp.content)
```

Remova também o import `override_settings` do topo do arquivo (linha 16) se não for mais usado por nenhuma outra classe do arquivo — confira com `grep override_settings core/tests/test_operacao_spec.py` antes de remover.

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `python manage.py test core.tests.test_operacao_spec.TestLoginPorPin -v 2`
Expected: `FAIL` — os PINs "0001"/"0099" não validam porque `autenticar_pin` ainda lê `settings.OPERACAO_PINS_ALUNOS` (vazio/inexistente no ambiente de teste).

- [ ] **Step 3: Reescrever `autenticar_pin` para consultar o banco**

Modify `core/operacao_auth.py` — substituir as linhas 77-120 (do comentário `# Leitura dos PINs configurados em settings` até o fim de `autenticar_pin`) por:

```python
# --------------------------------------------------------------------------
# Leitura dos PINs no banco (Turma / PinAcesso)
# --------------------------------------------------------------------------

def _pins_alunos() -> dict[str, dict]:
    """Retorna mapa { pin: { turma, turno } } a partir de PinAcesso ativos."""
    from core.models import PinAcesso

    return {
        p.pin: {"turma": p.turma.nome, "turno": p.turma.turno}
        for p in PinAcesso.objects.filter(
            papel=PinAcesso.ALUNO_REP, ativo=True
        ).select_related("turma")
    }


def _pin_valido_cozinha(pin: str) -> bool:
    from core.models import PinAcesso

    return PinAcesso.objects.filter(
        papel=PinAcesso.COZINHA, ativo=True, pin=pin
    ).exists()


# --------------------------------------------------------------------------
# Login via PIN
# --------------------------------------------------------------------------

def autenticar_pin(perfil: str, pin: str) -> dict | None:
    """
    Valida o PIN para o perfil informado.
    Retorna dict com dados da sessão ou None se inválido.
    """
    if perfil == PERFIL_ALUNO:
        mapa = _pins_alunos()
        dados = mapa.get(pin)
        if not dados:
            return None
        return {"perfil": PERFIL_ALUNO, **dados}

    if perfil == PERFIL_COZINHA:
        if not _pin_valido_cozinha(pin):
            return None
        return {"perfil": PERFIL_COZINHA, "turma": "", "turno": ""}

    return None
```

- [ ] **Step 4: Rodar os testes e a suíte completa de `core`**

Run: `python manage.py test core.tests.test_operacao_spec core.tests.test_operacao -v 2`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add core/operacao_auth.py core/tests/test_operacao_spec.py
git commit -m "feat: autenticacao por PIN passa a consultar PinAcesso no banco"
```

---

### Task 5: Remover PINs de `settings.py`

**Files:**
- Modify: `easystock/settings.py:181-197`

**Interfaces:**
- Consumes: nenhuma (edição isolada).

- [ ] **Step 1: Remover os blocos de PIN, mantendo o TTL**

Modify `easystock/settings.py` — remover:

```python
# ------------------------------------------------------------------
# Módulo de Operação da Merenda — PINs de acesso
# ------------------------------------------------------------------
# PIN de cada turma: { pin (str), turma, turno }
# Em produção, carregue de variável de ambiente ou arquivo seguro.
OPERACAO_PINS_ALUNOS = [
    {"pin": "1001", "turma": "6A", "turno": "MANHA"},
    {"pin": "1002", "turma": "6B", "turno": "MANHA"},
    {"pin": "1003", "turma": "7A", "turno": "MANHA"},
    {"pin": "1004", "turma": "7B", "turno": "TARDE"},
    {"pin": "1005", "turma": "8A", "turno": "TARDE"},
    {"pin": "1006", "turma": "8B", "turno": "TARDE"},
    {"pin": "1007", "turma": "9A", "turno": "INTEGRAL"},
]

# PIN único da cozinha
OPERACAO_PIN_COZINHA = "9999"

# Tempo de vida dos tokens de sessão em horas (padrão 12h)
OPERACAO_TOKEN_TTL_HORAS = 12
```

Substituir por (mantém só o TTL, que `operacao_auth.py:35` ainda usa):

```python
# ------------------------------------------------------------------
# Módulo de Operação da Merenda
# ------------------------------------------------------------------
# PINs de turma/cozinha agora ficam em Turma/PinAcesso (banco), geridos
# pelo Django Admin — ver core/models.py e core/admin.py.

# Tempo de vida dos tokens de sessão em horas (padrão 12h)
OPERACAO_TOKEN_TTL_HORAS = 12
```

- [ ] **Step 2: Rodar a suíte completa do backend**

Run: `python manage.py test core -v 2`
Expected: `OK`, nenhum teste depende mais de `OPERACAO_PINS_ALUNOS`/`OPERACAO_PIN_COZINHA` (confirmado na Task 4).

- [ ] **Step 3: Commit**

```bash
git add easystock/settings.py
git commit -m "chore: remove PINs fixos de settings.py (substituidos por PinAcesso)"
```

---

### Task 6: `app-alunos` — remover mapeamento local de PIN

> **Nota:** esta task foi escrita depois de sincronizar a branch local com
> `origin/main` (PR #5, já mergeado), que reformulou `PinLogin.jsx`/`api.js`
> com ícones `lucide-react`, retry-safety e testes Vitest. As mudanças
> abaixo partem **desse** código atual, não da versão antiga sem ícones —
> confira o estado real de cada arquivo antes de aplicar o diff caso ele já
> tenha mudado de novo.

**Files:**
- Modify: `app-alunos/src/PinLogin.jsx`
- Modify: `app-alunos/src/api.js`
- Modify: `app-alunos/src/PinLogin.test.jsx`
- Modify: `app-alunos/src/api.test.js`
- Modify: `app-alunos/.env.example`

**Interfaces:**
- Consumes: `POST /api/operacao/auth/` (já existe, inalterado — Task 4 só mudou a fonte de dados no backend).
- Produces: `login(pin)` — nova assinatura sem `turma`/`turno`.

- [ ] **Step 1: Atualizar os testes existentes (falhando após a Step 3)**

Modify `app-alunos/src/PinLogin.test.jsx` — remover os `vi.stubEnv` (linhas 13-14) e o `afterEach` de `vi.unstubAllEnvs()` (linha 17-19, já não há env para desfazer, mas mantenha o `afterEach` vazio é desnecessário — remova o bloco todo), e trocar o segundo teste para refletir a nova assinatura de `login`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./api.js', () => ({
  login: vi.fn(),
}))

describe('PinLogin (app-alunos)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('mostra o ícone School no cabeçalho, sem emoji', async () => {
    const { default: PinLogin } = await import('./PinLogin.jsx')

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    expect(screen.getByTestId('icone-cabecalho')).toBeInTheDocument()
    expect(screen.queryByText('🏫')).not.toBeInTheDocument()
  })

  it('chama login apenas com o PIN ao completar os 4 dígitos', async () => {
    const { login } = await import('./api.js')
    login.mockResolvedValue({ token: 'abc', turma: '1º DS-A', turno: 'INTEGRAL' })
    const { default: PinLogin } = await import('./PinLogin.jsx')

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    ;['1', '2', '3', '4'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })

    expect(login).toHaveBeenCalledWith('1234')
  })

  it('mostra erro do backend sem travar a interface quando o PIN não é reconhecido', async () => {
    const { login } = await import('./api.js')
    login.mockRejectedValue(new Error('PIN inválido.'))
    const { default: PinLogin } = await import('./PinLogin.jsx')

    render(
      <MemoryRouter>
        <PinLogin />
      </MemoryRouter>
    )

    ;['0', '0', '0', '0'].forEach((digito) => {
      fireEvent.click(screen.getByRole('button', { name: digito }))
    })

    expect(await screen.findByText('PIN inválido.')).toBeInTheDocument()
  })
})
```

Modify `app-alunos/src/api.test.js` linha 39 — trocar a chamada de `login` para a nova assinatura:

```js
  it('login NUNCA tenta de novo depois de uma falha de rede', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    global.fetch = fetchMock

    await expect(login('1234')).rejects.toThrow('Failed to fetch')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd app-alunos && npm test`
Expected: `FAIL` em `PinLogin.test.jsx` (o componente ainda chama `login(pinVal, entrada.turma, entrada.turno)` e só quando o PIN está no mapa local) e em `api.test.js` (assinatura de `login` ainda aceita `turma`/`turno`).

- [ ] **Step 3: Simplificar `api.js`**

Modify `app-alunos/src/api.js` — substituir a função `login` (linhas 70-89 no arquivo atual) por:

```js
/**
 * Login via PIN — troca PIN por token de sessão.
 * Turma e turno vêm sempre da resposta do backend (nunca de config local).
 * @param {string} pin — 4 dígitos
 * @returns {{ token, perfil, turma, turno }}
 */
export async function login(pin) {
  const data = await req('POST', '/api/operacao/auth/', {
    pin,
    perfil: 'ALUNO_REP',
  })
  sessionStorage.setItem('operacao_token', data.token)
  sessionStorage.setItem('operacao_sessao', JSON.stringify({
    turma: data.turma,
    turno: data.turno,
    perfil: data.perfil,
  }))
  return data
}
```

Note que `login` continua sem passar `{ retry: true }` para `req()` — preserva a garantia testada em `api.test.js` ("login NUNCA tenta de novo").

- [ ] **Step 4: Remover o mapeamento local em `PinLogin.jsx`, preservando ícones e layout atuais**

Modify `app-alunos/src/PinLogin.jsx` — remover as linhas 6-38 (comentário `/** Lê o mapa de PINs... */`, `carregarMapaPins()`, `const MAPA_PINS = ...`, `const TURNO_LABEL = ...`) — o arquivo passa a começar assim:

```jsx
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, Delete } from 'lucide-react'
import { login } from './api.js'

export default function PinLogin() {
```

Modify a função `confirmar` (linhas 59-78 no arquivo atual) — remove o gate local:

```jsx
  async function confirmar(pinVal = pin) {
    if (pinVal.length !== 4) return

    setLoading(true)
    try {
      await login(pinVal)
      navigate('/registrar', { replace: true })
    } catch (e) {
      setErro(e.message ?? 'PIN inválido. Tente novamente.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }
```

Modify o final do JSX (linhas 125-134 no arquivo atual) — remove o rodapé de pré-visualização "Turma X — turno" (dependia do `MAPA_PINS` que não existe mais); o bloco de loading é o último elemento do componente:

```jsx
      {loading && (
        <p className="mt-6 text-center text-[0.95rem] text-ink-soft">Verificando…</p>
      )}
    </div>
  )
}
```

Ícones (`School`, `Delete`), classes Tailwind e `data-testid="icone-cabecalho"` **não mudam** — são do redesign já mergeado e não fazem parte desta task.

- [ ] **Step 5: Atualizar `.env.example`**

Modify `app-alunos/.env.example` — substituir todo o conteúdo por:

```bash
# URL base da API Django (sem barra final)
# Em dev o proxy do Vite encaminha /api → localhost:8000
# Em produção aponte para o domínio real
VITE_API_BASE=

# Os PINs de cada turma NÃO ficam mais neste arquivo — são geridos
# pelo Django Admin (modelos Turma e PinAcesso, em core/models.py).
# Acesse /admin/core/turma/ para cadastrar/consultar os PINs.
```

- [ ] **Step 6: Rodar os testes**

Run: `cd app-alunos && npm test`
Expected: `PASS` em todos os arquivos.

- [ ] **Step 7: Verificar manualmente**

Run: `cd app-alunos && npm run dev` (deixe rodando; garanta que o backend Django também está rodando e que já existe pelo menos um `PinAcesso` cadastrado — use o admin ou o shell: `python manage.py shell -c "from core.models import Turma, PinAcesso; t = Turma.objects.first(); PinAcesso.objects.get_or_create(turma=t, pin='1234')"`)

No navegador, acesse `http://localhost:5174`, digite `1234` (ou o PIN cadastrado) e confirme que navega para `/registrar`. Digite um PIN não cadastrado (ex.: `0000`) e confirme que aparece a mensagem de erro do backend sem travar a interface.

Expected: login com PIN válido navega para `/registrar`; PIN inválido mostra erro e permite nova tentativa.

- [ ] **Step 8: Commit**

```bash
git add app-alunos/src/PinLogin.jsx app-alunos/src/api.js app-alunos/src/PinLogin.test.jsx app-alunos/src/api.test.js app-alunos/.env.example
git commit -m "feat(app-alunos): remove mapeamento local de PIN, valida sempre no backend"
```

---

### Task 7: `app-cozinha` — `.env.example` sem PIN fixo

**Files:**
- Modify: `app-cozinha/.env.example`

**Interfaces:**
- Consumes: nenhuma — `app-cozinha/src/PinLogin.jsx` já valida no backend quando `VITE_PIN_COZINHA` está vazio/ausente (comportamento existente, confirmado em `app-cozinha/src/PinLogin.jsx:12,29`); nenhuma mudança de código é necessária.

- [ ] **Step 1: Atualizar o `.env.example`**

Modify `app-cozinha/.env.example` — substituir todo o conteúdo por:

```bash
# URL base da API Django (sem barra final)
# Em dev o proxy do Vite encaminha /api → localhost:8000
# Em produção aponte para o domínio real
VITE_API_BASE=

# Os PINs da equipe da cozinha NÃO ficam mais neste arquivo — são geridos
# pelo Django Admin (papel "Equipe da cozinha" em PinAcesso, sem turma
# vinculada). Acesse /admin/core/pinacesso/ para cadastrar.
# Deixe VITE_PIN_COZINHA sem definir (ou remova a linha) — o app já
# valida direto no backend quando essa variável está ausente.
```

- [ ] **Step 2: Commit**

```bash
git add app-cozinha/.env.example
git commit -m "docs(app-cozinha): documenta PINs geridos pelo Django Admin"
```

---

### Task 8: Atalhos de turma reais no painel admin

**Files:**
- Modify: `frontend/src/features/merenda/ContagemView.jsx:13`

**Interfaces:**
- Consumes: nenhuma.

- [ ] **Step 1: Trocar os atalhos de turma**

Modify `frontend/src/features/merenda/ContagemView.jsx` linha 13:

```js
const TURMAS_RAPIDAS = ["Total", "6A", "7B", "8C"]
```

Para:

```js
const TURMAS_RAPIDAS = [
  "Total",
  "1º DS-A", "1º DS-B", "2º DS-A", "2º DS-B", "3º DS-A", "3º DS-B",
  "1º TET-A", "1º TET-B", "2º TET-A", "2º TET-B", "3º TET-A", "3º TET-B",
]
```

Os nomes são exatamente os mesmos usados em `Turma.nome` (Task 2) — isso é o que preserva a trava de contagem duplicada (`unique_frequencia_por_turma_turno_dia`) se a cozinha registrar manualmente por essa tela em vez de um aluno registrar pelo app-alunos (ver spec, seção "Idempotência").

- [ ] **Step 2: Verificar manualmente**

Run: `cd frontend && npm run dev` (com o backend rodando)

Acesse a aba Merenda no dashboard, confirme que os 13 chips aparecem e que clicar em um deles preenche o campo "Turma" com o nome correspondente.

Expected: chips renderizam sem quebrar layout (usam `flex-wrap`, já existente) e clicar atualiza o campo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/merenda/ContagemView.jsx
git commit -m "feat: atualiza atalhos de turma do painel admin para as turmas reais"
```

---

## Parte B — Alternador de exibição de preço

### Task 9: `mostrarPreco` em `config.js`

**Files:**
- Modify: `frontend/src/lib/config.js`
- Modify: `frontend/src/lib/config.test.js`

**Interfaces:**
- Produces: `DEFAULT_CONFIG.mostrarPreco: boolean` (default `false`), validado em `isValidConfig`. Usado pelas Tasks 10-13.

- [ ] **Step 1: Atualizar os testes existentes que comparam objetos completos de config**

O `getConfig()` mescla com `DEFAULT_CONFIG`, então assim que `mostrarPreco` for adicionado a `DEFAULT_CONFIG`, qualquer teste que compare o resultado contra um objeto **explícito** de 3 chaves (em vez de contra a constante `DEFAULT_CONFIG`) vai quebrar. Modify `frontend/src/lib/config.test.js`:

Linha 32-37 (`DEFAULT_CONFIG` deve ter valores padrão corretos):
```js
      expect(DEFAULT_CONFIG).toEqual({
        useMock: false,
        validityAlertDays: 30,
        cardDensity: "confortavel",
        mostrarPreco: false
      });
```

Linha 52-60 (merge com defaults quando config armazenado é parcial):
```js
    it("deve fazer merge com defaults quando config armazenado é parcial", () => {
      localStorage.setItem("edustock:config", JSON.stringify({ useMock: true }));
      const config = getConfig();
      expect(config).toEqual({
        useMock: true,
        validityAlertDays: 30,
        cardDensity: "confortavel",
        mostrarPreco: false
      });
    });
```

Linha 62-71 (retornar config válido completo) — o `validConfig` armazenado tem 3 chaves; o resultado de `getConfig()` ganha a 4ª por merge com o default:
```js
    it("deve retornar config válido completo", () => {
      const validConfig = {
        useMock: true,
        validityAlertDays: 45,
        cardDensity: "compacto"
      };
      localStorage.setItem("edustock:config", JSON.stringify(validConfig));
      const config = getConfig();
      expect(config).toEqual({ ...validConfig, mostrarPreco: false });
    });
```

Linha 122-136 (merge com config existente via `setConfig`):
```js
    it("deve fazer merge com config existente", () => {
      localStorage.setItem("edustock:config", JSON.stringify({
        useMock: true,
        validityAlertDays: 60,
        cardDensity: "denso"
      }));

      const result = setConfig({ validityAlertDays: 45 });

      expect(result).toEqual({
        useMock: true,
        validityAlertDays: 45,
        cardDensity: "denso",
        mostrarPreco: false
      });
    });
```

Linha 138-149 (retornar novo config após merge):
```js
    it("deve retornar novo config após merge", () => {
      const result = setConfig({
        useMock: true,
        cardDensity: "compacto"
      });

      expect(result).toEqual({
        useMock: true,
        validityAlertDays: 30,
        cardDensity: "compacto",
        mostrarPreco: false
      });
    });
```

- [ ] **Step 2: Adicionar os testes novos de `mostrarPreco`**

Add ao final do `describe("getConfig", ...)` (depois do teste "deve retornar defaults quando cardDensity é inválido", antes do `});` de fechamento em torno da linha 111):

```js
    it("deve retornar defaults quando mostrarPreco não é boolean", () => {
      localStorage.setItem("edustock:config", JSON.stringify({
        useMock: false,
        validityAlertDays: 30,
        cardDensity: "confortavel",
        mostrarPreco: "sim"
      }));
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
```

Add ao final do `describe("setConfig", ...)` (depois de "deve aceitar todas as densidades válidas", antes do `});` final):

```js
    it("deve persistir mostrarPreco", () => {
      const result = setConfig({ mostrarPreco: true });
      expect(result.mostrarPreco).toBe(true);
    });

    it("deve lançar erro quando mostrarPreco não é boolean", () => {
      expect(() => {
        setConfig({ mostrarPreco: "true" });
      }).toThrow("Invalid configuration values");
    });
```

- [ ] **Step 3: Rodar os testes para confirmar que falham**

Run: `cd frontend && npm test -- config.test.js`
Expected: `FAIL` — `mostrarPreco` ainda não existe em `DEFAULT_CONFIG`/`isValidConfig`.

- [ ] **Step 4: Implementar em `config.js`**

Modify `frontend/src/lib/config.js` linhas 11-15:

```js
export const DEFAULT_CONFIG = {
  useMock: false,
  validityAlertDays: 30,
  cardDensity: "confortavel",
  mostrarPreco: false
};
```

Modify `frontend/src/lib/config.js` — dentro de `isValidConfig` (depois do bloco que valida `cardDensity`, antes do `return true;` na linha 52), adicionar:

```js
  // Validate mostrarPreco
  if (config.mostrarPreco !== undefined && typeof config.mostrarPreco !== "boolean") {
    return false;
  }
```

- [ ] **Step 5: Rodar os testes**

Run: `cd frontend && npm test -- config.test.js`
Expected: `PASS` (todos os testes)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/config.js frontend/src/lib/config.test.js
git commit -m "feat: adiciona mostrarPreco (default desligado) ao config"
```

---

### Task 10: Toggle em Configurações

**Files:**
- Modify: `frontend/src/pages/ConfiguracoesPage.jsx`

**Interfaces:**
- Consumes: `getConfig`, `setConfig` (Task 9).

- [ ] **Step 1: Adicionar o handler**

Modify `frontend/src/pages/ConfiguracoesPage.jsx` — depois de `handleMockToggle` (linha 33), adicionar:

```js
  const handlePrecoToggle = () => {
    updateConfig({ mostrarPreco: !config.mostrarPreco })
    window.location.reload()
  }
```

- [ ] **Step 2: Adicionar a seção na UI**

Modify `frontend/src/pages/ConfiguracoesPage.jsx` — depois da seção "Dados de Demonstração" (fecha em `</section>` na linha 90) e antes da seção "Alertas de Validade" (linha 93), adicionar:

```jsx
        {/* Exibição de Custos Section */}
        <section className="rounded-2xl border border-line bg-surface p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-bold leading-tight">Exibição de Custos</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Controla se preço/custo aparece nos cadastros, formulários e relatórios
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="preco-toggle" className="font-medium">
                Mostrar preços e custos
              </label>
              <p className="text-sm text-ink-faint">A página será recarregada após alternar</p>
            </div>
            <button
              id="preco-toggle"
              type="button"
              role="switch"
              aria-checked={config.mostrarPreco}
              onClick={handlePrecoToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                config.mostrarPreco ? "bg-brand" : "bg-line"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#f4f1e7] shadow ring-0 transition duration-200 ease-in-out ${
                  config.mostrarPreco ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

```

- [ ] **Step 2: Verificar manualmente**

Run: `cd frontend && npm run dev`

Acesse Configurações, confirme que a nova seção "Exibição de Custos" aparece entre "Dados de Demonstração" e "Alertas de Validade", com o switch desligado por padrão. Clique nele, confirme que a página recarrega e o switch permanece ligado.

Expected: toggle funciona e persiste (F5 mantém o estado).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ConfiguracoesPage.jsx
git commit -m "feat: adiciona alternador de exibicao de precos em Configuracoes"
```

---

### Task 11: Ocultar preço em Inventário (formulário e detalhes)

**Files:**
- Modify: `frontend/src/features/inventario/ProductFormModal.jsx`
- Modify: `frontend/src/features/inventario/DetailsModal.jsx`
- Test: `frontend/src/features/inventario/ProductFormModal.test.jsx` (novo)
- Test: `frontend/src/features/inventario/DetailsModal.test.jsx` (novo)

**Interfaces:**
- Consumes: `getConfig` (Task 9).

- [ ] **Step 1: Escrever os testes (falhando)**

Create `frontend/src/features/inventario/ProductFormModal.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import ProductFormModal from "./ProductFormModal"
import * as config from "../../lib/config"

afterEach(cleanup)

describe("ProductFormModal — campo de preço", () => {
  it("não renderiza o campo de preço quando mostrarPreco é false", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: false })
    render(<ProductFormModal open produto={null} grupos={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/Preço unitário/i)).not.toBeInTheDocument()
  })

  it("renderiza o campo de preço quando mostrarPreco é true", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: true })
    render(<ProductFormModal open produto={null} grupos={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText(/Preço unitário/i)).toBeInTheDocument()
  })
})
```

Create `frontend/src/features/inventario/DetailsModal.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import DetailsModal from "./DetailsModal"
import * as config from "../../lib/config"

afterEach(cleanup)

const PRODUTO = {
  nome: "Arroz", categoria_nome: "Alimentos", grupo_nome: "Geral",
  quantidade: "10.000", estoque_minimo: "5.000", unidade: "KG",
  preco: "5.40", validade: null, numero_nota_fiscal: "", periodicidade: "MENSAL",
  fornecedor_nome: "",
}

describe("DetailsModal — linhas de preço", () => {
  it("não renderiza preço/valor em estoque quando mostrarPreco é false", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: false })
    render(<DetailsModal produto={PRODUTO} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.queryByText("Preço unitário")).not.toBeInTheDocument()
    expect(screen.queryByText("Valor em estoque")).not.toBeInTheDocument()
  })

  it("renderiza preço/valor em estoque quando mostrarPreco é true", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: true })
    render(<DetailsModal produto={PRODUTO} onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByText("Preço unitário")).toBeInTheDocument()
    expect(screen.getByText("Valor em estoque")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd frontend && npm test -- ProductFormModal.test.jsx DetailsModal.test.jsx`
Expected: `FAIL` — o campo/linhas de preço sempre renderizam hoje, então o teste "não renderiza quando false" falha.

- [ ] **Step 3: Gatear o campo em `ProductFormModal.jsx`**

Modify `frontend/src/features/inventario/ProductFormModal.jsx` linha 1-5 — adicionar import:

```js
import { useEffect, useMemo, useState } from "react"
import { produtosApi, movimentacoesApi } from "../../api"
import { UNIDADES, PERIODICIDADES } from "../../api/units"
import Modal from "../../components/ui/Modal"
import { useToast } from "../../components/ui/Toast"
import { getConfig } from "../../lib/config"
```

Modify linha 25-30 — ler o config dentro do componente:

```js
export default function ProductFormModal({ open, produto, grupos, fornecedores = [], onClose, onSaved }) {
  const editando = Boolean(produto)
  const { mostrarPreco } = getConfig()
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()
```

Modify linhas 192-194 — envolver o campo:

```jsx
        {mostrarPreco && (
          <Campo label="Preço unitário" hint="R$ · opcional">
            <input type="number" step="0.01" min="0" className="field" value={form.preco} onChange={set("preco")} placeholder="0,00" />
          </Campo>
        )}
```

- [ ] **Step 4: Gatear as linhas em `DetailsModal.jsx`**

Modify `frontend/src/features/inventario/DetailsModal.jsx` linha 1-5 — adicionar import:

```js
import Modal from "../../components/ui/Modal"
import { Icon } from "../../lib/icons.jsx"
import { categoryStyle } from "../../lib/catalog"
import { brl, qtd, dataBR, stockStatus, validadeStatus } from "../../lib/format"
import { unidadeLabel } from "../../api/units"
import { getConfig } from "../../lib/config"
```

Modify linha 16-20 — ler o config:

```js
export default function DetailsModal({ produto, onClose, onEdit, onDelete, onAdd, onRemove }) {
  if (!produto) return null
  const { mostrarPreco } = getConfig()
  const st = categoryStyle(produto.categoria_nome)
  const stock = stockStatus(produto.quantidade, produto.estoque_minimo)
  const val = validadeStatus(produto.validade)
```

Modify linhas 40-43 — envolver as duas linhas:

```jsx
        {mostrarPreco && (
          <>
            <Linha label="Preço unitário">{brl(produto.preco)}</Linha>
            <Linha label="Valor em estoque">
              {produto.preco ? brl(Number(produto.preco) * Number(produto.quantidade)) : "—"}
            </Linha>
          </>
        )}
```

- [ ] **Step 5: Rodar os testes**

Run: `cd frontend && npm test -- ProductFormModal.test.jsx DetailsModal.test.jsx`
Expected: `PASS`

- [ ] **Step 6: Rodar a suíte completa do frontend (checar regressão)**

Run: `cd frontend && npm test`
Expected: `PASS` em todos os arquivos.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/inventario/ProductFormModal.jsx frontend/src/features/inventario/DetailsModal.jsx frontend/src/features/inventario/ProductFormModal.test.jsx frontend/src/features/inventario/DetailsModal.test.jsx
git commit -m "feat: oculta preco no cadastro e detalhes de produto quando alternador desligado"
```

---

### Task 12: Ocultar preço no formulário de Entrada

**Files:**
- Modify: `frontend/src/features/movimentacoes/EntradaFormModal.jsx`
- Test: `frontend/src/features/movimentacoes/EntradaFormModal.test.jsx` (novo)

**Interfaces:**
- Consumes: `getConfig` (Task 9).

- [ ] **Step 1: Escrever o teste (falhando)**

Create `frontend/src/features/movimentacoes/EntradaFormModal.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import EntradaFormModal from "./EntradaFormModal"
import * as config from "../../lib/config"

afterEach(cleanup)

const PRODUTOS = [{ id: 1, nome: "Arroz" }]
const FORNECEDORES = []

describe("EntradaFormModal — coluna e total de preço", () => {
  it("não renderiza input de preço nem total quando mostrarPreco é false", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: false })
    render(<EntradaFormModal open produtos={PRODUTOS} fornecedores={FORNECEDORES} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByPlaceholderText("R$")).not.toBeInTheDocument()
    expect(screen.queryByText("Total")).not.toBeInTheDocument()
  })

  it("renderiza input de preço e total quando mostrarPreco é true", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: true })
    render(<EntradaFormModal open produtos={PRODUTOS} fornecedores={FORNECEDORES} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByPlaceholderText("R$")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `cd frontend && npm test -- EntradaFormModal.test.jsx`
Expected: `FAIL`

- [ ] **Step 3: Gatear em `EntradaFormModal.jsx`**

Modify `frontend/src/features/movimentacoes/EntradaFormModal.jsx` linhas 1-6 — adicionar import:

```js
import { useEffect, useMemo, useState } from "react"
import { entradasApi } from "../../api"
import { brl } from "../../lib/format"
import { Icon } from "../../lib/icons.jsx"
import Modal from "../../components/ui/Modal"
import { useToast } from "../../components/ui/Toast"
import { getConfig } from "../../lib/config"
```

Modify linha 10 — ler o config dentro do componente:

```js
export default function EntradaFormModal({ open, produtos, fornecedores, onClose, onSaved }) {
  const { mostrarPreco } = getConfig()
  const [cab, setCab] = useState({ fornecedor: "", numero_nota_fiscal: "", data: "", observacao: "" })
```

Modify linhas 89-99 (grid de cada linha de item) — trocar o grid fixo por um condicional e envolver o input de preço:

```jsx
            <div
              key={i}
              className={`grid items-center gap-2 ${
                mostrarPreco ? "grid-cols-[1fr_80px_90px_auto]" : "grid-cols-[1fr_80px_auto]"
              }`}
            >
              <select className="field" value={l.produto} onChange={setL(i, "produto")}>
                <option value="">— produto —</option>
                {produtos.map((p) => (<option key={p.id} value={p.id}>{p.nome}</option>))}
              </select>
              <input type="number" step="any" min="0" className="field" value={l.quantidade} onChange={setL(i, "quantidade")} placeholder="Qtd" />
              {mostrarPreco && (
                <input type="number" step="0.01" min="0" className="field" value={l.preco_unitario} onChange={setL(i, "preco_unitario")} placeholder="R$" />
              )}
              <button type="button" onClick={() => rmLinha(i)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-surface-2" title="Remover">
                {Icon.trash(15)}
              </button>
            </div>
```

Modify linhas 106-109 — envolver o rodapé de total:

```jsx
        {mostrarPreco && (
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-ink-soft">Total</span>
            <span className="font-display text-xl font-bold">{brl(total)}</span>
          </div>
        )}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd frontend && npm test -- EntradaFormModal.test.jsx`
Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/movimentacoes/EntradaFormModal.jsx frontend/src/features/movimentacoes/EntradaFormModal.test.jsx
git commit -m "feat: oculta coluna e total de preco na entrada quando alternador desligado"
```

---

### Task 13: Ocultar preço nos Relatórios (tela, PDF, CSV)

**Files:**
- Modify: `frontend/src/features/relatorios/RelatoriosView.jsx`
- Modify: `frontend/src/lib/prestacaoPdf.js`
- Modify: `frontend/src/lib/export.js`
- Test: `frontend/src/features/relatorios/RelatoriosView.test.jsx` (novo)
- Test: `frontend/src/lib/export.test.js` (novo)

**Interfaces:**
- Consumes: `getConfig` (Task 9), `relatoriosApi.prestacaoContas` (existente, via `../../api`).

- [ ] **Step 1: Escrever o teste da tela (falhando)**

Create `frontend/src/features/relatorios/RelatoriosView.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RelatoriosView from "./RelatoriosView"
import * as config from "../../lib/config"

afterEach(cleanup)

const DADOS = {
  periodo: { inicio: "2026-07-01", fim: "2026-07-18" },
  resumo_financeiro: { total_geral: "100.00", por_categoria: [{ categoria_id: 1, categoria_nome: "Alimentos", total: "100.00" }] },
  fornecedores: [{
    fornecedor_id: 1, fornecedor_nome: "Mercadinho do Zé", documento: "", total_fornecedor: "100.00",
    documentos: [{
      entrada_id: 1, numero_nota_fiscal: "NF-001", data: "2026-07-10", total: "100.00", legado: false,
      itens: [{ produto_nome: "Arroz", quantidade: "10", preco_unitario: "10.00", subtotal: "100.00", numero_nota_fiscal_legado: null }],
    }],
  }],
}

vi.mock("../../api", () => ({
  relatoriosApi: { prestacaoContas: vi.fn().mockResolvedValue(DADOS) },
}))

describe("RelatoriosView — colunas e resumo financeiro", () => {
  it("não renderiza Resumo financeiro nem colunas de preço quando mostrarPreco é false", async () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: false })
    const user = userEvent.setup()
    render(<RelatoriosView />)
    await user.click(screen.getByText("Gerar relatório"))
    await waitFor(() => expect(screen.getByText("Mercadinho do Zé")).toBeInTheDocument())

    expect(screen.queryByText("Resumo financeiro")).not.toBeInTheDocument()
    expect(screen.queryByText("Preço")).not.toBeInTheDocument()
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument()
  })

  it("renderiza Resumo financeiro e colunas de preço quando mostrarPreco é true", async () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: true })
    const user = userEvent.setup()
    render(<RelatoriosView />)
    await user.click(screen.getByText("Gerar relatório"))
    await waitFor(() => expect(screen.getByText("Mercadinho do Zé")).toBeInTheDocument())

    expect(screen.getByText("Resumo financeiro")).toBeInTheDocument()
    expect(screen.getByText("Preço")).toBeInTheDocument()
    expect(screen.getByText("Subtotal")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `cd frontend && npm test -- RelatoriosView.test.jsx`
Expected: `FAIL`

- [ ] **Step 3: Gatear em `RelatoriosView.jsx`**

Modify `frontend/src/features/relatorios/RelatoriosView.jsx` linhas 1-16 — adicionar import:

```js
import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { relatoriosApi } from "../../api"
import { brl, dataBR } from "../../lib/format"
import {
  downloadBlob,
  formatPeriodoLabel,
  isoHoje,
  periodoMesAtual,
  periodoTrimestre,
  prestacaoContasToCsv,
} from "../../lib/export"
import { gerarPdfPrestacaoContas } from "../../lib/prestacaoPdf"
import { Icon } from "../../lib/icons.jsx"
import { useToast } from "../../components/ui/Toast"
import { getConfig } from "../../lib/config"
```

Modify linha 23-24 — ler o config:

```js
export default function RelatoriosView() {
  const toast = useToast()
  const { mostrarPreco } = getConfig()
```

Modify linhas 176-191 — envolver o card "Resumo financeiro":

```jsx
          {mostrarPreco && (
            <div className="card p-5">
              <h3 className="font-display text-lg font-bold">Resumo financeiro</h3>
              <p className="mt-1 text-sm text-ink-faint">
                Total geral: <strong className="text-brand">{brl(dados.resumo_financeiro?.total_geral)}</strong>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(dados.resumo_financeiro?.por_categoria ?? []).map((c) => (
                  <span
                    key={c.categoria_id}
                    className="rounded-full bg-brand-tint px-3 py-1 text-sm font-semibold text-brand"
                  >
                    {c.categoria_nome}: {brl(c.total)}
                  </span>
                ))}
              </div>
            </div>
          )}
```

Modify linhas 201-211 (cabeçalho do card de fornecedor) — envolver o total:

```jsx
            <div key={f.fornecedor_id ?? "sem"} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{f.fornecedor_nome}</h3>
                  {f.documento && <p className="text-sm text-ink-faint">{f.documento}</p>}
                </div>
                {mostrarPreco && (
                  <span className="font-display text-xl font-bold text-brand">
                    {brl(f.total_fornecedor)}
                  </span>
                )}
              </div>
```

Modify linhas 216-221 (linha de metadados do documento) — envolver o total do documento:

```jsx
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">
                        NF {doc.numero_nota_fiscal || "—"}
                      </span>
                      <span className="text-sm text-ink-faint">{dataBR(doc.data)}</span>
                      {mostrarPreco && (
                        <span className="font-semibold text-brand">{brl(doc.total)}</span>
                      )}
```

Modify linhas 229-255 (tabela de itens) — remover as colunas "Preço"/"Subtotal" do cabeçalho e do corpo quando `mostrarPreco` é falso:

```jsx
                      <table className="w-full min-w-[480px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
                            <th className="py-2 pr-3">Produto</th>
                            <th className="py-2 pr-3">Qtd</th>
                            {mostrarPreco && (
                              <>
                                <th className="py-2 pr-3">Preço</th>
                                <th className="py-2">Subtotal</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(doc.itens ?? []).map((it, j) => (
                            <tr key={j} className="border-b border-line/60">
                              <td className="py-2 pr-3 font-medium">
                                {it.produto_nome}
                                {it.numero_nota_fiscal_legado && (
                                  <span className="ml-1 font-mono text-[0.65rem] text-ink-faint">
                                    NF leg. {it.numero_nota_fiscal_legado}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-3">{it.quantidade}</td>
                              {mostrarPreco && (
                                <>
                                  <td className="py-2 pr-3">{it.preco_unitario ? brl(it.preco_unitario) : "—"}</td>
                                  <td className="py-2">{brl(it.subtotal)}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
```

- [ ] **Step 4: Rodar o teste da tela**

Run: `cd frontend && npm test -- RelatoriosView.test.jsx`
Expected: `PASS`

- [ ] **Step 5: Escrever o teste do CSV (falhando)**

Create `frontend/src/lib/export.test.js`:

```js
import { describe, it, expect, vi } from "vitest"
import { prestacaoContasToCsv } from "./export"
import * as config from "./config"

const DADOS = {
  fornecedores: [{
    fornecedor_nome: "Mercadinho do Zé", documento: "",
    documentos: [{
      numero_nota_fiscal: "NF-001", data: "2026-07-10", legado: false,
      itens: [{ produto_nome: "Arroz", quantidade: "10", preco_unitario: "10.00", subtotal: "100.00", numero_nota_fiscal_legado: null }],
    }],
  }],
  resumo_financeiro: { por_categoria: [{ categoria_nome: "Alimentos", total: "100.00" }] },
}

describe("prestacaoContasToCsv — colunas de preço", () => {
  it("omite cabeçalho e valores de preço quando mostrarPreco é false", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: false })
    const csv = prestacaoContasToCsv(DADOS)
    expect(csv).not.toContain("Preço Unit.")
    expect(csv).not.toContain("10.00")
  })

  it("inclui cabeçalho e valores de preço quando mostrarPreco é true", () => {
    vi.spyOn(config, "getConfig").mockReturnValue({ mostrarPreco: true })
    const csv = prestacaoContasToCsv(DADOS)
    expect(csv).toContain("Preço Unit.")
    expect(csv).toContain("10.00")
  })
})
```

- [ ] **Step 6: Rodar o teste para confirmar que falha**

Run: `cd frontend && npm test -- export.test.js`
Expected: `FAIL`

- [ ] **Step 7: Gatear em `export.js`**

Modify `frontend/src/lib/export.js` linha 1 — adicionar import:

```js
import { dataBR } from "./format"
import { getConfig } from "./config"
```

Modify `prestacaoContasToCsv` (linhas 53-81) por:

```js
export function prestacaoContasToCsv(dados) {
  const { mostrarPreco } = getConfig()
  const header = mostrarPreco
    ? ["Fornecedor", "CNPJ", "NF", "Data", "Produto", "Qtd", "Preço Unit.", "Subtotal", "Categoria", "Legado"]
    : ["Fornecedor", "CNPJ", "NF", "Data", "Produto", "Qtd", "Categoria", "Legado"]
  const rows = [header]
  for (const f of dados.fornecedores ?? []) {
    for (const doc of f.documentos ?? []) {
      for (const it of doc.itens ?? []) {
        const linha = [
          f.fornecedor_nome,
          f.documento || "",
          doc.numero_nota_fiscal || it.numero_nota_fiscal_legado || "",
          dataBR(doc.data),
          it.produto_nome,
          it.quantidade,
        ]
        if (mostrarPreco) linha.push(it.preco_unitario ?? "", it.subtotal)
        linha.push("", doc.legado ? "Sim" : "Não")
        rows.push(linha)
      }
    }
  }
  if (mostrarPreco) {
    for (const c of dados.resumo_financeiro?.por_categoria ?? []) {
      rows.push(["", "", "", "", "", "", "", c.total, c.categoria_nome, "Resumo"])
    }
  }
  return "﻿" + toCsv(rows)
}
```

- [ ] **Step 8: Rodar o teste do CSV**

Run: `cd frontend && npm test -- export.test.js`
Expected: `PASS`

- [ ] **Step 9: Gatear em `prestacaoPdf.js` (verificação manual — sem teste automatizado)**

`prestacaoPdf.js` monta o PDF via `jspdf-autotable`; testar sua saída exigiria mockar `jsPDF`/`autoTable` para inspecionar as tabelas geradas, o que agrega complexidade desproporcional ao risco (a lógica de decisão já está coberta pelos testes de `RelatoriosView` e `export.js`, que exercitam o mesmo padrão de gate). Aplique o gate e valide manualmente exportando um PDF com o alternador ligado e desligado.

Modify `frontend/src/lib/prestacaoPdf.js` linha 1-4 — adicionar import:

```js
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { brl, dataBR } from "./format"
import { formatPeriodoLabel } from "./export"
import { getConfig } from "./config"
```

Modify linha 6 — ler o config no início da função:

```js
export function gerarPdfPrestacaoContas(dados) {
  const { mostrarPreco } = getConfig()
  const { inicio, fim } = dados.periodo
```

Modify linhas 22-38 (bloco "Resumo por categoria") — envolver em `if (mostrarPreco) { ... }`:

```js
  if (mostrarPreco) {
    doc.setFontSize(12)
    doc.text("Resumo por categoria", 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [["Categoria", "Total"]],
      body: (dados.resumo_financeiro?.por_categoria ?? []).map((c) => [
        c.categoria_nome,
        brl(c.total),
      ]),
      foot: [["Total geral", brl(dados.resumo_financeiro?.total_geral ?? 0)]],
      theme: "grid",
      headStyles: { fillColor: [33, 77, 63] },
      footStyles: { fillColor: [231, 239, 232], textColor: [33, 77, 63], fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    })

    y = doc.lastAutoTable.finalY + 10
  }
```

Modify linhas 47-53 (subtotal do fornecedor dentro do loop) — envolver:

```js
    doc.setFontSize(11)
    doc.setTextColor(33, 77, 63)
    doc.text(`${f.fornecedor_nome}${f.documento ? ` — ${f.documento}` : ""}`, 14, y)
    y += 2
    if (mostrarPreco) {
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(`Subtotal fornecedor: ${brl(f.total_fornecedor)}`, 14, y + 4)
      y += 8
    } else {
      y += 2
    }
```

Modify linhas 56-77 (tabela de itens por documento) — trocar head/body/foot conforme `mostrarPreco`:

```js
    for (const d of f.documentos ?? []) {
      const rows = (d.itens ?? []).map((it) => {
        const base = [
          d.numero_nota_fiscal || it.numero_nota_fiscal_legado || "—",
          dataBR(d.data),
          it.produto_nome,
          it.quantidade,
        ]
        if (mostrarPreco) {
          return [...base, it.preco_unitario ? brl(it.preco_unitario) : "—", brl(it.subtotal), d.legado ? "Legado" : ""]
        }
        return [...base, d.legado ? "Legado" : ""]
      })
      autoTable(doc, {
        startY: y,
        head: [mostrarPreco
          ? ["NF", "Data", "Produto", "Qtd", "Preço", "Subtotal", ""]
          : ["NF", "Data", "Produto", "Qtd", ""]],
        body: rows,
        foot: mostrarPreco
          ? [[`Documento ${d.legado ? "(legado) " : ""}total`, "", "", "", "", brl(d.total), ""]]
          : undefined,
        theme: "striped",
        headStyles: { fillColor: [47, 122, 91] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 },
      })
      y = doc.lastAutoTable.finalY + 6
    }
```

- [ ] **Step 10: Verificar manualmente**

Run: `cd frontend && npm run dev` (com backend rodando e ao menos uma entrada registrada no período)

Na aba Relatórios, gere um relatório, exporte o PDF com "Mostrar preços" desligado (padrão) e confirme visualmente que não há "Resumo por categoria", nem coluna "Preço"/"Subtotal", nem "Total geral" em nenhuma tabela. Ligue o alternador em Configurações, gere e exporte de novo, confirme que os valores em R$ voltam a aparecer.

Expected: PDF sem qualquer menção a R$ quando desligado; PDF completo (igual ao comportamento atual) quando ligado.

- [ ] **Step 11: Rodar a suíte completa do frontend**

Run: `cd frontend && npm test`
Expected: `PASS` em todos os arquivos.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/features/relatorios/RelatoriosView.jsx frontend/src/features/relatorios/RelatoriosView.test.jsx frontend/src/lib/prestacaoPdf.js frontend/src/lib/export.js frontend/src/lib/export.test.js
git commit -m "feat: oculta preco/custo nos relatorios (tela, PDF e CSV) quando alternador desligado"
```

---

## Task 14: Atualizar documentação

**Files:**
- Modify: `README.md`
- Modify: `DEPLOY.md`

**Interfaces:**
- Consumes: nenhuma.

- [ ] **Step 1: Atualizar a seção "Configure o App Alunos" e "PINs do App Alunos"**

Modify `README.md` — a seção atual (linhas 127-153) descreve `cp .env.example .env` + "Edite o .env com os PINs das turmas" e lista os PINs de demonstração (1001-1007, turmas 6A-9A). Substitua por uma nota explicando que os PINs agora são geridos pelo Django Admin:

```markdown
### 4. Configure o App Cozinha
```bash
cd app-cozinha
npm install

# Criar arquivo .env
echo "VITE_API_BASE=" > .env

npm run dev
```

App Cozinha rodando em: http://localhost:5175/

### 5. Configure o App Alunos
```bash
cd app-alunos
npm install

# Criar arquivo .env
cp .env.example .env

npm run dev
```

App Alunos rodando em: http://localhost:5174/

## 🔐 Gestão de PINs

Os PINs de acesso (turmas e equipe da cozinha) **não ficam mais em arquivos `.env`** — são cadastrados pelo Django Admin, em `/admin/core/turma/` (PINs de representantes de turma, 3 por turma) e `/admin/core/pinacesso/` (PINs da equipe da cozinha). Veja `docs/superpowers/specs/2026-07-18-turmas-pins-preco-design.md` para o desenho completo.
```

(Ajuste o trecho substituído para bater exatamente com o conteúdo atual do `README.md` nessa faixa de linhas — confira com `sed -n '114,154p' README.md` antes de editar, pois o arquivo pode ter mudado desde a leitura usada para este plano.)

- [ ] **Step 2: Atualizar `DEPLOY.md`**

Modify `DEPLOY.md` linhas 140-145 (variáveis de ambiente do deploy do App Alunos) — remover `VITE_PINS`/`VITE_TURNOS`:

```markdown
3. **Environment Variables**:
   ```
   VITE_API_BASE = https://edustock-backend.onrender.com
   ```
```

Modify `DEPLOY.md` linhas 179-182 (seção "3. Testar os Apps") — remover as menções a PINs fixos:

```markdown
- **Admin**: https://edustock-frontend.onrender.com
- **Cozinha**: https://edustock-cozinha.onrender.com (PIN cadastrado no Django Admin)
- **Alunos**: https://edustock-alunos.onrender.com (PIN cadastrado no Django Admin, por turma)
- **Admin Django**: https://edustock-backend.onrender.com/admin
```

(Confira o conteúdo atual dessas faixas com `sed -n '140,146p;179,182p' DEPLOY.md` antes de editar, caso o arquivo tenha mudado desde a leitura usada para este plano.)

- [ ] **Step 3: Commit**

```bash
git add README.md DEPLOY.md
git commit -m "docs: atualiza README e DEPLOY sobre gestao de PINs pelo Django Admin"
```

---

## Verificação final

- [ ] **Step 1: Suíte completa do backend**

Run: `python manage.py test`
Expected: `OK`

- [ ] **Step 2: Suíte completa do frontend**

Run: `cd frontend && npm test`
Expected: `PASS`

- [ ] **Step 3: Smoke test manual do fluxo ponta a ponta**

Com backend + `frontend` + `app-alunos` + `app-cozinha` rodando:
1. Django Admin: cadastre um PIN de aluno para "1º DS-A" e um PIN de cozinha.
2. app-alunos: logue com o PIN cadastrado, registre uma contagem.
3. app-alunos (outra aba/PIN diferente da mesma turma, se houver um segundo cadastrado): tente registrar de novo no mesmo turno/dia — confirme o erro de duplicidade.
4. app-cozinha: logue com o PIN de cozinha, confirme que o plano do dia reflete a contagem registrada.
5. `frontend`: em Configurações, confirme que "Mostrar preços" está desligado por padrão; navegue por Inventário, Movimentações e Relatórios confirmando ausência de qualquer valor em R$; ligue o alternador e confirme que os valores voltam.

Expected: todos os passos funcionam sem erro 500/403 inesperado.
