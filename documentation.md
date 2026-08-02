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
│  │  movim. ATM  │  │  validade +  │  │  tokens PIN em cache   │    │
│  │  select_for  │  │  estoque     │  │  TTL 12h               │    │
│  │  _update()   │  │              │  │                        │    │
│  └──────────────┘  └──────────────┘  └────────────────────────┘    │
│                          │                                          │
│  ┌───────────────────────▼──────────────────────────────────────┐  │
│  │                       Models                                 │  │
│  │  Categoria | Grupo | Produto | Fornecedor | BemPermanente    │  │
│  │  Entrada | Movimentacao | Perfil                             │  │
│  │  FrequenciaDiaria | FatorConsumo                             │  │
│  │  Turma | PinAcesso  ← PINs de operação (geridos via /admin/) │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                       SQLite (db.sqlite3)                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Isolamento de segurança

- Os endpoints operacionais protegidos por PIN rejeitam tokens do dashboard com **HTTP 403**. O endpoint `/resumo/` exige o token administrativo da plataforma.
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
│   ├── operacao_auth.py         # autenticação por PIN (tokens em cache)
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
# URL base da API Django (vazio = usa proxy do Vite)
VITE_API_BASE=

# Inatividade até o encerramento da sessão, em minutos
VITE_IDLE_TIMEOUT_MIN=5
```

> O app-alunos **não guarda PINs nem mapeamento de turma localmente** —
> nada disso é embutido no bundle JS. Todo PIN digitado é enviado direto para
> `POST /api/operacao/auth/`; a turma da sessão vem sempre da resposta do
> backend e todas as turmas operacionais são integrais. Os PINs são cadastrados apenas via
> Django Admin, em `/admin/core/turma/` (ver seção 4.5).

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
# URL base da API Django (vazio = usa proxy do Vite)
VITE_API_BASE=

# Inatividade até o encerramento da sessão, em minutos
VITE_IDLE_TIMEOUT_MIN=5
```

> O PIN digitado é enviado direto para `POST /api/operacao/auth/` e validado
> pelo backend contra `PinAcesso` (papel "Equipe da cozinha", sem turma).
> Nenhum PIN deve ser configurado em variáveis `VITE_*` ou incluído no bundle.

```bash
npm run dev
```

Disponível em **`http://localhost:5175`**.

---

### 4.5 Configurar os PINs no backend

Os PINs **não ficam mais em `settings.py`**. Eles são registros no banco de
dados (modelos `Turma` e `PinAcesso`, em `core/models.py`) e são geridos
exclusivamente pelo Django Admin:

1. Crie um superusuário (se ainda não tiver): `python manage.py createsuperuser`.
2. Acesse `http://localhost:8000/admin/core/turma/`.
   - Cada `Turma` (nome, curso, ano, turno) tem um inline de até 3 PINs
     (`PinAcesso` com `papel=ALUNO_REP`) — os representantes daquela turma.
3. Acesse `http://localhost:8000/admin/core/pinacesso/` para cadastrar PINs
   avulsos, incluindo o(s) PIN(s) da cozinha (`papel=COZINHA`, sem turma
   vinculada).
4. O backend (`core/operacao_auth.py`) consulta `PinAcesso` diretamente a
   cada tentativa de login — não há PIN nem mapeamento de turma
   hardcoded em nenhum lugar do código ou do bundle JS dos apps.

```python
# easystock/settings.py — ainda controla apenas o TTL das sessões de operação
OPERACAO_TOKEN_TTL_HORAS = 12
```

---

### 4.6 Rodar os Testes

```bash
# Todos os testes do backend
python manage.py test

# Apenas o módulo de operação/merenda
python manage.py test core.tests.test_operacao core.tests.test_operacao_spec

# Testes dos sub-apps
cd app-alunos && npm test -- --run --maxWorkers=1
cd app-cozinha && npm test -- --run --maxWorkers=1

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

**`FrequenciaDiaria`** — Contagem de alunos por turma/período/dia. Novos
registros dos representantes usam sempre `INTEGRAL`; os demais choices são
mantidos para compatibilidade histórica e serviços administrativos.

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

**`OperacaoBaixaProducao`** — Registro idempotente da baixa executada pela cozinha.

| Campo | Tipo | Notas |
|---|---|---|
| `operacao_id` | UUID | único; usado para repetição e reconciliação segura |
| `data` | Date | dia da produção |
| `refeicao` | choices | CAFE_MANHA, ALMOCO, LANCHE_TARDE |
| `status` | choices | CONCLUIDA ou PARCIAL |
| `resultado` | JSON | resposta persistida da operação |

Constraint única: (`data`, `refeicao`) — no máximo três baixas por dia.

---

#### Modelos de Autenticação por PIN

Única fonte de verdade dos PINs de operação (`/api/operacao/auth/`). Geridos
somente via Django Admin — nenhum PIN é hardcoded em `settings.py` nem
embutido no bundle JS do `app-alunos`/`app-cozinha`.

**`Turma`** — Turma da escola.

| Campo | Tipo | Notas |
|---|---|---|
| `nome` | CharField(50) | único, ex.: "1º DS-A" |
| `curso` | choices | `DS` (Desenvolvimento de Sistemas), `TET` (Eletrotécnica) |
| `ano` | PositiveSmallIntegerField | |
| `turno` | choices | somente INTEGRAL |
| `ativo` | Boolean | padrão True |

No admin (`/admin/core/turma/`), cada `Turma` tem um inline de até 3
`PinAcesso` (representantes daquela turma).

**`PinAcesso`** — Um PIN de 4 dígitos e o papel que ele autentica.

| Campo | Tipo | Notas |
|---|---|---|
| `papel` | choices | `ALUNO_REP` (representante de turma) ou `COZINHA` |
| `turma` | FK → Turma, null/blank | obrigatório para `ALUNO_REP`, deve ser nulo para `COZINHA` |
| `pin` | CharField(128) | hash não reversível, não editável diretamente |
| `pin_fingerprint` | CharField(64) | índice protegido e único para localizar o registro |
| `titular` | CharField(100) | nome de quem escolheu o PIN, opcional |
| `ativo` | Boolean | padrão True — PINs inativos são ignorados no login |

Constraint (`turma_obrigatoria_apenas_para_aluno_rep`): `papel=ALUNO_REP`
exige `turma` definida; `papel=COZINHA` exige `turma` nula. O model também
implementa `clean()` para essa mesma regra, então o form do admin em
`/admin/core/pinacesso/` (cadastro avulso, fora do inline de `Turma`) rejeita
combinações inválidas com uma mensagem amigável em vez de um erro 500.

PINs da cozinha são cadastrados diretamente em `/admin/core/pinacesso/` com
`papel=COZINHA` e `turma` vazia.

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

Os endpoints dos apps exigem `X-Operacao-Token`; `/auth/` recebe o PIN e
`/resumo/` exige `Authorization: Token <token-do-dashboard>`.
Tokens de admin Django são rejeitados com **HTTP 403**.

| Método | Endpoint | Perfil | Descrição |
|---|---|---|---|
| POST | `/api/operacao/auth/` | — | Login por PIN, retorna token de sessão |
| DELETE | `/api/operacao/auth/logout/` | qualquer | Invalida token |
| POST | `/api/operacao/contagem/` | ALUNO_REP | Registra frequência da turma |
| GET | `/api/operacao/contagem/` | ALUNO_REP, COZINHA | Consulta frequências do dia |
| GET | `/api/operacao/resumo/` | Token do dashboard | Resumo do dia para o dashboard admin |
| GET | `/api/operacao/plano-do-dia/` | COZINHA | Calcula o plano da refeição selecionada |
| POST | `/api/operacao/baixa-de-producao/` | COZINHA | Registra uma baixa idempotente por refeição |
| GET | `/api/operacao/baixa-de-producao/` | COZINHA | Consulta o resultado por `operacao_id` |

#### Login por PIN

```
POST /api/operacao/auth/
Body:  { "pin": "<4-dígitos>", "perfil": "ALUNO_REP" }
       { "pin": "<4-dígitos>", "perfil": "COZINHA"   }

200:   { "token": "uuid...", "perfil": "ALUNO_REP", "turma": "1º DS-A", "turno": "INTEGRAL" }
401:   { "detail": "PIN inválido." }
429:   { "detail": "Muitas tentativas de acesso..." }
```

#### Registrar Frequência

```
POST /api/operacao/contagem/
Header: X-Operacao-Token: <token-aluno>
Body:   { "quantidade_alunos": 32, "data": "2026-06-07" }

201:  { "id": 1, "data": "...", "turma": "1º DS-A", "turno": "INTEGRAL",
        "quantidade_alunos": 32,
        "previsao": { "total_alunos": 32, "media_historica": 30.5,
                      "alerta_reducao": false } }
409:  { "detail": "Frequência já registrada hoje para esta turma..." }
```

#### Plano do Dia

```
GET /api/operacao/plano-do-dia/?data=2026-06-07&refeicao=ALMOCO
Header: X-Operacao-Token: <token-cozinha>

200: {
  "data": "2026-06-07", "turno": "INTEGRAL", "refeicao": "ALMOCO",
  "refeicao_label": "Almoço", "baixa_realizada": false,
  "total_alunos": 210,
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
Body:   {
  "data": "2026-06-07",
  "refeicao": "ALMOCO",
  "operacao_id": "<uuid>"
}

200: {
  "operacao_id": "<uuid>", "refeicao": "ALMOCO", "repetida": false,
  "sucesso": 3, "falhas": 1,
  "resultados": [
    { "ok": true,  "produto_nome": "Arroz Branco", "quantidade": "16.800", ... },
    { "ok": false, "produto_nome": "Feijão",       "erro": "Saída excede saldo..." }
  ]
}
```

Cada dia aceita uma baixa para `CAFE_MANHA`, uma para `ALMOCO` e uma para
`LANCHE_TARDE`. Repetir o mesmo `operacao_id` devolve o resultado anterior sem
movimentar o estoque novamente. Uma segunda operação para a mesma refeição e
data retorna `409 refeicao_ja_baixada`.

#### Códigos de resposta operacionais

| HTTP | Código/cenário | Ação esperada no app |
|---|---|---|
| 400 | `payload_invalido`, `consulta_invalida`, `plano_invalido` | Corrigir os dados enviados |
| 401 | PIN inválido, token ausente ou expirado | Limpar a sessão e solicitar o PIN |
| 403 | Perfil incorreto ou módulo de merenda inativo | Encerrar o acesso e orientar o operador |
| 404 | `operacao_nao_encontrada` | Manter o UUID e permitir nova tentativa segura |
| 409 | `frequencia_duplicada` | Informar que a turma já registrou presença |
| 409 | `operacao_id_reutilizado` | Gerar operação apenas para uma nova ação |
| 409 | `refeicao_ja_baixada` | Exibir o resultado já registrado |
| 429 | Limite de tentativas de PIN | Respeitar `Retry-After` antes de tentar novamente |

Falhas sem resposta HTTP são exibidas como indisponibilidade de conexão. A
contagem e as consultas podem repetir automaticamente; a baixa nunca recebe
retry cego e é reconciliada por `operacao_id`.

O roteiro de operação, smoke tests pós-deploy e riscos restantes está em
[`docs/OPERACAO_SUBAPPS.md`](docs/OPERACAO_SUBAPPS.md).

---

### 5.4 Autenticação por PIN (`operacao_auth.py`)

Os **PINs** são registros protegidos por hash no banco (modelos
`Turma`/`PinAcesso`, geridos via Django Admin — ver seção 4.5); os
**tokens de sessão** gerados após o login ficam no cache compartilhado do
Django, sem depender de sessões de navegador.

**Fluxo:**
1. `POST /api/operacao/auth/` com PIN + perfil.
2. Backend calcula a impressão digital protegida do valor recebido, localiza
   o registro ativo e confirma o hash do PIN. Para `perfil=ALUNO_REP`, resolve
   a `turma`/`turno` a partir do relacionamento `PinAcesso.turma`; para
   `perfil=COZINHA`, valida o registro sem turma. Nenhum PIN é hardcoded em
   `settings.py` nem embutido no bundle JS de nenhum app — o servidor é a
   única fonte de verdade.
3. Gera um token UUID e armazena no cache compartilhado com TTL.
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

> **Nota de produção:** Os tokens usam o cache compartilhado do Django. Redis
> é preferido quando `REDIS_URL` está configurada; caso contrário, o sistema
> usa a tabela `edustock_cache` no banco de dados.

---

### 5.5 Serializers

`core/serializers.py` — padrão `ModelSerializer` do DRF.

- **`ProdutoSerializer`** — expõe `grupo_nome`, `categoria`, `categoria_nome`, `fornecedor_nome` como campos somente-leitura. Campo `quantidade` é somente-leitura (controlado por service).
- **`EntradaSerializer`** — nested write para `itens`; `create()` delega para `registrar_entrada()`.
- **`MovimentacaoSerializer`** — `entrada` somente-leitura.
- **`PlanoProducaoQuerySerializer`** — valida `data` e uma das três refeições.
- **`BaixaProducaoRequestSerializer`** — valida data, refeição, UUID idempotente e itens opcionais.
- **`ConsultaBaixaProducaoSerializer`** — valida o UUID usado na reconciliação de uma baixa.

As respostas operacionais continuam sendo dicionários controlados pelos
serviços, sem expor campos financeiros.

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
| `0012` | Ajuste de `registrado_por_turma` em `FrequenciaDiaria` |
| `0013` | Modelos `Turma` e `PinAcesso` (substituem os PINs hardcoded em `settings.py`/`.env`) |
| `0014` | Seed de dados: as 12 turmas reais da escola |
| `0015`–`0018` | Remoção do perfil legado, proteção de PIN/cache, índices e configuração de alertas |
| `0019` | Persistência das operações idempotentes de baixa de produção |
| `0020` | Turmas somente integrais e três refeições diárias independentes |

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
  └─ POST /api/operacao/auth/ { pin, perfil: "ALUNO_REP" }
       (única validação — não há PIN nem turma copiados localmente)
  └─ Sessão (token + turma integral, vindos da resposta do backend)
       salva em sessionStorage

→ /registrar (ContagemView)
  └─ Exibe turma e informa "Período integral"
  └─ Teclado numérico grande (botões ≥ 64px, fonte ≥ 24px)
  └─ Aceita de 1 a 45 alunos; frontend e backend validam o limite
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
| `src/PinLogin.jsx` | Teclado 4 dígitos, auto-confirma, envia direto ao backend |
| `src/ContagemView.jsx` | Display numérico, teclado, estados: idle/loading/sucesso/erro |
| `../packages/operacao-shared/` | Login por PIN, cliente HTTP e tokens visuais compartilhados |

### Variáveis de ambiente

```env
VITE_API_BASE=                        # vazio = usa proxy do Vite
VITE_IDLE_TIMEOUT_MIN=5               # minutos; padrão 5
```

> Não há mais `VITE_PINS`/`VITE_TURNOS` — o app não guarda PIN nem
> mapeamento de turma algum. PINs são geridos via Django Admin
> (`/admin/core/turma/`, ver seção 4.5).

---

## 8. App Cozinha (`app-cozinha/`)

Aplicação React independente para merendeiras. **Sem acesso ao painel administrativo, preços ou fornecedores.**

### Fluxo de uso

```
Abrir app → /login (PinLogin)
  └─ PIN único da cozinha (4 dígitos)
  └─ POST /api/operacao/auth/ { perfil: "COZINHA" }

→ /producao (ProducaoView)
  └─ Cabeçalho: data atual + Café da manhã/Almoço/Lanche da tarde
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
       - Confirmar → POST idempotente em /api/operacao/baixa-de-producao/
       - Cada refeição aceita somente uma baixa por dia
       - Modal de resultado: sucessos e falhas individualizados
```

### Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/api.js` | Sessão, plano, UUID pendente, baixa e consulta de reconciliação |
| `src/App.jsx` | Roteamento + guarda de rota |
| `src/PinLogin.jsx` | Teclado de 4 dígitos; a validação ocorre somente no backend |
| `src/ProducaoView.jsx` | Cabeçalho, cards, modal de confirmação, modal de resultado |
| `../packages/operacao-shared/` | Login por PIN, cliente HTTP e tokens visuais compartilhados |

### Variáveis de ambiente

```env
VITE_API_BASE=             # vazio = usa proxy do Vite
VITE_IDLE_TIMEOUT_MIN=5    # minutos; padrão 5
```

---

## 9. Testes

### Backend

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
    ▼ Seleciona café da manhã, almoço ou lanche da tarde
    │
    ▼ GET /api/operacao/plano-do-dia/?data=...&refeicao=ALMOCO
       Para cada FatorConsumo ativo:
         quantidade = gramas_por_aluno × frequência integral / 1000
         estoque_insuficiente = saldo_atual < quantidade
    │
    ▼ Cards de receita exibidos
    │
    ▼ "Dar Baixa de Produção" → modal de confirmação
    │
    ▼ POST /api/operacao/baixa-de-producao/ com operacao_id único
       Para cada item:
         registrar_movimentacao(tipo=SAIDA, motivo="consumo")
         [transação atômica POR ITEM — falha não cancela demais]
    │
    ▼ Modal de resultado: sucessos e falhas individualizados
       Uma repetição recupera o resultado sem movimentar o estoque novamente
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
| E — Merenda | 2026-06-07 | FrequenciaDiaria, FatorConsumo, endpoints /operacao/*, autenticação PIN, app-alunos e app-cozinha |
| Fix CSS | 2026-06-07 | `padding` shorthand sobrescrevia `pl-10` na barra de busca |
| Turmas/PINs no banco | 2026-07-18 | Modelos `Turma`/`PinAcesso` substituem `OPERACAO_PINS_ALUNOS`/`OPERACAO_PIN_COZINHA` (settings.py) e `VITE_PINS`/`VITE_TURNOS`/`VITE_PIN_COZINHA` (env do app-alunos); corrige vazamento de PINs no bundle JS público — gestão passa a ser 100% via Django Admin |
| Sub-apps operacionais | 2026-08-02 | Presença integral limitada a 45, baixas idempotentes por três refeições, revisão de acessibilidade e documentação operacional |

---

## 13. Roadmap

### Próximos passos

- **Solicitações de reposição** — aba "sol" já existe no frontend (placeholder); lógica de pedidos baseada em consumo médio.
- **UI de Bens Permanentes** — backend e API prontos, falta tela de listagem/edição.
- **Auditoria de ações administrativas** — registrar alterações críticas com usuário, data e objeto afetado.
- **Redis dedicado** — opcionalmente substituir o cache de banco por Redis para reduzir carga no PostgreSQL.

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
| app-alunos | `VITE_API_BASE` | `""` | URL base da API (vazio = proxy Vite) |
| app-alunos | `VITE_IDLE_TIMEOUT_MIN` | `5` | Inatividade até o logout, em minutos |
| app-cozinha | `VITE_API_BASE` | `""` | URL base da API |
| app-cozinha | `VITE_IDLE_TIMEOUT_MIN` | `5` | Inatividade até o logout, em minutos |

> PINs não são mais variáveis de ambiente. São geridos via Django Admin
> (modelos `Turma`/`PinAcesso`, seção 4.5/5.1).

### Configurações Django relevantes

```python
# settings.py — CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # admin
    "http://localhost:5174",  # app-alunos
    "http://localhost:5175",  # app-cozinha
]

# settings.py — TTL das sessões de operação (PINs em si vivem no banco,
# nos modelos Turma/PinAcesso — geridos via /admin/, não em settings.py)
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

*Documentação atualizada em 2 de agosto de 2026 na branch `new/subapps-fases-2-3`.*
