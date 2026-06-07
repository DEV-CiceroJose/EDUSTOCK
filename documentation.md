# EduStock — Documentação Técnica Completa

> Sistema de gestão de estoque escolar desenvolvido com Django (backend) e React (frontend).

---

## Sumário

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Estrutura de Pastas](#3-estrutura-de-pastas)
4. [Configuração e Instalação](#4-configuração-e-instalação)
5. [Backend — Django](#5-backend--django)
   - 5.1 [Modelos de Dados](#51-modelos-de-dados)
   - 5.2 [API REST — Endpoints](#52-api-rest--endpoints)
   - 5.3 [Serializers](#53-serializers)
   - 5.4 [Serviços (Services)](#54-serviços-services)
   - 5.5 [Sistema de Alertas](#55-sistema-de-alertas)
   - 5.6 [Relatórios — Prestação de Contas](#56-relatórios--prestação-de-contas)
   - 5.7 [Admin Django](#57-admin-django)
   - 5.8 [Migrações](#58-migrações)
6. [Frontend — React](#6-frontend--react)
   - 6.1 [Tecnologias e Dependências](#61-tecnologias-e-dependências)
   - 6.2 [Camada de API (src/api)](#62-camada-de-api-srcapi)
   - 6.3 [Páginas e Componentes](#63-páginas-e-componentes)
   - 6.4 [Abas do Dashboard](#64-abas-do-dashboard)
   - 6.5 [Modais](#65-modais)
   - 6.6 [Utilitários (src/lib)](#66-utilitários-srclib)
7. [Testes](#7-testes)
8. [Fluxos Funcionais](#8-fluxos-funcionais)
9. [Dados de Demonstração (Seed)](#9-dados-de-demonstração-seed)
10. [Evolução do Projeto — Histórico de Design](#10-evolução-do-projeto--histórico-de-design)
11. [Roadmap e Próximos Passos](#11-roadmap-e-próximos-passos)

---

## 1. Visão Geral do Projeto

O **EduStock** é um sistema digital de gestão de estoque desenvolvido para substituir o controle manual (Excel/papel) utilizado em escolas públicas. O projeto foi construído a partir de entrevistas com o responsável pela gestão (Alberes, assistente de gestão), e tem como foco:

- Controle de **itens de consumo** (alimentos, material de limpeza, higiene, papelaria).
- Cadastro de **bens permanentes** (patrimônio escolar).
- Registro de **entradas e saídas** de estoque com rastreabilidade.
- **Alertas automáticos** de itens com validade próxima ou estoque crítico.
- Geração de **relatórios de prestação de contas** para a GRE (Gerência Regional de Educação).
- Cadastro de **fornecedores** com informações fiscais.

O sistema é composto por:

- **Backend**: API REST em Django + Django REST Framework, banco SQLite (desenvolvimento).
- **Frontend**: SPA (Single Page Application) em React com Tailwind CSS e Vite.

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────┐
│                   Navegador (SPA)                   │
│   React 19 + React Router + Tailwind CSS + Motion   │
│   ┌─────────────────────────────────────────────┐   │
│   │             DashboardPage.jsx               │   │
│   │  Inventário | Alertas | Fornecedores        │   │
│   │  Movimentações | Relatórios | Solicitações  │   │
│   └─────────────────────────────────────────────┘   │
│                         │                           │
│            src/api/http.js  (fetch)                 │
│            src/api/mock.js  (modo offline)          │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP / JSON
                          ▼
┌─────────────────────────────────────────────────────┐
│             Django 5 + Django REST Framework        │
│                                                     │
│  /api/produtos/        /api/categorias/             │
│  /api/grupos/          /api/fornecedores/           │
│  /api/movimentacoes/   /api/entradas/               │
│  /api/bens-permanentes/                             │
│  /api/alertas/                                      │
│  /api/relatorios/prestacao-contas/                  │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │   Services   │  │   Alerts     │                 │
│  │ (services.py)│  │ (alerts.py)  │                 │
│  └──────────────┘  └──────────────┘                 │
│          │                                          │
│  ┌───────▼──────────────────────────────────────┐   │
│  │                  Models                      │   │
│  │ Categoria | Grupo | Produto | Fornecedor     │   │
│  │ BemPermanente | Entrada | Movimentacao       │   │
│  │ Perfil                                       │   │
│  └──────────────────────────────────────────────┘   │
│                      │                              │
│              SQLite (db.sqlite3)                    │
└─────────────────────────────────────────────────────┘
```

### Modo Mock (desenvolvimento offline)

O frontend possui um sistema de mock controlado pela variável de ambiente `VITE_USE_MOCK`. Quando `true` (padrão), todas as chamadas de API são interceptadas por `src/api/mock.js`, permitindo desenvolvimento sem o backend rodando.

---

## 3. Estrutura de Pastas

```
EduStock/
├── core/                        # App principal Django
│   ├── migrations/              # Migrações do banco de dados (0001–0009)
│   ├── templates/               # Templates HTML (admin Django legado)
│   │   ├── base.html
│   │   ├── categorias/
│   │   └── produtos/
│   ├── tests/                   # Suite de testes
│   │   ├── test_alerts.py
│   │   ├── test_api.py
│   │   ├── test_migrations.py
│   │   ├── test_models.py
│   │   ├── test_relatorios.py
│   │   └── test_services.py
│   ├── admin.py                 # Configuração do admin Django
│   ├── alerts.py                # Lógica de alertas (validade e estoque)
│   ├── api_urls.py              # Roteamento da API REST
│   ├── api_views.py             # ViewSets e Views da API
│   ├── apps.py
│   ├── forms.py                 # Formulários Django (legado)
│   ├── models.py                # Modelos de dados
│   ├── relatorios.py            # Geração de relatório de prestação de contas
│   ├── serializers.py           # Serializers DRF
│   ├── services.py              # Serviços de domínio (movimentações, entradas)
│   └── views.py                 # Views HTML legadas
│
├── EduStock/                   # Configuração do projeto Django
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
│
├── frontend/                    # SPA React
│   ├── public/                  # Assets estáticos (favicon, ícones)
│   ├── dist/                    # Build de produção (gerado pelo Vite)
│   └── src/
│       ├── api/
│       │   ├── http.js          # Chamadas reais ao backend
│       │   ├── index.js         # Seletor mock/real
│       │   ├── mock.js          # Dados fictícios para dev
│       │   └── units.js         # Utilitários de unidade
│       ├── assets/
│       ├── components/          # Componentes React
│       │   ├── AlertasView.jsx
│       │   ├── AlertTicker.jsx
│       │   ├── CategoryRail.jsx
│       │   ├── ConfirmDialog.jsx
│       │   ├── DetailsModal.jsx
│       │   ├── EntradaFormModal.jsx
│       │   ├── FornecedoresView.jsx
│       │   ├── FornecedorFormModal.jsx
│       │   ├── Header.jsx
│       │   ├── KitchenPanel.jsx
│       │   ├── Modal.jsx
│       │   ├── MovimentacoesView.jsx
│       │   ├── ProductCard.jsx
│       │   ├── ProductFormModal.jsx
│       │   ├── RelatoriosView.jsx
│       │   ├── SaidaFormModal.jsx
│       │   ├── Sidebar.jsx
│       │   ├── Tabs.jsx
│       │   └── Toast.jsx
│       ├── lib/
│       │   ├── catalog.js
│       │   ├── export.js        # Exportação CSV e PDF
│       │   ├── format.js        # Formatação de datas e moeda
│       │   ├── format.test.js   # Testes unitários de format
│       │   ├── icons.jsx        # Ícones SVG inline
│       │   └── prestacaoPdf.js  # Geração de PDF (jsPDF)
│       ├── pages/
│       │   └── DashboardPage.jsx
│       ├── index.css            # Estilos globais e tokens de design
│       └── main.jsx             # Entrada da aplicação
│
├── docs/
│   └── superpowers/
│       ├── plans/               # Planos de implementação
│       └── specs/               # Especificações de design
│
├── db.sqlite3                   # Banco de dados (dev)
├── manage.py
├── requirements.txt
└── seed_demo.py                 # Dados de exemplo
```

---

## 4. Configuração e Instalação

### Pré-requisitos

- Python 3.10+
- Node.js 18+ e npm

### Backend

```bash
# 1. Clonar o repositório
git clone https://github.com/DEV-CiceroJose/EDUSTOCK.git
cd EduStock

# 2. Criar e ativar o ambiente virtual
python -m venv .venv
source .venv/bin/activate          # Linux/Mac
.venv\Scripts\activate             # Windows

# 3. Instalar dependências Python
pip install -r requirements.txt

# 4. Executar as migrações
python manage.py migrate

# 5. Criar superusuário (opcional, para o admin)
python manage.py createsuperuser

# 6. Popular com dados de demonstração (opcional)
python manage.py shell < seed_demo.py

# 7. Iniciar o servidor de desenvolvimento
python manage.py runserver
```

O backend estará disponível em `http://localhost:8000`.

### Frontend

```bash
# 1. Entrar na pasta do frontend
cd frontend

# 2. Instalar dependências Node
npm install

# 3. Configurar variáveis de ambiente (opcional)
# Criar arquivo .env na pasta frontend:
# VITE_USE_MOCK=false     # usa o backend real
# VITE_USE_MOCK=true      # usa dados mock (padrão)

# 4. Iniciar em modo de desenvolvimento
npm run dev

# 5. Build de produção
npm run build
```

O frontend de desenvolvimento estará disponível em `http://localhost:5173`.

### Dependências Python (`requirements.txt`)

```
Django>=5.0
djangorestframework>=3.15
django-cors-headers>=4.4
```

### Dependências Node principais (`package.json`)

| Pacote | Versão | Função |
|---|---|---|
| react | ^19.2.6 | Biblioteca de UI |
| react-dom | ^19.2.6 | Renderização DOM |
| react-router-dom | ^7.16.0 | Roteamento SPA |
| tailwindcss | ^4.3.0 | Framework CSS utilitário |
| motion | ^12.40.0 | Animações |
| jspdf | ^4.2.1 | Geração de PDF |
| jspdf-autotable | ^5.0.8 | Tabelas em PDF |
| vite | ^8.0.12 | Bundler e servidor dev |
| vitest | ^4.1.8 | Testes unitários |

---

## 5. Backend — Django

### 5.1 Modelos de Dados

O banco de dados é composto pelos seguintes modelos, todos definidos em `core/models.py`:

#### `Perfil`

Extensão do usuário Django para armazenar a matrícula funcional.

| Campo | Tipo | Descrição |
|---|---|---|
| `user` | OneToOneField (User) | Usuário Django associado |
| `matricula` | CharField(50) | Matrícula funcional (única) |

---

#### `Categoria`

Nível superior da hierarquia de produtos. Ex.: Alimentos, Limpeza, Papelaria.

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | CharField(100) | Nome da categoria (único) |

---

#### `Grupo`

Segundo nível da hierarquia. Ex.: Carboidratos, Leguminosas (dentro de Alimentos).

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | CharField(100) | Nome do grupo |
| `categoria` | ForeignKey → Categoria | Categoria pai (PROTECT) |

Constraint: combinação (`categoria`, `nome`) deve ser única.

---

#### `Produto`

Item de consumo do estoque escolar.

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | CharField(200) | Nome do produto |
| `numero_nota_fiscal` | CharField(12) | NF de origem (legado, pode ser nulo) |
| `grupo` | ForeignKey → Grupo | Grupo ao qual pertence (PROTECT) |
| `fornecedor` | ForeignKey → Fornecedor | Fornecedor padrão (opcional) |
| `quantidade` | Decimal(10,3) | Saldo atual em estoque |
| `unidade` | choices | UN, KG, L, CX ou PC |
| `estoque_minimo` | Decimal(10,3) | Limiar de alerta de estoque baixo |
| `perecivel` | Boolean | Indica se o produto tem prazo de validade |
| `periodicidade` | choices | SEMANAL, MENSAL ou EVENTUAL |
| `validade` | Date | Data de vencimento (opcional) |
| `preco` | Decimal(10,2) | Preço unitário (opcional) |
| `criado_por` | ForeignKey → User | Usuário que criou |
| `atualizado_por` | ForeignKey → User | Último usuário que atualizou |
| `criado_em` | DateTimeField | Data/hora de criação (automático) |
| `atualizado_em` | DateTimeField | Data/hora de atualização (automático) |

---

#### `Fornecedor`

Cadastro de fornecedores de produtos.

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | CharField(200) | Nome do fornecedor |
| `documento` | CharField(20) | CNPJ ou CPF |
| `endereco` | CharField(200) | Endereço (opcional) |
| `telefone` | CharField(20) | Telefone (opcional) |
| `email` | EmailField | E-mail (opcional) |
| `emite_nota_fiscal` | Boolean | Indica se emite NF (padrão: True) |
| `aceita_fiado` | Boolean | Indica se aceita crédito |
| `ativo` | Boolean | Indica se o fornecedor está ativo |
| `observacao` | TextField | Notas livres |
| `criado_por` | ForeignKey → User | Auditoria |
| `atualizado_por` | ForeignKey → User | Auditoria |
| `criado_em` / `atualizado_em` | DateTimeField | Timestamps automáticos |

---

#### `BemPermanente`

Cadastro de bens patrimoniais da escola (não entram no fluxo de estoque de consumo).

| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | CharField(200) | Nome do bem |
| `numero_patrimonio` | CharField(50) | Número de patrimônio (único, opcional) |
| `localizacao` | CharField(150) | Local onde o bem se encontra |
| `responsavel` | CharField(150) | Responsável pelo bem |
| `estado_conservacao` | choices | NOVO, BOM, REGULAR, RUIM ou INSERVIVEL |
| `data_aquisicao` | Date | Data de aquisição (opcional) |
| `observacao` | TextField | Notas livres |
| `criado_por` / `atualizado_por` | ForeignKey → User | Auditoria |
| `criado_em` / `atualizado_em` | DateTimeField | Timestamps automáticos |

---

#### `Entrada`

Registro de uma nota fiscal / lote de compra. Agrupa múltiplos `Movimentacao` do tipo ENTRADA.

| Campo | Tipo | Descrição |
|---|---|---|
| `fornecedor` | ForeignKey → Fornecedor | Fornecedor da compra (opcional) |
| `numero_nota_fiscal` | CharField(20) | Número da NF |
| `data` | Date | Data da entrada (padrão: hoje) |
| `observacao` | TextField | Observações livres |
| `criado_por` | ForeignKey → User | Usuário que registrou |
| `criado_em` | DateTimeField | Timestamp automático |

**Propriedade calculada `total`**: soma de `quantidade × preco_unitario` de todos os itens (movimentações) vinculados.

---

#### `Movimentacao`

Registro atômico de entrada ou saída de um produto. É o coração do rastreamento de saldo.

| Campo | Tipo | Descrição |
|---|---|---|
| `produto` | ForeignKey → Produto | Produto movimentado (PROTECT) |
| `tipo` | choices | ENTRADA ou SAIDA |
| `quantidade` | Decimal(10,3) | Quantidade movimentada |
| `preco_unitario` | Decimal(10,2) | Preço unitário (opcional) |
| `entrada` | ForeignKey → Entrada | Entrada associada (para entradas em lote) |
| `motivo` | CharField(120) | Descrição do motivo |
| `data` | Date | Data da movimentação (padrão: hoje) |
| `criado_por` | ForeignKey → User | Usuário que registrou |
| `criado_em` | DateTimeField | Timestamp automático |

> **Importante:** `Movimentacao` é **append-only** (somente criação e leitura, sem edição ou exclusão via API). O saldo do produto (`Produto.quantidade`) é atualizado atomicamente no momento do registro.

---

### 5.2 API REST — Endpoints

A API está disponível em `/api/` e segue os padrões do Django REST Framework com `DefaultRouter`.

#### Produtos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/produtos/` | Listar todos os produtos |
| POST | `/api/produtos/` | Criar novo produto |
| GET | `/api/produtos/{id}/` | Detalhe de um produto |
| PUT/PATCH | `/api/produtos/{id}/` | Atualizar produto |
| DELETE | `/api/produtos/{id}/` | Remover produto |

**Filtros disponíveis (query params):**
- `?search=<termo>` — busca por nome
- `?grupo=<id>` — filtra por grupo
- `?categoria=<id>` — filtra por categoria
- `?fornecedor=<id>` — filtra por fornecedor

#### Categorias

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/categorias/` | Listar categorias |
| POST | `/api/categorias/` | Criar categoria |
| GET/PUT/PATCH/DELETE | `/api/categorias/{id}/` | CRUD completo |

#### Grupos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/grupos/` | Listar grupos (com nome da categoria) |
| POST | `/api/grupos/` | Criar grupo |
| GET/PUT/PATCH/DELETE | `/api/grupos/{id}/` | CRUD completo |

#### Fornecedores

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/fornecedores/` | Listar fornecedores |
| POST | `/api/fornecedores/` | Criar fornecedor |
| GET/PUT/PATCH/DELETE | `/api/fornecedores/{id}/` | CRUD completo |

**Filtros disponíveis (query params):**
- `?search=<termo>` — busca por nome ou CNPJ/CPF
- `?emite_nota_fiscal=true|false`
- `?aceita_fiado=true|false`
- `?ativo=true|false`

#### Bens Permanentes

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/bens-permanentes/` | Listar bens |
| POST | `/api/bens-permanentes/` | Criar bem |
| GET/PUT/PATCH/DELETE | `/api/bens-permanentes/{id}/` | CRUD completo |

#### Movimentações (append-only)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/movimentacoes/` | Listar movimentações |
| POST | `/api/movimentacoes/` | Registrar movimentação (entrada ou saída) |

**Filtros disponíveis (query params):**
- `?produto=<id>`
- `?tipo=ENTRADA|SAIDA`
- `?data_de=YYYY-MM-DD`
- `?data_ate=YYYY-MM-DD`

**Payload de criação:**
```json
{
  "produto": 1,
  "tipo": "ENTRADA",
  "quantidade": "5.000",
  "motivo": "reposição semanal",
  "preco_unitario": "8.50"
}
```

#### Entradas (lote, append-only)

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/entradas/` | Listar entradas |
| POST | `/api/entradas/` | Criar entrada com múltiplos itens |

**Payload de criação:**
```json
{
  "fornecedor": 2,
  "numero_nota_fiscal": "NF-00321",
  "data": "2026-06-03",
  "observacao": "",
  "itens": [
    { "produto": 1, "quantidade": "10.000", "preco_unitario": "5.40" },
    { "produto": 3, "quantidade": "5.000", "preco_unitario": "8.20" }
  ]
}
```

#### Alertas

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/alertas/` | Retornar alertas de validade e estoque |

**Filtros disponíveis:**
- `?tipo=validade|estoque`
- `?urgencia=critico|alerta`

**Resposta:**
```json
{
  "resumo": {
    "vencidos": 2,
    "esgotados": 1,
    "total_validade": 4,
    "total_estoque_critico": 3
  },
  "validade": [...],
  "estoque_critico": [...]
}
```

#### Relatório de Prestação de Contas

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/relatorios/prestacao-contas/` | Gerar relatório por período |

**Parâmetros obrigatórios:**
- `?inicio=YYYY-MM-DD`
- `?fim=YYYY-MM-DD`

---

### 5.3 Serializers

Definidos em `core/serializers.py`. Todos os serializers seguem o padrão `ModelSerializer` do DRF.

**`ProdutoSerializer`** — expõe campos derivados somente-leitura:
- `grupo_nome` — nome do grupo
- `categoria` — ID da categoria (via grupo)
- `categoria_nome` — nome da categoria
- `criado_por_nome` — username do criador
- `fornecedor_nome` — nome do fornecedor

**`GrupoSerializer`** — inclui `categoria_nome` somente-leitura.

**`FornecedorSerializer`** — todos os campos do modelo, com `criado_em` e `atualizado_em` somente-leitura.

**`MovimentacaoSerializer`** — inclui `produto_nome` somente-leitura. O campo `entrada` é somente-leitura (preenchido pelo service).

**`EntradaSerializer`** — inclui:
- `fornecedor_nome` somente-leitura
- `itens` (nested `EntradaItemSerializer`, com escrita)
- `total` calculado via `SerializerMethodField`

O método `create` de `EntradaSerializer` delega para o service `registrar_entrada`, garantindo que toda a lógica de negócio (criação dos itens, atualização de saldo) seja executada de forma atômica.

---

### 5.4 Serviços (Services)

Definidos em `core/services.py`. Toda a lógica de negócio que altera o banco de dados fica aqui, isolada dos serializers e views.

#### `registrar_movimentacao`

```python
def registrar_movimentacao(*, produto, tipo, quantidade, motivo="",
                            preco_unitario=None, entrada=None, data=None, user=None)
```

Registra uma movimentação (entrada ou saída) de forma atômica (`@transaction.atomic`):

1. Valida que `quantidade > 0`.
2. Bloqueia o produto com `select_for_update()` para evitar condições de corrida.
3. Para `SAIDA`: verifica se o saldo é suficiente; rejeita com `ValidationError` caso contrário.
4. Atualiza `Produto.quantidade`.
5. Cria e retorna o objeto `Movimentacao`.

#### `registrar_entrada`

```python
def registrar_entrada(*, fornecedor=None, numero_nota_fiscal="", data=None,
                       observacao="", itens, user=None)
```

Registra uma entrada em lote (múltiplos produtos em uma NF):

1. Valida que `itens` não está vazio.
2. Cria o objeto `Entrada`.
3. Para cada item, chama `registrar_movimentacao` com `tipo=ENTRADA`.
4. Tudo em uma única transação atômica.

---

### 5.5 Sistema de Alertas

Definido em `core/alerts.py`. Gera alertas em duas categorias:

#### Alertas de Validade

Configuração:
- `CRITICO_DIAS = 7` — Produtos com validade em até 7 dias (urgência **crítico**).
- `ALERTA_DIAS = 30` — Produtos com validade em até 30 dias (urgência **alerta**).

Função principal: `coletar_alertas(tipo=None, urgencia=None, hoje=None)`

Retorno de um item de validade:
```json
{
  "produto_id": 3,
  "nome": "Óleo de Soja 900ml",
  "grupo_nome": "Óleos e Gorduras",
  "fornecedor_nome": "Atacadão",
  "motivo": "Vence em 5 dias",
  "urgencia": "critico",
  "dias_validade": 5
}
```

#### Alertas de Estoque Crítico

Um produto entra em estado crítico quando:
- `quantidade <= 0` → urgência **crítico** (esgotado)
- `quantidade < estoque_minimo × 0.2` (menos de 20% do mínimo) → urgência **alerta**

Retorno de um item de estoque:
```json
{
  "produto_id": 7,
  "nome": "Feijão Carioca",
  "grupo_nome": "Leguminosas",
  "fornecedor_nome": null,
  "motivo": "Saldo: 1.5 kg",
  "urgencia": "alerta",
  "quantidade": "1.500",
  "estoque_minimo": "10.000"
}
```

---

### 5.6 Relatórios — Prestação de Contas

Definido em `core/relatorios.py`. Gera um relatório financeiro de um período, agrupando compras por fornecedor com detalhamento por nota fiscal.

**Função principal:** `gerar_prestacao_contas(inicio, fim)`

**Estrutura do retorno:**
```json
{
  "periodo": { "inicio": "2026-06-01", "fim": "2026-06-30" },
  "resumo_financeiro": {
    "total_geral": "1250.00",
    "por_categoria": [
      { "categoria_id": 1, "categoria_nome": "Alimentos", "total": "980.00" },
      { "categoria_id": 2, "categoria_nome": "Limpeza", "total": "270.00" }
    ]
  },
  "fornecedores": [
    {
      "fornecedor_id": 1,
      "fornecedor_nome": "Atacadão",
      "documento": "12.345.678/0001-99",
      "total_fornecedor": "980.00",
      "documentos": [
        {
          "entrada_id": 5,
          "numero_nota_fiscal": "NF-00321",
          "data": "2026-06-03",
          "total": "980.00",
          "legado": false,
          "itens": [...]
        }
      ]
    }
  ]
}
```

O relatório suporta dois modos de dados:

- **Entradas regulares**: produtos com `Entrada` associada (fluxo normal pós-implementação do módulo de movimentações).
- **Dados legados**: produtos cadastrados diretamente com `numero_nota_fiscal` no campo do produto (migração de dados do Excel), tratados como documentos separados no relatório.

---

### 5.7 Admin Django

Configurado em `core/admin.py`. Registra as seguintes entidades com configurações personalizadas:

**`CategoriaAdmin`**
- Exibe: ID e nome
- Busca por nome
- Ordenação por nome

**`ProdutoAdmin`**
- Exibe: nome, NF, grupo, quantidade, unidade, validade, preço, usuários de auditoria e data de atualização
- Filtros laterais: grupo, NF, unidade, validade, data de criação
- Busca por nome
- Campos somente-leitura: `criado_por`, `atualizado_por`, `criado_em`, `atualizado_em`
- Preenchimento automático de `criado_por` e `atualizado_por` no `save_model`

---

### 5.8 Migrações

O histórico de migrações documenta a evolução do modelo de dados:

| Migração | Descrição |
|---|---|
| `0001_initial` | Criação inicial de `Categoria` e `Produto` |
| `0002_produto_numero_nota_fiscal` | Adição do campo `numero_nota_fiscal` ao Produto |
| `0003_perfil` | Criação do modelo `Perfil` (matrícula do usuário) |
| `0004_fundacao_grupo_bempermanente` | Criação de `Grupo` e `BemPermanente`; adição de campos `estoque_minimo`, `perecivel`, `periodicidade` ao Produto |
| `0005_repoint_produtos_para_grupo` | Migração de dados: associa produtos existentes ao novo modelo de Grupo |
| `0006_finaliza_grupo_obrigatorio` | Torna o campo `grupo` obrigatório no Produto |
| `0007_fornecedor` | Criação do modelo `Fornecedor`; vínculo com Produto |
| `0008_movimentacoes` | Criação dos modelos `Entrada` e `Movimentacao` |
| `0009_saldo_inicial` | Migração de saldo inicial: cria movimentações de entrada com o saldo pré-existente dos produtos |

---

## 6. Frontend — React

### 6.1 Tecnologias e Dependências

- **React 19** com hooks funcionais
- **React Router DOM v7** para roteamento (SPA)
- **Tailwind CSS v4** via plugin Vite
- **Motion (Framer Motion)** para animações de transição
- **jsPDF + jspdf-autotable** para exportação de relatórios em PDF
- **Vite v8** como bundler e servidor de desenvolvimento
- **Vitest** para testes unitários

### 6.2 Camada de API (`src/api`)

O módulo `src/api/index.js` exporta as APIs de cada entidade, selecionando automaticamente entre implementação HTTP real e mock:

```javascript
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "true") !== "false"

export const produtosApi    = USE_MOCK ? mockProdutos    : httpProdutos
export const categoriasApi  = USE_MOCK ? mockCategorias  : httpCategorias
export const gruposApi      = USE_MOCK ? mockGrupos      : httpGrupos
export const fornecedoresApi= USE_MOCK ? mockFornecedores: httpFornecedores
export const movimentacoesApi=USE_MOCK ? mockMovimentacoes:httpMovimentacoes
export const entradasApi    = USE_MOCK ? mockEntradas    : httpEntradas
export const alertasApi     = USE_MOCK ? mockAlertas     : httpAlertas
export const relatoriosApi  = USE_MOCK ? mockRelatorios  : httpRelatorios
```

Cada módulo de API (`http.js` e `mock.js`) implementa a mesma interface: `list()`, `create(data)`, `update(id, data)`, `remove(id)`.

### 6.3 Páginas e Componentes

#### `DashboardPage.jsx` (página principal)

É a única página real da aplicação. Gerencia todo o estado global e orquestra os componentes:

**Estado gerenciado:**
- `produtos`, `categorias`, `grupos`, `fornecedores`, `movimentacoes`, `alertas` — dados carregados da API
- `tab` — aba ativa do painel
- `cat` — filtro de categoria/grupo ativo
- `search` / `termo` — busca com debounce de 300ms
- `addOpen`, `editProduto`, `addFornOpen`, `editFornecedor`, `detalhe`, `aExcluir` — estado dos modais

**Função `carregar()`:** carrega todos os dados em paralelo com `Promise.all`.

**Lógica de alerta ao carregar:** exibe um toast de aviso se há itens críticos (vencidos ou esgotados).

**Funções de ação:**
- `ajustar(produto, delta)` — lança movimentação de +1 ou -1 unidade diretamente dos cards
- `excluir()` — remove o produto selecionado
- `novaCategoria()` — cria nova categoria via `window.prompt`

#### `Header.jsx`

Barra superior com campo de busca e botão de adicionar item. Props: `search`, `setSearch`, `onAddItem`, `onReport`.

#### `Sidebar.jsx`

Barra lateral de navegação com ícones para: Início, Inventário, Usuários e Configurações. Visível apenas em telas grandes (`lg:flex`).

#### `CategoryRail.jsx`

Painel lateral esquerdo no inventário com lista de categorias e grupos. Exibe contagem de itens por categoria/grupo. Permite filtrar o inventário e adicionar nova categoria.

#### `ProductCard.jsx`

Card de produto na grade do inventário. Exibe nome, quantidade, unidade, validade e estado do estoque. Botões de incremento/decremento rápido. Ao clicar, abre o `DetailsModal`.

#### `KitchenPanel.jsx`

Painel lateral direito com informações auxiliares para a gestão da cozinha escolar (visão do dia, itens de atenção).

#### `AlertTicker.jsx`

Faixa de alertas deslizante na parte inferior da tela. Exibe alertas críticos em rolagem contínua.

#### `AlertasView.jsx`

Aba de alertas com listagem detalhada de produtos com validade crítica e estoque baixo, organizados por urgência.

#### `FornecedoresView.jsx`

Aba de fornecedores com tabela de listagem. Ações: novo, editar, filtrar por status (ativo/inativo, emite NF, aceita fiado).

#### `MovimentacoesView.jsx`

Aba de movimentações. Exibe histórico de entradas e saídas com filtros por tipo, produto e período. Botões para abrir os modais de nova entrada (lote) e nova saída.

#### `RelatoriosView.jsx`

Aba de relatórios de prestação de contas. Permite selecionar período (mês atual, trimestre ou personalizado), gerar o relatório via API e exportar em **CSV** ou **PDF** (via jsPDF).

### 6.4 Abas do Dashboard

| Chave | Label | Descrição |
|---|---|---|
| `geral` | Visão Geral | Cards de resumo (total de itens, estoque crítico, validade crítica, valor em estoque) e central de alertas |
| `inv` | Inventário | Grade de produtos com filtro por categoria/grupo e busca |
| `alert` | Alertas | Listagem detalhada de alertas de validade e estoque |
| `forn` | Fornecedores | CRUD de fornecedores |
| `mov` | Movimentações | Histórico de entradas e saídas |
| `rel` | Relatórios | Prestação de contas por período |
| `sol` | Solicitações | Em desenvolvimento — pedidos de reposição |

### 6.5 Modais

#### `ProductFormModal.jsx`
Criação e edição de produto. Campos: nome, grupo (com seletor de categoria + grupo), fornecedor, unidade, estoque mínimo, periodicidade, perecível, validade, preço.

#### `FornecedorFormModal.jsx`
Criação e edição de fornecedor. Campos: nome, CNPJ/CPF, endereço, telefone, e-mail, emite NF, aceita fiado, ativo, observação.

#### `SaidaFormModal.jsx`
Registro de saída de produto. Campos: produto (busca), quantidade e motivo.

#### `EntradaFormModal.jsx`
Registro de entrada em lote. Campos: fornecedor, número da NF, data, observação e lista dinâmica de itens (produto, quantidade, preço unitário).

#### `DetailsModal.jsx`
Exibição detalhada de um produto, com histórico de movimentações. Ações: editar, excluir.

#### `ConfirmDialog.jsx`
Caixa de diálogo de confirmação genérica, usada antes de exclusões.

#### `Modal.jsx`
Componente base de modal (overlay + container) utilizado pelos demais modais.

### 6.6 Utilitários (`src/lib`)

#### `format.js`

- `brl(valor)` — formata número em reais (ex.: `R$ 1.250,00`)
- `dataBR(isoString)` — formata data ISO para o padrão brasileiro (ex.: `03/06/2026`)

#### `export.js`

- `isoHoje()` — retorna a data atual no formato ISO (`YYYY-MM-DD`)
- `periodoMesAtual()` — retorna `{ inicio, fim }` do mês corrente
- `periodoTrimestre()` — retorna `{ inicio, fim }` do trimestre corrente
- `formatPeriodoLabel(inicio, fim)` — texto legível do período (ex.: `Junho 2026`)
- `prestacaoContasToCsv(dados)` — converte o retorno do relatório em CSV
- `downloadBlob(blob, filename)` — dispara download de arquivo no navegador

#### `prestacaoPdf.js`

Gera o PDF de prestação de contas usando jsPDF e jspdf-autotable. O PDF inclui:
- Cabeçalho com período
- Resumo financeiro por categoria
- Detalhamento por fornecedor com tabela de NFs e itens

#### `icons.jsx`

Biblioteca de ícones SVG inline. Principais ícones disponíveis: `box`, `alert`, `bell`, `report`, `home`, `grid`, `users`, `gear`, `chevronR`.

#### `catalog.js`

Definição de dados estáticos de catálogo (unidades, periodicidades, estados de conservação) compartilhados entre frontend e lógica de exibição.

---

## 7. Testes

Os testes estão em `core/tests/` (backend) e `src/lib/format.test.js` (frontend).

### Testes de Backend

Executar com:
```bash
python manage.py test
```

#### `test_models.py`
Testa as constraints e comportamentos dos modelos:
- Unicidade de grupos por categoria
- Criação de produto com grupo obrigatório
- Comportamento do campo `quantidade` decimal

#### `test_services.py`
Testa a lógica de movimentações:
- Entrada soma ao saldo do produto
- Saída subtrai do saldo
- Saída maior que saldo lança `ValidationError` sem alterar o banco
- Quantidade zero ou negativa lança `ValidationError`
- `registrar_entrada` cria múltiplos itens e calcula total corretamente
- Entrada sem itens lança `ValidationError`

#### `test_api.py`
Testa os endpoints da API com `APITestCase`:
- CRUD de Grupos, Produtos, Bens Permanentes, Fornecedores
- Filtros de produtos por categoria, grupo e fornecedor
- Criação de movimentações (entrada e saída)
- Criação de entrada em lote (`/api/entradas/`)
- Alertas: validade e estoque crítico
- Filtros de fornecedores

#### `test_alerts.py`
Testa o módulo de alertas:
- Produtos com validade vencida aparecem como críticos
- Produtos com validade em até 30 dias aparecem como alerta
- Produtos esgotados (`quantidade=0`) aparecem como críticos
- Filtragem por `tipo` e `urgencia`
- Formatação das mensagens de motivo

#### `test_relatorios.py`
Testa a geração de prestação de contas:
- Agrupamento correto por fornecedor e NF
- Cálculo de totais por categoria
- Tratamento de dados legados
- Período sem movimentações retorna totais zerados

#### `test_migrations.py`
Verifica a integridade das migrações Django.

### Testes de Frontend

Executar com:
```bash
cd frontend && npm test
```

#### `format.test.js`
Testa as funções utilitárias de formatação:
- `brl()` para diferentes valores
- `dataBR()` para diferentes formatos de data ISO

---

## 8. Fluxos Funcionais

### 8.1 Registro de Entrada de Produto (Lote)

```
Usuário abre EntradaFormModal
    │
    ├─ Seleciona fornecedor
    ├─ Informa número da NF e data
    └─ Adiciona itens (produto, quantidade, preço)
           │
           ▼
    POST /api/entradas/
           │
           ▼
    EntradaSerializer.create()
           │
           ▼
    registrar_entrada() [transaction.atomic]
        ├─ Cria objeto Entrada
        └─ Para cada item:
               registrar_movimentacao(tipo=ENTRADA)
                   ├─ select_for_update() no Produto
                   ├─ produto.quantidade += item.quantidade
                   ├─ produto.save()
                   └─ Movimentacao.objects.create()
           │
           ▼
    Resposta 201 com Entrada + itens + total
           │
           ▼
    carregar() no DashboardPage atualiza estado
```

### 8.2 Registro de Saída de Produto

```
Usuário abre SaidaFormModal
    │
    ├─ Seleciona produto
    ├─ Informa quantidade e motivo
           │
           ▼
    POST /api/movimentacoes/
    { tipo: "SAIDA", ... }
           │
           ▼
    MovimentacaoViewSet.create()
           │
           ▼
    registrar_movimentacao(tipo=SAIDA)
        ├─ Valida quantidade > 0
        ├─ select_for_update() no Produto
        ├─ Verifica saldo suficiente
        │    └─ ValidationError se insuficiente
        ├─ produto.quantidade -= quantidade
        ├─ produto.save()
        └─ Movimentacao.objects.create()
           │
           ▼
    Resposta 201 ou 400 (saldo insuficiente)
```

### 8.3 Geração de Relatório de Prestação de Contas

```
Usuário seleciona período em RelatoriosView
    │
    ▼
GET /api/relatorios/prestacao-contas/?inicio=...&fim=...
    │
    ▼
gerar_prestacao_contas(inicio, fim)
    ├─ Busca Entradas no período
    ├─ Agrupa por fornecedor e NF
    ├─ Busca dados legados (produtos com NF direta)
    ├─ Calcula totais por categoria
    └─ Retorna JSON estruturado
           │
           ▼
    RelatoriosView exibe tabelas
           │
           ├─ Botão CSV → prestacaoContasToCsv() → downloadBlob()
           └─ Botão PDF → gerarPdfPrestacaoContas() → downloadBlob()
```

### 8.4 Sistema de Alertas

```
DashboardPage.carregar()
    │
    ▼
GET /api/alertas/
    │
    ▼
coletar_alertas()
    ├─ queryset_validade(): produtos com validade <= hoje + 30 dias
    │    └─ _serializar_validade(): calcula dias, define urgência
    └─ queryset_estoque_critico(): produtos esgotados ou < 20% do mínimo
         └─ _serializar_estoque(): monta mensagem e urgência
    │
    ▼
AlertTicker (faixa deslizante de alertas críticos)
AlertasView (listagem completa)
VisaoGeral (cards de resumo + central de alertas)
Toast (notificação se há críticos ao carregar)
```

---

## 9. Dados de Demonstração (Seed)

O arquivo `seed_demo.py` popula o banco com dados representativos para demonstração:

```bash
python manage.py shell < seed_demo.py
```

Cria 4 categorias e 8 produtos com diferentes estados:
- Produtos com validade futura (arroz, feijão, detergente)
- Produto com validade em poucos dias (água sanitária — alerta)
- Produto com validade vencida (óleo de soja — crítico)
- Produtos sem validade (material de escritório)
- Produtos com diferentes unidades (KG, UN, CX, L, PC)

O script é **idempotente** — pode ser executado múltiplas vezes sem duplicar dados (usa `get_or_create`).

---

## 10. Evolução do Projeto — Histórico de Design

O projeto foi construído em blocos incrementais, documentados nas specs em `docs/superpowers/specs/`:

### Bloco A — Fundação do Modelo de Estoque (2026-06-03)

**Contexto:** O sistema tinha apenas `Categoria` e `Produto` simples. As entrevistas com o usuário revelaram a necessidade de uma hierarquia de dois níveis e campos adicionais.

**Entregues:**
- Hierarquia `Categoria → Grupo → Produto`
- Novos campos no Produto: `estoque_minimo`, `perecivel`, `periodicidade`
- Conversão de `quantidade` de Float para Decimal
- Criação de `BemPermanente` (sem UI nesta fase)
- Migrações de dados preservando os registros existentes

### Bloco B — Fornecedores (2026-06-04)

**Entregues:**
- Modelo `Fornecedor` com CNPJ/CPF, telefone, e-mail, `emite_nota_fiscal`, `aceita_fiado`
- API REST completa com filtros
- UI de cadastro e listagem de fornecedores
- Vínculo do fornecedor ao produto

### Bloco C — Movimentações, Entradas e Alertas (2026-06-04)

**Entregues:**
- Modelos `Entrada` e `Movimentacao` (append-only)
- Service `registrar_movimentacao` com transação atômica e proteção de saldo
- Service `registrar_entrada` para entrada em lote
- Alertas refinados: validade (crítico/alerta) e estoque crítico
- Migração de saldo inicial (0009)
- UI de movimentações, modais de entrada e saída

### Bloco D — Relatórios GRE (planejado)

Geração de relatórios de prestação de contas estruturados para submissão à GRE (Gerência Regional de Educação), com agrupamento por fornecedor, nota fiscal e categoria. O endpoint já existe; a exportação em PDF e CSV está implementada no frontend.

---

## 11. Roadmap e Próximos Passos

Com base nas specs e no código atual, os próximos ciclos de desenvolvimento previstos são:

### Em Desenvolvimento / Planejado

**Solicitações de Reposição** — A aba "Solicitações" já existe no frontend (placeholder) e prevê:
- Pedidos de reposição baseados no consumo médio histórico
- Lista de compras automática por produto com estoque abaixo do mínimo

**Tela de Bens Permanentes** — O backend e a API existem; falta a UI para:
- Listagem de bens com filtro por estado de conservação e localização
- Formulário de cadastro e edição

**Autenticação e Controle de Acesso** — O modelo `Perfil` existe, mas o sistema ainda não implementa login/logout na UI. Próximos passos:
- Tela de login
- Controle de permissões por perfil (gestor vs. operador)

### Fora de Escopo (documentado nas specs)

Itens explicitamente marcados como "não importante" pelo usuário responsável:
- App de contagem de alunos
- Interface dedicada para merendeiras
- Integração com sistemas estaduais de educação

---

## Referências Rápidas

### Comandos Úteis

```bash
# Rodar testes do backend
python manage.py test

# Criar migrações após mudança no models.py
python manage.py makemigrations

# Aplicar migrações
python manage.py migrate

# Acessar o shell Django
python manage.py shell

# Rodar testes do frontend
cd frontend && npm test

# Build de produção do frontend
cd frontend && npm run build

# Linting do frontend
cd frontend && npm run lint
```

### Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_USE_MOCK` | `true` | `false` para usar o backend real |
| `DJANGO_SECRET_KEY` | (hardcoded em dev) | Chave secreta Django (trocar em produção) |
| `DEBUG` | `True` | Desabilitar em produção |

### Configurações CORS (settings.py)

O middleware `django-cors-headers` está configurado para permitir o frontend de desenvolvimento (`localhost:5173`) acessar a API sem bloqueios de CORS.

---

*Documentação gerada em 07 de junho de 2026 com base no código-fonte do projeto EduStock.*