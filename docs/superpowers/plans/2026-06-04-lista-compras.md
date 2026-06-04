# Lista de Compras Automatizada — Implementation Plan (Sub-bloco C2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sugerir o que comprar por item (consumo médio semanal + estoque mínimo − saldo), via endpoint read-only e uma aba "Compras" com tabela agrupada por fornecedor e exportação CSV/impressão.

**Architecture:** Um serviço puro (`core/compras.py`) faz uma agregação única das saídas de consumo e calcula a sugestão; um `APIView` read-only expõe em `/api/sugestao-compras/`. Sem modelo nem migração (a sugestão é derivada). Frontend: aba "Compras" auto-suficiente que busca a sugestão e exporta.

**Tech Stack:** Django 6 + DRF (venv `.venv`, test runner nativo); React + Vite + Tailwind; Vitest.

**Spec:** `docs/superpowers/specs/2026-06-04-lista-compras-design.md`
**Branch:** `feat/lista-compras` (da `main` com A + B + C1).

**Comandos base (Windows / PowerShell):**
- Backend: `.venv\Scripts\python manage.py test core -v 2`
- Frontend (em `frontend/`): `npm run build` · `npx vitest run`

---

## File Structure

**Backend (`core/`):**
- `compras.py` — **novo**: `sugerir_compras(horizonte, semanas)`
- `api_views.py` — +`SugestaoComprasView`
- `api_urls.py` — +rota `sugestao-compras/`
- `tests/test_compras.py` — **novo** (serviço + endpoint)

**Frontend (`frontend/src/`):**
- `api/http.js` — +`httpCompras`
- `api/mock.js` — +`mockCompras` (recalcula a sugestão do journal)
- `api/index.js` — +`comprasApi`
- `lib/csv.js` — **novo**: util de download CSV
- `components/ComprasView.jsx` — **novo** (aba)
- `pages/DashboardPage.jsx` — +aba "Compras"

---

## Task 1: Serviço `sugerir_compras`

**Files:** Create `core/compras.py`; create `core/tests/test_compras.py`.

- [ ] **Step 1: Escrever os testes (falham)** — criar `core/tests/test_compras.py`:

```python
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from core.models import Categoria, Grupo, Produto, Fornecedor, Movimentacao
from core.compras import sugerir_compras


class SugerirComprasTest(TestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.forn = Fornecedor.objects.create(nome="Atacadão")
        # saldo 10, mínimo 5, preço 2.00
        self.p = Produto.objects.create(
            nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG",
            estoque_minimo=5, preco="2.00", fornecedor=self.forn,
        )

    def _saida(self, qtd, motivo="consumo", dias_atras=1):
        Movimentacao.objects.create(
            produto=self.p, tipo=Movimentacao.SAIDA, quantidade=qtd, motivo=motivo,
            data=timezone.localdate() - timedelta(days=dias_atras),
        )

    def test_sugere_por_consumo_mais_minimo(self):
        # 4 semanas, consumo total 28 em consumo => 7/semana
        self._saida(28, motivo="consumo", dias_atras=3)
        r = sugerir_compras(horizonte=1, semanas=4)
        item = next(i for i in r["itens"] if i["produto"] == self.p.id)
        # consumo_semanal=7; sugerido = 7*1 + 5 - 10 = 2
        self.assertEqual(item["consumo_semanal"], "7.000")
        self.assertEqual(item["sugerido"], "2.000")
        self.assertEqual(item["custo_estimado"], "4.00")  # 2 * 2.00
        self.assertEqual(item["fornecedor_nome"], "Atacadão")

    def test_ignora_saidas_nao_consumo_e_entradas(self):
        self._saida(100, motivo="perda", dias_atras=2)         # ignora
        Movimentacao.objects.create(produto=self.p, tipo=Movimentacao.ENTRADA, quantidade=50, motivo="entrada")  # ignora
        r = sugerir_compras(horizonte=1, semanas=4)
        # sem consumo => consumo_semanal 0; sugerido = 0 + 5 - 10 = -5 <= 0 => fora
        self.assertEqual([i for i in r["itens"] if i["produto"] == self.p.id], [])

    def test_horizonte_multiplica_consumo(self):
        self._saida(28, motivo="consumo", dias_atras=3)  # 7/semana
        r = sugerir_compras(horizonte=2, semanas=4)
        item = next(i for i in r["itens"] if i["produto"] == self.p.id)
        # 7*2 + 5 - 10 = 9
        self.assertEqual(item["sugerido"], "9.000")

    def test_resumo(self):
        self._saida(28, motivo="consumo", dias_atras=3)
        r = sugerir_compras(horizonte=1, semanas=4)
        self.assertEqual(r["total_itens"], len(r["itens"]))
        self.assertEqual(r["custo_total_estimado"], "4.00")
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_compras -v 2`
Expected: FAIL (ModuleNotFoundError: core.compras)

- [ ] **Step 3: Criar `core/compras.py`**:

```python
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from django.utils import timezone

from .models import Produto, Movimentacao

_Q3 = Decimal("0.001")
_Q2 = Decimal("0.01")


def _q(valor, exp):
    return Decimal(valor).quantize(exp, rounding=ROUND_HALF_UP)


def sugerir_compras(*, horizonte=1, semanas=4):
    horizonte = max(1, int(horizonte))
    semanas = max(1, int(semanas))
    janela_inicio = timezone.localdate() - timedelta(days=semanas * 7)

    consumo = {
        row["produto"]: row["total"]
        for row in Movimentacao.objects.filter(
            tipo=Movimentacao.SAIDA, motivo="consumo", data__gte=janela_inicio
        ).values("produto").annotate(total=Sum("quantidade"))
    }

    itens = []
    custo_total = Decimal("0")
    for p in Produto.objects.select_related("grupo", "fornecedor").all():
        consumo_total = Decimal(consumo.get(p.id, 0))
        consumo_semanal = consumo_total / Decimal(semanas)
        sugerido = consumo_semanal * horizonte + p.estoque_minimo - p.quantidade
        if sugerido <= 0:
            continue
        sugerido = _q(sugerido, _Q3)
        consumo_semanal = _q(consumo_semanal, _Q3)
        custo = _q(sugerido * p.preco, _Q2) if p.preco is not None else None
        if custo is not None:
            custo_total += custo
        itens.append({
            "produto": p.id,
            "produto_nome": p.nome,
            "unidade": p.unidade,
            "saldo": str(p.quantidade),
            "estoque_minimo": str(p.estoque_minimo),
            "consumo_semanal": str(consumo_semanal),
            "sugerido": str(sugerido),
            "fornecedor": p.fornecedor_id,
            "fornecedor_nome": p.fornecedor.nome if p.fornecedor_id else None,
            "preco": str(p.preco) if p.preco is not None else None,
            "custo_estimado": str(custo) if custo is not None else None,
        })

    itens.sort(key=lambda i: ((i["fornecedor_nome"] or "￿"), i["produto_nome"]))
    return {
        "itens": itens,
        "total_itens": len(itens),
        "custo_total_estimado": str(_q(custo_total, _Q2)),
    }
```

- [ ] **Step 4: Rodar os testes**

Run: `.venv\Scripts\python manage.py test core.tests.test_compras -v 2`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/compras.py core/tests/test_compras.py
git commit -m "feat: serviço sugerir_compras (consumo médio + mínimo)"
```

---

## Task 2: Endpoint `/api/sugestao-compras/`

**Files:** Modify `core/api_views.py`, `core/api_urls.py`, `core/tests/test_compras.py`.

- [ ] **Step 1: Escrever os testes (falham)** — acrescentar a `core/tests/test_compras.py`:

```python
from rest_framework.test import APITestCase


class SugestaoComprasEndpointTest(APITestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p = Produto.objects.create(
            nome="Feijão", grupo=self.grupo, quantidade=2, unidade="KG", estoque_minimo=10
        )

    def test_get_retorna_sugestao(self):
        resp = self.client.get("/api/sugestao-compras/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("itens", resp.data)
        self.assertIn("total_itens", resp.data)
        self.assertIn("custo_total_estimado", resp.data)
        # saldo 2, mínimo 10, sem consumo => sugerido = 10 - 2 = 8
        item = next(i for i in resp.data["itens"] if i["produto"] == self.p.id)
        self.assertEqual(item["sugerido"], "8.000")

    def test_params_invalidos_usam_default(self):
        resp = self.client.get("/api/sugestao-compras/?horizonte=abc&semanas=-5")
        self.assertEqual(resp.status_code, 200)
        # default horizonte=1, semanas=4 → ainda sugere 8 (sem consumo)
        item = next(i for i in resp.data["itens"] if i["produto"] == self.p.id)
        self.assertEqual(item["sugerido"], "8.000")
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `.venv\Scripts\python manage.py test core.tests.test_compras.SugestaoComprasEndpointTest -v 2`
Expected: FAIL (404)

- [ ] **Step 3: Adicionar `SugestaoComprasView`** em `core/api_views.py`.

No topo, acrescentar os imports (após a linha `from rest_framework.response import Response`):
```python
from rest_framework.views import APIView
from .compras import sugerir_compras
```

E acrescentar a classe ao final do arquivo:
```python
class SugestaoComprasView(APIView):
    def get(self, request):
        def _intparam(nome, default):
            try:
                v = int(request.query_params.get(nome, default))
            except (TypeError, ValueError):
                return default
            return v if v > 0 else default

        horizonte = _intparam("horizonte", 1)
        semanas = _intparam("semanas", 4)
        return Response(sugerir_compras(horizonte=horizonte, semanas=semanas))
```

- [ ] **Step 4: Registrar a rota** em `core/api_urls.py`. O arquivo atual termina com `urlpatterns = router.urls`. Substituir o conteúdo inteiro por (mantendo todos os registros do router e adicionando a rota da APIView):

```python
from django.urls import path
from rest_framework.routers import DefaultRouter
from .api_views import (
    ProdutoViewSet, CategoriaViewSet, GrupoViewSet,
    BemPermanenteViewSet, FornecedorViewSet,
    MovimentacaoViewSet, EntradaViewSet, SugestaoComprasView,
)

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"grupos", GrupoViewSet, basename="grupo")
router.register(r"bens-permanentes", BemPermanenteViewSet, basename="bempermanente")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedor")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacao")
router.register(r"entradas", EntradaViewSet, basename="entrada")

urlpatterns = [
    path("sugestao-compras/", SugestaoComprasView.as_view(), name="sugestao-compras"),
] + router.urls
```

- [ ] **Step 5: Rodar os testes do endpoint + suíte completa**

Run: `.venv\Scripts\python manage.py test core.tests.test_compras -v 2`
Expected: PASS
Run: `.venv\Scripts\python manage.py test core -v 2`
Expected: PASS (todos)

- [ ] **Step 6: Commit**

```bash
git add core/api_views.py core/api_urls.py core/tests/test_compras.py
git commit -m "feat: endpoint /api/sugestao-compras/ (read-only, params com default)"
```

---

## Task 3: Camada de API do front + util CSV

**Files:** Modify `frontend/src/api/http.js`, `mock.js`, `index.js`; create `frontend/src/lib/csv.js`.

- [ ] **Step 1: Adicionar o cliente HTTP** em `frontend/src/api/http.js` — acrescentar após `httpEntradas`:

```js
export const httpCompras = {
  sugerir: ({ horizonte = 1, semanas = 4 } = {}) =>
    req(`/sugestao-compras/?horizonte=${horizonte}&semanas=${semanas}`),
}
```

- [ ] **Step 2: Adicionar `mockCompras`** em `frontend/src/api/mock.js` — acrescentar após `mockEntradas`:

```js
export const mockCompras = {
  async sugerir({ horizonte = 1, semanas = 4 } = {}) {
    await delay(150)
    const db = load()
    const h = Math.max(1, Number(horizonte) || 1)
    const s = Math.max(1, Number(semanas) || 4)
    const janela = new Date()
    janela.setDate(janela.getDate() - s * 7)
    const janelaStr = janela.toISOString().slice(0, 10)

    const consumo = {}
    for (const m of db.movimentacoes) {
      if (m.tipo === "SAIDA" && m.motivo === "consumo" && m.data >= janelaStr) {
        consumo[m.produto] = (consumo[m.produto] || 0) + Number(m.quantidade)
      }
    }

    const itens = []
    let custoTotal = 0
    for (const p of db.produtos) {
      const consumoSemanal = (consumo[p.id] || 0) / s
      const sugerido = consumoSemanal * h + Number(p.estoque_minimo) - Number(p.quantidade)
      if (sugerido <= 0) continue
      const preco = p.preco != null && p.preco !== "" ? Number(p.preco) : null
      const custo = preco != null ? sugerido * preco : null
      if (custo != null) custoTotal += custo
      const forn = p.fornecedor ? db.fornecedores.find((f) => f.id === Number(p.fornecedor)) : null
      itens.push({
        produto: p.id, produto_nome: p.nome, unidade: p.unidade,
        saldo: String(p.quantidade), estoque_minimo: String(p.estoque_minimo),
        consumo_semanal: consumoSemanal.toFixed(3), sugerido: sugerido.toFixed(3),
        fornecedor: forn ? forn.id : null, fornecedor_nome: forn ? forn.nome : null,
        preco: preco != null ? String(preco) : null,
        custo_estimado: custo != null ? custo.toFixed(2) : null,
      })
    }
    itens.sort((a, b) =>
      ((a.fornecedor_nome || "￿") + a.produto_nome)
        .localeCompare((b.fornecedor_nome || "￿") + b.produto_nome, "pt-BR")
    )
    return { itens, total_itens: itens.length, custo_total_estimado: custoTotal.toFixed(2) }
  },
}
```

- [ ] **Step 3: Atualizar `frontend/src/api/index.js`** — adicionar `mockCompras`/`httpCompras` aos imports e exportar `comprasApi`. O arquivo passa a ser EXATAMENTE:

```js
import { mockProdutos, mockGrupos, mockCategorias, mockFornecedores, mockMovimentacoes, mockEntradas, mockCompras } from "./mock"
import { httpProdutos, httpGrupos, httpCategorias, httpBensPermanentes, httpFornecedores, httpMovimentacoes, httpEntradas, httpCompras } from "./http"

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi = USE_MOCK ? mockProdutos : httpProdutos
export const gruposApi = USE_MOCK ? mockGrupos : httpGrupos
export const categoriasApi = USE_MOCK ? mockCategorias : httpCategorias
export const fornecedoresApi = USE_MOCK ? mockFornecedores : httpFornecedores
export const movimentacoesApi = USE_MOCK ? mockMovimentacoes : httpMovimentacoes
export const entradasApi = USE_MOCK ? mockEntradas : httpEntradas
export const comprasApi = USE_MOCK ? mockCompras : httpCompras
export const bensApi = USE_MOCK ? null : httpBensPermanentes
export const isMock = USE_MOCK
```

- [ ] **Step 4: Criar `frontend/src/lib/csv.js`**:

```js
// Gera e baixa um CSV (separador ';' para abrir no Excel pt-BR). BOM p/ acentos.
export function baixarCSV(nomeArquivo, colunas, linhas) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const head = colunas.map((c) => esc(c.label)).join(";")
  const corpo = linhas.map((l) => colunas.map((c) => esc(l[c.key])).join(";")).join("\r\n")
  const conteudo = "﻿" + head + "\r\n" + corpo
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 5: Verificar build + vitest**

Run (em `frontend/`): `npm run build` → Expected: sem erros.
Run (em `frontend/`): `npx vitest run` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api frontend/src/lib/csv.js
git commit -m "feat(front): camada comprasApi + util de download CSV"
```

---

## Task 4: Aba "Compras" (`ComprasView`) + wiring

**Files:** Create `frontend/src/components/ComprasView.jsx`; modify `frontend/src/pages/DashboardPage.jsx`.

- [ ] **Step 1: Criar `frontend/src/components/ComprasView.jsx`**:

```jsx
import { useEffect, useMemo, useState } from "react"
import { comprasApi } from "../api"
import { brl } from "../lib/format"
import { baixarCSV } from "../lib/csv"
import { Icon } from "../lib/icons.jsx"
import { useToast } from "./Toast"

const HORIZONTES = [
  { value: 1, label: "1 semana" },
  { value: 2, label: "2 semanas" },
  { value: 4, label: "4 semanas" },
]
const JANELAS = [
  { value: 4, label: "4 semanas" },
  { value: 8, label: "8 semanas" },
]

export default function ComprasView() {
  const [horizonte, setHorizonte] = useState(1)
  const [semanas, setSemanas] = useState(4)
  const [dados, setDados] = useState({ itens: [], total_itens: 0, custo_total_estimado: "0.00" })
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    let vivo = true
    setLoading(true)
    comprasApi.sugerir({ horizonte, semanas })
      .then((d) => { if (vivo) setDados(d) })
      .catch((e) => toast(String(e.message || "Falha ao calcular"), "danger"))
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [horizonte, semanas]) // eslint-disable-line

  // agrupa por fornecedor
  const grupos = useMemo(() => {
    const m = new Map()
    for (const it of dados.itens) {
      const k = it.fornecedor_nome || "Sem fornecedor"
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(it)
    }
    return [...m.entries()].map(([nome, itens]) => ({
      nome, itens,
      subtotal: itens.reduce((s, i) => s + (Number(i.custo_estimado) || 0), 0),
    }))
  }, [dados])

  function exportar() {
    if (dados.itens.length === 0) return
    baixarCSV(
      "lista-de-compras.csv",
      [
        { key: "fornecedor_nome", label: "Fornecedor" },
        { key: "produto_nome", label: "Produto" },
        { key: "saldo", label: "Saldo" },
        { key: "estoque_minimo", label: "Mínimo" },
        { key: "consumo_semanal", label: "Consumo/sem" },
        { key: "sugerido", label: "Comprar" },
        { key: "unidade", label: "Unidade" },
        { key: "custo_estimado", label: "Custo estimado" },
      ],
      dados.itens
    )
    toast("CSV exportado")
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Lista de compras</h2>
          <p className="mt-1 text-sm text-ink-faint">Sugestão por consumo médio + estoque mínimo</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-ink-soft">
            <span className="mb-1 block">Cobrir</span>
            <select className="field" value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))}>
              {HORIZONTES.map((h) => (<option key={h.value} value={h.value}>{h.label}</option>))}
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-soft">
            <span className="mb-1 block">Consumo (janela)</span>
            <select className="field" value={semanas} onChange={(e) => setSemanas(Number(e.target.value))}>
              {JANELAS.map((j) => (<option key={j.value} value={j.value}>{j.label}</option>))}
            </select>
          </label>
          <button onClick={() => window.print()} className="btn btn-ghost">{Icon.report(16)} Imprimir</button>
          <button onClick={exportar} className="btn btn-brand" disabled={dados.itens.length === 0}>
            {Icon.report(16)} Exportar CSV
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="card px-4 py-3">
          <div className="font-display text-2xl font-bold">{dados.total_itens}</div>
          <div className="text-xs text-ink-faint">itens a comprar</div>
        </div>
        <div className="card px-4 py-3">
          <div className="font-display text-2xl font-bold">{brl(dados.custo_total_estimado)}</div>
          <div className="text-xs text-ink-faint">custo total estimado</div>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-ink-faint">Calculando…</div>
      ) : dados.itens.length === 0 ? (
        <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
          <span className="mb-2 text-ink-faint">{Icon.box(40)}</span>
          <p className="font-display text-lg font-bold">Nada a comprar</p>
          <p className="text-sm text-ink-faint">Estoque suficiente para o horizonte escolhido. 🎉</p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {grupos.map((g) => (
            <div key={g.nome} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-surface-2/50 px-4 py-2.5">
                <span className="font-display font-bold">{g.nome}</span>
                <span className="font-mono text-sm text-ink-soft">{brl(g.subtotal)}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2 text-right">Saldo</th>
                    <th className="px-4 py-2 text-right">Mínimo</th>
                    <th className="px-4 py-2 text-right">Consumo/sem</th>
                    <th className="px-4 py-2 text-right">Comprar</th>
                    <th className="px-4 py-2 text-right">Custo est.</th>
                  </tr>
                </thead>
                <tbody>
                  {g.itens.map((it) => (
                    <tr key={it.produto} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2 font-medium">{it.produto_nome}</td>
                      <td className="px-4 py-2 text-right font-mono">{it.saldo}</td>
                      <td className="px-4 py-2 text-right font-mono text-ink-faint">{it.estoque_minimo}</td>
                      <td className="px-4 py-2 text-right font-mono text-ink-faint">{it.consumo_semanal}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">{it.sugerido} {it.unidade}</td>
                      <td className="px-4 py-2 text-right font-mono">{it.custo_estimado ? brl(it.custo_estimado) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Ligar no `DashboardPage.jsx`.**

(a) Acrescentar o import após `import MovimentacoesView from "../components/MovimentacoesView"`:
```js
import ComprasView from "../components/ComprasView"
```

(b) Inserir a aba "Compras" no array `TABS`, após "Movimentações":
```js
const TABS = [
  { key: "geral", label: "Visão Geral" },
  { key: "inv", label: "Inventário" },
  { key: "forn", label: "Fornecedores" },
  { key: "mov", label: "Movimentações" },
  { key: "compras", label: "Compras" },
  { key: "sol", label: "Solicitações" },
]
```

(c) Renderizar a aba — após o bloco `{tab === "mov" && ( ... )}`, adicionar:
```jsx
              {tab === "compras" && <ComprasView />}
```

- [ ] **Step 3: Verificar build + vitest**

Run (em `frontend/`): `npm run build` → Expected: sem erros.
Run (em `frontend/`): `npx vitest run` → Expected: PASS.

- [ ] **Step 4: Verificação manual (servidores no ar)**

1. Backend: `.venv\Scripts\python manage.py runserver`
2. Front: `npm run dev`
3. Conferir: aba Compras lista itens com `sugerido > 0` agrupados por fornecedor; mudar o horizonte recalcula; "Exportar CSV" baixa o arquivo; "Imprimir" abre o diálogo de impressão; quando não há nada a comprar, mostra o estado vazio.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ComprasView.jsx frontend/src/pages/DashboardPage.jsx
git commit -m "feat(front): aba Compras (sugestão agrupada + export CSV/imprimir)"
```

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura do spec:**
- Serviço `sugerir_compras` (agregação única, fórmula consumo×horizonte+mínimo−saldo, ignora não-consumo, arredondamento) → Task 1 ✓
- Endpoint `/api/sugestao-compras/` com params + defaults → Task 2 ✓
- Camada `comprasApi` (http + mock que recalcula) + util CSV → Task 3 ✓
- Aba Compras: controles horizonte/janela, tabela agrupada por fornecedor, resumo, exportar CSV + imprimir, estado vazio → Task 4 ✓
- Sem modelo/migração → respeitado ✓
- Tratamento de erros (params inválidos→default; falha de rede→toast) → Tasks 2 (default), 4 (toast) ✓

**Sem placeholders:** todo passo mostra o código completo.

**Consistência de tipos:** o contrato do item (`produto`, `produto_nome`, `saldo`, `estoque_minimo`, `consumo_semanal`, `sugerido`, `unidade`, `fornecedor_nome`, `preco`, `custo_estimado`) é idêntico entre o serviço (Task 1), o mock (Task 3) e a `ComprasView` (Task 4); `comprasApi.sugerir({horizonte,semanas})` consistente entre http (Task 3), mock (Task 3) e uso (Task 4); strings numéricas (ex.: "8.000", "4.00") batem entre backend e mock.
