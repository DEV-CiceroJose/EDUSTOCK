# Lista de Compras Automatizada — Design (Sub-bloco C2)

**Data:** 2026-06-04
**Projeto:** Gestor Escolar (EasyStock)
**Status:** Aprovado para implementação
**Depende de:** A (Produto, `estoque_minimo`), B (Fornecedor), C1 (Movimentacao SAÍDA com
`motivo`) — todos mergeados na `main`.
**Origem:** Entrevista — sugerir ao gestor a lista de compras da semana com base no consumo
médio + estoque atual + estoque mínimo.

---

## 1. Contexto e objetivo

O C1 passou a registrar cada saída de estoque como `Movimentacao(tipo=SAIDA, motivo=...)`. Com
esse histórico, o C2 calcula, por produto, o **consumo médio semanal** (das saídas de consumo)
e sugere **quanto comprar** para cobrir o consumo previsto mais a margem do estoque mínimo. A
sugestão é apresentada numa tela e pode ser **exportada** (CSV/impressão) para levar à compra.

### Posição na decomposição do bloco C

| Sub-bloco | Status | Entrega |
|---|---|---|
| C1 — Movimentações | ✅ feito | Entradas/saídas, saldo por journal |
| **C2 — Lista de compras** *(este doc)* | — | Sugestão de compra por consumo médio + tela + export |
| C3 — Alertas refinados | futuro | Validade + estoque crítico em painel dedicado |

---

## 2. Escopo

**Dentro:**
- Serviço `sugerir_compras(horizonte, semanas)` (cálculo, agregação única, sem N+1).
- Endpoint read-only `GET /api/sugestao-compras/` (params `horizonte`, `semanas`).
- Frontend: aba **Compras** com tabela agrupada por fornecedor, resumo, e exportar CSV/imprimir.

**Fora (próximos ciclos):**
- "Pedido de compra" persistido (modelo) → futuro/bloco D.
- Edição manual das quantidades sugeridas antes de exportar (a tela é read-only no C2).
- Alertas refinados → C3. Relatórios GRE → D.

---

## 3. Backend — cálculo + endpoint

### Serviço `core/compras.py` (arquivo novo)
`sugerir_compras(*, horizonte=1, semanas=4)`:
1. `janela_inicio = timezone.localdate() - timedelta(days=semanas * 7)`.
2. Agregação única: `Movimentacao.objects.filter(tipo=SAIDA, motivo="consumo",
   data__gte=janela_inicio).values("produto").annotate(total=Sum("quantidade"))` →
   `consumo_total` por produto.
3. Para cada `Produto` (com `select_related("grupo", "fornecedor")`):
   - `consumo_semanal = consumo_total / semanas` (0 se sem consumo).
   - `sugerido = max(0, consumo_semanal * horizonte + estoque_minimo - quantidade)`.
   - Inclui o item somente se `sugerido > 0`.
4. Arredonda `consumo_semanal` e `sugerido` a 3 casas (`Decimal.quantize("0.001")`).
5. Cada item: `produto`, `produto_nome`, `unidade`, `saldo` (=quantidade), `estoque_minimo`,
   `consumo_semanal`, `sugerido`, `fornecedor`, `fornecedor_nome`, `preco`,
   `custo_estimado` (= `sugerido * preco`, ou `None` se sem preço).
6. Ordena por `fornecedor_nome` (nulos por último) e depois `produto_nome`.
Retorna `{ "itens": [...], "total_itens": N, "custo_total_estimado": "NN.NN" }`.

### Endpoint `core/api_views.py`
`SugestaoComprasView(APIView)` — `get`:
- Lê `horizonte` e `semanas` dos query params; converte para inteiro positivo, com defaults
  `1` e `4` (valor inválido/ausente → default).
- Chama `sugerir_compras(...)` e devolve o dict acima (DRF `Response`).
- Rota: `path("sugestao-compras/", SugestaoComprasView.as_view(), name="sugestao-compras")`
  adicionada em `core/api_urls.py` (além das rotas do router).

> Sem modelo nem migração — a sugestão é derivada do estado atual.

---

## 4. Frontend — aba Compras

- **Nova aba "Compras"** no array `TABS` do `DashboardPage` (após "Movimentações").
- **`ComprasView`**:
  - Busca via `comprasApi.sugerir({ horizonte, semanas })` ao montar e ao mudar os controles.
  - **Controles:** seletor de horizonte (1/2/4 semanas) e de janela (4/8 semanas) — chips ou selects.
  - **Resumo:** total de itens a comprar + custo total estimado (`brl`).
  - **Tabela agrupada por fornecedor** (cabeçalho por fornecedor + subtotal): produto, saldo,
    mínimo, consumo/semana, **comprar** (`sugerido` + unidade), custo estimado.
  - **Exportar CSV** (Blob client-side, `;`-separado, cabeçalho em PT-BR) e **Imprimir**
    (`window.print()`; estilo de impressão simples).
  - **Estado vazio:** "Nada a comprar — estoque suficiente."
- **Camada de dados:** `comprasApi` (HTTP: `GET /sugestao-compras/?horizonte=&semanas=`; mock:
  recalcula a mesma sugestão a partir do journal + produtos locais, espelhando o contrato).

Reusa Tabs, cards, chips, Toast e o sistema visual sálvia/creme. Sem modais novos.

---

## 5. Tratamento de erros

- Params inválidos no endpoint → caem nos defaults (nunca 500).
- Sem consumo registrado → `consumo_semanal = 0`; itens só aparecem se o mínimo já exige
  reposição (`estoque_minimo - saldo > 0`).
- Falha de rede no front → toast de erro; a tabela mostra estado vazio/erro.

---

## 6. Estratégia de testes (TDD)

- **Serviço:** consumo médio correto na janela; **ignora** saídas com motivo ≠ "consumo"
  (perda/ajuste) e entradas; `sugerido` = consumo×horizonte + mínimo − saldo; item com saldo
  suficiente fica fora; `custo_estimado` = sugerido × preço (e `None` sem preço).
- **Endpoint:** defaults aplicados; `?horizonte=2` muda o resultado; resposta tem
  `itens`/`total_itens`/`custo_total_estimado`.
- **Frontend (Vitest):** se houver lógica pura (ex.: montagem do CSV), testar isolada; UI por
  build + checagem manual.

---

## 7. Itens em aberto / próximos ciclos

- Ajuste manual das quantidades + "gerar pedido" persistido → futuro.
- Alertas refinados (validade/estoque crítico) → C3.
- Relatórios de prestação de contas (agrupar entradas/NFs por fornecedor) → D.
- Branch de execução: `feat/lista-compras`, ramificada da `main` (A + B + C1).
