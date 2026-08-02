# 🏫 EduStock - Sistema de Gestão Escolar

Sistema completo de gestão de estoque e merenda escolar desenvolvido com Django e React.

## 📋 Sobre o Projeto

EduStock é uma plataforma integrada para gerenciamento de:
- 📦 Inventário e estoque de produtos
- 🔄 Movimentações (entradas e saídas)
- ⚠️ Alertas de validade e estoque crítico
- 🏢 Cadastro de fornecedores
- 📊 Relatórios e análises
- 🍽️ Gestão de merenda escolar
- 👨‍🍳 Interface para cozinha (produção diária)
- 👨‍🎓 Interface para alunos (contagem de presença)

## 🚀 Tecnologias

### Backend
- **Django 6.0+** - Framework web Python
- **Django REST Framework** - API REST
- **PostgreSQL** - Banco de dados (produção)
- **SQLite** - Banco de dados (desenvolvimento)

### Frontend
- **React 19** - Biblioteca JavaScript
- **Vite** - Build tool e dev server
- **React Router** - Navegação SPA
- **Motion** - Animações
- **Tailwind CSS** - Estilização

## 📁 Estrutura do Projeto

```
EduStock/
├── core/                   # App Django principal
│   ├── models.py          # Modelos (Produto, Categoria, Movimentação, etc)
│   ├── views.py           # Views Django
│   ├── api_views.py       # API REST endpoints
│   ├── serializers.py     # Serializers DRF
│   └── tests/             # Testes automatizados
├── frontend/              # Dashboard administrativo (React)
│   ├── src/
│   │   ├── pages/LandingPage.jsx # Página institucional pública em /
│   │   ├── pages/        # Páginas (Inventário, Alertas, etc)
│   │   ├── api/          # API e contratos em TypeScript progressivo
│   │   ├── features/     # Componentes por feature
│   │   ├── layouts/      # Layouts (Header, Sidebar)
│   │   └── lib/          # Utilitários
│   └── package.json
├── app-alunos/           # Interface para alunos (React)
│   └── src/
├── app-cozinha/          # Interface para cozinha (React)
│   └── src/
├── packages/
│   └── operacao-shared/  # PIN, cliente HTTP e tokens usados pelos mini-apps
├── easystock/            # Configurações Django
│   ├── settings.py
│   └── urls.py
├── requirements.txt      # Dependências Python
├── render.yaml          # Configuração de deploy (Render)
└── DEPLOY.md            # Guia de deploy

```

## 🛠️ Instalação Local

### Pré-requisitos
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone o repositório
```bash
git clone https://github.com/SEU_USUARIO/edustock.git
cd edustock
```

### 2. Configure o Backend
```bash
# Criar ambiente virtual
python -m venv .venv

# Ativar ambiente virtual
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Rodar migrações
python manage.py migrate

# Criar superusuário
python manage.py createsuperuser

# Iniciar servidor
python manage.py runserver
```

Backend rodando em: http://127.0.0.1:8000/

### 3. Configure o Frontend Principal
```bash
cd frontend
npm install

# Criar arquivo .env
echo "VITE_API_URL=http://localhost:8000/api" > .env

npm run dev
```

Frontend rodando em: http://localhost:5173/

### 4. Configure o App Cozinha
```bash
cd app-cozinha
npm install

# Criar arquivo .env
echo "VITE_API_BASE=" > .env

npm run dev
```

App Cozinha rodando em: http://localhost:5175/

### 5. Configure o App Alunos
```bash
cd app-alunos
npm install

# Criar arquivo .env
cp .env.example .env

npm run dev
```

App Alunos rodando em: http://localhost:5174/

## 🔐 Gestão de PINs

Os PINs de acesso (turmas e equipe da cozinha) **não ficam mais em arquivos `.env`** — são cadastrados pelo Django Admin, em `/admin/core/turma/` (PINs de representantes de turma, 3 por turma) e `/admin/core/pinacesso/` (PINs da equipe da cozinha). Veja `docs/superpowers/specs/2026-07-18-turmas-pins-preco-design.md` para o desenho completo.

## 🚀 Deploy na Render

Siga o guia completo em [DEPLOY.md](DEPLOY.md)

**Resumo rápido:**
1. Faça push do código para o GitHub
2. Na Render: New → Blueprint
3. Conecte o repositório
4. Apply (a Render criará todos os serviços automaticamente)

## 🧪 Testes

### Backend (Django)
```bash
python manage.py test
```

### Frontend
```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm run test:e2e
```

O endereço `/` é público e apresenta a plataforma. O dashboard permanece
protegido nas rotas `/inventario`, `/movimentacoes`, `/alertas` e demais áreas
administrativas. Veja [docs/IMPLEMENTACAO_FASE_4.md](docs/IMPLEMENTACAO_FASE_4.md)
para detalhes da landing, migração de dados e testes E2E.

## 📊 Funcionalidades Principais

### Dashboard Administrativo
- ✅ Gestão completa de inventário
- ✅ Cadastro de produtos, categorias e grupos
- ✅ Registro de movimentações (entradas/saídas)
- ✅ Sistema de alertas (validade e estoque crítico)
- ✅ Gestão de fornecedores
- ✅ Relatórios personalizáveis
- ✅ Sidebar colapsável com hover
- ✅ Busca global de produtos
- ✅ Navegação rápida entre páginas

### App Cozinha
- 👨‍🍳 Registro de produção para café da manhã, almoço e lanche da tarde
- 📋 Visualização do plano do dia
- 🔐 Autenticação por PIN único
- 📲 Instalável pelo navegador como aplicativo (PWA)

### App Alunos
- 👨‍🎓 Registro de contagem de presença por turma
- 📊 Acompanhamento de frequência
- 🔐 Autenticação por PIN de turma
- ⏰ Registro simplificado para turmas de período integral
- 📲 Instalável pelo navegador como aplicativo (PWA)

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:
1. Fazer fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abrir um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Autores

- **Cicero José** - Desenvolvimento inicial
- **Anderson Vieira** - Modelo base do Django

**Feito para facilitar a gestão escolar**
