# Movimentações de Estoque — Design (Sub-projeto C1)

**Data:** 2026-06-04
**Projeto:** Gestor Escolar (EasyStock)
**Status:** Aprovado para implementação
**Depende de:** A (Categoria→Grupo→Produto, estoque_minimo, perecivel, periodicidade) e
B (Fornecedor, Produto.fornecedor) — ambos mergeados na `main`.
**Origem:** Entrevista — registrar entradas (recebimentos com NF/fornecedor) e saídas/consumo,
gerando o histórico que alimenta a lista de compras (C2) e a prestação de contas (D).

---

## 1. Contexto e objetivo

Hoje a `quantidade` do produto é um número editável direto (o +/- no card faz PATCH) e o
`numero_nota_fiscal` é texto livre no Produto. Este sub-bloco introduz um **livro-razão de
movimentações** que passa a ser a fonte do histórico de estoque: toda mudança de saldo vira
uma movimentação (entrada ou saída), e os recebimentos são agrupados em **documentos de
entrada** (fornecedor + NF + data + itens).

### Posição na decomposição do bloco C

| Sub-bloco | Status | Entrega |
|---|---|---|
| **C1 — Movimentações** *(este doc)* | — | Entradas (documento + itens) e saídas; saldo movido por movimentações; histórico |
| C2 — Lista de compras automatizada | futuro | Consumo médio semanal (do histórico) → sugestão de compras |
| C3 — Alertas refinados | futuro | Validade próxima + estoque crítico em painel dedicado |

---

## 2. Escopo

**Dentro:**
- Modelos `Entrada` (documento) e `Movimentacao` (journal); serviço de saldo transacional.
- `Produto.quantidade` torna-se **somente-leitura na API** (muda apenas via movimentações/migração).
- Migração de schema + data migration (movimentação de "saldo inicial" por produto).
- API: `/api/movimentacoes/` (GET + POST, append-only) e `/api/entradas/` (GET + POST com itens
  aninhados, append-only).
- Frontend completo: aba **Movimentações** (histórico filtrável), **Nova entrada**
  (fornecedor/NF/itens com total), **Registrar saída** (produto/quantidade/motivo); o +/- do
  card vira movimentação; formulário de produto com "quantidade inicial" (só na criação) e sem
  o campo de NF; detalhes mostram "NF (legado)" quando existir.

**Fora (próximos sub-blocos):**
- Lista de compras por consumo médio → C2. Alertas refinados → C3.
- Edição/exclusão de movimentações (livro é append-only; correção via nova movimentação).
- Estorno de entrada com reversão de saldo (pode ser adicionado depois).

---

## 3. Modelo de dados

### `Entrada` (documento de recebimento)
| Campo | Tipo / regra |
|---|---|
| `fornecedor` | FK → Fornecedor, `on_delete=PROTECT`, null/blank |
| `numero_nota_fiscal` | CharField(20), blank |
| `data` | DateField, default = hoje |
| `observacao` | TextField, blank |
| `criado_por` | FK User, SET_NULL, null |
| `criado_em` | DateTime (auto) |

`Meta.ordering = ["-data", "-id"]`. Propriedade `total` = soma de `quantidade * preco_unitario`
das suas movimentações.

### `Movimentacao` (journal — fonte do histórico)
| Campo | Tipo / regra |
|---|---|
| `produto` | FK → Produto, `on_delete=PROTECT`, related_name="movimentacoes" |
| `tipo` | CharField choices **ENTRADA / SAIDA** |
| `quantidade` | Decimal(10,3), positiva (magnitude) |
| `preco_unitario` | Decimal(10,2), null/blank (usado em entradas) |
| `entrada` | FK → Entrada, null/blank, `on_delete=CASCADE`, related_name="itens" |
| `motivo` | CharField(120), blank (ex.: "consumo", "perda", "ajuste", "saldo inicial") |
| `data` | DateField, default = hoje |
| `criado_por` | FK User, SET_NULL, null |
| `criado_em` | DateTime (auto) |

`Meta.ordering = ["-data", "-id"]`.

**Regras (decididas no brainstorming):**
1. Sem tipo "AJUSTE": correções são ENTRADA/SAÍDA com `motivo="ajuste"`.
2. Append-only: sem edição/exclusão de movimentação avulsa pela API.
3. `produto` com `PROTECT`: excluir produto com movimentações é bloqueado.
4. `entrada` com `CASCADE`: as movimentações-item pertencem ao documento (mas entradas também
   são append-only no C1, então isso só vale para limpeza administrativa/testes).

### Serviço de saldo — `core/services.py`
- `registrar_movimentacao(*, produto, tipo, quantidade, motivo="", preco_unitario=None, entrada=None, data=None, user=None)`:
  dentro de `transaction.atomic()`, cria a `Movimentacao` e ajusta `produto.quantidade`
  (`+quantidade` se ENTRADA, `−quantidade` se SAÍDA), com `select_for_update` no produto.
  Levanta `django.core.exceptions.ValidationError` se SAÍDA deixaria o saldo negativo, ou se
  `quantidade <= 0`.
- `registrar_entrada(*, fornecedor, numero_nota_fiscal, data, observacao, itens, user)`: cria a
  `Entrada` e, para cada item (`{produto, quantidade, preco_unitario}`), chama
  `registrar_movimentacao(tipo=ENTRADA, entrada=<header>)`. Tudo em uma transação.

### Mudança no `Produto`
- `numero_nota_fiscal` **permanece** no banco (dado legado), mas sai do fluxo de cadastro.
- `quantidade` permanece como campo do model (saldo), mas vira **read-only no serializer**.

---

## 4. Migração

`core/migrations/0008_movimentacoes.py` (schema) cria `Entrada` + `Movimentacao`.
Data migration (mesma ou seguinte):
1. Para cada produto com `quantidade > 0`, cria uma `Movimentacao(tipo=ENTRADA,
   motivo="saldo inicial", quantidade=quantidade_atual, data=hoje)`.
2. **Inserida direto via ORM (sem o serviço de saldo)** — `produto.quantidade` NÃO é alterado
   (o saldo já reflete o valor); a movimentação apenas documenta o ponto de partida.
3. `reverse`: remove as movimentações com `motivo="saldo inicial"`.

Sem perda de dados.

---

## 5. API (DRF) — aditiva

- `MovimentacaoSerializer`: `id`, `produto`, `produto_nome` (read), `tipo`, `quantidade`,
  `preco_unitario`, `entrada`, `motivo`, `data`, `criado_em`.
- `MovimentacaoViewSet`: **somente** `list`/`retrieve`/`create` (sem update/delete).
  `create` chama `registrar_movimentacao` (valida saldo). Filtros: `?produto=`, `?tipo=`,
  `?data_de=`, `?data_ate=`. `select_related("produto", "entrada")`.
- `EntradaItemSerializer`: `produto`, `produto_nome` (read), `quantidade`, `preco_unitario`.
- `EntradaSerializer`: `id`, `fornecedor`, `fornecedor_nome` (read), `numero_nota_fiscal`,
  `data`, `observacao`, `itens` (nested, write+read), `total` (read), `criado_em`. O `create`
  chama `registrar_entrada`.
- `EntradaViewSet`: `list`/`retrieve`/`create` (append-only). `prefetch_related("itens__produto")`,
  `select_related("fornecedor")`.
- `ProdutoSerializer`: `quantidade` passa a `read_only`. Demais campos inalterados.
- Erros de saldo (SAÍDA > estoque) retornam 400 com mensagem clara → toast no front.

---

## 6. Frontend (escopo completo)

- **Aba "Movimentações"** (substitui o placeholder): histórico filtrável (produto/tipo/período)
  em lista; cada linha com produto, badge entrada/saída, quantidade, motivo, data e, em
  entradas, fornecedor/NF. Botões "Nova entrada" e "Registrar saída".
- **`EntradaFormModal`**: fornecedor (ativos), NF, data, observação + linhas de item dinâmicas
  (produto + quantidade + preço unitário; adicionar/remover) com total ao vivo. Salva via
  `entradasApi.create` (POST com `itens`), recarrega produtos e histórico.
- **`SaidaFormModal`**: produto, quantidade, motivo (consumo/perda/ajuste/outro). Bloqueia
  quantidade > saldo (validação local + erro da API).
- **Card +/-**: `ajustar` passa a criar uma movimentação (ENTRADA +1 / SAÍDA −1, motivo "ajuste
  rápido") via `movimentacoesApi.create`; atualização otimista + refetch.
- **Formulário de produto:** o campo "Quantidade" vira **"quantidade inicial"**, editável apenas
  na criação; ao criar, o front lança a movimentação de saldo inicial (cria o produto e, se
  inicial > 0, posta uma ENTRADA "saldo inicial"). Na edição, o campo de quantidade sai (nota:
  "ajuste o estoque por movimentações"). O campo `numero_nota_fiscal` sai do formulário.
- **`DetailsModal`**: mostra "NF (legado)" quando `produto.numero_nota_fiscal` existir; o
  histórico do item fica acessível pela aba Movimentações filtrada por produto.
- **Camada de dados:** `movimentacoesApi` + `entradasApi` (HTTP real + mock que simula o journal,
  ajusta os saldos dos produtos e espelha o contrato — incluindo o total da entrada). KEY do
  mock sobe para `v4`.

---

## 7. Tratamento de erros

- SAÍDA maior que o saldo: serviço levanta `ValidationError` → API 400 → toast no front; o
  `SaidaFormModal` também valida localmente (`quantidade <= saldo`).
- `quantidade <= 0`: rejeitada pelo serviço e pela validação do form.
- Excluir produto com movimentações: bloqueado por `PROTECT` → toast claro.
- Entrada sem itens: rejeitada (pelo menos um item válido).

---

## 8. Estratégia de testes (TDD)

- **Serviço:** ENTRADA soma ao saldo; SAÍDA subtrai; SAÍDA > saldo levanta `ValidationError`
  (saldo inalterado); `registrar_entrada` cria N movimentações e soma os saldos atomicamente.
- **Migração:** produtos com saldo > 0 ganham uma movimentação "saldo inicial" e o saldo NÃO
  muda; reverse remove essas movimentações.
- **API:** POST `/api/movimentacoes/` (entrada/saída) reflete no saldo do produto; POST
  `/api/entradas/` com itens cria o documento + movimentações + total; movimentações são
  append-only (PUT/DELETE → 405); `ProdutoSerializer.quantidade` é read-only (PATCH não muda
  o saldo).
- **Frontend (Vitest):** lógica pura, se houver (ex.: cálculo do total da entrada); UI por build
  + checagem manual.

---

## 9. Itens em aberto / próximos ciclos

- Lista de compras por consumo médio semanal (usa as SAÍDAS de motivo "consumo") → C2.
- Alertas refinados de validade/estoque crítico → C3.
- Estorno/edição de entradas com reversão de saldo (pós-C1, se necessário).
- Eventual remoção definitiva do `numero_nota_fiscal` legado do Produto (após D consolidar a NF
  nas entradas).
- Branch de execução: `feat/movimentacoes`, ramificada da `main` (A + B).
