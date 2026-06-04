# Movimentações de Estoque — Implementation Plan (Sub-bloco C1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir um livro-razão de movimentações (entradas como documento + saídas) que passa a ser a fonte do saldo, com API e telas completas no dashboard.

**Architecture:** Modelos `Entrada` (documento) + `Movimentacao` (journal); um serviço transacional (`core/services.py`) cria movimentações e ajusta `Produto.quantidade` atomicamente (saída não pode passar do saldo). `Produto.quantidade` vira read-only na API. Append-only. Frontend: aba Movimentações + modais de entrada/saída + o +/- vira movimentação.

**Tech Stack:** Django 6 + DRF (venv `.venv`, test runner nativo); React + Vite + Tailwind; Vitest.

**Spec:** `docs/superpowers/specs/2026-06-04-movimentacoes-design.md`
**Branch:** `feat/movimentacoes` (criada da `main` com A + B).

**Comandos base (Windows / PowerShell):**
- Backend: `.venv\Scripts\python manage.py test core -v 2` · `makemigrations` · `migrate`
- Frontend (em `frontend/`): `npm run build` · `npx vitest run`

---

## File Structure

**Backend (`core/`):**
- `models.py` — +`Entrada`, +`Movimentacao` (usa `from django.utils import timezone`)
- `services.py` — **novo**: `registrar_movimentacao`, `registrar_entrada`
- `migrations/0008_movimentacoes.py` — schema (gerada)
- `migrations/0009_saldo_inicial.py` — data migration (manual)
- `serializers.py` — +`MovimentacaoSerializer`, +`EntradaItemSerializer`, +`EntradaSerializer`; `ProdutoSerializer.quantidade` read-only
- `api_views.py` — +`MovimentacaoViewSet`, +`EntradaViewSet`
- `api_urls.py` — registra `movimentacoes`, `entradas`
- `tests/test_services.py`, `tests/test_migrations.py`, `tests/test_api.py` — testes

**Frontend (`frontend/src/`):**
- `api/units.js` — +`MOTIVOS_SAIDA`
- `api/http.js` — +`httpMovimentacoes`, +`httpEntradas`
- `api/mock.js` — +journal/entradas, ajusta saldos, KEY `v4`
- `api/index.js` — +`movimentacoesApi`, +`entradasApi`
- `lib/format.js` — (reuso) nada novo obrigatório
- `components/MovimentacoesView.jsx` — **novo** (aba: histórico + filtros + botões)
- `components/SaidaFormModal.jsx` — **novo**
- `components/EntradaFormModal.jsx` — **novo** (linhas dinâmicas + total)
- `components/ProductFormModal.jsx` — quantidade só na criação; remove NF
- `components/DetailsModal.jsx` — "NF (legado)"
- `pages/DashboardPage.jsx` — aba Movimentações, fetch, +/- vira movimentação, modais

---

## Phase A — Backend: modelos, serviço, migração

### Task 1: Modelos `Entrada` + `Movimentacao` + migração 0008

**Files:** Modify `core/models.py`; create `core/migrations/0008_movimentacoes.py`; modify `core/tests/test_models.py`.

- [ ] **Step 1: Escrever os testes (falham)** — acrescentar ao final de `core/tests/test_models.py`:

```python
class MovimentacaoModelTest(TestCase):
    def _produto(self):
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        return Produto.objects.create(nome="Arroz", grupo=grupo, quantidade=10, unidade="KG")

    def test_cria_movimentacao_e_entrada(self):
        from core.models import Entrada, Movimentacao
        p = self._produto()
        e = Entrada.objects.create(numero_nota_fiscal="NF-1")
        m = Movimentacao.objects.create(produto=p, tipo=Movimentacao.ENTRADA, quantidade=5, entrada=e, preco_unitario="2.00")
        self.assertEqual(m.entrada, e)
        self.assertEqual(list(e.itens.all()), [m])
        self.assertEqual(str(m), "ENTRADA 5.000 Arroz")

    def test_entrada_total(self):
        from core.models import Entrada, Movimentacao
        p = self._produto()
        e = Entrada.objects.create()
        Movimentacao.objects.create(produto=p, tipo=Movimentacao.ENTRADA, quantidade=3, entrada=e, preco_unitario="2.00")
        Movimentacao.objects.create(produto=p, tipo=Movimentacao.ENTRADA, quantidade=2, entrada=e, preco_unitario="5.00")
        from decimal import Decimal
        self.assertEqual(e.total, Decimal("16.00"))

    def test_produto_com_movimentacao_protegido(self):
        from django.db.models import ProtectedError
        from core.models import Movimentacao
        p = self._produto()
        Movimentacao.objects.create(produto=p, tipo=Movimentacao.SAIDA, quantidade=1)
        with self.assertRaises(ProtectedError):
            p.delete()
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_models -v 2`
Expected: FAIL (ImportError: cannot import name 'Entrada')

- [ ] **Step 3: Editar `core/models.py`.** No topo, garantir o import do timezone (logo após `from django.contrib.auth.models import User`):

```python
from django.utils import timezone
```

E acrescentar ao final do arquivo:

```python
class Entrada(models.Model):
    fornecedor = models.ForeignKey(
        "Fornecedor", on_delete=models.PROTECT, null=True, blank=True, related_name="entradas"
    )
    numero_nota_fiscal = models.CharField(max_length=20, blank=True)
    data = models.DateField(default=timezone.localdate)
    observacao = models.TextField(blank=True)
    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="entradas_criadas"
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-data", "-id"]
        verbose_name = "Entrada"
        verbose_name_plural = "Entradas"

    def __str__(self):
        return f"Entrada {self.data} - {self.fornecedor or 'sem fornecedor'}"

    @property
    def total(self):
        from decimal import Decimal
        return sum(
            (m.quantidade * m.preco_unitario for m in self.itens.all() if m.preco_unitario),
            Decimal("0"),
        )


class Movimentacao(models.Model):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"
    TIPO_CHOICES = [(ENTRADA, "Entrada"), (SAIDA, "Saída")]

    produto = models.ForeignKey("Produto", on_delete=models.PROTECT, related_name="movimentacoes")
    tipo = models.CharField(max_length=7, choices=TIPO_CHOICES)
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    entrada = models.ForeignKey(
        Entrada, on_delete=models.CASCADE, null=True, blank=True, related_name="itens"
    )
    motivo = models.CharField(max_length=120, blank=True)
    data = models.DateField(default=timezone.localdate)
    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="movimentacoes_criadas"
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-data", "-id"]
        verbose_name = "Movimentação"
        verbose_name_plural = "Movimentações"

    def __str__(self):
        return f"{self.tipo} {self.quantidade} {self.produto.nome}"
```

- [ ] **Step 4: Gerar a migração**

Run: `.venv\Scripts\python manage.py makemigrations core --name movimentacoes`
Expected: cria `core/migrations/0008_movimentacoes.py` (CreateModel Entrada + Movimentacao). Sem prompt interativo. Se prompt, STOP e reporte.

- [ ] **Step 5: Rodar os testes**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (todos + os 3 novos)

- [ ] **Step 6: Commit**

```bash
git add core/models.py core/migrations/0008_movimentacoes.py core/tests/test_models.py
git commit -m "feat: modelos Entrada + Movimentacao (migração 0008)"
```

---

### Task 2: Serviço de saldo (`core/services.py`)

**Files:** Create `core/services.py`; create `core/tests/test_services.py`.

- [ ] **Step 1: Escrever os testes (falham)** — criar `core/tests/test_services.py`:

```python
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.test import TestCase
from core.models import Categoria, Grupo, Produto, Movimentacao
from core.services import registrar_movimentacao, registrar_entrada


class ServicoSaldoTest(TestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG")

    def test_entrada_soma(self):
        registrar_movimentacao(produto=self.p, tipo=Movimentacao.ENTRADA, quantidade=5)
        self.p.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("15.000"))

    def test_saida_subtrai(self):
        registrar_movimentacao(produto=self.p, tipo=Movimentacao.SAIDA, quantidade=4, motivo="consumo")
        self.p.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("6.000"))

    def test_saida_maior_que_saldo_falha_sem_alterar(self):
        with self.assertRaises(ValidationError):
            registrar_movimentacao(produto=self.p, tipo=Movimentacao.SAIDA, quantidade=999)
        self.p.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("10.000"))

    def test_quantidade_zero_falha(self):
        with self.assertRaises(ValidationError):
            registrar_movimentacao(produto=self.p, tipo=Movimentacao.ENTRADA, quantidade=0)

    def test_registrar_entrada_cria_itens_e_soma(self):
        p2 = Produto.objects.create(nome="Feijão", grupo=self.grupo, quantidade=0, unidade="KG")
        entrada = registrar_entrada(
            fornecedor=None, numero_nota_fiscal="NF-9", data=None, observacao="",
            itens=[
                {"produto": self.p, "quantidade": Decimal("2"), "preco_unitario": Decimal("3.00")},
                {"produto": p2, "quantidade": Decimal("7"), "preco_unitario": Decimal("8.00")},
            ],
            user=None,
        )
        self.p.refresh_from_db(); p2.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("12.000"))
        self.assertEqual(p2.quantidade, Decimal("7.000"))
        self.assertEqual(entrada.itens.count(), 2)
        self.assertEqual(entrada.total, Decimal("62.00"))

    def test_registrar_entrada_sem_itens_falha(self):
        with self.assertRaises(ValidationError):
            registrar_entrada(fornecedor=None, numero_nota_fiscal="", data=None, observacao="", itens=[], user=None)
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_services -v 2`
Expected: FAIL (ModuleNotFoundError: core.services)

- [ ] **Step 3: Criar `core/services.py`**:

```python
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Produto, Entrada, Movimentacao


@transaction.atomic
def registrar_movimentacao(*, produto, tipo, quantidade, motivo="", preco_unitario=None,
                           entrada=None, data=None, user=None):
    quantidade = Decimal(str(quantidade))
    if quantidade <= 0:
        raise ValidationError("A quantidade deve ser maior que zero.")

    p = Produto.objects.select_for_update().get(pk=produto.pk)
    if tipo == Movimentacao.SAIDA:
        if quantidade > p.quantidade:
            raise ValidationError(
                f"Saída de {quantidade} excede o saldo atual ({p.quantidade})."
            )
        p.quantidade = p.quantidade - quantidade
    else:
        p.quantidade = p.quantidade + quantidade
    p.save(update_fields=["quantidade", "atualizado_em"])

    return Movimentacao.objects.create(
        produto=p, tipo=tipo, quantidade=quantidade, motivo=motivo,
        preco_unitario=preco_unitario, entrada=entrada,
        data=data or timezone.localdate(), criado_por=user,
    )


@transaction.atomic
def registrar_entrada(*, fornecedor=None, numero_nota_fiscal="", data=None, observacao="",
                      itens, user=None):
    if not itens:
        raise ValidationError("Informe ao menos um item.")
    entrada = Entrada.objects.create(
        fornecedor=fornecedor, numero_nota_fiscal=numero_nota_fiscal,
        data=data or timezone.localdate(), observacao=observacao, criado_por=user,
    )
    for item in itens:
        registrar_movimentacao(
            produto=item["produto"], tipo=Movimentacao.ENTRADA,
            quantidade=item["quantidade"], preco_unitario=item.get("preco_unitario"),
            entrada=entrada, motivo="entrada", data=entrada.data, user=user,
        )
    return entrada
```

- [ ] **Step 4: Rodar os testes**

Run: `.venv\Scripts\python manage.py test core.tests.test_services -v 2`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/services.py core/tests/test_services.py
git commit -m "feat: serviço transacional de saldo (registrar_movimentacao/entrada)"
```

---

### Task 3: Data migration de saldo inicial (0009)

**Files:** Create `core/migrations/0009_saldo_inicial.py`; modify `core/tests/test_migrations.py`.

- [ ] **Step 1: Escrever o teste (falha)** — acrescentar a `core/tests/test_migrations.py`:

```python
class SaldoInicialMigrationTest(TransactionTestCase):
    migrate_from = ("core", "0008_movimentacoes")
    migrate_to = ("core", "0009_saldo_inicial")

    def _migrate(self, target):
        from django.db.migrations.executor import MigrationExecutor
        from django.db import connection
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_saldo_inicial_nao_altera_saldo(self):
        from decimal import Decimal
        apps = self._migrate(self.migrate_from)
        Categoria = apps.get_model("core", "Categoria")
        Grupo = apps.get_model("core", "Grupo")
        Produto = apps.get_model("core", "Produto")
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        Produto.objects.create(nome="Arroz", grupo=grupo, quantidade=Decimal("10"), unidade="KG")

        apps = self._migrate(self.migrate_to)
        Produto = apps.get_model("core", "Produto")
        Movimentacao = apps.get_model("core", "Movimentacao")
        prod = Produto.objects.get(nome="Arroz")
        self.assertEqual(prod.quantidade, Decimal("10.000"))  # saldo não muda
        mov = Movimentacao.objects.get(produto=prod, motivo="saldo inicial")
        self.assertEqual(mov.tipo, "ENTRADA")
        self.assertEqual(mov.quantidade, Decimal("10.000"))

    def tearDown(self):
        self._migrate(("core", "0009_saldo_inicial"))
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_migrations.SaldoInicialMigrationTest -v 2`
Expected: FAIL (NodeNotFoundError: 0009_saldo_inicial)

- [ ] **Step 3: Criar a migração vazia**

Run: `.venv\Scripts\python manage.py makemigrations core --empty --name saldo_inicial`
Expected: cria `core/migrations/0009_saldo_inicial.py`.

- [ ] **Step 4: Implementar** — substituir o conteúdo de `core/migrations/0009_saldo_inicial.py` por:

```python
from django.db import migrations


def criar_saldo_inicial(apps, schema_editor):
    from django.utils import timezone
    Produto = apps.get_model("core", "Produto")
    Movimentacao = apps.get_model("core", "Movimentacao")
    hoje = timezone.localdate()
    movs = [
        Movimentacao(produto=p, tipo="ENTRADA", quantidade=p.quantidade,
                     motivo="saldo inicial", data=hoje)
        for p in Produto.objects.filter(quantidade__gt=0)
    ]
    Movimentacao.objects.bulk_create(movs)


def remover_saldo_inicial(apps, schema_editor):
    Movimentacao = apps.get_model("core", "Movimentacao")
    Movimentacao.objects.filter(motivo="saldo inicial").delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0008_movimentacoes")]
    operations = [migrations.RunPython(criar_saldo_inicial, remover_saldo_inicial)]
```

- [ ] **Step 5: Rodar o teste + suíte**

Run: `.venv\Scripts\python manage.py test core.tests.test_migrations -v 2`
Expected: PASS
Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (todos)

- [ ] **Step 6: Aplicar no banco real**

Run: `.venv\Scripts\python manage.py migrate`
Expected: aplica 0008 e 0009; os produtos com saldo > 0 ganham movimentação "saldo inicial"; saldos inalterados. Sem erros.

- [ ] **Step 7: Commit**

```bash
git add core/migrations/0009_saldo_inicial.py core/tests/test_migrations.py
git commit -m "feat: data migration de saldo inicial (0009)"
```

---

## Phase B — Backend: API

### Task 4: API de Movimentações (append-only + filtros)

**Files:** Modify `core/serializers.py`, `core/api_views.py`, `core/api_urls.py`, `core/tests/test_api.py`.

- [ ] **Step 1: Escrever os testes (falham)** — acrescentar a `core/tests/test_api.py`:

```python
class MovimentacaoApiTest(APITestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG")

    def test_post_saida_atualiza_saldo(self):
        resp = self.client.post("/api/movimentacoes/", {
            "produto": self.p.id, "tipo": "SAIDA", "quantidade": "4", "motivo": "consumo",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["produto_nome"], "Arroz")
        self.p.refresh_from_db()
        from decimal import Decimal
        self.assertEqual(self.p.quantidade, Decimal("6.000"))

    def test_saida_excede_saldo_400(self):
        resp = self.client.post("/api/movimentacoes/", {
            "produto": self.p.id, "tipo": "SAIDA", "quantidade": "999",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_filtro_por_tipo(self):
        self.client.post("/api/movimentacoes/", {"produto": self.p.id, "tipo": "SAIDA", "quantidade": "1"}, format="json")
        self.client.post("/api/movimentacoes/", {"produto": self.p.id, "tipo": "ENTRADA", "quantidade": "1"}, format="json")
        resp = self.client.get("/api/movimentacoes/?tipo=SAIDA")
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["tipo"], "SAIDA")

    def test_append_only(self):
        self.client.post("/api/movimentacoes/", {"produto": self.p.id, "tipo": "ENTRADA", "quantidade": "1"}, format="json")
        mid = self.client.get("/api/movimentacoes/").data[0]["id"]
        self.assertEqual(self.client.delete(f"/api/movimentacoes/{mid}/").status_code, 405)
        self.assertEqual(self.client.patch(f"/api/movimentacoes/{mid}/", {"quantidade": "2"}, format="json").status_code, 405)
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.MovimentacaoApiTest -v 2`
Expected: FAIL (404)

- [ ] **Step 3: Adicionar `MovimentacaoSerializer`** ao final de `core/serializers.py` e atualizar o import do topo.

Import — trocar:
```python
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor
```
por:
```python
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor, Entrada, Movimentacao
```

Acrescentar:
```python
class MovimentacaoSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)

    class Meta:
        model = Movimentacao
        fields = [
            "id", "produto", "produto_nome", "tipo", "quantidade",
            "preco_unitario", "entrada", "motivo", "data", "criado_em",
        ]
        read_only_fields = ["entrada", "criado_em"]
```

- [ ] **Step 4: Adicionar `MovimentacaoViewSet`** em `core/api_views.py`.

Atualizar imports do topo — trocar:
```python
from rest_framework import viewsets, filters
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor
from .serializers import (
    ProdutoSerializer, CategoriaSerializer, GrupoSerializer,
    BemPermanenteSerializer, FornecedorSerializer,
)
```
por:
```python
from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor, Entrada, Movimentacao
from .serializers import (
    ProdutoSerializer, CategoriaSerializer, GrupoSerializer,
    BemPermanenteSerializer, FornecedorSerializer,
    MovimentacaoSerializer, EntradaSerializer,
)
from .services import registrar_movimentacao, registrar_entrada
```

Acrescentar a classe:
```python
class MovimentacaoViewSet(viewsets.ModelViewSet):
    serializer_class = MovimentacaoSerializer
    http_method_names = ["get", "post", "head", "options"]  # append-only

    def get_queryset(self):
        qs = Movimentacao.objects.select_related("produto", "entrada").all()
        params = self.request.query_params
        if params.get("produto"):
            qs = qs.filter(produto_id=params["produto"])
        if params.get("tipo"):
            qs = qs.filter(tipo=params["tipo"])
        if params.get("data_de"):
            qs = qs.filter(data__gte=params["data_de"])
        if params.get("data_ate"):
            qs = qs.filter(data__lte=params["data_ate"])
        return qs

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        user = request.user if request.user.is_authenticated else None
        try:
            mov = registrar_movimentacao(
                produto=d["produto"], tipo=d["tipo"], quantidade=d["quantidade"],
                motivo=d.get("motivo", ""), preco_unitario=d.get("preco_unitario"),
                data=d.get("data"), user=user,
            )
        except DjangoValidationError as e:
            return Response({"detail": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        out = self.get_serializer(mov)
        return Response(out.data, status=status.HTTP_201_CREATED)
```

> Nota: `EntradaSerializer`/`EntradaViewSet` são criados na Task 5. Faça as Tasks 4 e 5 em sequência; o import de `EntradaSerializer` acima já antecipa a Task 5 — se rodar os testes da Task 4 antes de criar o `EntradaSerializer`, haverá ImportError. Portanto **crie o `EntradaSerializer` stub mínimo agora** (Step 5) para destravar a Task 4.

- [ ] **Step 5: Criar o `EntradaSerializer` (versão completa, já usada na Task 5)** ao final de `core/serializers.py`:

```python
class EntradaItemSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)

    class Meta:
        model = Movimentacao
        fields = ["produto", "produto_nome", "quantidade", "preco_unitario"]


class EntradaSerializer(serializers.ModelSerializer):
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True, allow_null=True, default=None)
    itens = EntradaItemSerializer(many=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = Entrada
        fields = [
            "id", "fornecedor", "fornecedor_nome", "numero_nota_fiscal",
            "data", "observacao", "itens", "total", "criado_em",
        ]
        read_only_fields = ["criado_em"]

    def get_total(self, obj):
        return str(obj.total)

    def create(self, validated_data):
        from .services import registrar_entrada
        itens = validated_data.pop("itens")
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        return registrar_entrada(
            fornecedor=validated_data.get("fornecedor"),
            numero_nota_fiscal=validated_data.get("numero_nota_fiscal", ""),
            data=validated_data.get("data"),
            observacao=validated_data.get("observacao", ""),
            itens=itens, user=user,
        )
```

- [ ] **Step 6: Registrar as rotas** em `core/api_urls.py` — substituir o arquivo inteiro por:

```python
from rest_framework.routers import DefaultRouter
from .api_views import (
    ProdutoViewSet, CategoriaViewSet, GrupoViewSet,
    BemPermanenteViewSet, FornecedorViewSet,
    MovimentacaoViewSet, EntradaViewSet,
)

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"grupos", GrupoViewSet, basename="grupo")
router.register(r"bens-permanentes", BemPermanenteViewSet, basename="bempermanente")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedor")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacao")
router.register(r"entradas", EntradaViewSet, basename="entrada")

urlpatterns = router.urls
```

> `EntradaViewSet` é criado na Task 5. Para a Task 4 compilar, crie já o stub mínimo no Step 7 abaixo.

- [ ] **Step 7: Criar o `EntradaViewSet`** em `core/api_views.py` (versão final, usada também na Task 5):

```python
class EntradaViewSet(viewsets.ModelViewSet):
    serializer_class = EntradaSerializer
    http_method_names = ["get", "post", "head", "options"]  # append-only

    def get_queryset(self):
        return Entrada.objects.select_related("fornecedor").prefetch_related("itens__produto").all()

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            entrada = ser.save()
        except DjangoValidationError as e:
            return Response({"detail": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        out = self.get_serializer(entrada)
        return Response(out.data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 8: Rodar os testes de movimentação**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.MovimentacaoApiTest -v 2`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add core/serializers.py core/api_views.py core/api_urls.py core/tests/test_api.py
git commit -m "feat: API de movimentações (append-only, filtros) + base de entradas"
```

---

### Task 5: API de Entradas (itens aninhados) + Produto.quantidade read-only

**Files:** Modify `core/serializers.py`, `core/tests/test_api.py`.

(`EntradaSerializer`/`EntradaViewSet` já foram criados na Task 4 — esta task adiciona os testes e torna `Produto.quantidade` read-only.)

- [ ] **Step 1: Escrever os testes (falham)** — acrescentar a `core/tests/test_api.py`:

```python
class EntradaApiTest(APITestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p1 = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=0, unidade="KG")
        self.p2 = Produto.objects.create(nome="Feijão", grupo=self.grupo, quantidade=0, unidade="KG")

    def test_cria_entrada_com_itens_e_atualiza_saldos(self):
        resp = self.client.post("/api/entradas/", {
            "numero_nota_fiscal": "NF-100",
            "itens": [
                {"produto": self.p1.id, "quantidade": "5", "preco_unitario": "4.00"},
                {"produto": self.p2.id, "quantidade": "3", "preco_unitario": "8.00"},
            ],
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(len(resp.data["itens"]), 2)
        self.assertEqual(resp.data["total"], "44.00")
        self.p1.refresh_from_db(); self.p2.refresh_from_db()
        from decimal import Decimal
        self.assertEqual(self.p1.quantidade, Decimal("5.000"))
        self.assertEqual(self.p2.quantidade, Decimal("3.000"))

    def test_entrada_append_only(self):
        self.client.post("/api/entradas/", {
            "itens": [{"produto": self.p1.id, "quantidade": "1"}],
        }, format="json")
        eid = self.client.get("/api/entradas/").data[0]["id"]
        self.assertEqual(self.client.delete(f"/api/entradas/{eid}/").status_code, 405)


class ProdutoQuantidadeReadOnlyTest(APITestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)

    def test_patch_quantidade_ignorado(self):
        from decimal import Decimal
        p = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG")
        resp = self.client.patch(f"/api/produtos/{p.id}/", {"quantidade": "999"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        p.refresh_from_db()
        self.assertEqual(p.quantidade, Decimal("10.000"))  # inalterado
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.EntradaApiTest core.tests.test_api.ProdutoQuantidadeReadOnlyTest -v 2`
Expected: FAIL (`ProdutoQuantidadeReadOnlyTest` falha — quantidade ainda gravável; `EntradaApiTest` deve passar já, pois a API de entradas foi criada na Task 4)

- [ ] **Step 3: Tornar `Produto.quantidade` read-only** em `core/serializers.py`. No `ProdutoSerializer`, na lista `read_only_fields`, acrescentar `"quantidade"`. Ela passa de:
```python
        read_only_fields = ["criado_por_nome", "criado_em", "atualizado_em"]
```
para:
```python
        read_only_fields = ["quantidade", "criado_por_nome", "criado_em", "atualizado_em"]
```

- [ ] **Step 4: Rodar os testes (completo)**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (todos)

- [ ] **Step 5: Commit**

```bash
git add core/serializers.py core/tests/test_api.py
git commit -m "feat: API de entradas com itens + Produto.quantidade read-only"
```

---

## Phase C — Frontend

### Task 6: Camada de API do front (movimentações + entradas)

**Files:** Modify `frontend/src/api/units.js`, `http.js`, `mock.js`, `index.js`.

- [ ] **Step 1: Adicionar motivos** ao final de `frontend/src/api/units.js`:

```js
export const MOTIVOS_SAIDA = [
  { value: "consumo", label: "Consumo" },
  { value: "perda", label: "Perda" },
  { value: "ajuste", label: "Ajuste" },
  { value: "outro", label: "Outro" },
]
```

- [ ] **Step 2: Adicionar clientes HTTP** em `frontend/src/api/http.js` — acrescentar após `httpFornecedores`:

```js
export const httpMovimentacoes = {
  list: (qs = "") => req(`/movimentacoes/${qs ? `?${qs}` : ""}`),
  create: (data) => req(`/movimentacoes/`, { method: "POST", body: data }),
}

export const httpEntradas = {
  list: () => req(`/entradas/`),
  create: (data) => req(`/entradas/`, { method: "POST", body: data }),
}
```

- [ ] **Step 3: Atualizar o mock** `frontend/src/api/mock.js`:

(a) Trocar `const KEY = "easystock:db:v3"` por `const KEY = "easystock:db:v4"`.

(b) No `return` do `seed()`, acrescentar `movimentacoes`, `entradas` e os contadores. Trocar:
```js
  return { categorias, grupos, fornecedores, produtos, seqC: 4, seqG: 5, seqF: 3, seqP: 5 }
```
por:
```js
  return {
    categorias, grupos, fornecedores, produtos,
    movimentacoes: [], entradas: [],
    seqC: 4, seqG: 5, seqF: 3, seqP: 5, seqM: 1, seqE: 1,
  }
```

(c) Acrescentar `mockMovimentacoes` e `mockEntradas` (após `mockFornecedores`):

```js
function ajustarSaldo(db, produtoId, tipo, quantidade) {
  const p = db.produtos.find((x) => x.id === Number(produtoId))
  if (!p) throw new Error("Produto não encontrado")
  const q = Number(quantidade)
  if (q <= 0) throw new Error("A quantidade deve ser maior que zero.")
  if (tipo === "SAIDA") {
    if (q > Number(p.quantidade)) throw new Error(`Saída de ${q} excede o saldo (${p.quantidade}).`)
    p.quantidade = Number(p.quantidade) - q
  } else {
    p.quantidade = Number(p.quantidade) + q
  }
  return p
}

export const mockMovimentacoes = {
  async list(qs = "") {
    await delay(120)
    const db = load()
    const params = new URLSearchParams(qs)
    let itens = db.movimentacoes.map((m) => ({
      ...m,
      produto_nome: db.produtos.find((p) => p.id === Number(m.produto))?.nome ?? "—",
    }))
    if (params.get("produto")) itens = itens.filter((m) => Number(m.produto) === Number(params.get("produto")))
    if (params.get("tipo")) itens = itens.filter((m) => m.tipo === params.get("tipo"))
    return itens.sort((a, b) => (b.data + String(b.id)).localeCompare(a.data + String(a.id)))
  },
  async create(data) {
    await delay()
    const db = load()
    ajustarSaldo(db, data.produto, data.tipo, data.quantidade)
    const nova = {
      id: db.seqM++, produto: Number(data.produto), tipo: data.tipo,
      quantidade: Number(data.quantidade), preco_unitario: data.preco_unitario ?? null,
      entrada: data.entrada ?? null, motivo: data.motivo || "",
      data: data.data || new Date().toISOString().slice(0, 10),
      criado_em: new Date().toISOString(),
    }
    db.movimentacoes.push(nova)
    save(db)
    return nova
  },
}

export const mockEntradas = {
  async list() {
    await delay(120)
    const db = load()
    return [...db.entradas].sort((a, b) => (b.data + String(b.id)).localeCompare(a.data + String(a.id)))
  },
  async create(data) {
    await delay()
    const db = load()
    const itens = data.itens || []
    if (itens.length === 0) throw new Error("Informe ao menos um item.")
    const hoje = data.data || new Date().toISOString().slice(0, 10)
    const entradaId = db.seqE++
    let total = 0
    const itensOut = []
    for (const it of itens) {
      ajustarSaldo(db, it.produto, "ENTRADA", it.quantidade)
      const preco = it.preco_unitario != null && it.preco_unitario !== "" ? Number(it.preco_unitario) : null
      if (preco != null) total += preco * Number(it.quantidade)
      db.movimentacoes.push({
        id: db.seqM++, produto: Number(it.produto), tipo: "ENTRADA",
        quantidade: Number(it.quantidade), preco_unitario: preco, entrada: entradaId,
        motivo: "entrada", data: hoje, criado_em: new Date().toISOString(),
      })
      itensOut.push({
        produto: Number(it.produto),
        produto_nome: db.produtos.find((p) => p.id === Number(it.produto))?.nome ?? "—",
        quantidade: Number(it.quantidade), preco_unitario: preco,
      })
    }
    const forn = data.fornecedor ? db.fornecedores.find((f) => f.id === Number(data.fornecedor)) : null
    const entrada = {
      id: entradaId, fornecedor: data.fornecedor ? Number(data.fornecedor) : null,
      fornecedor_nome: forn ? forn.nome : null, numero_nota_fiscal: data.numero_nota_fiscal || "",
      data: hoje, observacao: data.observacao || "", itens: itensOut,
      total: total.toFixed(2), criado_em: new Date().toISOString(),
    }
    db.entradas.push(entrada)
    save(db)
    return entrada
  },
}
```

- [ ] **Step 4: Atualizar `frontend/src/api/index.js`** para EXATAMENTE:

```js
import { mockProdutos, mockGrupos, mockCategorias, mockFornecedores, mockMovimentacoes, mockEntradas } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes, httpFornecedores, httpMovimentacoes, httpEntradas } from "./http"

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const gruposApi = USE_MOCK ? mockGrupos : httpGrupos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const fornecedoresApi = USE_MOCK ? mockFornecedores : httpFornecedores
export const movimentacoesApi = USE_MOCK ? mockMovimentacoes : httpMovimentacoes
export const entradasApi = USE_MOCK ? mockEntradas : httpEntradas
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
```

- [ ] **Step 5: Verificar build + vitest**

Run (em `frontend/`): `npm run build` → Expected: sem erros.
Run (em `frontend/`): `npx vitest run` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api
git commit -m "feat(front): camada de API de movimentações e entradas; mock com journal"
```

---

### Task 7: `SaidaFormModal` + card +/- vira movimentação

**Files:** Create `frontend/src/components/SaidaFormModal.jsx`; modify `frontend/src/pages/DashboardPage.jsx`.

- [ ] **Step 1: Criar `frontend/src/components/SaidaFormModal.jsx`**:

```jsx
import { useEffect, useMemo, useState } from "react"
import { movimentacoesApi } from "../api"
import { MOTIVOS_SAIDA } from "../api/units"
import Modal from "./Modal"
import { useToast } from "./Toast"

export default function SaidaFormModal({ open, produtos, onClose, onSaved }) {
  const [form, setForm] = useState({ produto: "", quantidade: "", motivo: "consumo" })
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) { setForm({ produto: "", quantidade: "", motivo: "consumo" }); setErro("") }
  }, [open])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const saldo = useMemo(() => {
    const p = produtos.find((x) => String(x.id) === String(form.produto))
    return p ? Number(p.quantidade) : null
  }, [produtos, form.produto])

  async function submit(ev) {
    ev.preventDefault()
    if (!form.produto) return setErro("Selecione o produto")
    const q = Number(form.quantidade)
    if (!q || q <= 0) return setErro("Quantidade inválida")
    if (saldo != null && q > saldo) return setErro(`Saída excede o saldo (${saldo})`)
    setSalvando(true)
    try {
      await movimentacoesApi.create({ produto: Number(form.produto), tipo: "SAIDA", quantidade: q, motivo: form.motivo })
      toast("Saída registrada")
      onSaved?.()
      onClose()
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar saída" subtitle="Consumo, perda ou ajuste" maxW="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Produto</span>
          <select className="field" value={form.produto} onChange={set("produto")}>
            <option value="">— selecione —</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome} (saldo {p.quantidade} {p.unidade})</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Quantidade</span>
          <input type="number" step="any" min="0" className="field" value={form.quantidade} onChange={set("quantidade")} placeholder="0" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Motivo</span>
          <select className="field" value={form.motivo} onChange={set("motivo")}>
            {MOTIVOS_SAIDA.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
        </label>
        {erro && <p className="text-xs text-out">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Registrando…" : "Registrar saída"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Alterar o `ajustar` no `DashboardPage.jsx`** para criar movimentação. Substituir a função `ajustar` inteira por:

```js
  async function ajustar(produto, delta) {
    setBusyId(produto.id)
    try {
      await movimentacoesApi.create({
        produto: produto.id,
        tipo: delta > 0 ? "ENTRADA" : "SAIDA",
        quantidade: Math.abs(delta),
        motivo: "ajuste rápido",
      })
      await carregar()
    } catch (e) {
      toast(String(e.message || "Falha ao ajustar"), "danger")
    } finally {
      setBusyId(null)
    }
  }
```

E no import de `../api` do `DashboardPage.jsx`, acrescentar `movimentacoesApi` e `entradasApi`:
```js
import { produtosApi, categoriasApi, gruposApi, fornecedoresApi, movimentacoesApi, entradasApi } from "../api"
```

- [ ] **Step 3: Verificar build + vitest**

Run (em `frontend/`): `npm run build` → Expected: sem erros (SaidaFormModal será montado na Task 8; o ajustar já usa movimentacoesApi).
Run (em `frontend/`): `npx vitest run` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SaidaFormModal.jsx frontend/src/pages/DashboardPage.jsx
git commit -m "feat(front): SaidaFormModal + card +/- vira movimentação"
```

---

### Task 8: `MovimentacoesView` (aba) + wiring

**Files:** Create `frontend/src/components/MovimentacoesView.jsx`; modify `frontend/src/pages/DashboardPage.jsx`.

- [ ] **Step 1: Criar `frontend/src/components/MovimentacoesView.jsx`**:

```jsx
import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { Icon } from "../lib/icons.jsx"
import { dataBR } from "../lib/format"

export default function MovimentacoesView({ movimentacoes, onNovaEntrada, onNovaSaida }) {
  const [tipo, setTipo] = useState("todos")

  const lista = useMemo(() => {
    if (tipo === "todos") return movimentacoes
    return movimentacoes.filter((m) => m.tipo === tipo)
  }, [movimentacoes, tipo])

  const CHIPS = [
    { key: "todos", label: "Todas" },
    { key: "ENTRADA", label: "Entradas" },
    { key: "SAIDA", label: "Saídas" },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Movimentações</h2>
          <p className="mt-1 text-sm text-ink-faint">{lista.length} registro(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onNovaSaida} className="btn btn-ghost">{Icon.minus(16)} Registrar saída</button>
          <button onClick={onNovaEntrada} className="btn btn-brand">{Icon.plus(16)} Nova entrada</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => setTipo(c.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              tipo === c.key ? "border-brand bg-brand text-[#f4f1e7]" : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="card mt-5 overflow-hidden">
        {lista.length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <span className="mb-2 text-ink-faint">{Icon.refresh(40)}</span>
            <p className="font-display text-lg font-bold">Nenhuma movimentação</p>
            <p className="text-sm text-ink-faint">Registre uma entrada ou saída.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Qtd.</th>
                <th className="px-4 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m, i) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.2) }}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{dataBR(m.data)}</td>
                  <td className="px-4 py-2.5 font-medium">{m.produto_nome}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[0.66rem] font-bold uppercase ${
                      m.tipo === "ENTRADA" ? "bg-ok-tint text-ok" : "bg-low-tint text-low"
                    }`}>
                      {m.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{m.quantidade}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{m.motivo || "—"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Ligar no `DashboardPage.jsx`.** Aplicar:

(a) Imports (após `import FornecedorFormModal ...`):
```js
import MovimentacoesView from "../components/MovimentacoesView"
import SaidaFormModal from "../components/SaidaFormModal"
import EntradaFormModal from "../components/EntradaFormModal"
```

(b) Estado — após `const [fornecedores, setFornecedores] = useState([])`:
```js
  const [movimentacoes, setMovimentacoes] = useState([])
  const [saidaOpen, setSaidaOpen] = useState(false)
  const [entradaOpen, setEntradaOpen] = useState(false)
```

(c) Atualizar `carregar` para buscar movimentações. Trocar a linha do `Promise.all`:
```js
      const [p, c, g, f] = await Promise.all([
        produtosApi.list(termo), categoriasApi.list(), gruposApi.list(), fornecedoresApi.list(),
      ])
```
por:
```js
      const [p, c, g, f, mv] = await Promise.all([
        produtosApi.list(termo), categoriasApi.list(), gruposApi.list(),
        fornecedoresApi.list(), movimentacoesApi.list(),
      ])
```
e adicionar `setMovimentacoes(mv)` junto aos outros setters:
```js
      setProdutos(p)
      setCategorias(c)
      setGrupos(g)
      setFornecedores(f)
      setMovimentacoes(mv)
```

(d) Substituir o bloco placeholder da aba "mov". Trocar:
```jsx
              {tab === "mov" && (
                <EmptyTab
                  icon={Icon.refresh(40)}
                  titulo="Movimentações"
                  texto="O histórico de entradas e saídas aparecerá aqui. Cada Adicionar/Retirar já é registrado via API."
                />
              )}
```
por:
```jsx
              {tab === "mov" && (
                <MovimentacoesView
                  movimentacoes={movimentacoes}
                  onNovaEntrada={() => setEntradaOpen(true)}
                  onNovaSaida={() => setSaidaOpen(true)}
                />
              )}
```

(e) Montar os modais — logo após o `<FornecedorFormModal ... />`:
```jsx
      <SaidaFormModal
        open={saidaOpen}
        produtos={produtos}
        onClose={() => setSaidaOpen(false)}
        onSaved={carregar}
      />
      <EntradaFormModal
        open={entradaOpen}
        produtos={produtos}
        fornecedores={fornecedores.filter((f) => f.ativo)}
        onClose={() => setEntradaOpen(false)}
        onSaved={carregar}
      />
```

> `EntradaFormModal` é criado na Task 9 — faça as Tasks 8 e 9 em sequência. Se rodar o build entre elas, crie antes um stub mínimo (Task 9 Step 1) para o import resolver.

- [ ] **Step 3: Verificar build + vitest** (após criar o EntradaFormModal na Task 9, ou com stub)

Run (em `frontend/`): `npm run build`
Expected: sem erros (com o EntradaFormModal da Task 9 presente).

- [ ] **Step 4: Commit** (junto com a Task 9, ou isolado se usar stub)

```bash
git add frontend/src/components/MovimentacoesView.jsx frontend/src/pages/DashboardPage.jsx
git commit -m "feat(front): aba Movimentações (histórico + filtros) + wiring"
```

---

### Task 9: `EntradaFormModal` (linhas dinâmicas + total)

**Files:** Create `frontend/src/components/EntradaFormModal.jsx`.

- [ ] **Step 1: Criar `frontend/src/components/EntradaFormModal.jsx`**:

```jsx
import { useEffect, useMemo, useState } from "react"
import { entradasApi } from "../api"
import { brl } from "../lib/format"
import { Icon } from "../lib/icons.jsx"
import Modal from "./Modal"
import { useToast } from "./Toast"

const linhaVazia = () => ({ produto: "", quantidade: "", preco_unitario: "" })

export default function EntradaFormModal({ open, produtos, fornecedores, onClose, onSaved }) {
  const [cab, setCab] = useState({ fornecedor: "", numero_nota_fiscal: "", data: "", observacao: "" })
  const [linhas, setLinhas] = useState([linhaVazia()])
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setCab({ fornecedor: "", numero_nota_fiscal: "", data: new Date().toISOString().slice(0, 10), observacao: "" })
      setLinhas([linhaVazia()])
      setErro("")
    }
  }, [open])

  const setC = (k) => (e) => setCab((c) => ({ ...c, [k]: e.target.value }))
  const setL = (i, k) => (e) =>
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: e.target.value } : l)))
  const addLinha = () => setLinhas((ls) => [...ls, linhaVazia()])
  const rmLinha = (i) => setLinhas((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))

  const total = useMemo(
    () => linhas.reduce((s, l) => s + (Number(l.quantidade) || 0) * (Number(l.preco_unitario) || 0), 0),
    [linhas]
  )

  async function submit(ev) {
    ev.preventDefault()
    const itens = linhas
      .filter((l) => l.produto && Number(l.quantidade) > 0)
      .map((l) => ({
        produto: Number(l.produto),
        quantidade: Number(l.quantidade),
        preco_unitario: l.preco_unitario === "" ? null : Number(l.preco_unitario),
      }))
    if (itens.length === 0) return setErro("Adicione ao menos um item com produto e quantidade.")
    setSalvando(true)
    try {
      await entradasApi.create({
        fornecedor: cab.fornecedor ? Number(cab.fornecedor) : null,
        numero_nota_fiscal: cab.numero_nota_fiscal,
        data: cab.data || null,
        observacao: cab.observacao,
        itens,
      })
      toast("Entrada registrada")
      onSaved?.()
      onClose()
    } catch (err) {
      toast(String(err.message || err), "danger")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova entrada" subtitle="Recebimento de itens" maxW="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Fornecedor</span>
            <select className="field" value={cab.fornecedor} onChange={setC("fornecedor")}>
              <option value="">— sem fornecedor —</option>
              {fornecedores.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nota Fiscal</span>
            <input className="field" value={cab.numero_nota_fiscal} onChange={setC("numero_nota_fiscal")} placeholder="NF-00000" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Data</span>
            <input type="date" className="field" value={cab.data} onChange={setC("data")} />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-semibold">Itens</span>
          {linhas.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_90px_auto] items-center gap-2">
              <select className="field" value={l.produto} onChange={setL(i, "produto")}>
                <option value="">— produto —</option>
                {produtos.map((p) => (<option key={p.id} value={p.id}>{p.nome}</option>))}
              </select>
              <input type="number" step="any" min="0" className="field" value={l.quantidade} onChange={setL(i, "quantidade")} placeholder="Qtd" />
              <input type="number" step="0.01" min="0" className="field" value={l.preco_unitario} onChange={setL(i, "preco_unitario")} placeholder="R$" />
              <button type="button" onClick={() => rmLinha(i)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-surface-2" title="Remover">
                {Icon.trash(15)}
              </button>
            </div>
          ))}
          <button type="button" onClick={addLinha} className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-surface-2">
            {Icon.plus(15)} Adicionar item
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-ink-soft">Total</span>
          <span className="font-display text-xl font-bold">{brl(total)}</span>
        </div>

        {erro && <p className="text-xs text-out">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Salvando…" : "Registrar entrada"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verificar build + vitest**

Run (em `frontend/`): `npm run build` → Expected: sem erros.
Run (em `frontend/`): `npx vitest run` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EntradaFormModal.jsx
git commit -m "feat(front): EntradaFormModal (linhas dinâmicas + total)"
```

---

### Task 10: Formulário de produto (quantidade inicial) + detalhes (NF legado)

**Files:** Modify `frontend/src/components/ProductFormModal.jsx`, `DetailsModal.jsx`.

- [ ] **Step 1: `ProductFormModal.jsx` — quantidade só na criação + saldo inicial + remover NF.**

(a) No import, acrescentar `movimentacoesApi`:
```js
import { produtosApi, movimentacoesApi } from "../api"
```

(b) Remover o campo de Nota Fiscal do formulário — apagar este bloco inteiro:
```jsx
        <Campo label="Nota Fiscal" hint="opcional">
          <input className="field" value={form.numero_nota_fiscal} onChange={set("numero_nota_fiscal")} placeholder="NF-00000" />
        </Campo>
```

(c) Tornar a "Quantidade" condicional à criação. Localizar o bloco:
```jsx
        <Campo label="Quantidade">
          <input type="number" step="any" min="0" className="field" value={form.quantidade} onChange={set("quantidade")} placeholder="0" />
          {erros.quantidade && <p className="mt-1 text-xs text-out">{erros.quantidade}</p>}
        </Campo>
```
e trocá-lo por:
```jsx
        {!editando && (
          <Campo label="Quantidade inicial">
            <input type="number" step="any" min="0" className="field" value={form.quantidade} onChange={set("quantidade")} placeholder="0" />
            {erros.quantidade && <p className="mt-1 text-xs text-out">{erros.quantidade}</p>}
          </Campo>
        )}
        {editando && (
          <Campo label="Saldo atual">
            <input className="field bg-surface-2" value={`${produto.quantidade} ${produto.unidade}`} readOnly />
            <p className="mt-1 text-[0.66rem] text-ink-faint">Ajuste o estoque pela aba Movimentações.</p>
          </Campo>
        )}
```

(d) No `submit`, ao criar, lançar a movimentação de saldo inicial. Trocar o bloco:
```js
      const payload = { ...form, fornecedor: form.fornecedor || null }
      if (editando) {
        await produtosApi.update(produto.id, payload)
        toast("Item atualizado")
      } else {
        await produtosApi.create(payload)
        toast("Item cadastrado")
      }
```
por:
```js
      const payload = { ...form, fornecedor: form.fornecedor || null }
      if (editando) {
        await produtosApi.update(produto.id, payload)
        toast("Item atualizado")
      } else {
        const novo = await produtosApi.create(payload)
        if (Number(form.quantidade) > 0) {
          await movimentacoesApi.create({
            produto: novo.id, tipo: "ENTRADA",
            quantidade: Number(form.quantidade), motivo: "saldo inicial",
          })
        }
        toast("Item cadastrado")
      }
```

> Observação: como `quantidade` agora é read-only na API, o `produtosApi.create(payload)` grava o produto com saldo 0; o saldo inicial vem da movimentação acima. No mock, `normalize` ignora a quantidade no create do produto (o saldo é movido pela movimentação) — garanta no Step seguinte.

(e) Ajustar o mock para não setar a quantidade direto no create de produto. Em `frontend/src/api/mock.js`, na função `normalize`, a linha `quantidade: Number(data.quantidade),` deve virar `quantidade: 0,` **apenas no fluxo de create**. Como `normalize` é usada em create e update, troque a abordagem: em `mockProdutos.create`, após `const novo = { id: db.seqP++, ...normalize(data) }`, force `novo.quantidade = 0`. Localize em `mock.js`:
```js
  async create(data) {
    await delay()
    const db = load()
    const novo = { id: db.seqP++, ...normalize(data) }
    db.produtos.push(novo)
    save(db)
    return expand(novo, db)
  },
```
e troque para:
```js
  async create(data) {
    await delay()
    const db = load()
    const novo = { id: db.seqP++, ...normalize(data), quantidade: 0 }
    db.produtos.push(novo)
    save(db)
    return expand(novo, db)
  },
```
E em `mockProdutos.update`, para refletir o read-only do saldo, não deixe a quantidade ser sobrescrita: troque
```js
    db.produtos[i] = { ...db.produtos[i], ...normalize(data) }
```
por
```js
    const { quantidade, ...semSaldo } = normalize(data)
    db.produtos[i] = { ...db.produtos[i], ...semSaldo }
```

- [ ] **Step 2: `DetailsModal.jsx` — "NF (legado)".** Localizar a linha:
```jsx
        <Linha label="Nota Fiscal">{produto.numero_nota_fiscal || "—"}</Linha>
```
e trocá-la por:
```jsx
        {produto.numero_nota_fiscal && (
          <Linha label="NF (legado)">{produto.numero_nota_fiscal}</Linha>
        )}
```

- [ ] **Step 3: Verificar build + vitest**

Run (em `frontend/`): `npm run build` → Expected: sem erros.
Run (em `frontend/`): `npx vitest run` → Expected: PASS.

- [ ] **Step 4: Verificação manual (servidores no ar)**

1. Backend: `.venv\Scripts\python manage.py runserver`
2. Front: `npm run dev`
3. Conferir: aba Movimentações lista o saldo inicial; "Nova entrada" com 2 itens soma o total e aumenta os saldos; "Registrar saída" abate o saldo e barra saída > saldo; o +/- do card cria movimentação; criar produto com quantidade inicial gera a movimentação; detalhes mostram "NF (legado)" quando houver.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProductFormModal.jsx frontend/src/components/DetailsModal.jsx frontend/src/api/mock.js
git commit -m "feat(front): quantidade inicial via movimentação + NF legada nos detalhes"
```

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura do spec:**
- Modelos Entrada + Movimentacao (PROTECT produto, CASCADE entrada, total) → Task 1 ✓
- Serviço transacional (entrada soma, saída subtrai, saída>saldo erro, registrar_entrada) → Task 2 ✓
- Migração 0008 + saldo inicial 0009 (sem alterar saldo, reversível) → Tasks 1, 3 ✓
- API movimentações append-only + filtros → Task 4 ✓
- API entradas itens aninhados + total → Tasks 4, 5 ✓
- Produto.quantidade read-only → Task 5 ✓
- Front: camada movimentacoesApi/entradasApi + mock journal v4 → Task 6 ✓
- Front: aba Movimentações (histórico + filtros) → Task 8 ✓
- Front: EntradaFormModal (linhas + total) → Task 9 ✓
- Front: SaidaFormModal + card +/- vira movimentação → Task 7 ✓
- Front: quantidade inicial só na criação + NF removida + NF legado nos detalhes → Task 10 ✓
- Erros (saída>saldo, qtd<=0, entrada sem itens, produto protegido) → Tasks 2, 4, 5 (back) + 7, 9 (front) ✓

**Sem placeholders:** todo passo mostra código completo. As dependências cruzadas (Task 4 usa EntradaSerializer/ViewSet; Task 8 usa EntradaFormModal) estão sinalizadas para execução em sequência, com o código completo fornecido na própria task que o cria.

**Consistência de tipos:** `tipo` usa strings "ENTRADA"/"SAIDA" no back (constantes Movimentacao.ENTRADA/SAIDA) e no front (mock/API); `movimentacoesApi.create({produto,tipo,quantidade,motivo})` consistente entre Task 6 (def), Task 7 (ajustar + saída), Task 10 (saldo inicial); `entradasApi.create({fornecedor,numero_nota_fiscal,data,observacao,itens:[{produto,quantidade,preco_unitario}]})` consistente entre Task 6 (mock), Task 9 (uso) e a API (Task 5); `produto_nome`/`fornecedor_nome` read-only em ambos os lados.
