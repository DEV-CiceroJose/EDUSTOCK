# Controle de Fornecedores — Design (Sub-projeto B)

**Data:** 2026-06-04
**Projeto:** Gestor Escolar (EasyStock)
**Status:** Aprovado para implementação
**Depende de:** Sub-projeto A (Fundação do modelo — Categoria→Grupo→Produto + BemPermanente),
já mergeado na `main`.
**Origem:** Entrevista com Alberes — necessidade de identificar fornecedores regularizados
(emitem nota fiscal) e os que vendem "fiado" quando há atraso de verba governamental.

---

## 1. Contexto e objetivo

A escola compra de fornecedores com perfis diferentes: uns **emitem nota fiscal** (formais,
úteis para a prestação de contas à GRE), outros aceitam vender **fiado** quando a verba
atrasa. Hoje não há cadastro de fornecedores — o `Produto` guarda apenas um
`numero_nota_fiscal` em texto livre.

Este sub-projeto entrega o **cadastro de Fornecedores** e um **vínculo simples
Produto→Fornecedor**, dando base para a lista de compras (C) e os relatórios da GRE (D).

### Posição na decomposição

| Bloco | Status | Entrega |
|---|---|---|
| A — Fundação | ✅ feito | Categoria→Grupo→Produto, BemPermanente, API, dashboard |
| **B — Fornecedores** *(este doc)* | — | Cadastro NF/fiado + `Produto.fornecedor` + tela de gestão |
| C — Movimentações + Compras + Alertas | futuro | Entradas/saídas (com NF por recebimento), lista de compras |
| D — Relatórios GRE | futuro | Organizar NFs/documentos, exportar |

---

## 2. Escopo

**Dentro:**
- Modelo `Fornecedor` (com flags independentes `emite_nota_fiscal` e `aceita_fiado`).
- Campo `Produto.fornecedor` (FK opcional, `PROTECT`).
- Migração de schema (sem data migration — produtos existentes ficam com fornecedor nulo).
- API REST aditiva (`/api/fornecedores/`) + `fornecedor`/`fornecedor_nome` no `ProdutoSerializer`.
- Frontend: **nova aba "Fornecedores"** (lista + criar/editar + filtros + ativar/desativar),
  seletor de fornecedor no formulário de produto, linha "Fornecedor" nos detalhes do item.

**Fora (próximos ciclos):**
- "Entradas"/recebimentos detalhados (NF por compra, itens recebidos) → bloco C.
- Migração do `numero_nota_fiscal` para registros de entrada → bloco C. Nesta fase ele
  **permanece** como texto livre no Produto.
- Lista de compras automatizada e relatórios da GRE.

---

## 3. Modelo de dados

### `Fornecedor` (novo)
| Campo | Tipo / regra |
|---|---|
| `nome` | CharField(200), obrigatório |
| `documento` | CharField(20), blank (CNPJ/CPF; informais podem não ter) |
| `endereco` | CharField(200), blank |
| `telefone` | CharField(20), blank |
| `email` | EmailField, blank |
| `emite_nota_fiscal` | BooleanField, default **True** |
| `aceita_fiado` | BooleanField, default **False** |
| `ativo` | BooleanField, default **True** (desativar em vez de excluir) |
| `observacao` | TextField, blank |
| `criado_por` / `atualizado_por` | FK User, SET_NULL, null (auditoria) |
| `criado_em` / `atualizado_em` | DateTime (auto) |

`Meta`: `ordering = ["nome"]`, `verbose_name = "Fornecedor"`,
`verbose_name_plural = "Fornecedores"`. `__str__` retorna `nome`.

### `Produto.fornecedor` (novo campo)
- `ForeignKey(Fornecedor, on_delete=PROTECT, null=True, blank=True, related_name="produtos")`
- `PROTECT` impede excluir um fornecedor vinculado a produtos (preserva histórico para a
  prestação de contas); para "remover" um fornecedor, usa-se `ativo=False`.
- `numero_nota_fiscal` **permanece** inalterado nesta fase.

---

## 4. Migração

Uma única migração de schema (`core/migrations/0007_fornecedor.py`, gerada por
`makemigrations`):
- `CreateModel Fornecedor`
- `AddField produto.fornecedor` (nullable FK, PROTECT)

Sem data migration: os 8 produtos existentes ficam com `fornecedor = NULL` e são atribuídos
manualmente pelo painel. Sem perda de dados; reversível pelo próprio Django.

---

## 5. API (DRF) — aditiva

- Nova rota: `GET/POST/PATCH/DELETE /api/fornecedores/`. Demais rotas inalteradas.
- `FornecedorSerializer`: todos os campos do modelo (`criado_em`/`atualizado_em` read-only).
- `FornecedorViewSet` (`ModelViewSet`):
  - `search_fields = ["nome", "documento"]` (busca via `?search=`).
  - Filtros por query param: `?emite_nota_fiscal=`, `?aceita_fiado=`, `?ativo=`.
  - `perform_create`/`perform_update` preenchem a auditoria com o usuário logado.
- `ProdutoSerializer`: adiciona `fornecedor` (id, gravável, opcional) e `fornecedor_nome`
  (read-only, via `fornecedor.nome`; `None` quando sem fornecedor).
- `ProdutoViewSet`: acrescenta `"fornecedor"` ao `select_related` (evita N+1) e filtro
  opcional `?fornecedor=`.
- Excluir fornecedor em uso → `ProtectedError` → a API responde com erro; o front orienta a
  desativar.

---

## 6. Frontend (Abordagem 1 — aba Fornecedores)

- **Nova aba "Fornecedores"** no array `TABS` do `DashboardPage` (5ª aba), usando o `Tabs`.
- **`FornecedoresView`** (conteúdo da aba):
  - Cabeçalho com botão "Novo fornecedor".
  - Chips de filtro: Todos · Emite NF · Aceita fiado · Inativos (estado local; filtra a lista).
  - Lista de cards de fornecedor: nome, documento, **badges** (NF / Fiado / Inativo),
    contato (telefone/e-mail), endereço. Ações: Editar, Ativar/Desativar (toggle do `ativo`
    via PATCH), Excluir.
- **`FornecedorFormModal`** (criar/editar): nome, documento, endereço, telefone, e-mail,
  checkboxes `emite_nota_fiscal`/`aceita_fiado`, `ativo`, observação. Validação: `nome`
  obrigatório.
- **Exclusão**: `ConfirmDialog`; se a API retornar erro de proteção (fornecedor em uso),
  mostra toast orientando a desativar.
- **Integração no inventário:**
  - `ProductFormModal`: novo seletor opcional "Fornecedor" listando fornecedores **ativos**.
  - `DetailsModal`: nova linha "Fornecedor" (`fornecedor_nome` ou "—").
  - `ProductCard`: mantém-se enxuto (sem fornecedor) para não poluir.
- **Camada de dados:** `fornecedoresApi` (cliente HTTP real + mock espelhando o contrato),
  exportado em `api/index.js`. O `normalize` do mock e o payload do formulário passam a
  incluir `fornecedor`.

Reusa os primitivos existentes (Tabs, Modal, ConfirmDialog, Toast, padrão card/tag) e o
sistema visual sálvia/creme.

---

## 7. Tratamento de erros

- Validação no formulário de fornecedor: `nome` obrigatório; e-mail validado pelo `type=email`.
- Excluir fornecedor vinculado a produtos é bloqueado por `PROTECT`; a API retorna erro e o
  front exibe toast claro ("Fornecedor vinculado a produtos — desative em vez de excluir").
- Erros gerais da API exibidos como toasts (mecanismo existente).

---

## 8. Estratégia de testes (TDD)

- **Modelo:** criação de `Fornecedor` com defaults (`emite_nota_fiscal=True`,
  `aceita_fiado=False`, `ativo=True`); `Produto` aceita `fornecedor` nulo e vinculado;
  `PROTECT` ao excluir fornecedor em uso (`ProtectedError`).
- **API:** CRUD de `/api/fornecedores/`; filtros `?ativo=`/`?aceita_fiado=`; `ProdutoSerializer`
  expõe `fornecedor` e `fornecedor_nome`; criar produto com `fornecedor`.
- **Frontend (Vitest):** se surgir lógica pura de filtro dos chips, testar isoladamente;
  caso contrário, verificar via build. (UI verificada por build + checagem manual.)

---

## 9. Itens em aberto / próximos ciclos

- "Entradas"/recebimentos com NF por compra → bloco C (substituirão o `numero_nota_fiscal`
  de texto livre do Produto).
- Lista de compras automatizada (consumo médio + fornecedor preferencial) → bloco C.
- Relatórios de prestação de contas agrupados por fornecedor → bloco D.
- Branch de execução: `feat/fornecedores`, ramificada da `main` (com A já mergeado).
