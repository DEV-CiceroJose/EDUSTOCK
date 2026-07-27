# Como rodar o EduStock

O EduStock é composto por **1 backend Django** + **3 frontends React** (Dashboard, Cozinha e Alunos).

## Pré-requisitos
- Python 3.11+
- Node.js 18+
- Git

## 1. Clonar o repositório
```bash
git clone https://github.com/DEV-CiceroJose/EDUSTOCK.git
cd EDUSTOCK
```

## 2. Backend (Django)
```bash
# criar e ativar o ambiente virtual
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# instalar dependências
pip install -r requirements.txt

# rodar as migrações
python manage.py migrate

# criar o primeiro usuário administrador (escolha usuário e senha à sua vontade)
python manage.py createsuperuser
python manage.py criar_admin <usuario> <senha>

# (opcional) popular o banco com alguns produtos de exemplo
python manage.py shell < seed_demo.py

# iniciar o servidor
python manage.py runserver
```
Backend em: http://127.0.0.1:8000/

## 3. Frontend Dashboard (administrativo)
```bash
cd frontend
npm install
echo "VITE_API_BASE=" > .env
npm run dev
```
Em: http://localhost:5173/

## 4. App Cozinha
```bash
cd app-cozinha
npm install
echo "VITE_API_BASE=" > .env
npm run dev
```
Em: http://localhost:5175/

## 5. App Alunos
```bash
cd app-alunos
npm install
cp .env.example .env
npm run dev
```
Em: http://localhost:5174/

---

### ⚠️ Nota importante antes de rodar

Este pacote que te mandei está **desatualizado em relação ao repositório no GitHub** (`main`). O `main` está **dezenas de commits à frente** — foi adicionado um sistema completo de autenticação/permissões (app `plataforma`), gestão de usuários pelo dashboard, módulo Financeiro, tela de edição de perfil, entre outros. As instruções acima já refletem o que está **atualmente no GitHub**, e não exatamente o que veio no zip. Recomendo clonar direto do repositório (passo 1) em vez de usar os arquivos do zip, para não rodar uma versão velha do sistema.

---

### 🔐 Usuários e senhas

O sistema **não tem mais usuário/senha fixos de fábrica**. Isso mudou nas últimas atualizações:

- **Login do Dashboard (Django)**: não existe usuário padrão. Ele é criado por quem instala o sistema, no passo 2, com:
  ```bash
  python manage.py createsuperuser
  python manage.py criar_admin <usuario> <senha>
  ```
  Ou seja: o usuário e a senha são os que **você mesmo escolher** ao rodar esse comando.

- **PINs do App Cozinha e App Alunos**: também não ficam mais fixos em arquivo `.env`. Eles são cadastrados manualmente pelo administrador no Django Admin (`/admin/`), em:
  - `/admin/core/turma/` → PINs de cada turma (App Alunos)
  - `/admin/core/pinacesso/` → PINs da equipe da cozinha (App Cozinha)

  Ou seja, depois de criar o superusuário/admin, é preciso entrar no Django Admin e cadastrar os PINs manualmente antes de usar os apps de Cozinha e Alunos.
