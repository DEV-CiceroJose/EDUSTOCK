# Fundação do Modelo de Estoque — Design (Sub-projeto A)

**Data:** 2026-06-03
**Projeto:** Gestor Escolar (EasyStock)
**Status:** Aprovado para implementação
**Origem:** Entrevista com Alberes (assistente de gestão) sobre a transição do controle
manual (Excel/papel) para um sistema digital de estoque escolar.

---

## 1. Contexto e objetivo

O sistema já tem backend Django (modelos `Categoria` e `Produto`, API REST/DRF) e um
dashboard React funcional. A entrevista revelou necessidades que exigem evoluir o **modelo
de dados** antes de construir as features de maior valor (lista de compras, relatórios da
GRE, alertas refinados).

Este sub-projeto (**A — Fundação**) entrega a base de dados sobre a qual os próximos ciclos
(B — Fornecedores, C — Movimentações/Compras/Alertas, D — Relatórios GRE) serão construídos.

### Decomposição do projeto maior (referência)

| Bloco | Depende de | Entrega |
|---|---|---|
| **A — Fundação do modelo** *(este doc)* | — | Bem consumo vs permanente, categorias em 2 níveis, estoque mínimo, perecível, periodicidade |
| B — Fornecedores | A | Cadastro com NF/fiado, vínculo às entradas |
| C — Movimentações + Compras + Alertas | A, B | Entradas/saídas, lista de compras por consumo médio, alertas |
| D — Relatórios prestação de contas (GRE) | A, B, C | Organizar NFs/documentos, exportar |

**Fora de escopo agora** (marcados "não importante" pelo usuário): app de contagem de alunos,
interface de merendeiras, integração com sistemas estaduais.

---

## 2. Escopo do sub-projeto A

**Dentro:**
- Hierarquia de categorias em 2 níveis: `Categoria → Grupo`.
- Evolução do `Produto` (item de consumo): vínculo a `Grupo`, `estoque_minimo`, `perecivel`,
  `periodicidade`, `quantidade` em Decimal.
- Novo modelo `BemPermanente` (cadastro leve) + API. **Sem UI nesta fase.**
- Data migration preservando os dados atuais.
- Ajuste do front: formulário de item (seletor de Grupo + novos campos) e status de estoque
  por `estoque_minimo`.
- Correções de dívida técnica já mapeadas: `quantidade` Float→Decimal, `on_delete=PROTECT`,
  fim do limiar fixo `LIMITE_BAIXO=15`.

**Fora (próximos ciclos):**
- Tela (UI) de Bens Permanentes.
- Fornecedores, movimentações, lista de compras, relatórios, alertas avançados.

---

## 3. Modelo de dados

### `Categoria` (nível topo)
Ex.: Alimentos, Limpeza, Papelaria.
- `nome` — CharField(100), único.

### `Grupo` (nível 2)
Ex.: Carboidratos, Leguminosas (dentro de Alimentos).
- `nome` — CharField(100)
- `categoria` — FK → `Categoria`, `on_delete=PROTECT`
- Constraint: único por (`categoria`, `nome`).

### `Produto` (item de consumo — evolui o modelo atual)
| Campo | Tipo / regra | Mudança |
|---|---|---|
| `nome` | CharField(200) | mantém |
| `grupo` | FK → `Grupo`, `on_delete=PROTECT` | **novo** (substitui FK direto p/ Categoria) |
| `quantidade` | Decimal(10,3) | Float → **Decimal** |
| `unidade` | choices UN/KG/L/CX/PC | mantém |
| `estoque_minimo` | Decimal(10,3), default 0 | **novo** (substitui limiar fixo do front) |
| `perecivel` | Boolean, default False | **novo** |
| `periodicidade` | choices SEMANAL/MENSAL/EVENTUAL, default EVENTUAL | **novo** |
| `validade` | Date, null/blank | mantém |
| `preco` | Decimal(10,2), null/blank | mantém |
| `numero_nota_fiscal` | CharField(12), null/blank | mantém (vincula a Fornecedor em B/C) |
| `criado_por`/`atualizado_por`/`criado_em`/`atualizado_em` | auditoria | mantém |

> A categoria é derivada via `produto.grupo.categoria` — não duplicar o vínculo.

### `BemPermanente` (cadastro leve, separado — só modelo + API nesta fase)
- `nome` — CharField(200)
- `numero_patrimonio` — CharField(50), null/blank, único quando presente
- `localizacao` — CharField(150) (sala/setor)
- `responsavel` — CharField(150) (texto livre; nem sempre é usuário do sistema)
- `estado_conservacao` — choices NOVO / BOM / REGULAR / RUIM / INSERVIVEL
- `data_aquisicao` — Date, null/blank
- `observacao` — TextField, null/blank
- auditoria (mesmos campos do Produto)

---

## 4. Migração dos dados existentes

Data migration do Django, automática e reversível:

1. Para cada `Categoria` existente, criar um `Grupo` **"Geral"** dentro dela.
2. Repontar cada `Produto` para o "Geral" da sua categoria atual.
3. Converter `quantidade` Float → Decimal (valores preservados).
4. Defaults seguros: `estoque_minimo=0`, `perecivel=False`, `periodicidade=EVENTUAL`.
5. `reverse`: reaponta `produto.grupo.categoria` de volta ao FK de categoria, removendo os
   grupos "Geral" criados.

Após a migração, o usuário reorganiza pelo painel (cria grupos reais e move os itens).
Nenhum dado é perdido; o sistema segue operante durante a transição.

---

## 5. API (DRF) — aditiva

- Novas rotas: `GET/POST /api/grupos/`, `GET/POST/PATCH/DELETE /api/bens-permanentes/`.
  Mantidas: `/api/categorias/`, `/api/produtos/`.
- `GrupoSerializer`: `id`, `nome`, `categoria`, `categoria_nome`.
- `ProdutoSerializer` (atualizado): inclui `grupo`, `grupo_nome`, `categoria_nome`
  (via `grupo.categoria`), `estoque_minimo`, `perecivel`, `periodicidade`.
- `BemPermanenteSerializer`: todos os campos do modelo.
- `ProdutoViewSet`: `select_related("grupo__categoria", "criado_por", "atualizado_por")`
  (evita N+1); filtros por `grupo` e por `grupo__categoria`; busca por `nome` (mantida).
- `GrupoViewSet`, `BemPermanenteViewSet`: ModelViewSet padrão.

---

## 6. Impacto no Frontend (React)

- **Formulário de item:** seletor de Categoria → seletor de **Grupo**, agrupado por categoria
  com `<optgroup>`. Novos campos: `estoque mínimo`, `perecível` (checkbox), `periodicidade`.
- **Status de estoque:** `stockStatus` passa a usar `item.estoque_minimo`
  (`quantidade <= 0` → Esgotado; `<= estoque_minimo` → Baixo; senão Em Estoque). Remover
  `LIMITE_BAIXO` de `lib/format.js`.
- **Coluna de categorias:** mantém filtro por categoria; ao expandir uma categoria, lista os
  **grupos** dentro; selecionar categoria ou grupo filtra a grade. Card do produto passa a
  exibir o grupo.
- **Bens Permanentes:** sem UI nesta fase (modelo + API apenas).

---

## 7. Tratamento de erros

- Validação no formulário: `grupo` obrigatório; `quantidade` e `estoque_minimo` ≥ 0.
- Erros da API (DRF) exibidos como toasts (mecanismo já existente).
- Excluir `Categoria`/`Grupo` em uso é bloqueado por `PROTECT`; a API retorna erro claro e o
  front mostra mensagem amigável.

---

## 8. Estratégia de testes (TDD)

Testes escritos antes da implementação (sub-projeto seguinte: writing-plans):
- **Data migration:** todos os produtos preservam quantidade e ficam vinculados a um grupo
  "Geral"; `reverse` restaura o estado anterior.
- **Constraints:** unicidade (categoria+nome) em Grupo; `numero_patrimonio` único.
- **Serializers:** `ProdutoSerializer` expõe `grupo_nome` e `categoria_nome` corretos.
- **Status de estoque:** lógica por `estoque_minimo` cobrindo os 3 estados.

---

## 9. Itens em aberto / próximos ciclos

- UI de Bens Permanentes (fase futura).
- `numero_nota_fiscal` será migrado para um vínculo com `Fornecedor`/entrada no bloco B/C.
- Periodicidade alimentará a lista de compras automatizada no bloco C.
