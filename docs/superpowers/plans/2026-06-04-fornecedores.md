# Controle de Fornecedores — Implementation Plan (Sub-projeto B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cadastro de Fornecedores (flags NF/fiado/ativo) e vínculo opcional `Produto.fornecedor`, com API REST e tela de gestão no dashboard.

**Architecture:** Um modelo `Fornecedor` + FK opcional em `Produto` (PROTECT), migração única de schema (sem data migration). API DRF aditiva. Frontend: nova aba "Fornecedores" reusando os primitivos existentes (Tabs/Modal/ConfirmDialog/Toast), seletor no formulário de produto, linha nos detalhes.

**Tech Stack:** Django 6 + DRF (venv `.venv`, test runner nativo); React + Vite + Tailwind; Vitest.

**Spec:** `docs/superpowers/specs/2026-06-04-fornecedores-design.md`
**Branch:** `feat/fornecedores` (já criada a partir da `main` com o A mergeado).

**Comandos base (Windows / PowerShell):**
- Backend: `.venv\Scripts\python manage.py test core -v 2` · `makemigrations` · `migrate`
- Frontend (em `frontend/`): `npm run build` · `npx vitest run`

---

## File Structure

**Backend (`core/`):**
- `models.py` — +`Fornecedor`, +`Produto.fornecedor`
- `migrations/0007_fornecedor.py` — schema (gerada)
- `serializers.py` — +`FornecedorSerializer`, atualiza `ProdutoSerializer`
- `api_views.py` — +`FornecedorViewSet`, atualiza `ProdutoViewSet`
- `api_urls.py` — registra `fornecedores`
- `tests/test_models.py`, `tests/test_api.py` — novos testes

**Frontend (`frontend/src/`):**
- `api/http.js` — +`httpFornecedores`
- `api/mock.js` — +fornecedores (seed/mock), `produto.fornecedor`
- `api/index.js` — +`fornecedoresApi`
- `components/FornecedorFormModal.jsx` — novo (criar/editar fornecedor)
- `components/FornecedoresView.jsx` — novo (aba: lista + chips + ações)
- `components/ProductFormModal.jsx` — +seletor de fornecedor
- `components/DetailsModal.jsx` — +linha "Fornecedor"
- `pages/DashboardPage.jsx` — +aba, +fetch fornecedores, +modal

---

## Phase A — Backend

### Task 1: Modelo `Fornecedor` + `Produto.fornecedor` + migração 0007

**Files:**
- Modify: `core/models.py`
- Create: `core/migrations/0007_fornecedor.py` (gerada)
- Modify: `core/tests/test_models.py`

- [ ] **Step 1: Escrever os testes que falham** — acrescentar ao final de `core/tests/test_models.py`:

```python
class FornecedorModelTest(TestCase):
    def test_defaults(self):
        from core.models import Fornecedor
        f = Fornecedor.objects.create(nome="Atacadão Escolar")
        self.assertTrue(f.emite_nota_fiscal)
        self.assertFalse(f.aceita_fiado)
        self.assertTrue(f.ativo)
        self.assertEqual(str(f), "Atacadão Escolar")

    def test_produto_com_e_sem_fornecedor(self):
        from core.models import Fornecedor
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        p1 = Produto.objects.create(nome="Sem forn", grupo=grupo, quantidade=1, unidade="UN")
        self.assertIsNone(p1.fornecedor)
        f = Fornecedor.objects.create(nome="Fornecedor X")
        p2 = Produto.objects.create(nome="Com forn", grupo=grupo, quantidade=1, unidade="UN", fornecedor=f)
        self.assertEqual(p2.fornecedor, f)

    def test_fornecedor_em_uso_protegido(self):
        from django.db.models import ProtectedError
        from core.models import Fornecedor
        cat = Categoria.objects.create(name="Limpeza")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        f = Fornecedor.objects.create(nome="Protegido")
        Produto.objects.create(nome="Item", grupo=grupo, quantidade=1, unidade="UN", fornecedor=f)
        with self.assertRaises(ProtectedError):
            f.delete()
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_models -v 2`
Expected: FAIL (ImportError: cannot import name 'Fornecedor')

- [ ] **Step 3: Adicionar o modelo `Fornecedor`** ao final de `core/models.py` (depois de `BemPermanente`):

```python
class Fornecedor(models.Model):
    nome = models.CharField(max_length=200)
    documento = models.CharField("CNPJ/CPF", max_length=20, blank=True)
    endereco = models.CharField(max_length=200, blank=True)
    telefone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    emite_nota_fiscal = models.BooleanField("Emite nota fiscal", default=True)
    aceita_fiado = models.BooleanField("Aceita fiado", default=False)
    ativo = models.BooleanField(default=True)
    observacao = models.TextField(blank=True)

    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="fornecedores_criados"
    )
    atualizado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="fornecedores_atualizados"
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "Fornecedor"
        verbose_name_plural = "Fornecedores"

    def __str__(self):
        return self.nome
```

- [ ] **Step 4: Adicionar o campo `fornecedor` ao `Produto`.** Em `core/models.py`, no modelo `Produto`, logo após o campo `grupo` (a linha `grupo = models.ForeignKey("Grupo", ...)`), acrescentar:

```python
    fornecedor = models.ForeignKey(
        "Fornecedor", on_delete=models.PROTECT, null=True, blank=True, related_name="produtos"
    )
```

- [ ] **Step 5: Gerar a migração com nome fixo**

Run: `.venv\Scripts\python manage.py makemigrations core --name fornecedor`
Expected: cria `core/migrations/0007_fornecedor.py` (CreateModel Fornecedor + AddField produto.fornecedor). Sem prompt interativo (fornecedor é nullable). Se houver prompt, STOP e reporte.

- [ ] **Step 6: Rodar os testes**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (todos, incluindo os 3 novos de Fornecedor)

- [ ] **Step 7: Aplicar a migração no banco real**

Run: `.venv\Scripts\python manage.py migrate`
Expected: aplica `0007_fornecedor`. Os 8 produtos existentes ficam com `fornecedor = NULL`. Sem erros.

- [ ] **Step 8: Commit**

```bash
git add core/models.py core/migrations/0007_fornecedor.py core/tests/test_models.py
git commit -m "feat: modelo Fornecedor + Produto.fornecedor (migração 0007)"
```

---

### Task 2: API de Fornecedores (serializer + viewset + rota)

**Files:**
- Modify: `core/serializers.py`
- Modify: `core/api_views.py`
- Modify: `core/api_urls.py`
- Modify: `core/tests/test_api.py`

- [ ] **Step 1: Escrever os testes (falham)** — acrescentar ao final de `core/tests/test_api.py`:

```python
class FornecedorApiTest(APITestCase):
    def test_crud_e_filtro(self):
        resp = self.client.post("/api/fornecedores/", {
            "nome": "Atacadão", "documento": "12.345.678/0001-99",
            "emite_nota_fiscal": True, "aceita_fiado": False,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertTrue(resp.data["ativo"])

        # cria um fiado/inativo
        self.client.post("/api/fornecedores/", {
            "nome": "Seu Zé (fiado)", "emite_nota_fiscal": False,
            "aceita_fiado": True, "ativo": False,
        }, format="json")

        # lista todos
        resp = self.client.get("/api/fornecedores/")
        self.assertEqual(len(resp.data), 2)

        # filtro aceita_fiado=true
        resp = self.client.get("/api/fornecedores/?aceita_fiado=true")
        nomes = [f["nome"] for f in resp.data]
        self.assertEqual(nomes, ["Seu Zé (fiado)"])

        # filtro ativo=false
        resp = self.client.get("/api/fornecedores/?ativo=false")
        self.assertEqual(len(resp.data), 1)

    def test_busca_por_nome(self):
        self.client.post("/api/fornecedores/", {"nome": "Papelaria Central"}, format="json")
        self.client.post("/api/fornecedores/", {"nome": "Distribuidora Sul"}, format="json")
        resp = self.client.get("/api/fornecedores/?search=papel")
        self.assertEqual([f["nome"] for f in resp.data], ["Papelaria Central"])
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.FornecedorApiTest -v 2`
Expected: FAIL (404)

- [ ] **Step 3: Adicionar `FornecedorSerializer`** ao final de `core/serializers.py` e atualizar o import do topo.

Import no topo — trocar:
```python
from .models import Produto, Categoria, Grupo, BemPermanente
```
por:
```python
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor
```

Acrescentar a classe:
```python
class FornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = [
            "id", "nome", "documento", "endereco", "telefone", "email",
            "emite_nota_fiscal", "aceita_fiado", "ativo", "observacao",
            "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]
```

- [ ] **Step 4: Adicionar `FornecedorViewSet`** em `core/api_views.py`.

Atualizar imports do topo — trocar:
```python
from .models import Produto, Categoria, Grupo, BemPermanente
from .serializers import (
    ProdutoSerializer, CategoriaSerializer, GrupoSerializer, BemPermanenteSerializer,
)
```
por:
```python
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor
from .serializers import (
    ProdutoSerializer, CategoriaSerializer, GrupoSerializer,
    BemPermanenteSerializer, FornecedorSerializer,
)
```

Acrescentar a classe:
```python
class FornecedorViewSet(viewsets.ModelViewSet):
    serializer_class = FornecedorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome", "documento"]

    def get_queryset(self):
        qs = Fornecedor.objects.all()
        for campo in ("emite_nota_fiscal", "aceita_fiado", "ativo"):
            valor = self.request.query_params.get(campo)
            if valor is not None:
                qs = qs.filter(**{campo: valor.lower() in ("1", "true", "sim")})
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)
```

- [ ] **Step 5: Registrar a rota** em `core/api_urls.py`. Trocar o arquivo inteiro por:

```python
from rest_framework.routers import DefaultRouter
from .api_views import (
    ProdutoViewSet, CategoriaViewSet, GrupoViewSet,
    BemPermanenteViewSet, FornecedorViewSet,
)

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"grupos", GrupoViewSet, basename="grupo")
router.register(r"bens-permanentes", BemPermanenteViewSet, basename="bempermanente")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedor")

urlpatterns = router.urls
```

- [ ] **Step 6: Rodar os testes**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.FornecedorApiTest -v 2`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add core/serializers.py core/api_views.py core/api_urls.py core/tests/test_api.py
git commit -m "feat: API de fornecedores (serializer, viewset, filtros, rota)"
```

---

### Task 3: Integrar `fornecedor` no Produto API

**Files:**
- Modify: `core/serializers.py`
- Modify: `core/api_views.py`
- Modify: `core/tests/test_api.py`

- [ ] **Step 1: Escrever o teste (falha)** — acrescentar a `core/tests/test_api.py`:

```python
class ProdutoFornecedorApiTest(APITestCase):
    def setUp(self):
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=self.cat)

    def test_produto_expoe_e_aceita_fornecedor(self):
        from core.models import Fornecedor
        f = Fornecedor.objects.create(nome="Atacadão")
        resp = self.client.post("/api/produtos/", {
            "nome": "Arroz", "grupo": self.grupo.id, "quantidade": "1",
            "unidade": "KG", "fornecedor": f.id,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["fornecedor"], f.id)
        self.assertEqual(resp.data["fornecedor_nome"], "Atacadão")

    def test_produto_sem_fornecedor_tem_nome_nulo(self):
        resp = self.client.post("/api/produtos/", {
            "nome": "Feijão", "grupo": self.grupo.id, "quantidade": "1", "unidade": "KG",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertIsNone(resp.data["fornecedor"])
        self.assertIsNone(resp.data["fornecedor_nome"])
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_api.ProdutoFornecedorApiTest -v 2`
Expected: FAIL (KeyError `fornecedor_nome`)

- [ ] **Step 3: Atualizar `ProdutoSerializer`** em `core/serializers.py`. Adicionar o campo derivado logo após a linha `criado_por_nome = serializers.CharField(...)`:

```python
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True)
```

E na lista `fields` do `ProdutoSerializer`, acrescentar `"fornecedor"` e `"fornecedor_nome"` logo após `"grupo_nome"` (mantendo os demais). A lista fica:

```python
        fields = [
            "id", "nome", "numero_nota_fiscal",
            "grupo", "grupo_nome", "fornecedor", "fornecedor_nome",
            "categoria", "categoria_nome",
            "quantidade", "unidade", "estoque_minimo", "perecivel", "periodicidade",
            "validade", "preco",
            "criado_por_nome", "criado_em", "atualizado_em",
        ]
```

- [ ] **Step 4: Atualizar `ProdutoViewSet.get_queryset`** em `core/api_views.py` — incluir `fornecedor` no `select_related` e o filtro `?fornecedor=`. Substituir o método `get_queryset` do `ProdutoViewSet` por:

```python
    def get_queryset(self):
        qs = Produto.objects.select_related(
            "grupo__categoria", "fornecedor", "criado_por", "atualizado_por"
        ).all()
        grupo = self.request.query_params.get("grupo")
        categoria = self.request.query_params.get("categoria")
        fornecedor = self.request.query_params.get("fornecedor")
        if grupo:
            qs = qs.filter(grupo_id=grupo)
        if categoria:
            qs = qs.filter(grupo__categoria_id=categoria)
        if fornecedor:
            qs = qs.filter(fornecedor_id=fornecedor)
        return qs
```

- [ ] **Step 5: Rodar os testes (completo)**

Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (todos)

- [ ] **Step 6: Commit**

```bash
git add core/serializers.py core/api_views.py core/tests/test_api.py
git commit -m "feat: expõe fornecedor/fornecedor_nome no Produto API + filtro"
```

---

## Phase B — Frontend

### Task 4: Camada de API do front (fornecedores)

**Files:**
- Modify: `frontend/src/api/http.js`
- Modify: `frontend/src/api/mock.js`
- Modify: `frontend/src/api/index.js`

- [ ] **Step 1: Adicionar o cliente HTTP** em `frontend/src/api/http.js` — acrescentar após `httpBensPermanentes`:

```js
export const httpFornecedores = {
  list: () => req(`/fornecedores/`),
  create: (data) => req(`/fornecedores/`, { method: "POST", body: data }),
  update: (id, data) => req(`/fornecedores/${id}/`, { method: "PATCH", body: data }),
  remove: (id) => req(`/fornecedores/${id}/`, { method: "DELETE" }),
}
```

- [ ] **Step 2: Atualizar o mock** `frontend/src/api/mock.js`:

(a) Trocar a constante de chave:
```js
const KEY = "easystock:db:v2"
```
por:
```js
const KEY = "easystock:db:v3"
```

(b) Dentro de `seed()`, antes do `return`, adicionar fornecedores e referenciá-los nos produtos. Substituir o array `produtos` e o `return` por:

```js
  const fornecedores = [
    { id: 1, nome: "Atacadão Escolar", documento: "12.345.678/0001-99", endereco: "Av. Central, 100", telefone: "(81) 99999-0000", email: "vendas@atacadao.com", emite_nota_fiscal: true, aceita_fiado: false, ativo: true, observacao: "" },
    { id: 2, nome: "Mercadinho do Zé", documento: "", endereco: "Rua 5, 23", telefone: "(81) 98888-1111", email: "", emite_nota_fiscal: false, aceita_fiado: true, ativo: true, observacao: "Aceita fiado quando a verba atrasa." },
  ]
  const produtos = [
    { id: 1, nome: "Arroz Branco Tipo 1", numero_nota_fiscal: "NF-00231", grupo: 1, fornecedor: 1, quantidade: 48, unidade: "KG", estoque_minimo: 20, perecivel: true, periodicidade: "MENSAL", validade: emDias(95), preco: "5.40" },
    { id: 2, nome: "Feijão Carioca", numero_nota_fiscal: "NF-00231", grupo: 2, fornecedor: 1, quantidade: 12, unidade: "KG", estoque_minimo: 15, perecivel: true, periodicidade: "MENSAL", validade: emDias(20), preco: "8.20" },
    { id: 3, nome: "Detergente Neutro", numero_nota_fiscal: "NF-00198", grupo: 3, fornecedor: 2, quantidade: 64, unidade: "UN", estoque_minimo: 20, perecivel: false, periodicidade: "EVENTUAL", validade: emDias(310), preco: "2.15" },
    { id: 4, nome: "Resma Papel A4", numero_nota_fiscal: "NF-00210", grupo: 4, fornecedor: null, quantidade: 25, unidade: "PC", estoque_minimo: 10, perecivel: false, periodicidade: "EVENTUAL", validade: null, preco: "23.00" },
  ]
  return { categorias, grupos, fornecedores, produtos, seqC: 4, seqG: 5, seqF: 3, seqP: 5 }
```

(c) Em `expand(p, db)`, adicionar `fornecedor_nome`. Substituir a função `expand` por:

```js
function expand(p, db) {
  const grupo = db.grupos.find((g) => g.id === Number(p.grupo))
  const cat = grupo ? db.categorias.find((c) => c.id === Number(grupo.categoria)) : null
  const forn = p.fornecedor ? db.fornecedores.find((f) => f.id === Number(p.fornecedor)) : null
  return {
    ...p,
    grupo_nome: grupo ? grupo.nome : "—",
    categoria: cat ? cat.id : null,
    categoria_nome: cat ? cat.name : "—",
    fornecedor: p.fornecedor ?? null,
    fornecedor_nome: forn ? forn.nome : null,
    criado_por_nome: "voce",
    criado_em: p.criado_em ?? new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }
}
```

(d) Em `normalize(data)`, incluir `fornecedor`. Substituir a função `normalize` por:

```js
function normalize(data) {
  return {
    nome: data.nome,
    numero_nota_fiscal: data.numero_nota_fiscal || null,
    grupo: Number(data.grupo),
    fornecedor: data.fornecedor ? Number(data.fornecedor) : null,
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

(e) Acrescentar o objeto `mockFornecedores` (após `mockGrupos`):

```js
export const mockFornecedores = {
  async list() {
    await delay(120)
    const db = load()
    return [...db.fornecedores].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  },
  async create(data) {
    await delay()
    const db = load()
    const novo = {
      id: db.seqF++,
      nome: String(data.nome).trim(),
      documento: data.documento || "",
      endereco: data.endereco || "",
      telefone: data.telefone || "",
      email: data.email || "",
      emite_nota_fiscal: data.emite_nota_fiscal ?? true,
      aceita_fiado: Boolean(data.aceita_fiado),
      ativo: data.ativo ?? true,
      observacao: data.observacao || "",
    }
    db.fornecedores.push(novo)
    save(db)
    return novo
  },
  async update(id, data) {
    await delay()
    const db = load()
    const i = db.fornecedores.findIndex((f) => f.id === Number(id))
    if (i === -1) throw new Error("Fornecedor não encontrado")
    db.fornecedores[i] = { ...db.fornecedores[i], ...data }
    save(db)
    return db.fornecedores[i]
  },
  async remove(id) {
    await delay()
    const db = load()
    const emUso = db.produtos.some((p) => Number(p.fornecedor) === Number(id))
    if (emUso) throw new Error("Fornecedor vinculado a produtos — desative em vez de excluir.")
    db.fornecedores = db.fornecedores.filter((f) => f.id !== Number(id))
    save(db)
  },
}
```

- [ ] **Step 3: Atualizar `frontend/src/api/index.js`** para EXATAMENTE:

```js
import { mockProdutos, mockGrupos, mockCategorias, mockFornecedores } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes, httpFornecedores } from "./http"

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const gruposApi = USE_MOCK ? mockGrupos : httpGrupos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const fornecedoresApi = USE_MOCK ? mockFornecedores : httpFornecedores
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
```

- [ ] **Step 4: Verificar build + vitest**

Run (em `frontend/`): `npm run build`
Expected: build sem erros.
Run (em `frontend/`): `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api
git commit -m "feat(front): camada de API de fornecedores; mock com fornecedor"
```

---

### Task 5: `FornecedorFormModal`

**Files:**
- Create: `frontend/src/components/FornecedorFormModal.jsx`

- [ ] **Step 1: Criar `frontend/src/components/FornecedorFormModal.jsx`**:

```jsx
import { useEffect, useState } from "react"
import { fornecedoresApi } from "../api"
import Modal from "./Modal"
import { useToast } from "./Toast"

const VAZIO = {
  nome: "", documento: "", endereco: "", telefone: "", email: "",
  emite_nota_fiscal: true, aceita_fiado: false, ativo: true, observacao: "",
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

export default function FornecedorFormModal({ open, fornecedor, onClose, onSaved }) {
  const editando = Boolean(fornecedor)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setForm(fornecedor ? { ...VAZIO, ...fornecedor } : VAZIO)
    setErro("")
  }, [open, fornecedor])

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))

  async function submit(ev) {
    ev.preventDefault()
    if (!form.nome.trim()) { setErro("Informe o nome"); return }
    setSalvando(true)
    try {
      if (editando) {
        await fornecedoresApi.update(fornecedor.id, form)
        toast("Fornecedor atualizado")
      } else {
        await fornecedoresApi.create(form)
        toast("Fornecedor cadastrado")
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
      title={editando ? "Editar fornecedor" : "Novo fornecedor"}
      subtitle={editando ? fornecedor?.nome : "Cadastre um fornecedor"}
      maxW="max-w-xl"
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome" full>
          <input className="field" value={form.nome} onChange={set("nome")} placeholder="Ex.: Atacadão Escolar" />
          {erro && <p className="mt-1 text-xs text-out">{erro}</p>}
        </Campo>

        <Campo label="CNPJ / CPF" hint="opcional">
          <input className="field" value={form.documento} onChange={set("documento")} placeholder="00.000.000/0000-00" />
        </Campo>

        <Campo label="Telefone" hint="opcional">
          <input className="field" value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" />
        </Campo>

        <Campo label="E-mail" hint="opcional">
          <input type="email" className="field" value={form.email} onChange={set("email")} placeholder="contato@fornecedor.com" />
        </Campo>

        <Campo label="Endereço" hint="opcional">
          <input className="field" value={form.endereco} onChange={set("endereco")} placeholder="Rua, número, cidade" />
        </Campo>

        <Campo label="Observação" hint="opcional" full>
          <textarea className="field" rows={2} value={form.observacao} onChange={set("observacao")} />
        </Campo>

        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.emite_nota_fiscal} onChange={set("emite_nota_fiscal")} className="h-4 w-4" />
            <span className="text-sm font-semibold">Emite nota fiscal</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.aceita_fiado} onChange={set("aceita_fiado")} className="h-4 w-4" />
            <span className="text-sm font-semibold">Aceita fiado</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.ativo} onChange={set("ativo")} className="h-4 w-4" />
            <span className="text-sm font-semibold">Ativo</span>
          </label>
        </div>

        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn btn-brand disabled:opacity-60">
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verificar build**

Run (em `frontend/`): `npm run build`
Expected: build sem erros (componente ainda não usado; será ligado na Task 6).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FornecedorFormModal.jsx
git commit -m "feat(front): FornecedorFormModal (criar/editar)"
```

---

### Task 6: `FornecedoresView` + aba no Dashboard

**Files:**
- Create: `frontend/src/components/FornecedoresView.jsx`
- Modify: `frontend/src/pages/DashboardPage.jsx`

- [ ] **Step 1: Criar `frontend/src/components/FornecedoresView.jsx`**:

```jsx
import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { fornecedoresApi } from "../api"
import { Icon } from "../lib/icons.jsx"
import ConfirmDialog from "./ConfirmDialog"
import { useToast } from "./Toast"

const CHIPS = [
  { key: "todos", label: "Todos" },
  { key: "nf", label: "Emite NF" },
  { key: "fiado", label: "Aceita fiado" },
  { key: "inativos", label: "Inativos" },
]

function Badge({ tone, children }) {
  const cls = {
    ok: "bg-ok-tint text-ok",
    warn: "bg-low-tint text-low",
    off: "bg-ink/5 text-ink-faint",
  }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-[0.66rem] font-bold uppercase ${cls}`}>{children}</span>
}

export default function FornecedoresView({ fornecedores, onNew, onEdit, onChanged }) {
  const [filtro, setFiltro] = useState("todos")
  const [aExcluir, setAExcluir] = useState(null)
  const toast = useToast()

  const lista = useMemo(() => {
    if (filtro === "nf") return fornecedores.filter((f) => f.emite_nota_fiscal)
    if (filtro === "fiado") return fornecedores.filter((f) => f.aceita_fiado)
    if (filtro === "inativos") return fornecedores.filter((f) => !f.ativo)
    return fornecedores
  }, [fornecedores, filtro])

  async function toggleAtivo(f) {
    await fornecedoresApi.update(f.id, { ativo: !f.ativo })
    toast(f.ativo ? "Fornecedor desativado" : "Fornecedor ativado")
    onChanged?.()
  }

  async function excluir() {
    const f = aExcluir
    setAExcluir(null)
    try {
      await fornecedoresApi.remove(f.id)
      toast(`"${f.nome}" excluído`, "danger")
      onChanged?.()
    } catch (err) {
      toast(String(err.message || err), "danger")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Fornecedores</h2>
          <p className="mt-1 text-sm text-ink-faint">{lista.length} {lista.length === 1 ? "fornecedor" : "fornecedores"}</p>
        </div>
        <button onClick={onNew} className="btn btn-brand">{Icon.plus(18)} Novo fornecedor</button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => setFiltro(c.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              filtro === c.key ? "border-brand bg-brand text-[#f4f1e7]" : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {lista.length === 0 && (
          <div className="col-span-full grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
            <span className="mb-2 text-ink-faint">{Icon.users(40)}</span>
            <p className="font-display text-lg font-bold">Nenhum fornecedor</p>
            <p className="text-sm text-ink-faint">Cadastre o primeiro com "Novo fornecedor".</p>
          </div>
        )}

        {lista.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
            className={`card flex flex-col p-4 ${f.ativo ? "" : "opacity-70"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold leading-tight" title={f.nome}>{f.nome}</h3>
                {f.documento && <div className="font-mono text-[0.66rem] text-ink-faint">{f.documento}</div>}
              </div>
              <button onClick={() => onEdit(f)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-surface-2" title="Editar">
                {Icon.edit(15)}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.emite_nota_fiscal && <Badge tone="ok">NF</Badge>}
              {f.aceita_fiado && <Badge tone="warn">Fiado</Badge>}
              {!f.ativo && <Badge tone="off">Inativo</Badge>}
            </div>

            {(f.telefone || f.email || f.endereco) && (
              <div className="mt-3 space-y-0.5 text-xs text-ink-soft">
                {f.telefone && <div>📞 {f.telefone}</div>}
                {f.email && <div className="truncate">✉ {f.email}</div>}
                {f.endereco && <div className="truncate">📍 {f.endereco}</div>}
              </div>
            )}

            <div className="mt-3 flex gap-1.5 border-t border-line pt-3">
              <button onClick={() => toggleAtivo(f)} className="btn btn-ghost flex-1 py-1.5 text-xs">
                {f.ativo ? "Desativar" : "Ativar"}
              </button>
              <button
                onClick={() => setAExcluir(f)}
                className="btn px-3 py-1.5 text-xs"
                style={{ background: "var(--color-out-tint)", color: "var(--color-out)" }}
              >
                {Icon.trash(15)}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <ConfirmDialog
        open={!!aExcluir}
        title="Excluir fornecedor"
        message={aExcluir ? `Remover "${aExcluir.nome}"? Se estiver vinculado a produtos, desative em vez de excluir.` : ""}
        onConfirm={excluir}
        onCancel={() => setAExcluir(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Ligar no `DashboardPage.jsx`.** Aplicar os edits:

(a) Nos imports (após `import ProductFormModal ...`):
```js
import FornecedoresView from "../components/FornecedoresView"
import FornecedorFormModal from "../components/FornecedorFormModal"
```
e trocar:
```js
import { produtosApi, categoriasApi, gruposApi } from "../api"
```
por:
```js
import { produtosApi, categoriasApi, gruposApi, fornecedoresApi } from "../api"
```

(b) No array `TABS`, inserir a aba Fornecedores após Inventário:
```js
const TABS = [
  { key: "geral", label: "Visão Geral" },
  { key: "inv", label: "Inventário" },
  { key: "forn", label: "Fornecedores" },
  { key: "mov", label: "Movimentações" },
  { key: "sol", label: "Solicitações" },
]
```

(c) Adicionar estados — após `const [grupos, setGrupos] = useState([])`:
```js
  const [fornecedores, setFornecedores] = useState([])
```
e após `const [editProduto, setEditProduto] = useState(null)`:
```js
  const [addFornOpen, setAddFornOpen] = useState(false)
  const [editFornecedor, setEditFornecedor] = useState(null)
```

(d) Atualizar `carregar` para buscar fornecedores:
```js
  async function carregar() {
    setLoading(true)
    try {
      const [p, c, g, f] = await Promise.all([
        produtosApi.list(termo), categoriasApi.list(), gruposApi.list(), fornecedoresApi.list(),
      ])
      setProdutos(p)
      setCategorias(c)
      setGrupos(g)
      setFornecedores(f)
    } finally {
      setLoading(false)
    }
  }
```

(e) Renderizar a aba — após o bloco `{tab === "inv" && ( ... )}` e antes de `{tab === "geral" && ...}`, adicionar:
```jsx
              {tab === "forn" && (
                <FornecedoresView
                  fornecedores={fornecedores}
                  onNew={() => setAddFornOpen(true)}
                  onEdit={(f) => setEditFornecedor(f)}
                  onChanged={carregar}
                />
              )}
```

(f) Passar fornecedores ativos ao `ProductFormModal`. Trocar o elemento `<ProductFormModal ... />` por:
```jsx
      <ProductFormModal
        open={addOpen || !!editProduto}
        produto={editProduto}
        grupos={grupos}
        fornecedores={fornecedores.filter((f) => f.ativo)}
        onClose={() => { setAddOpen(false); setEditProduto(null) }}
        onSaved={carregar}
      />
```

(g) Adicionar o `FornecedorFormModal` logo após o `<ProductFormModal ... />`:
```jsx
      <FornecedorFormModal
        open={addFornOpen || !!editFornecedor}
        fornecedor={editFornecedor}
        onClose={() => { setAddFornOpen(false); setEditFornecedor(null) }}
        onSaved={carregar}
      />
```

- [ ] **Step 3: Verificar build + vitest**

Run (em `frontend/`): `npm run build`
Expected: build sem erros.
Run (em `frontend/`): `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/FornecedoresView.jsx frontend/src/pages/DashboardPage.jsx
git commit -m "feat(front): aba Fornecedores (lista, chips, ações) + wiring no dashboard"
```

---

### Task 7: Seletor de fornecedor no produto + linha nos detalhes

**Files:**
- Modify: `frontend/src/components/ProductFormModal.jsx`
- Modify: `frontend/src/components/DetailsModal.jsx`

- [ ] **Step 1: `ProductFormModal.jsx` — adicionar o seletor de fornecedor.**

(a) Na assinatura do componente, adicionar a prop `fornecedores`:
```js
export default function ProductFormModal({ open, produto, grupos, fornecedores = [], onClose, onSaved }) {
```

(b) No objeto `VAZIO`, adicionar `fornecedor: ""`:
```js
const VAZIO = {
  nome: "", numero_nota_fiscal: "", grupo: "", fornecedor: "",
  quantidade: "", unidade: "UN", estoque_minimo: "",
  perecivel: false, periodicidade: "EVENTUAL", validade: "", preco: "",
}
```

(c) No `useEffect` que carrega o produto para edição, adicionar a linha do fornecedor dentro do `setForm({...})` (logo após `grupo: String(produto.grupo ?? ""),`):
```js
        fornecedor: String(produto.fornecedor ?? ""),
```

(d) No `submit`, enviar o payload com `fornecedor` normalizado (null quando vazio). Trocar as duas chamadas de salvar:
```js
      if (editando) {
        await produtosApi.update(produto.id, form)
        toast("Item atualizado")
      } else {
        await produtosApi.create(form)
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
        await produtosApi.create(payload)
        toast("Item cadastrado")
      }
```

(e) Adicionar o campo do seletor no formulário, logo após o bloco `<Campo label="Periodicidade">...</Campo>`:
```jsx
        <Campo label="Fornecedor" hint="opcional">
          <select className="field" value={form.fornecedor} onChange={set("fornecedor")}>
            <option value="">— sem fornecedor —</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </Campo>
```

- [ ] **Step 2: `DetailsModal.jsx` — adicionar a linha "Fornecedor".** Após a `<Linha label="Periodicidade">...</Linha>` (ou após "Nota Fiscal" se Periodicidade não existir), adicionar:
```jsx
        <Linha label="Fornecedor">{produto.fornecedor_nome || "—"}</Linha>
```

- [ ] **Step 3: Verificar build + vitest**

Run (em `frontend/`): `npm run build`
Expected: build sem erros.
Run (em `frontend/`): `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Verificação manual (opcional, com servidores no ar)**

1. Backend: `.venv\Scripts\python manage.py runserver`
2. Front: `npm run dev`
3. Conferir: aba Fornecedores lista os 2 mocks (ou dados reais), chips filtram, criar/editar/desativar funciona; no formulário de produto o seletor de fornecedor aparece; detalhes do item mostram o fornecedor.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProductFormModal.jsx frontend/src/components/DetailsModal.jsx
git commit -m "feat(front): seletor de fornecedor no produto + linha nos detalhes"
```

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura do spec:**
- Modelo Fornecedor (flags + contato/endereço/documento/observacao + auditoria) → Task 1 ✓
- Produto.fornecedor FK PROTECT opcional → Task 1 ✓
- Migração 0007 sem data migration → Task 1 ✓
- API /api/fornecedores/ + busca + filtros (NF/fiado/ativo) → Task 2 ✓
- fornecedor/fornecedor_nome no ProdutoSerializer + filtro + select_related → Task 3 ✓
- Front: camada fornecedoresApi (http+mock) → Task 4 ✓
- Front: aba Fornecedores (lista, chips NF/fiado/inativos, criar/editar, ativar/desativar, excluir com PROTECT) → Tasks 5, 6 ✓
- Front: seletor de fornecedor no ProductFormModal → Task 7 ✓
- Front: linha Fornecedor no DetailsModal → Task 7 ✓
- Tratamento de erro PROTECT (toast orientando desativar) → Tasks 4 (mock), 6 (excluir) ✓
- Testes (modelo PROTECT, API CRUD/filtros, produto fornecedor) → Tasks 1, 2, 3 ✓

**Sem placeholders:** todo passo mostra o código completo.

**Consistência de tipos:** `fornecedor` é id (number/string) e `fornecedor_nome` string|null em backend (Task 3) e front (mock Task 4, DetailsModal Task 7); `fornecedoresApi` exportado (Task 4) e usado (Tasks 5, 6, 7); prop `fornecedores` passada do DashboardPage (Task 6) ao ProductFormModal (Task 7) e FornecedoresView (Task 6); chips `todos/nf/fiado/inativos` consistentes em FornecedoresView.
