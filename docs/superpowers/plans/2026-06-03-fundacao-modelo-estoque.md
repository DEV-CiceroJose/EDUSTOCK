# Fundação do Modelo de Estoque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o modelo de dados do Gestor Escolar para hierarquia `Categoria → Grupo → Produto`, adicionar `BemPermanente` (modelo+API), `estoque_minimo`/`perecivel`/`periodicidade`, e corrigir dívidas técnicas (quantidade Decimal, `on_delete=PROTECT`, fim do limiar fixo "15"), sem perder dados existentes.

**Architecture:** Backend Django/DRF com migração em 3 etapas (schema → data → finalização) para trocar o FK `Produto.categoria` por `Produto.grupo` sem downtime. API REST aditiva. Frontend React consome `grupo`/`categoria` (derivada) e usa `estoque_minimo` por item.

**Tech Stack:** Django 6 + DRF (venv em `.venv`), test runner nativo do Django; React + Vite + Tailwind; Vitest para a lógica pura do front.

**Spec:** `docs/superpowers/specs/2026-06-03-fundacao-modelo-estoque-design.md`

**Comandos base (Windows):**
- Testes Django: `.venv\Scripts\python manage.py test core -v 2`
- Migrações: `.venv\Scripts\python manage.py makemigrations core` / `migrate`
- Front (em `frontend/`): `npm run build`, `npx vitest run`

---

## File Structure

**Backend (`core/`):**
- `models.py` — +`Grupo`, +`BemPermanente`, evolui `Produto`, Meta em `Categoria`
- `migrations/0004_fundacao_grupo_bempermanente.py` — schema (gerada)
- `migrations/0005_repoint_produtos_para_grupo.py` — data migration (manual)
- `migrations/0006_finaliza_grupo_obrigatorio.py` — schema (gerada)
- `serializers.py` — +`GrupoSerializer`, +`BemPermanenteSerializer`, atualiza `ProdutoSerializer`
- `api_views.py` — +`GrupoViewSet`, +`BemPermanenteViewSet`, atualiza `ProdutoViewSet`
- `api_urls.py` — registra `grupos`, `bens-permanentes`
- `tests/` — pacote: `test_models.py`, `test_migrations.py`, `test_api.py`

**Frontend (`frontend/src/`):**
- `lib/format.js` — `stockStatus`/`stockPercent` por `estoque_minimo`; remove `LIMITE_BAIXO`
- `lib/format.test.js` — testes Vitest (novo)
- `api/units.js` — +`PERIODICIDADES`
- `api/http.js` — +`httpGrupos`, +`httpBensPermanentes`
- `api/mock.js` — grupos + `produto.grupo`
- `api/index.js` — exporta `gruposApi`
- `components/ProductFormModal.jsx` — seletor de Grupo + novos campos
- `components/ProductCard.jsx` — exibe grupo; status por `estoque_minimo`
- `components/DetailsModal.jsx` — status por `estoque_minimo`
- `components/CategoryRail.jsx` — 2 níveis (categoria → grupos)
- `pages/DashboardPage.jsx` — busca grupos; filtros por categoria/grupo

---

## Phase A — Backend: modelo e migrações

### Task 1: Converter `tests.py` em pacote de testes

**Files:**
- Delete: `core/tests.py`
- Create: `core/tests/__init__.py`, `core/tests/test_models.py`

- [ ] **Step 1: Remover o módulo antigo e criar o pacote**

```bash
rm core/tests.py
```

Criar `core/tests/__init__.py` (vazio):

```python
```

Criar `core/tests/test_models.py`:

```python
from django.test import TestCase


class SmokeTest(TestCase):
    def test_runner_funciona(self):
        self.assertTrue(True)
```

- [ ] **Step 2: Rodar para confirmar descoberta**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (1 test — `test_runner_funciona`)

- [ ] **Step 3: Commit**

```bash
git add core/tests core/tests.py
git commit -m "test: converte core/tests.py em pacote de testes"
```

---

### Task 2: Modelos novos + migração de schema (0004)

Adiciona `Grupo`, `BemPermanente`, novos campos em `Produto` (com `grupo` **nullable** por enquanto), converte `quantidade` para Decimal e mantém `categoria` temporariamente.

**Files:**
- Modify: `core/models.py`
- Create: `core/migrations/0004_fundacao_grupo_bempermanente.py` (gerada)
- Modify: `core/tests/test_models.py`

- [ ] **Step 1: Escrever os testes que falham**

Substituir `core/tests/test_models.py` por:

```python
from datetime import date
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.test import TestCase
from core.models import Categoria, Grupo, Produto, BemPermanente


class GrupoModelTest(TestCase):
    def test_grupo_pertence_a_categoria(self):
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Carboidratos", categoria=cat)
        self.assertEqual(grupo.categoria, cat)
        self.assertIn("Carboidratos", str(grupo))

    def test_grupo_unico_por_categoria(self):
        cat = Categoria.objects.create(name="Alimentos")
        Grupo.objects.create(nome="Geral", categoria=cat)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Grupo.objects.create(nome="Geral", categoria=cat)


class ProdutoModelTest(TestCase):
    def setUp(self):
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=self.cat)

    def test_novos_campos_e_defaults(self):
        p = Produto.objects.create(
            nome="Arroz", grupo=self.grupo, quantidade=Decimal("48.5"), unidade="KG"
        )
        self.assertEqual(p.estoque_minimo, Decimal("0"))
        self.assertFalse(p.perecivel)
        self.assertEqual(p.periodicidade, "EVENTUAL")
        self.assertEqual(p.quantidade, Decimal("48.5"))
        self.assertEqual(p.grupo.categoria, self.cat)


class BemPermanenteModelTest(TestCase):
    def test_cria_bem_permanente(self):
        b = BemPermanente.objects.create(
            nome="Notebook Dell", numero_patrimonio="PAT-001",
            localizacao="Lab Informática", responsavel="Prof. Marcelo",
            estado_conservacao="BOM", data_aquisicao=date(2025, 1, 10),
        )
        self.assertEqual(str(b), "Notebook Dell")

    def test_patrimonio_unico(self):
        BemPermanente.objects.create(nome="A", numero_patrimonio="PAT-9")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                BemPermanente.objects.create(nome="B", numero_patrimonio="PAT-9")
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: FAIL (ImportError: cannot import name 'Grupo' / 'BemPermanente')

- [ ] **Step 3: Reescrever `core/models.py`** (mantendo `categoria` em Produto por enquanto)

```python
from django.db import models
from django.contrib.auth.models import User


class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    matricula = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"{self.user.username} - {self.matricula}"


class Categoria(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"

    def __str__(self):
        return self.name


class Grupo(models.Model):
    nome = models.CharField(max_length=100)
    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name="grupos"
    )

    class Meta:
        ordering = ["categoria__name", "nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["categoria", "nome"], name="unique_grupo_por_categoria"
            )
        ]

    def __str__(self):
        return f"{self.categoria.name} › {self.nome}"


class Produto(models.Model):
    UNIDADE_CHOICES = [
        ("UN", "Unidade"),
        ("KG", "Quilograma"),
        ("L", "Litro"),
        ("CX", "Caixa"),
        ("PC", "Pacote"),
    ]
    PERIODICIDADE_CHOICES = [
        ("SEMANAL", "Semanal"),
        ("MENSAL", "Mensal"),
        ("EVENTUAL", "Eventual"),
    ]

    nome = models.CharField("Nome", max_length=200)
    numero_nota_fiscal = models.CharField(
        "Número da Nota Fiscal", max_length=12, null=True, blank=True
    )
    # categoria mantida temporariamente; removida na migração 0006
    categoria = models.ForeignKey(
        "Categoria", on_delete=models.PROTECT, null=True, blank=True,
        related_name="produtos_legado",
    )
    grupo = models.ForeignKey(
        "Grupo", on_delete=models.PROTECT, null=True, blank=True,
        related_name="produtos",
    )
    quantidade = models.DecimalField("Quantidade", max_digits=10, decimal_places=3, default=0)
    unidade = models.CharField(max_length=2, choices=UNIDADE_CHOICES)
    estoque_minimo = models.DecimalField(
        "Estoque mínimo", max_digits=10, decimal_places=3, default=0
    )
    perecivel = models.BooleanField("Perecível", default=False)
    periodicidade = models.CharField(
        max_length=8, choices=PERIODICIDADE_CHOICES, default="EVENTUAL"
    )
    validade = models.DateField("Validade", null=True, blank=True)
    preco = models.DecimalField("Preço", max_digits=10, decimal_places=2, null=True, blank=True)

    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="produtos_criados"
    )
    atualizado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="produtos_atualizados"
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class BemPermanente(models.Model):
    ESTADO_CHOICES = [
        ("NOVO", "Novo"),
        ("BOM", "Bom"),
        ("REGULAR", "Regular"),
        ("RUIM", "Ruim"),
        ("INSERVIVEL", "Inservível"),
    ]

    nome = models.CharField(max_length=200)
    numero_patrimonio = models.CharField(max_length=50, null=True, blank=True, unique=True)
    localizacao = models.CharField(max_length=150, blank=True)
    responsavel = models.CharField(max_length=150, blank=True)
    estado_conservacao = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="BOM")
    data_aquisicao = models.DateField(null=True, blank=True)
    observacao = models.TextField(blank=True)

    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="bens_criados"
    )
    atualizado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="bens_atualizados"
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "Bem permanente"
        verbose_name_plural = "Bens permanentes"

    def __str__(self):
        return self.nome
```

- [ ] **Step 4: Gerar a migração de schema com nome fixo**

Run: `.venv\Scripts\python manage.py makemigrations core --name fundacao_grupo_bempermanente`
Expected: cria `core/migrations/0004_fundacao_grupo_bempermanente.py` (CreateModel Grupo, BemPermanente; AddField grupo/estoque_minimo/perecivel/periodicidade; AlterField quantidade, categoria). Sem prompts interativos (todos os campos novos têm default ou são nullable).

- [ ] **Step 5: Rodar os testes (migra o banco de teste e valida)**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (todos os testes de modelo)

- [ ] **Step 6: Commit**

```bash
git add core/models.py core/migrations/0004_fundacao_grupo_bempermanente.py core/tests/test_models.py
git commit -m "feat: adiciona Grupo, BemPermanente e novos campos de Produto (migração 0004)"
```

---

### Task 3: Data migration de repontuação (0005)

Cria um `Grupo` "Geral" por categoria existente e move os produtos para ele. Reversível.

**Files:**
- Create: `core/migrations/0005_repoint_produtos_para_grupo.py`
- Create: `core/tests/test_migrations.py`

- [ ] **Step 1: Escrever o teste de migração (falha)**

Criar `core/tests/test_migrations.py`:

```python
from decimal import Decimal
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class RepointDataMigrationTest(TransactionTestCase):
    migrate_from = ("core", "0004_fundacao_grupo_bempermanente")
    migrate_to = ("core", "0005_repoint_produtos_para_grupo")

    def _migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_produto_vai_para_grupo_geral_e_volta(self):
        # estado em 0004 (categoria ainda existe, grupo nullable)
        apps = self._migrate(self.migrate_from)
        Categoria = apps.get_model("core", "Categoria")
        Produto = apps.get_model("core", "Produto")
        cat = Categoria.objects.create(name="Alimentos")
        Produto.objects.create(nome="Arroz", categoria=cat, quantidade=Decimal("10"), unidade="KG")

        # aplica 0005 (forward)
        apps = self._migrate(self.migrate_to)
        Produto = apps.get_model("core", "Produto")
        prod = Produto.objects.get(nome="Arroz")
        self.assertIsNotNone(prod.grupo_id)
        self.assertEqual(prod.grupo.nome, "Geral")
        self.assertEqual(prod.grupo.categoria.name, "Alimentos")
        self.assertEqual(prod.quantidade, Decimal("10"))

        # reverse para 0004 restaura categoria e remove "Geral"
        apps = self._migrate(self.migrate_from)
        Produto = apps.get_model("core", "Produto")
        Grupo = apps.get_model("core", "Grupo")
        prod = Produto.objects.get(nome="Arroz")
        self.assertEqual(prod.categoria.name, "Alimentos")
        self.assertEqual(Grupo.objects.filter(nome="Geral").count(), 0)

    def tearDown(self):
        # deixa o banco de teste na migração mais recente
        self._migrate(("core", "0005_repoint_produtos_para_grupo"))
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_migrations -v 2`
Expected: FAIL (migração `0005_repoint_produtos_para_grupo` não existe → NodeNotFoundError)

- [ ] **Step 3: Criar a migração vazia com nome fixo**

Run: `.venv\Scripts\python manage.py makemigrations core --empty --name repoint_produtos_para_grupo`
Expected: cria `core/migrations/0005_repoint_produtos_para_grupo.py` com esqueleto.

- [ ] **Step 4: Implementar a data migration**

Substituir o conteúdo de `core/migrations/0005_repoint_produtos_para_grupo.py`:

```python
from django.db import migrations


def criar_grupos_geral(apps, schema_editor):
    Categoria = apps.get_model("core", "Categoria")
    Grupo = apps.get_model("core", "Grupo")
    Produto = apps.get_model("core", "Produto")
    for cat in Categoria.objects.all():
        grupo, _ = Grupo.objects.get_or_create(categoria=cat, nome="Geral")
        Produto.objects.filter(categoria=cat, grupo__isnull=True).update(grupo=grupo)


def reverter(apps, schema_editor):
    Grupo = apps.get_model("core", "Grupo")
    Produto = apps.get_model("core", "Produto")
    for produto in Produto.objects.select_related("grupo__categoria").all():
        if produto.grupo_id:
            produto.categoria_id = produto.grupo.categoria_id
            produto.save(update_fields=["categoria"])
    Grupo.objects.filter(nome="Geral").delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0004_fundacao_grupo_bempermanente")]
    operations = [migrations.RunPython(criar_grupos_geral, reverter)]
```

- [ ] **Step 5: Rodar o teste de migração**

Run: `.venv\Scripts\python manage.py test core.tests.test_migrations -v 2`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core/migrations/0005_repoint_produtos_para_grupo.py core/tests/test_migrations.py
git commit -m "feat: data migration repontua produtos para grupo 'Geral' (0005)"
```

---

### Task 4: Finalizar — grupo obrigatório, remover categoria (0006)

**Files:**
- Modify: `core/models.py` (remover `categoria` de Produto; `grupo` não-nulo)
- Create: `core/migrations/0006_finaliza_grupo_obrigatorio.py` (gerada)
- Modify: `core/tests/test_models.py`

- [ ] **Step 1: Escrever teste que exige grupo e proíbe categoria (falha)**

Acrescentar ao final de `core/tests/test_models.py`:

```python
class ProdutoFinalTest(TestCase):
    def test_grupo_obrigatorio_e_categoria_removida(self):
        cat = Categoria.objects.create(name="Limpeza")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        p = Produto.objects.create(nome="Sabão", grupo=grupo, quantidade=5, unidade="UN")
        # categoria não é mais campo do Produto
        self.assertFalse(hasattr(p, "categoria"))

    def test_categoria_em_uso_protegida(self):
        from django.db.models import ProtectedError
        cat = Categoria.objects.create(name="Papelaria")
        Grupo.objects.create(nome="Geral", categoria=cat)
        with self.assertRaises(ProtectedError):
            cat.delete()
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_models -v 2`
Expected: FAIL (`hasattr(p, "categoria")` ainda True)

- [ ] **Step 3: Editar `core/models.py`** — no modelo `Produto`, remover o campo `categoria` inteiro e tornar `grupo` obrigatório.

Remover este bloco:

```python
    # categoria mantida temporariamente; removida na migração 0006
    categoria = models.ForeignKey(
        "Categoria", on_delete=models.PROTECT, null=True, blank=True,
        related_name="produtos_legado",
    )
```

E trocar o campo `grupo` por (sem `null/blank`):

```python
    grupo = models.ForeignKey("Grupo", on_delete=models.PROTECT, related_name="produtos")
```

- [ ] **Step 4: Gerar a migração final**

Run: `.venv\Scripts\python manage.py makemigrations core --name finaliza_grupo_obrigatorio`
Expected: cria `0006_finaliza_grupo_obrigatorio.py` (RemoveField categoria; AlterField grupo → não-nulo). Sem prompt (linhas existentes já têm grupo após 0005).

- [ ] **Step 5: Rodar todos os testes**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (modelos + migração)

- [ ] **Step 6: Aplicar as migrações no banco de desenvolvimento real**

Run: `.venv\Scripts\python manage.py migrate`
Expected: aplica 0004, 0005, 0006; os 8 produtos existentes passam a apontar para o grupo "Geral" da sua categoria. Sem erros.

- [ ] **Step 7: Commit**

```bash
git add core/models.py core/migrations/0006_finaliza_grupo_obrigatorio.py core/tests/test_models.py
git commit -m "feat: torna grupo obrigatório e remove categoria de Produto (0006)"
```

---

## Phase B — Backend: API (DRF)

### Task 5: GrupoSerializer + GrupoViewSet + rota

**Files:**
- Modify: `core/serializers.py`
- Modify: `core/api_views.py`
- Modify: `core/api_urls.py`
- Create: `core/tests/test_api.py`

- [ ] **Step 1: Escrever teste de API para grupos (falha)**

Criar `core/tests/test_api.py`:

```python
from rest_framework.test import APITestCase
from core.models import Categoria, Grupo


class GrupoApiTest(APITestCase):
    def test_lista_e_cria_grupo(self):
        cat = Categoria.objects.create(name="Alimentos")
        resp = self.client.post(
            "/api/grupos/", {"nome": "Carboidratos", "categoria": cat.id}, format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["categoria_nome"], "Alimentos")

        resp = self.client.get("/api/grupos/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_api -v 2`
Expected: FAIL (404 em `/api/grupos/`)

- [ ] **Step 3: Adicionar `GrupoSerializer`** ao final de `core/serializers.py`

```python
class GrupoSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.name", read_only=True)

    class Meta:
        model = Grupo
        fields = ["id", "nome", "categoria", "categoria_nome"]
```

E atualizar o import no topo de `core/serializers.py`:

```python
from .models import Produto, Categoria, Grupo, BemPermanente
```

- [ ] **Step 4: Adicionar `GrupoViewSet`** em `core/api_views.py`

Atualizar o import do topo:

```python
from .models import Produto, Categoria, Grupo, BemPermanente
from .serializers import (
    ProdutoSerializer, CategoriaSerializer, GrupoSerializer, BemPermanenteSerializer,
)
```

E adicionar a classe:

```python
class GrupoViewSet(viewsets.ModelViewSet):
    queryset = Grupo.objects.select_related("categoria").all()
    serializer_class = GrupoSerializer
```

- [ ] **Step 5: Registrar a rota** em `core/api_urls.py`

```python
from rest_framework.routers import DefaultRouter
from .api_views import (
    ProdutoViewSet, CategoriaViewSet, GrupoViewSet, BemPermanenteViewSet,
)

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"grupos", GrupoViewSet, basename="grupo")
router.register(r"bens-permanentes", BemPermanenteViewSet, basename="bempermanente")

urlpatterns = router.urls
```

> Nota: `BemPermanenteViewSet` é criado na Task 7. Faça as Tasks 5–7 em sequência antes de rodar o servidor; o teste de grupos abaixo não depende dele.

- [ ] **Step 6: Rodar o teste de grupos**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.GrupoApiTest -v 2`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add core/serializers.py core/api_views.py core/api_urls.py core/tests/test_api.py
git commit -m "feat: API de grupos (serializer, viewset, rota)"
```

---

### Task 6: Atualizar ProdutoSerializer + ProdutoViewSet

`Produto` passa a expor `grupo`, `grupo_nome`, `categoria`/`categoria_nome` (derivados via grupo) e os novos campos; filtro por `grupo`/`categoria`.

**Files:**
- Modify: `core/serializers.py`
- Modify: `core/api_views.py`
- Modify: `core/tests/test_api.py`

- [ ] **Step 1: Escrever teste (falha)** — acrescentar a `core/tests/test_api.py`:

```python
from core.models import Produto


class ProdutoApiTest(APITestCase):
    def setUp(self):
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Carboidratos", categoria=self.cat)

    def test_cria_produto_com_grupo_e_expoe_derivados(self):
        resp = self.client.post("/api/produtos/", {
            "nome": "Arroz", "grupo": self.grupo.id, "quantidade": "48",
            "unidade": "KG", "estoque_minimo": "10", "perecivel": False,
            "periodicidade": "MENSAL",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["grupo_nome"], "Carboidratos")
        self.assertEqual(resp.data["categoria_nome"], "Alimentos")
        self.assertEqual(resp.data["categoria"], self.cat.id)
        self.assertEqual(resp.data["periodicidade"], "MENSAL")

    def test_filtra_por_categoria(self):
        Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=1, unidade="KG")
        outra = Categoria.objects.create(name="Limpeza")
        g2 = Grupo.objects.create(nome="Geral", categoria=outra)
        Produto.objects.create(nome="Sabão", grupo=g2, quantidade=1, unidade="UN")

        resp = self.client.get(f"/api/produtos/?categoria={self.cat.id}")
        self.assertEqual(resp.status_code, 200)
        nomes = [p["nome"] for p in resp.data]
        self.assertEqual(nomes, ["Arroz"])
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.ProdutoApiTest -v 2`
Expected: FAIL (KeyError `grupo_nome` / produto sem campo grupo)

- [ ] **Step 3: Substituir `ProdutoSerializer`** em `core/serializers.py`

```python
class ProdutoSerializer(serializers.ModelSerializer):
    grupo_nome = serializers.CharField(source="grupo.nome", read_only=True)
    categoria = serializers.IntegerField(source="grupo.categoria_id", read_only=True)
    categoria_nome = serializers.CharField(source="grupo.categoria.name", read_only=True)
    criado_por_nome = serializers.CharField(source="criado_por.username", read_only=True)

    class Meta:
        model = Produto
        fields = [
            "id", "nome", "numero_nota_fiscal",
            "grupo", "grupo_nome", "categoria", "categoria_nome",
            "quantidade", "unidade", "estoque_minimo", "perecivel", "periodicidade",
            "validade", "preco",
            "criado_por_nome", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_por_nome", "criado_em", "atualizado_em"]
```

- [ ] **Step 4: Substituir `ProdutoViewSet`** em `core/api_views.py`

```python
class ProdutoViewSet(viewsets.ModelViewSet):
    serializer_class = ProdutoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def get_queryset(self):
        qs = Produto.objects.select_related(
            "grupo__categoria", "criado_por", "atualizado_por"
        ).all()
        grupo = self.request.query_params.get("grupo")
        categoria = self.request.query_params.get("categoria")
        if grupo:
            qs = qs.filter(grupo_id=grupo)
        if categoria:
            qs = qs.filter(grupo__categoria_id=categoria)
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)
```

- [ ] **Step 5: Rodar os testes de produto**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.ProdutoApiTest -v 2`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core/serializers.py core/api_views.py core/tests/test_api.py
git commit -m "feat: Produto API por grupo, com categoria derivada e filtros"
```

---

### Task 7: BemPermanente serializer + viewset

**Files:**
- Modify: `core/serializers.py`
- Modify: `core/api_views.py`
- Modify: `core/tests/test_api.py`

- [ ] **Step 1: Escrever teste (falha)** — acrescentar a `core/tests/test_api.py`:

```python
class BemPermanenteApiTest(APITestCase):
    def test_crud_basico(self):
        resp = self.client.post("/api/bens-permanentes/", {
            "nome": "Projetor", "numero_patrimonio": "PAT-77",
            "localizacao": "Sala 3", "responsavel": "Coordenação",
            "estado_conservacao": "BOM",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        bem_id = resp.data["id"]

        resp = self.client.get("/api/bens-permanentes/")
        self.assertEqual(len(resp.data), 1)

        resp = self.client.delete(f"/api/bens-permanentes/{bem_id}/")
        self.assertEqual(resp.status_code, 204)
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.BemPermanenteApiTest -v 2`
Expected: FAIL (404)

- [ ] **Step 3: Adicionar `BemPermanenteSerializer`** ao final de `core/serializers.py`

```python
class BemPermanenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = BemPermanente
        fields = [
            "id", "nome", "numero_patrimonio", "localizacao", "responsavel",
            "estado_conservacao", "data_aquisicao", "observacao",
            "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]
```

- [ ] **Step 4: Adicionar `BemPermanenteViewSet`** em `core/api_views.py`

```python
class BemPermanenteViewSet(viewsets.ModelViewSet):
    queryset = BemPermanente.objects.all()
    serializer_class = BemPermanenteSerializer

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)
```

- [ ] **Step 5: Rodar a suíte de API completa**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (modelos + migração + toda a API)

- [ ] **Step 6: Commit**

```bash
git add core/serializers.py core/api_views.py core/tests/test_api.py
git commit -m "feat: API de bens permanentes (modelo+API, sem UI)"
```

---

## Phase C — Frontend

### Task 8: Vitest + `stockStatus` por `estoque_minimo`

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/format.test.js`
- Modify: `frontend/src/lib/format.js`

- [ ] **Step 1: Instalar o Vitest e adicionar o script**

Run (em `frontend/`): `npm install -D vitest`

Em `frontend/package.json`, dentro de `"scripts"`, acrescentar:

```json
    "test": "vitest run"
```

- [ ] **Step 2: Escrever o teste (falha)** — criar `frontend/src/lib/format.test.js`:

```js
import { describe, it, expect } from "vitest"
import { stockStatus, stockPercent } from "./format"

describe("stockStatus por estoque_minimo", () => {
  it("esgotado quando quantidade <= 0", () => {
    expect(stockStatus(0, 10).code).toBe("out")
  })
  it("baixo quando quantidade <= estoque_minimo", () => {
    expect(stockStatus(8, 10).code).toBe("low")
    expect(stockStatus(10, 10).code).toBe("low")
  })
  it("em estoque quando acima do minimo", () => {
    expect(stockStatus(11, 10).code).toBe("ok")
  })
  it("sem minimo definido: so esgota em 0", () => {
    expect(stockStatus(1, 0).code).toBe("ok")
  })
})

describe("stockPercent", () => {
  it("usa 2x o minimo como teto", () => {
    expect(stockPercent(10, 10)).toBe(50)
    expect(stockPercent(20, 10)).toBe(100)
  })
})
```

- [ ] **Step 3: Rodar para verificar que falha**

Run (em `frontend/`): `npx vitest run`
Expected: FAIL (`stockStatus(8, 10)` retorna "ok" porque ainda usa o limiar fixo 15)

- [ ] **Step 4: Editar `frontend/src/lib/format.js`** — remover `LIMITE_BAIXO` e reescrever as duas funções.

Remover:

```js
// Limiar (heurística de UI — o backend não tem campo estoque_minimo ainda)
export const LIMITE_BAIXO = 15

// Status de estoque a partir da quantidade: { code, label }
export function stockStatus(quantidade) {
  const q = Number(quantidade)
  if (q <= 0) return { code: "out", label: "Esgotado" }
  if (q <= LIMITE_BAIXO) return { code: "low", label: "Estoque Baixo" }
  return { code: "ok", label: "Em Estoque" }
}

// Percentual visual da barrinha (0–100), saturando em 2x o limiar
export function stockPercent(quantidade) {
  const q = Math.max(0, Number(quantidade))
  return Math.min(100, Math.round((q / (LIMITE_BAIXO * 2)) * 100))
}
```

Substituir por:

```js
// Status de estoque a partir da quantidade e do estoque mínimo do item
export function stockStatus(quantidade, estoqueMinimo = 0) {
  const q = Number(quantidade)
  const min = Number(estoqueMinimo) || 0
  if (q <= 0) return { code: "out", label: "Esgotado" }
  if (q <= min) return { code: "low", label: "Estoque Baixo" }
  return { code: "ok", label: "Em Estoque" }
}

// Percentual visual da barrinha (0–100), saturando em 2x o mínimo
export function stockPercent(quantidade, estoqueMinimo = 0) {
  const q = Math.max(0, Number(quantidade))
  const min = Number(estoqueMinimo) || 0
  const teto = min > 0 ? min * 2 : Math.max(q, 1)
  return Math.min(100, Math.round((q / teto) * 100))
}
```

- [ ] **Step 5: Rodar o teste**

Run (em `frontend/`): `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/format.js frontend/src/lib/format.test.js
git commit -m "test: stockStatus por estoque_minimo + setup vitest"
```

---

### Task 9: Camada de API do front (grupos, periodicidade)

**Files:**
- Modify: `frontend/src/api/units.js`
- Modify: `frontend/src/api/http.js`
- Modify: `frontend/src/api/index.js`
- Modify: `frontend/src/api/mock.js`

- [ ] **Step 1: Adicionar periodicidades** ao final de `frontend/src/api/units.js`

```js
// Espelha Produto.PERIODICIDADE_CHOICES
export const PERIODICIDADES = [
  { value: "SEMANAL", label: "Semanal" },
  { value: "MENSAL", label: "Mensal" },
  { value: "EVENTUAL", label: "Eventual" },
]
```

- [ ] **Step 2: Adicionar clientes HTTP** em `frontend/src/api/http.js` (acrescentar antes do final, após `httpCategorias`)

```js
export const httpGrupos = {
  list: () => req(`/grupos/`),
  create: (data) => req(`/grupos/`, { method: "POST", body: data }),
  remove: (id) => req(`/grupos/${id}/`, { method: "DELETE" }),
}

export const httpBensPermanentes = {
  list: () => req(`/bens-permanentes/`),
  create: (data) => req(`/bens-permanentes/`, { method: "POST", body: data }),
  update: (id, data) => req(`/bens-permanentes/${id}/`, { method: "PATCH", body: data }),
  remove: (id) => req(`/bens-permanentes/${id}/`, { method: "DELETE" }),
}
```

- [ ] **Step 3: Reescrever `frontend/src/api/mock.js`** para suportar grupos e `produto.grupo`

```js
/* ------------------------------------------------------------------
   Mock que ESPELHA o contrato da API REST do Django (DRF).
   Hierarquia: Categoria -> Grupo -> Produto. Persiste em localStorage.
------------------------------------------------------------------ */

const KEY = "easystock:db:v2"
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))

function seed() {
  const hoje = new Date()
  const emDias = (d) => {
    const x = new Date(hoje)
    x.setDate(x.getDate() + d)
    return x.toISOString().slice(0, 10)
  }
  const categorias = [
    { id: 1, name: "Alimentos" },
    { id: 2, name: "Limpeza" },
    { id: 3, name: "Papelaria" },
  ]
  const grupos = [
    { id: 1, nome: "Carboidratos", categoria: 1 },
    { id: 2, nome: "Leguminosas", categoria: 1 },
    { id: 3, nome: "Geral", categoria: 2 },
    { id: 4, nome: "Geral", categoria: 3 },
  ]
  const produtos = [
    { id: 1, nome: "Arroz Branco Tipo 1", numero_nota_fiscal: "NF-00231", grupo: 1, quantidade: 48, unidade: "KG", estoque_minimo: 20, perecivel: true, periodicidade: "MENSAL", validade: emDias(95), preco: "5.40" },
    { id: 2, nome: "Feijão Carioca", numero_nota_fiscal: "NF-00231", grupo: 2, quantidade: 12, unidade: "KG", estoque_minimo: 15, perecivel: true, periodicidade: "MENSAL", validade: emDias(20), preco: "8.20" },
    { id: 3, nome: "Detergente Neutro", numero_nota_fiscal: "NF-00198", grupo: 3, quantidade: 64, unidade: "UN", estoque_minimo: 20, perecivel: false, periodicidade: "EVENTUAL", validade: emDias(310), preco: "2.15" },
    { id: 4, nome: "Resma Papel A4", numero_nota_fiscal: "NF-00210", grupo: 4, quantidade: 25, unidade: "PC", estoque_minimo: 10, perecivel: false, periodicidade: "EVENTUAL", validade: null, preco: "23.00" },
  ]
  return { categorias, grupos, produtos, seqC: 4, seqG: 5, seqP: 5 }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignora */ }
  const s = seed()
  localStorage.setItem(KEY, JSON.stringify(s))
  return s
}

function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db))
}

function expand(p, db) {
  const grupo = db.grupos.find((g) => g.id === Number(p.grupo))
  const cat = grupo ? db.categorias.find((c) => c.id === Number(grupo.categoria)) : null
  return {
    ...p,
    grupo_nome: grupo ? grupo.nome : "—",
    categoria: cat ? cat.id : null,
    categoria_nome: cat ? cat.name : "—",
    criado_por_nome: "voce",
    atualizado_em: new Date().toISOString(),
  }
}

export const mockProdutos = {
  async list(q) {
    await delay()
    const db = load()
    let itens = db.produtos.map((p) => expand(p, db))
    if (q) {
      const t = q.toLowerCase()
      itens = itens.filter((p) => p.nome.toLowerCase().includes(t))
    }
    return itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  },
  async get(id) {
    await delay(120)
    const db = load()
    const p = db.produtos.find((x) => x.id === Number(id))
    if (!p) throw new Error("Produto não encontrado")
    return expand(p, db)
  },
  async create(data) {
    await delay()
    const db = load()
    const novo = { id: db.seqP++, ...normalize(data) }
    db.produtos.push(novo)
    save(db)
    return expand(novo, db)
  },
  async update(id, data) {
    await delay()
    const db = load()
    const i = db.produtos.findIndex((x) => x.id === Number(id))
    if (i === -1) throw new Error("Produto não encontrado")
    db.produtos[i] = { ...db.produtos[i], ...normalize(data) }
    save(db)
    return expand(db.produtos[i], db)
  },
  async remove(id) {
    await delay()
    const db = load()
    db.produtos = db.produtos.filter((x) => x.id !== Number(id))
    save(db)
  },
}

export const mockGrupos = {
  async list() {
    await delay(120)
    const db = load()
    return db.grupos
      .map((g) => ({ ...g, categoria_nome: db.categorias.find((c) => c.id === g.categoria)?.name ?? "—" }))
      .sort((a, b) => (a.categoria_nome + a.nome).localeCompare(b.categoria_nome + b.nome, "pt-BR"))
  },
  async create(data) {
    await delay()
    const db = load()
    const novo = { id: db.seqG++, nome: String(data.nome).trim(), categoria: Number(data.categoria) }
    db.grupos.push(novo)
    save(db)
    return novo
  },
  async remove(id) {
    await delay()
    const db = load()
    db.grupos = db.grupos.filter((g) => g.id !== Number(id))
    save(db)
  },
}

export const mockCategorias = {
  async list() {
    await delay(120)
    const db = load()
    return [...db.categorias].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  },
  async create(data) {
    await delay()
    const db = load()
    const novo = { id: db.seqC++, name: String(data.name).trim() }
    db.categorias.push(novo)
    save(db)
    return novo
  },
  async remove(id) {
    await delay()
    const db = load()
    db.categorias = db.categorias.filter((c) => c.id !== Number(id))
    save(db)
  },
}

function normalize(data) {
  return {
    nome: data.nome,
    numero_nota_fiscal: data.numero_nota_fiscal || null,
    grupo: Number(data.grupo),
    quantidade: Number(data.quantidade),
    unidade: data.unidade,
    estoque_minimo: Number(data.estoque_minimo) || 0,
    perecivel: Boolean(data.perecivel),
    periodicidade: data.periodicidade || "EVENTUAL",
    validade: data.validade || null,
    preco: data.preco === "" || data.preco == null ? null : String(data.preco),
  }
}
```

- [ ] **Step 4: Atualizar `frontend/src/api/index.js`**

```js
import { mockProdutos, mockGrupos, mockCategorias } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes } from "./http"

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const gruposApi = USE_MOCK ? mockGrupos : httpGrupos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
```

- [ ] **Step 5: Verificar build**

Run (em `frontend/`): `npm run build`
Expected: build sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api
git commit -m "feat(front): camada de API de grupos + periodicidade; mock 2 níveis"
```

---

### Task 10: Formulário de item — seletor de Grupo + novos campos

**Files:**
- Modify: `frontend/src/components/ProductFormModal.jsx`

- [ ] **Step 1: Reescrever `frontend/src/components/ProductFormModal.jsx`**

```jsx
import { useEffect, useMemo, useState } from "react"
import { produtosApi } from "../api"
import { UNIDADES, PERIODICIDADES } from "../api/units"
import Modal from "./Modal"
import { useToast } from "./Toast"

const VAZIO = {
  nome: "", numero_nota_fiscal: "", grupo: "",
  quantidade: "", unidade: "UN", estoque_minimo: "",
  perecivel: false, periodicidade: "EVENTUAL", validade: "", preco: "",
}

function Campo({ label, hint, children, full }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 flex items-baseline gap-2 text-sm font-semibold">
        {label}
        {hint && <span className="text-[0.66rem] font-normal text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export default function ProductFormModal({ open, produto, grupos, onClose, onSaved }) {
  const editando = Boolean(produto)
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  // Agrupa os grupos por categoria para o <optgroup>
  const porCategoria = useMemo(() => {
    const m = new Map()
    for (const g of grupos) {
      const k = g.categoria_nome || "Sem categoria"
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(g)
    }
    return [...m.entries()]
  }, [grupos])

  useEffect(() => {
    if (!open) return
    if (produto) {
      setForm({
        nome: produto.nome ?? "",
        numero_nota_fiscal: produto.numero_nota_fiscal ?? "",
        grupo: String(produto.grupo ?? ""),
        quantidade: String(produto.quantidade ?? ""),
        unidade: produto.unidade ?? "UN",
        estoque_minimo: String(produto.estoque_minimo ?? ""),
        perecivel: Boolean(produto.perecivel),
        periodicidade: produto.periodicidade ?? "EVENTUAL",
        validade: produto.validade ?? "",
        preco: produto.preco ?? "",
      })
    } else {
      setForm({ ...VAZIO, grupo: grupos[0] ? String(grupos[0].id) : "" })
    }
    setErros({})
  }, [open, produto, grupos])

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))

  function validar() {
    const e = {}
    if (!form.nome.trim()) e.nome = "Informe o nome"
    if (!form.grupo) e.grupo = "Selecione um grupo"
    if (form.quantidade === "" || Number(form.quantidade) < 0) e.quantidade = "Inválida"
    if (form.estoque_minimo !== "" && Number(form.estoque_minimo) < 0) e.estoque_minimo = "Inválido"
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    if (!validar()) return
    setSalvando(true)
    try {
      if (editando) {
        await produtosApi.update(produto.id, form)
        toast("Item atualizado")
      } else {
        await produtosApi.create(form)
        toast("Item cadastrado")
      }
      onSaved?.()
      onClose()
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? "Editar item" : "Adicionar novo item"}
      subtitle={editando ? produto?.nome : "Cadastre um produto no estoque"}
      maxW="max-w-xl"
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome do item" full>
          <input className="field" value={form.nome} onChange={set("nome")} placeholder="Ex.: Papel Sulfite A4" />
          {erros.nome && <p className="mt-1 text-xs text-out">{erros.nome}</p>}
        </Campo>

        <Campo label="Grupo">
          <select className="field" value={form.grupo} onChange={set("grupo")}>
            <option value="">— selecione —</option>
            {porCategoria.map(([cat, gs]) => (
              <optgroup key={cat} label={cat}>
                {gs.map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {erros.grupo && <p className="mt-1 text-xs text-out">{erros.grupo}</p>}
        </Campo>

        <Campo label="Nota Fiscal" hint="opcional">
          <input className="field" value={form.numero_nota_fiscal} onChange={set("numero_nota_fiscal")} placeholder="NF-00000" />
        </Campo>

        <Campo label="Quantidade">
          <input type="number" step="any" min="0" className="field" value={form.quantidade} onChange={set("quantidade")} placeholder="0" />
          {erros.quantidade && <p className="mt-1 text-xs text-out">{erros.quantidade}</p>}
        </Campo>

        <Campo label="Estoque mínimo" hint="alerta de reposição">
          <input type="number" step="any" min="0" className="field" value={form.estoque_minimo} onChange={set("estoque_minimo")} placeholder="0" />
          {erros.estoque_minimo && <p className="mt-1 text-xs text-out">{erros.estoque_minimo}</p>}
        </Campo>

        <Campo label="Unidade">
          <select className="field" value={form.unidade} onChange={set("unidade")}>
            {UNIDADES.map((u) => (
              <option key={u.value} value={u.value}>{u.value} · {u.label}</option>
            ))}
          </select>
        </Campo>

        <Campo label="Periodicidade">
          <select className="field" value={form.periodicidade} onChange={set("periodicidade")}>
            {PERIODICIDADES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Campo>

        <Campo label="Validade" hint="opcional">
          <input type="date" className="field" value={form.validade} onChange={set("validade")} />
        </Campo>

        <Campo label="Preço unitário" hint="R$ · opcional">
          <input type="number" step="0.01" min="0" className="field" value={form.preco} onChange={set("preco")} placeholder="0,00" />
        </Campo>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={form.perecivel} onChange={set("perecivel")} className="h-4 w-4" />
          <span className="text-sm font-semibold">Item perecível</span>
        </label>

        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar item"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verificar build**

Run (em `frontend/`): `npm run build`
Expected: build sem erros (o `grupos` prop ainda será ligado na Task 12 — o build não quebra).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProductFormModal.jsx
git commit -m "feat(front): formulário com seletor de Grupo e campos estoque/perecível/periodicidade"
```

---

### Task 11: ProductCard e DetailsModal — status por `estoque_minimo` e grupo

**Files:**
- Modify: `frontend/src/components/ProductCard.jsx`
- Modify: `frontend/src/components/DetailsModal.jsx`

- [ ] **Step 1: Atualizar `ProductCard.jsx`** — passar `estoque_minimo` ao status e exibir o grupo.

Trocar as três chamadas no topo da função:

```js
  const stock = stockStatus(produto.quantidade)
  const val = validadeStatus(produto.validade)
  const pct = stockPercent(produto.quantidade)
```

por:

```js
  const stock = stockStatus(produto.quantidade, produto.estoque_minimo)
  const val = validadeStatus(produto.validade)
  const pct = stockPercent(produto.quantidade, produto.estoque_minimo)
```

E na linha que mostra a categoria, trocar:

```jsx
          <div className="truncate text-xs text-ink-faint">{produto.categoria_nome}</div>
```

por (mostra categoria › grupo):

```jsx
          <div className="truncate text-xs text-ink-faint">
            {produto.categoria_nome}
            {produto.grupo_nome ? ` › ${produto.grupo_nome}` : ""}
          </div>
```

- [ ] **Step 2: Atualizar `DetailsModal.jsx`** — status por `estoque_minimo` e mostrar o grupo.

Trocar:

```js
  const stock = stockStatus(produto.quantidade)
```

por:

```js
  const stock = stockStatus(produto.quantidade, produto.estoque_minimo)
```

E no `<Modal ... subtitle={produto.categoria_nome}>`, trocar para incluir o grupo:

```jsx
    <Modal open={!!produto} onClose={onClose} title="Detalhes do item" subtitle={`${produto.categoria_nome} › ${produto.grupo_nome ?? ""}`}>
```

Acrescentar uma linha de detalhe dentro do bloco `.rounded-2xl` (após a linha de "Nota Fiscal"):

```jsx
        <Linha label="Estoque mínimo">{qtd(produto.estoque_minimo)} {unidadeLabel(produto.unidade).toLowerCase()}</Linha>
        <Linha label="Periodicidade">{produto.periodicidade ?? "—"}</Linha>
```

- [ ] **Step 3: Verificar build**

Run (em `frontend/`): `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProductCard.jsx frontend/src/components/DetailsModal.jsx
git commit -m "feat(front): status por estoque_minimo e exibição de grupo nos cards/detalhes"
```

---

### Task 12: CategoryRail 2 níveis + DashboardPage

**Files:**
- Modify: `frontend/src/components/CategoryRail.jsx`
- Modify: `frontend/src/pages/DashboardPage.jsx`

- [ ] **Step 1: Reescrever `frontend/src/components/CategoryRail.jsx`** (categoria expansível mostrando grupos)

```jsx
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { categoryStyle } from "../lib/catalog"
import { Icon } from "../lib/icons.jsx"

export default function CategoryRail({ categorias, grupos, counts, total, active, onPick, onAddCategory }) {
  const [aberta, setAberta] = useState(null)

  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 font-display text-sm font-bold uppercase tracking-wider text-ink-faint">
        Categorias Principais
      </h2>

      <button
        onClick={() => onPick({ tipo: "all" })}
        className={`card-flat flex items-center gap-3 px-3 py-3 text-left transition ${
          active.tipo === "all" ? "ring-2 ring-brand ring-offset-2 ring-offset-canvas" : "hover:bg-surface-2"
        }`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-tint text-brand">{Icon.grid(20)}</span>
        <span className="flex-1 font-semibold">Todos os itens</span>
        <span className="font-mono text-xs text-ink-faint">{total}</span>
      </button>

      {categorias.map((c, i) => {
        const st = categoryStyle(c.name, i)
        const on = active.tipo === "cat" && active.id === c.id
        const gruposDaCat = grupos.filter((g) => g.categoria === c.id)
        const expandida = aberta === c.id
        return (
          <div key={c.id}>
            <div
              className={`card-flat flex items-center gap-3 px-3 py-3 transition ${
                on ? "ring-2 ring-offset-2 ring-offset-canvas" : "hover:bg-surface-2"
              }`}
              style={on ? { "--tw-ring-color": st.fg } : undefined}
            >
              <button onClick={() => onPick({ tipo: "cat", id: c.id })} className="flex flex-1 items-center gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: st.tint, color: st.fg }}>
                  {st.renderIcon(20)}
                </span>
                <span className="flex-1 text-sm font-semibold leading-tight">{c.name}</span>
                <span className="font-mono text-xs text-ink-faint">{counts.cat[c.id] || 0}</span>
              </button>
              {gruposDaCat.length > 0 && (
                <button
                  onClick={() => setAberta(expandida ? null : c.id)}
                  className="grid h-6 w-6 place-items-center rounded-md text-ink-faint hover:bg-surface-2"
                  aria-label="Expandir grupos"
                >
                  <span className={`transition-transform ${expandida ? "rotate-90" : ""}`}>{Icon.chevronR(14)}</span>
                </button>
              )}
            </div>

            <AnimatePresence>
              {expandida && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pl-5"
                >
                  <div className="mt-1 flex flex-col gap-1 border-l-2 border-line pl-2">
                    {gruposDaCat.map((g) => {
                      const gon = active.tipo === "grupo" && active.id === g.id
                      return (
                        <button
                          key={g.id}
                          onClick={() => onPick({ tipo: "grupo", id: g.id })}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                            gon ? "bg-brand-tint font-semibold text-brand" : "hover:bg-surface-2"
                          }`}
                        >
                          <span>{g.nome}</span>
                          <span className="font-mono text-xs text-ink-faint">{counts.grupo[g.id] || 0}</span>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      <button
        onClick={onAddCategory}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-2"
      >
        {Icon.plus(16)} Nova categoria
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `frontend/src/pages/DashboardPage.jsx`** — buscar grupos, ajustar filtros/contagens e props.

No bloco de imports, trocar:

```js
import { produtosApi, categoriasApi } from "../api"
```

por:

```js
import { produtosApi, categoriasApi, gruposApi } from "../api"
```

Trocar o estado de categorias/cat e acrescentar grupos. Localizar:

```js
  const [categorias, setCategorias] = useState([])
```

e logo abaixo acrescentar:

```js
  const [grupos, setGrupos] = useState([])
```

Trocar a inicialização do filtro. Localizar:

```js
  const [cat, setCat] = useState("all")
```

por:

```js
  const [cat, setCat] = useState({ tipo: "all" })
```

Trocar a função `carregar` para também buscar grupos:

```js
  async function carregar() {
    setLoading(true)
    try {
      const [p, c, g] = await Promise.all([
        produtosApi.list(termo), categoriasApi.list(), gruposApi.list(),
      ])
      setProdutos(p)
      setCategorias(c)
      setGrupos(g)
    } finally {
      setLoading(false)
    }
  }
```

Trocar o `counts` (memo) por contagens separadas de categoria e grupo:

```js
  const counts = useMemo(() => {
    const cat = {}, grupo = {}
    for (const p of produtos) {
      if (p.categoria != null) cat[p.categoria] = (cat[p.categoria] || 0) + 1
      grupo[p.grupo] = (grupo[p.grupo] || 0) + 1
    }
    return { cat, grupo }
  }, [produtos])
```

Trocar o `visiveis` (memo) para filtrar por categoria OU grupo:

```js
  const visiveis = useMemo(() => {
    if (cat.tipo === "cat") return produtos.filter((p) => p.categoria === cat.id)
    if (cat.tipo === "grupo") return produtos.filter((p) => p.grupo === cat.id)
    return produtos
  }, [produtos, cat])
```

Atualizar as chamadas de `stockStatus`/`validadeStatus` dentro de `alerts` e `resumo`. Em `alerts`, trocar:

```js
      const s = stockStatus(p.quantidade)
```

por:

```js
      const s = stockStatus(p.quantidade, p.estoque_minimo)
```

Em `resumo`, trocar:

```js
      if (stockStatus(p.quantidade).code !== "ok") baixo++
```

por:

```js
      if (stockStatus(p.quantidade, p.estoque_minimo).code !== "ok") baixo++
```

Atualizar o JSX do `<CategoryRail>` para passar `grupos` e o novo formato de `active`:

```jsx
                  <CategoryRail
                    categorias={categorias}
                    grupos={grupos}
                    counts={counts}
                    total={produtos.length}
                    active={cat}
                    onPick={setCat}
                    onAddCategory={novaCategoria}
                  />
```

Atualizar a `<section>` que mostra a contagem — localizar e trocar:

```jsx
                          {cat !== "all" && " nesta categoria"}
```

por:

```jsx
                          {cat.tipo !== "all" && " no filtro atual"}
```

Atualizar o `<ProductFormModal>` para passar `grupos` em vez de `categorias`:

```jsx
      <ProductFormModal
        open={addOpen || !!editProduto}
        produto={editProduto}
        grupos={grupos}
        onClose={() => { setAddOpen(false); setEditProduto(null) }}
        onSaved={carregar}
      />
```

- [ ] **Step 3: Verificar build**

Run (em `frontend/`): `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Rodar os testes do front**

Run (em `frontend/`): `npx vitest run`
Expected: PASS

- [ ] **Step 5: Verificação manual (servidores no ar)**

1. Backend: `.venv\Scripts\python manage.py runserver`
2. Front: `npm run dev`
3. Conferir: filtro por categoria e por grupo (expandindo), cadastro de item com grupo, status de estoque refletindo `estoque_minimo` (Feijão com qtd 12 e mínimo 15 → "Estoque Baixo").

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/CategoryRail.jsx frontend/src/pages/DashboardPage.jsx
git commit -m "feat(front): filtro de categorias em 2 níveis (categoria/grupo)"
```

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura do spec:**
- Categoria→Grupo→Produto → Tasks 2, 4, 6, 12 ✓
- BemPermanente (modelo+API, sem UI) → Tasks 2, 7 ✓
- estoque_minimo / perecivel / periodicidade → Tasks 2, 8, 10 ✓
- quantidade Decimal → Task 2 ✓
- on_delete=PROTECT → Tasks 2, 4 (teste ProtectedError) ✓
- Data migration reversível → Task 3 ✓
- API aditiva (/grupos/, /bens-permanentes/) → Tasks 5, 7 ✓
- Front: seletor de grupo + campos → Task 10 ✓
- Front: status por estoque_minimo (fim do LIMITE_BAIXO) → Tasks 8, 11, 12 ✓
- Front: rail 2 níveis + card mostra grupo → Tasks 11, 12 ✓
- Tratamento de erros (PROTECT, validação form) → Tasks 4, 10 ✓
- Testes (migração, constraints, serializers, stock) → Tasks 2, 3, 5, 6, 7, 8 ✓

**Sem placeholders:** todo passo de código mostra o código completo.

**Consistência de tipos:** `active` é objeto `{tipo, id}` em CategoryRail (Task 12) e DashboardPage (Task 12); `counts` é `{cat, grupo}` em ambos; `stockStatus(quantidade, estoqueMinimo)` consistente em format.js (8), ProductCard (11), DetailsModal (11), DashboardPage (12); `gruposApi` exportado (9) e usado (12).
