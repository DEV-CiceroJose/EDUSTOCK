# Como rodar o EduStock localmente

O sistema usa um backend Django e três frontends React.

## Pré-requisitos

- Python 3.13;
- Node.js 22;
- Git.

## 1. Preparar o backend

```bash
git clone https://github.com/DEV-CiceroJose/EDUSTOCK.git
cd EDUSTOCK
python -m venv .venv
```

Ative o ambiente virtual:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# Linux ou macOS
source .venv/bin/activate
```

Instale, migre e inicie:

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API: `http://127.0.0.1:8000/api/`

Health check: `http://127.0.0.1:8000/api/health/`

Para uma instalação local normal, crie contas escolhendo credenciais próprias:

```bash
python manage.py criar_admin <usuario>
```

O comando solicita a senha sem exibi-la no terminal. Para automação controlada,
use `--password-env NOME_DA_VARIAVEL` e remova a variável após a execução.

Não existem usuário, senha ou PIN de fábrica. PINs de Alunos e Cozinha são
administrados no Django Admin. Não use credenciais da demonstração em outro
ambiente.

## 2. Dashboard

Em outro terminal:

```bash
cd frontend
npm ci
```

Crie `frontend/.env.local` com:

```dotenv
VITE_API_URL=http://127.0.0.1:8000/api
VITE_DEMO_MODE=false
```

Depois:

```bash
npm run dev
```

Dashboard: `http://127.0.0.1:5173/`

## 3. App Alunos

```bash
cd app-alunos
npm ci
```

Crie `app-alunos/.env.local` com:

```dotenv
VITE_API_BASE=http://127.0.0.1:8000
```

```bash
npm run dev
```

Alunos: `http://127.0.0.1:5174/login`

## 4. App Cozinha

```bash
cd app-cozinha
npm ci
```

Crie `app-cozinha/.env.local` com:

```dotenv
VITE_API_BASE=http://127.0.0.1:8000
```

```bash
npm run dev
```

Cozinha: `http://127.0.0.1:5175/login`

## Variáveis e arquivos locais

Arquivos `.env.local` são ignorados pelo Git. Não crie nem versione
`.env.production`: a configuração de produção fica no `render.yaml` e os
segredos ficam no painel da hospedagem.

Para simular produção localmente, defina todas as configurações de segurança de
forma explícita. Não use `APP_ENV=production` com chaves fracas, SQLite, hosts
locais ou origens HTTP; o backend rejeita uma configuração insegura.

## Verificação rápida

1. Confirme resposta HTTP 200 em `/api/health/`.
2. Entre no dashboard por `/login` com a conta criada localmente.
3. Cadastre os PINs necessários no Django Admin.
4. Entre em Alunos e Cozinha com os respectivos PINs.
5. Registre somente dados locais de teste.

Para publicar a demonstração gratuita, não replique esta configuração manual:
use [docs/DEPLOY_RENDER_FREE_DEMO.md](docs/DEPLOY_RENDER_FREE_DEMO.md).
