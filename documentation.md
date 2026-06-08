# EduStock — Documentação Técnica

> Sistema de gestão de estoque escolar com backend Django REST + frontend React (SPA) + dois apps independentes de merenda escolar.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Estrutura de Pastas](#3-estrutura-de-pastas)
4. [Como Rodar o Projeto](#4-como-rodar-o-projeto)
5. [Backend — Django](#5-backend--django)
   - 5.1 [Modelos de Dados](#51-modelos-de-dados)
   - 5.2 [API REST — Endpoints Administrativos](#52-api-rest--endpoints-administrativos)
   - 5.3 [API REST — Endpoints de Operação (Merenda)](#53-api-rest--endpoints-de-operação-merenda)
   - 5.4 [Autenticação por PIN (operacao_auth.py)](#54-autenticação-por-pin-operacao_authpy)
   - 5.5 [Serializers](#55-serializers)
   - 5.6 [Serviços (services.py)](#56-serviços-servicespy)
   - 5.7 [Sistema de Alertas](#57-sistema-de-alertas)
   - 5.8 [Relatórios — Prestação de Contas](#58-relatórios--prestação-de-contas)
   - 5.9 [Migrações](#59-migrações)
6. [Frontend Administrativo (frontend/)](#6-frontend-administrativo-frontend)
7. [App Alunos (app-alunos/)](#7-app-alunos-app-alunos)
8. [App Cozinha (app-cozinha/)](#8-app-cozinha-app-cozinha)
9. [Testes](#9-testes)
10. [Fluxos Funcionais](#10-fluxos-funcionais)
11. [Dados de Demonstração](#11-dados-de-demonstração)
12. [Histórico de Desenvolvimento](#12-histórico-de-desenvolvimento)
13. [Roadmap](#13-roadmap)
14. [Referências Rápidas](#14-referências-rápidas)

---

## 1. Visão Geral

O **EduStock** é um sistema digital de gestão de estoque para escolas públicas, substituindo controles em Excel e papel. Foi construído a partir de entrevistas com o responsável pela gestão (Alberes, assistente de gestão).

**Módulos implementados:**

| Módulo | Status | Descrição |
|---|---|---|
| A — Estoque (Hierarquia) | ✅ | Categorias → Grupos → Produtos com campos completos |
| B — Fornecedores | ✅ | CRUD com filtros e vínculo a produtos |
| C — Movimentações | ✅ | Entradas/saídas com transação atômica, saldo protegido |
| D — Alertas e Relatórios | ✅ | Alertas de validade/estoque, relatório GRE em CSV/PDF |
| E — Merenda Escolar | ✅ | Frequência de alunos + painel de produção diária |

**Três interfaces independentes:**
- **`/frontend`** — painel administrativo (gestor/almoxarife)
- **`/app-alunos`** — registro de frequência por turma (representantes)
- **`/app-cozinha`** — painel de produção diária (merendeiras)

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│  frontend/        app-alunos/           app-cozinha/                │
│  :5173            :5174                 :5175                        │
│  Painel Admin     Frequência de alunos  Painel de produção          │
│                                                                      │
│  Token: Django    Token: X-Operacao-    Token: X-Operacao-          │
│  session/admin    Token (ALUNO_REP)     Token (COZINHA)             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP / JSON
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Django 6 + Django REST Framework                   │
│                                                                      │
│  /api/produtos/      /api/categorias/    /api/grupos/               │
│  /api/fornecedores/  /api/movimentacoes/ /api/entradas/             │
│  /api/bens-permanentes/                                             │
│  /api/alertas/       /api/relatorios/prestacao-contas/              │
│                                                                      │
│  /api/operacao/auth/           ← login por PIN                      │
│  /api/operacao/contagem/       ← frequência (ALUNO_REP)             │
│  /api/operacao/resumo/         ← resumo do dia (dashboard admin)    │
│  /api/operacao/plano-do-dia/   ← ordem de produção (COZINHA)        │
│  /api/operacao/baixa-de-producao/ ← saídas de estoque (COZINHA)    │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │  services.py │  │   alerts.py  │  │  operacao_auth.py      │    │
│  │  movim. ATM  │  │  validade +  │  │  tokens PIN em memória │    │
│  │  select_for  │  │  estoque     │  │  TTL 12h               │    │
│  │  _update()   │  │              │  │                        │    │
│  └──────────────┘  └──────────────┘  └────────────────────────┘    │
│                          │                                          │
│  ┌───────────────────────▼──────────────────────────────────────┐  │
│  │                       Models                                 │  │
│  │  Categoria | Grupo | Produto | Fornecedor | BemPermanente    │  │
│  │  Entrada | Movimentacao | Perfil                             │  │
│  │  FrequenciaDiaria | FatorConsumo                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                       SQLite (db.sqlite3)                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Isolamento de segurança

- Os endpoints `/api/operacao/*` (exceto `/resumo/`) rejeitam tokens de admin Django com **HTTP 403**.
- O app-alunos e o app-cozinha não têm acesso a preços, fornecedores ou relatórios financeiros.
- Os três apps não compartilham código, estado ou autenticação entre si.

---

## 3. Estrutura de Pastas

```
easystock/
├── core/                        # App principal Django
│   ├── migrations/              # 0001–0011
│   ├── tests/
│   │   ├── test_alerts.py
│   │   ├── test_api.py
│   │   ├── test_migrations.py
│   │   ├── test_models.py
│   │   ├── test_operacao.py     # testes de integração do módulo E
│   │   ├── test_operacao_spec.py # 5 testes obrigatórios da spec + extras
│   │   ├── test_relatorios.py
│   │   └── test_services.py
│   ├── admin.py
│   ├── alerts.py                # alertas de validade e estoque
│   ├── api_urls.py              # roteamento da API (admin + operacao)
│   ├── api_views.py             # ViewSets administrativos
│   ├── models.py                # todos os modelos de dados
│   ├── operacao.py              # lógica de plano e baixa de produção
│   ├── operacao_auth.py         # autenticação por PIN (tokens em memória)
│   ├── operacao_views.py        # views dos endpoints /api/operacao/*
│   ├── relatorios.py
│   ├── serializers.py
│   ├── services.py
│   └── views.py                 # views HTML legadas
│
├── easystock/                   # Configuração do projeto Django
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
│
├── frontend/                    # Painel administrativo (porta 5173)
│   └── src/
│       ├── api/                 # http.js, mock.js, index.js
│       ├── components/          # Header, Sidebar, ProductCard, modais…
│       ├── lib/                 # format.js, export.js, icons.jsx…
│       ├── pages/DashboardPage.jsx
│       └── index.css            # tokens de design + utilitários
│
├── app-alunos/                  # App de frequência (porta 5174)
│   ├── .env.example
│   ├── vite.config.js
│   └── src/
│       ├── api.js               # login, registrarContagem
│       ├── App.jsx              # rotas /login → /registrar
│       ├── PinLogin.jsx         # teclado PIN 4 dígitos
│       └── ContagemView.jsx     # teclado numérico + tela de resultado
│
├── app-cozinha/                 # Painel de produção (porta 5175)
│   ├── .env.example
│   ├── vite.config.js
│   └── src/
│       ├── api.js               # login, getPlano, baixaProducao
│       ├── App.jsx              # rotas /login → /producao
│       ├── PinLogin.jsx         # teclado PIN único da cozinha
│       └── ProducaoView.jsx     # cards de receita, modal de baixa
│
├── db.sqlite3
├── manage.py
├── requirements.txt
└── seed_demo.py
```

---

## 4. Como Rodar o Projeto

### Pré-requisitos

- Python 3.10+
- Node.js 18+ e npm

---

### 4.1 Backend

```bash
# 1. Clonar o repositório
git clone https://github.com/DEV-CiceroJose/EDUSTOCK.git
cd easystock

# 2. Criar e ativar ambiente virtual
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Linux/Mac

# 3. Instalar dependências Python
pip install -r requirements.txt

# 4. Aplicar migrações
python manage.py migrate

# 5. (Opcional) Criar superusuário para o admin Django
python manage.py createsuperuser

# 6. (Opcional) Popular com dados de demonstração
python manage.py shell < seed_demo.py

# 7. Iniciar o servidor
python manage.py runserver
```

Backend disponível em **`http://localhost:8000`**.

---

### 4.2 Frontend Administrativo

```bash
cd frontend
npm install

# Modo mock (sem backend):
# crie frontend/.env com VITE_USE_MOCK=true  (já é o padrão)

# Modo real (com backend rodando):
# crie frontend/.env com VITE_USE_MOCK=false

npm run dev
```

Disponível em **`http://localhost:5173`**.

---

### 4.3 App Alunos (Frequência)

```bash
cd app-alunos
npm install

# Copiar e configurar variáveis de ambiente
copy .env.example .env        # Windows
cp .env.example .env          # Linux/Mac
```

Editar `app-alunos/.env`:

```env
# PINs das turmas no formato TURMA:PIN,TURMA:PIN,...
VITE_PINS=6A:1001,6B:1002,7A:1003,7B:1004,8A:1005,8B:1006,9A:1007

# Turno de cada turma (padrão MANHA se omitido)
VITE_TURNOS=6A:MANHA,6B:MANHA,7A:MANHA,7B:TARDE,8A:TARDE,8B:TARDE,9A:INTEGRAL
```

> Os PINs no `.env` são usados para validação local (resposta imediata na UI).
> A validação final é **sempre feita pelo backend** via `POST /api/operacao/auth/`.
> Os PINs configurados em `settings.py` (`OPERACAO_PINS_ALUNOS`) precisam coincidir.

```bash
npm run dev
```

Disponível em **`http://localhost:5174`**.

---

### 4.4 App Cozinha (Produção)

```bash
cd app-cozinha
npm install

copy .env.example .env        # Windows
cp .env.example .env          # Linux/Mac
```

Editar `app-cozinha/.env`:

```env
# PIN único da cozinha
VITE_PIN_COZINHA=9999
```

> Precisa coincidir com `OPERACAO_PIN_COZINHA` em `settings.py`.

```bash
npm run dev
```

Disponível em **`http://localhost:5175`**.

---

### 4.5 Configurar os PINs no backend

Em `easystock/settings.py`, ajuste as listas para corresponder ao `.env` de cada app:

```python
# PINs das turmas (validados pelo backend no login)
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

# TTL dos tokens de sessão em horas (padrão 12h)
OPERACAO_TOKEN_TTL_HORAS = 12
```

---

### 4.6 Rodar os Testes

```bash
# Todos os testes do backend (104 testes)
python manage.py test

# Apenas o módulo de operação/merenda
python manage.py test core.tests.test_operacao core.tests.test_operacao_spec

# Testes do frontend administrativo
cd frontend && npm test
```

---

### 4.7 Build de Produção

```bash
# Frontend admin
cd frontend && npm run build

# App alunos
cd app-alunos && npm run build

# App cozinha
cd app-cozinha && npm run build
```

Os arquivos de produção ficam nas respectivas pastas `dist/`.

---

## 5. Backend — Django

### 5.1 Modelos de Dados

Todos em `core/models.py`.

#### Modelos Administrativos (Módulos A–D)

**`Categoria`** — Nível superior da hierarquia. Ex.: Alimentos, Limpeza.

**`Grupo`** — Segundo nível. Ex.: Carboidratos (dentro de Alimentos).
- Constraint: (`categoria`, `nome`) únicos.

**`Produto`** — Item de estoque de consumo.

| Campo | Tipo | Notas |
|---|---|---|
| `nome` | CharField(200) | |
| `grupo` | FK → Grupo | PROTECT |
| `fornecedor` | FK → Fornecedor | opcional |
| `quantidade` | Decimal(10,3) | saldo atual, atualizado por service |
| `unidade` | choices | UN, KG, L, CX, PC |
| `estoque_minimo` | Decimal(10,3) | limiar de alerta |
| `perecivel` | Boolean | |
| `validade` | Date | opcional |
| `preco` | Decimal(10,2) | opcional, não exposto nos endpoints de operação |

**`Fornecedor`** — CNPJ/CPF, telefone, e-mail, `emite_nota_fiscal`, `aceita_fiado`.

**`BemPermanente`** — Patrimônio escolar (sem fluxo de estoque de consumo).

**`Entrada`** — Agrupa movimentações de uma nota fiscal.

**`Movimentacao`** — Registro atômico append-only de entrada ou saída.

---

#### Modelos do Módulo E (Merenda)

**`FrequenciaDiaria`** — Contagem de alunos por turma/turno/dia.

| Campo | Tipo | Notas |
|---|---|---|
| `data` | Date | padrão: hoje |
| `turno` | choices | MANHA, TARDE, INTEGRAL |
| `turma` | CharField(20) | ex.: "6A" |
| `quantidade_alunos` | PositiveIntegerField | > 0 |
| `registrado_por_turma` | CharField(20) | PIN/identificador da turma (app-alunos) |
| `registrado_por` | FK → User | nulo quando registrado via app-alunos |
| `criado_em` | DateTimeField | automático |

Constraint única: (`data`, `turno`, `turma`) — bloqueia duplicatas com HTTP 409.

**`FatorConsumo`** — Define quanto de um produto usar por aluno.

| Campo | Tipo | Notas |
|---|---|---|
| `produto` | OneToOneField → Produto | PROTECT |
| `gramas_por_aluno` | Decimal(6,2) | quantidade em gramas por aluno |
| `ativo` | Boolean | padrão True |

---

### 5.2 API REST — Endpoints Administrativos

Prefixo: `/api/`

| Método | Endpoint | Descrição |
|---|---|---|
| GET/POST | `/api/produtos/` | Lista e cria produtos |
| GET/PUT/PATCH/DELETE | `/api/produtos/{id}/` | CRUD de produto |
| GET/POST | `/api/categorias/` | Lista e cria categorias |
| GET/POST | `/api/grupos/` | Lista e cria grupos |
| GET/POST | `/api/fornecedores/` | Lista e cria fornecedores |
| GET/POST | `/api/movimentacoes/` | Lista e cria movimentações (append-only) |
| GET/POST | `/api/entradas/` | Lista e cria entradas em lote (append-only) |
| GET/POST | `/api/bens-permanentes/` | Lista e cria bens patrimoniais |
| GET | `/api/alertas/` | Alertas de validade e estoque crítico |
| GET | `/api/relatorios/prestacao-contas/` | Relatório por período |

**Filtros comuns:**
- Produtos: `?search=`, `?grupo=`, `?categoria=`, `?fornecedor=`
- Fornecedores: `?search=`, `?emite_nota_fiscal=`, `?aceita_fiado=`, `?ativo=`
- Movimentações: `?produto=`, `?tipo=`, `?data_de=`, `?data_ate=`
- Alertas: `?tipo=validade|estoque`, `?urgencia=critico|alerta`
- Relatório: `?inicio=YYYY-MM-DD&fim=YYYY-MM-DD`

---

### 5.3 API REST — Endpoints de Operação (Merenda)

Prefixo: `/api/operacao/`

Todos exigem o header `X-Operacao-Token` (exceto `/auth/` e `/resumo/`).
Tokens de admin Django são rejeitados com **HTTP 403**.

| Método | Endpoint | Perfil | Descrição |
|---|---|---|---|
| POST | `/api/operacao/auth/` | — | Login por PIN, retorna token de sessão |
| DELETE | `/api/operacao/auth/logout/` | qualquer | Invalida token |
| POST | `/api/operacao/contagem/` | ALUNO_REP | Registra frequência da turma |
| GET | `/api/operacao/contagem/` | ALUNO_REP, COZINHA | Consulta total do dia/turno |
| GET | `/api/operacao/resumo/` | — (público) | Resumo do dia para o dashboard admin |
| GET | `/api/operacao/plano-do-dia/` | COZINHA | Ordem de produção calculada |
| POST | `/api/operacao/baixa-de-producao/` | COZINHA | Registra saídas de estoque |

#### Login por PIN

```
POST /api/operacao/auth/
Body:  { "pin": "1001", "perfil": "ALUNO_REP" }
       { "pin": "9999", "perfil": "COZINHA"   }

200:   { "token": "uuid...", "perfil": "ALUNO_REP", "turma": "6A", "turno": "MANHA" }
401:   { "detail": "PIN inválido." }
```

#### Registrar Frequência

```
POST /api/operacao/contagem/
Header: X-Operacao-Token: <token-aluno>
Body:   { "quantidade_alunos": 32, "data": "2026-06-07" }

201:  { "id": 1, "data": "...", "turma": "6A", "turno": "MANHA",
        "quantidade_alunos": 32,
        "previsao": { "total_alunos": 32, "media_historica": 30.5,
                      "alerta_reducao": false } }
409:  { "detail": "Frequência já registrada hoje para esta turma..." }
```

#### Plano do Dia

```
GET /api/operacao/plano-do-dia/?data=2026-06-07&turno=MANHA
Header: X-Operacao-Token: <token-cozinha>

200: {
  "data": "2026-06-07", "turno": "MANHA", "total_alunos": 210,
  "previsao": { "alerta_reducao": false, ... },
  "itens": [
    {
      "produto_id": 1, "produto_nome": "Arroz Branco",
      "categoria_nome": "Alimentos", "unidade": "KG",
      "quantidade": "16.800", "quantidade_legivel": "16,8 kg",
      "saldo_atual": "48.000", "estoque_insuficiente": false
    }
  ]
}
```

#### Baixa de Produção

```
POST /api/operacao/baixa-de-producao/
Header: X-Operacao-Token: <token-cozinha>
Body:   { "data": "2026-06-07", "turno": "MANHA" }

200: {
  "sucesso": 3, "falhas": 1,
  "resultados": [
    { "ok": true,  "produto_nome": "Arroz Branco", "quantidade": "16.800", ... },
    { "ok": false, "produto_nome": "Feijão",       "erro": "Saída excede saldo..." }
  ]
}
```

---

### 5.4 Autenticação por PIN (`operacao_auth.py`)

Sistema de tokens de sessão em memória (dict Python), sem dependência de banco de dados ou sessões Django.

**Fluxo:**
1. `POST /api/operacao/auth/` com PIN + perfil.
2. Backend valida o PIN contra `settings.OPERACAO_PINS_ALUNOS` ou `settings.OPERACAO_PIN_COZINHA`.
3. Gera um token UUID e armazena em `_SESSOES` com TTL.
4. Retorna o token para o app, que o salva em `sessionStorage`.
5. Cada request subsequente inclui `X-Operacao-Token: <token>`.
6. O decorador `@requer_perfil_operacao(PERFIL_ALUNO)` / `@requer_perfil_operacao(PERFIL_COZINHA)` valida e injeta `request.sessao_operacao`.

**Regras de segurança:**
- Se o request tem um usuário Django autenticado → **HTTP 403** (bloqueia admin).
- Token ausente → **HTTP 401**.
- Token expirado → **HTTP 401**.
- Perfil errado para o endpoint → **HTTP 403**.

```python
# Uso nas views
@requer_perfil_operacao(PERFIL_ALUNO)
def post(self, request):
    sessao = request.sessao_operacao  # { perfil, turma, turno }
    ...
```

> **Nota de produção:** Os tokens ficam em memória do processo Django. Reiniciar o servidor invalida todas as sessões ativas. Para alta disponibilidade, substitua `_SESSOES` por um cache Redis.

---

### 5.5 Serializers

`core/serializers.py` — padrão `ModelSerializer` do DRF.

- **`ProdutoSerializer`** — expõe `grupo_nome`, `categoria`, `categoria_nome`, `fornecedor_nome` como campos somente-leitura. Campo `quantidade` é somente-leitura (controlado por service).
- **`EntradaSerializer`** — nested write para `itens`; `create()` delega para `registrar_entrada()`.
- **`MovimentacaoSerializer`** — `entrada` somente-leitura.

Os endpoints de operação **não usam serializers DRF** — retornam dicts Python diretamente para evitar expor campos financeiros por acidente.

---

### 5.6 Serviços (`services.py`)

#### `registrar_movimentacao`

```python
@transaction.atomic
def registrar_movimentacao(*, produto, tipo, quantidade, motivo="",
                            preco_unitario=None, entrada=None, data=None, user=None)
```

1. Valida `quantidade > 0`.
2. `select_for_update()` no produto — evita race conditions.
3. Para SAIDA: verifica saldo; lança `ValidationError` se insuficiente.
4. Atualiza `produto.quantidade`.
5. Cria e retorna `Movimentacao`.

#### `registrar_entrada`

Cria `Entrada` + chama `registrar_movimentacao(ENTRADA)` para cada item. Tudo em uma transação.

#### `calcular_previsao_producao(data, turno)`

Retorna `{ total_alunos, media_historica, alerta_reducao }`.
- `media_historica` = média dos totais diários dos últimos 30 dias no mesmo turno.
- `alerta_reducao = total < media * 0.5` (frequência abaixo de 50% da média).

#### `calcular_resumo_dia(data)`

Versão sem turno para o widget do dashboard admin.

---

### 5.7 Sistema de Alertas

`core/alerts.py` — função `coletar_alertas(tipo, urgencia)`.

**Validade:**
- `critico`: vence em ≤ 7 dias
- `alerta`: vence em ≤ 30 dias

**Estoque:**
- `critico`: `quantidade <= 0`
- `alerta`: `quantidade < estoque_minimo × 0.2`

---

### 5.8 Relatórios — Prestação de Contas

`core/relatorios.py` — `gerar_prestacao_contas(inicio, fim)`.

Retorna JSON agrupado por fornecedor e NF. Suporta dados legados (produtos com NF no campo `numero_nota_fiscal` do modelo). O frontend exporta em CSV e PDF (jsPDF).

---

### 5.9 Migrações

| Migração | Descrição |
|---|---|
| `0001_initial` | Categoria + Produto |
| `0002` | Campo `numero_nota_fiscal` no Produto |
| `0003` | Modelo `Perfil` |
| `0004` | `Grupo`, `BemPermanente`, campos `estoque_minimo`/`perecivel`/`periodicidade` |
| `0005` | Migração de dados: produtos → grupos |
| `0006` | `grupo` obrigatório no Produto |
| `0007` | Modelo `Fornecedor` |
| `0008` | Modelos `Entrada` e `Movimentacao` |
| `0009` | Saldo inicial: movimentações de entrada para o saldo existente |
| `0010` | Modelos `FrequenciaDiaria` e `FatorConsumo` (Módulo E) |
| `0011` | Campo `registrado_por_turma` em `FrequenciaDiaria` |

---

## 6. Frontend Administrativo (`frontend/`)

SPA em React 19 + Tailwind CSS v4, rodando na porta **5173**.

### Tecnologias

| Pacote | Versão | Função |
|---|---|---|
| react | ^19.2.6 | UI |
| react-router-dom | ^7.16.0 | Roteamento |
| tailwindcss | ^4.3.0 | Estilos |
| motion | ^12.40.0 | Animações |
| jspdf | ^4.2.1 | PDF |
| vite | ^8.0.12 | Bundler |
| vitest | ^4.1.8 | Testes |

### Modo mock

```env
# frontend/.env
VITE_USE_MOCK=true   # dados fictícios (padrão)
VITE_USE_MOCK=false  # backend real
```

### Abas do Dashboard

| Chave | Label | Descrição |
|---|---|---|
| `geral` | Visão Geral | Cards de resumo + central de alertas + widget de frequência |
| `inv` | Inventário | Grade de produtos com filtro por categoria/grupo e busca |
| `alert` | Alertas | Alertas de validade e estoque |
| `forn` | Fornecedores | CRUD de fornecedores |
| `mov` | Movimentações | Histórico de entradas e saídas |
| `rel` | Relatórios | Prestação de contas CSV/PDF |
| `merenda` | Merenda | Sub-views: Contagem (frequência) e Produção |
| `sol` | Solicitações | Em desenvolvimento |

### Fix CSS — barra de busca

O shorthand `padding` em `.field` sobrescrevia a classe utilitária `pl-10` do Tailwind v4 (mesmo nível de especificidade, ordem de cascade). Corrigido usando `padding-block`/`padding-inline` separados, que não conflitam com `padding-left`.

---

## 7. App Alunos (`app-alunos/`)

Aplicação React independente para representantes de turma. **Sem acesso a dados financeiros ou de estoque.**

### Fluxo de uso

```
Abrir app → /login (PinLogin)
  └─ Digitar 4 dígitos
  └─ Auto-confirma ao completar
  └─ Validação local (VITE_PINS) + POST /api/operacao/auth/
  └─ Sessão salva em sessionStorage

→ /registrar (ContagemView)
  └─ Exibe turma e turno (somente leitura)
  └─ Teclado numérico grande (botões ≥ 64px, fonte ≥ 24px)
  └─ POST /api/operacao/contagem/
  └─ Tela de sucesso: número + variação em relação à média
       Ex.: "32 alunos — +5% em relação à média"
  └─ HTTP 409 → "Frequência já registrada hoje" (sem travar)
  └─ Botão "Concluído" → sair
```

### Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/api.js` | `login()`, `logout()`, `getSessao()`, `registrarContagem()` |
| `src/App.jsx` | Roteamento + guarda de rota (redireciona sem sessão) |
| `src/PinLogin.jsx` | Teclado 4 dígitos, auto-confirma, lê `VITE_PINS` |
| `src/ContagemView.jsx` | Display numérico, teclado, estados: idle/loading/sucesso/erro |

### Variáveis de ambiente

```env
VITE_PINS=6A:1001,6B:1002,...         # obrigatório
VITE_TURNOS=6A:MANHA,7B:TARDE,...     # opcional (padrão MANHA)
VITE_API_BASE=                        # vazio = usa proxy do Vite
```

---

## 8. App Cozinha (`app-cozinha/`)

Aplicação React independente para merendeiras. **Sem acesso ao painel administrativo, preços ou fornecedores.**

### Fluxo de uso

```
Abrir app → /login (PinLogin)
  └─ PIN único da cozinha (4 dígitos)
  └─ POST /api/operacao/auth/ { perfil: "COZINHA" }

→ /producao (ProducaoView)
  └─ Cabeçalho: data atual + chips de turno (Manhã/Tarde/Integral)
  └─ Total de alunos do dia em destaque
  └─ Banner amarelo se alerta_reducao=true
  └─ Cards de receita por produto:
       - Ícone SVG da categoria (alimentos=prato, limpeza=balde)
       - Nome do produto (≥ 22px)
       - Quantidade calculada em destaque ("16,8 kg")
       - Borda vermelha + ícone ⚠ se estoque insuficiente
  └─ Botão "Dar Baixa de Produção" fixo no rodapé
       - Desabilitado se nenhum item disponível
       - Clique → modal de confirmação listando itens + quantidades
       - Confirmar → POST /api/operacao/baixa-de-producao/
       - Modal de resultado: sucessos e falhas individualizados
```

### Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/api.js` | `login()`, `logout()`, `isLoggedIn()`, `getPlano()`, `baixaProducao()` |
| `src/App.jsx` | Roteamento + guarda de rota |
| `src/PinLogin.jsx` | Teclado 4 dígitos, PIN único via `VITE_PIN_COZINHA` |
| `src/ProducaoView.jsx` | Cabeçalho, cards, modal de confirmação, modal de resultado |

### Variáveis de ambiente

```env
VITE_PIN_COZINHA=9999      # obrigatório
VITE_API_BASE=             # vazio = usa proxy do Vite
```

---

## 9. Testes

### Backend (104 testes, todos passando)

```bash
python manage.py test
```

#### Testes obrigatórios do Módulo E (`test_operacao_spec.py`)

| Teste | Classe | O que verifica |
|---|---|---|
| `test_frequencia_duplicata_bloqueada` | `TestFrequenciaDuplicataBloqueada` | Segundo POST igual retorna 409 com mensagem clara |
| `test_previsao_alerta_reducao` | `TestPrevisaoAlertaReducao` | `alerta_reducao=true` quando total < 50% da média |
| `test_plano_do_dia_calcula_quantidades` | `TestPlanoDoDiaCalculaQuantidades` | `qtd = gramas × alunos / 1000`; sinaliza estoque insuficiente |
| `test_baixa_producao_atomica_por_item` | `TestBaixaProducaoAtomicaPorItem` | Falha em um item não cancela os demais |
| `test_endpoint_operacao_rejeita_token_admin` | `TestEndpointOperacaoRejeitaTokenAdmin` | Admin Django recebe HTTP 403 nos endpoints de operação |

#### Outros testes do Módulo E (`test_operacao.py`)

- `FrequenciaServiceTest` — somas, alerta, duplicata a nível de model
- `PlanoProducaoTest` — cálculo de KG, estoque insuficiente
- `BaixaProducaoTest` — baixa parcial não aborta
- `ContagemApiTest` — endpoints via APIClient com token de operação

#### Testes Administrativos

- `test_services.py` — movimentações, entradas, saldo
- `test_api.py` — CRUD de todas as entidades, filtros
- `test_alerts.py` — alertas de validade e estoque
- `test_relatorios.py` — prestação de contas, dados legados

### Frontend

```bash
cd frontend && npm test
```

- `format.test.js` — `brl()` e `dataBR()`

---

## 10. Fluxos Funcionais

### 10.1 Registro de Frequência (app-alunos)

```
Representante abre app → digita PIN (4 dígitos)
    │
    ▼ POST /api/operacao/auth/ { pin, perfil: "ALUNO_REP" }
    │
    ▼ Token retornado → salvo em sessionStorage
    │
    ▼ Teclado numérico → digita quantidade de alunos
    │
    ▼ POST /api/operacao/contagem/ { quantidade_alunos }
    ├─ 201: tela de sucesso com quantidade + variação histórica
    └─ 409: "Frequência já registrada hoje" → não trava o app
```

### 10.2 Produção da Cozinha (app-cozinha)

```
Merendeira abre app → digita PIN da cozinha
    │
    ▼ POST /api/operacao/auth/ { pin, perfil: "COZINHA" }
    │
    ▼ GET /api/operacao/plano-do-dia/?data=...&turno=MANHA
       Para cada FatorConsumo ativo:
         quantidade = gramas_por_aluno × total_alunos / 1000
         estoque_insuficiente = saldo_atual < quantidade
    │
    ▼ Cards de receita exibidos
    │
    ▼ "Dar Baixa de Produção" → modal de confirmação
    │
    ▼ POST /api/operacao/baixa-de-producao/
       Para cada item:
         registrar_movimentacao(tipo=SAIDA, motivo="consumo")
         [transação atômica POR ITEM — falha não cancela demais]
    │
    ▼ Modal de resultado: sucessos e falhas individualizados
```

### 10.3 Registro de Entrada em Lote (admin)

```
POST /api/entradas/
    │
    ▼ EntradaSerializer.create()
    │
    ▼ registrar_entrada() [transaction.atomic]
        ├─ Cria objeto Entrada
        └─ Para cada item: registrar_movimentacao(ENTRADA)
               ├─ select_for_update() no Produto
               ├─ produto.quantidade += quantidade
               └─ Movimentacao.objects.create()
```

---

## 11. Dados de Demonstração

```bash
python manage.py shell < seed_demo.py
```

Cria 4 categorias, 8 produtos em diferentes estados (crítico, alerta, normal), fornecedores e algumas movimentações. O script é **idempotente** (`get_or_create`).

Para o Módulo E funcionar com dados reais, configure `FatorConsumo` para os produtos de merenda via admin Django (`/admin/`) ou diretamente no banco.

---

## 12. Histórico de Desenvolvimento

| Bloco | Data | Entregues |
|---|---|---|
| A — Fundação | 2026-06-03 | Hierarquia Categoria→Grupo→Produto, BemPermanente, Decimal |
| B — Fornecedores | 2026-06-04 | Modelo Fornecedor, API, UI |
| C — Movimentações | 2026-06-04 | Entrada, Movimentacao (append-only), services atômicos, alertas |
| D — Relatórios | 2026-06-07 | Prestação de contas, exportação CSV/PDF |
| E — Merenda | 2026-06-07 | FrequenciaDiaria, FatorConsumo, endpoints /operacao/*, autenticação PIN, app-alunos, app-cozinha, 104 testes |
| Fix CSS | 2026-06-07 | `padding` shorthand sobrescrevia `pl-10` na barra de busca |

---

## 13. Roadmap

### Próximos passos

- **Solicitações de reposição** — aba "sol" já existe no frontend (placeholder); lógica de pedidos baseada em consumo médio.
- **UI de Bens Permanentes** — backend e API prontos, falta tela de listagem/edição.
- **Autenticação do painel admin** — modelo `Perfil` existe; falta tela de login/logout e controle de permissões por perfil.
- **Tokens de operação em cache distribuído** — substituir o dict em memória por Redis para suporte a múltiplos workers.

### Fora de escopo (confirmado)

Itens explicitamente marcados como não prioritários pelo usuário responsável:
- Integração com sistemas estaduais de educação
- App mobile nativo

---

## 14. Referências Rápidas

### Comandos do dia a dia

```bash
# Backend
python manage.py runserver          # servidor de dev
python manage.py migrate            # aplicar migrações
python manage.py makemigrations     # gerar migrações após mudança em models.py
python manage.py test               # todos os testes
python manage.py shell              # shell interativo

# Frontend admin
cd frontend && npm run dev          # servidor dev :5173
cd frontend && npm run build        # build produção
cd frontend && npm test             # testes unitários

# App alunos
cd app-alunos && npm run dev        # servidor dev :5174
cd app-alunos && npm run build

# App cozinha
cd app-cozinha && npm run dev       # servidor dev :5175
cd app-cozinha && npm run build
```

### Variáveis de ambiente

| App | Variável | Padrão | Descrição |
|---|---|---|---|
| frontend | `VITE_USE_MOCK` | `true` | `false` para usar backend real |
| app-alunos | `VITE_PINS` | — | `TURMA:PIN,...` obrigatório |
| app-alunos | `VITE_TURNOS` | — | `TURMA:TURNO,...` opcional |
| app-alunos | `VITE_API_BASE` | `""` | URL base da API (vazio = proxy Vite) |
| app-cozinha | `VITE_PIN_COZINHA` | — | PIN único da cozinha, obrigatório |
| app-cozinha | `VITE_API_BASE` | `""` | URL base da API |

### Configurações Django relevantes

```python
# settings.py — CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # admin
    "http://localhost:5174",  # app-alunos
    "http://localhost:5175",  # app-cozinha
]

# settings.py — PINs de operação
OPERACAO_PINS_ALUNOS = [...]   # lista de { pin, turma, turno }
OPERACAO_PIN_COZINHA = "9999"
OPERACAO_TOKEN_TTL_HORAS = 12
```

### Portas em desenvolvimento

| Serviço | Porta | URL |
|---|---|---|
| Django (backend) | 8000 | http://localhost:8000 |
| Frontend admin | 5173 | http://localhost:5173 |
| App alunos | 5174 | http://localhost:5174 |
| App cozinha | 5175 | http://localhost:5175 |
| Admin Django | 8000 | http://localhost:8000/admin/ |
| API browsable | 8000 | http://localhost:8000/api/ |

---

*Documentação atualizada em 07 de junho de 2026 — branches: `tudo-finalizado-mas-feio` (baseline) e `apps-merenda-e-alunosv1` (Módulo E).*
