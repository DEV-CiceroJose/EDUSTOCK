# 🚀 Guia de Deploy do EduStock na Render

Este guia explica como fazer o deploy completo do sistema EduStock na plataforma Render.

## 📋 Pré-requisitos

1. Conta no GitHub (para conectar o repositório)
2. Conta na Render (https://render.com - gratuita)
3. Código do projeto commitado em um repositório GitHub

## 🏗️ Arquitetura do Deploy

O EduStock será deployado em 5 serviços separados:

1. **PostgreSQL Database** - Banco de dados
2. **Backend Django** - API REST (edustock-backend)
3. **Frontend Admin** - Dashboard administrativo (edustock-frontend)
4. **App Cozinha** - Interface da cozinha (edustock-cozinha)
5. **App Alunos** - Interface dos alunos (edustock-alunos)

## 📝 Passo a Passo

### 1. Preparar o Repositório GitHub

```bash
# Se ainda não inicializou o Git
git init
git add .
git commit -m "Preparar projeto para deploy na Render"

# Criar repositório no GitHub e fazer push
git remote add origin https://github.com/SEU_USUARIO/edustock.git
git branch -M main
git push -u origin main
```

### 2. Deploy Usando render.yaml (Recomendado)

A forma mais fácil é usar o arquivo `render.yaml` já configurado:

1. Acesse https://dashboard.render.com/
2. Clique em **"New" → "Blueprint"**
3. Conecte seu repositório GitHub
4. Selecione o repositório **edustock**
5. A Render detectará automaticamente o `render.yaml`
6. Clique em **"Apply"**

A Render criará automaticamente todos os 5 serviços!

### 3. Deploy Manual (Alternativa)

Se preferir criar serviço por serviço:

#### 3.1. Criar o Banco de Dados

1. No Dashboard da Render, clique em **"New" → "PostgreSQL"**
2. Configure:
   - **Name**: `edustock-db`
   - **Database**: `edustock`
   - **User**: `edustock`
   - **Region**: escolha a mais próxima
   - **Plan**: Free
3. Clique em **"Create Database"**
4. Guarde a **Internal Database URL** (será usada no backend)

#### 3.2. Deploy do Backend Django

1. Clique em **"New" → "Web Service"**
2. Conecte seu repositório GitHub
3. Configure:
   - **Name**: `edustock-backend`
   - **Region**: mesma do banco de dados
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn easystock.wsgi:application`
   - **Plan**: Free

4. **Environment Variables** (variáveis de ambiente):
   ```
   PYTHON_VERSION = 3.11.0
   DATABASE_URL = [Cole aqui a Internal Database URL do PostgreSQL]
   SECRET_KEY = [Gere uma chave aleatória segura]
   DJANGO_SETTINGS_MODULE = easystock.settings
   DEBUG = False
   ALLOWED_HOSTS = .onrender.com
   ```

5. Clique em **"Create Web Service"**

Aguarde o build (5-10 minutos). A URL será algo como:
`https://edustock-backend.onrender.com`

#### 3.3. Deploy do Frontend Admin

1. Clique em **"New" → "Static Site"**
2. Conecte o mesmo repositório
3. Configure:
   - **Name**: `edustock-frontend`
   - **Branch**: `main`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`

4. **Environment Variables**:
   ```
   VITE_API_BASE = https://edustock-backend.onrender.com
   ```

5. Clique em **"Create Static Site"**

URL: `https://edustock-frontend.onrender.com`

#### 3.4. Deploy do App Cozinha

1. Clique em **"New" → "Static Site"**
2. Configure:
   - **Name**: `edustock-cozinha`
   - **Branch**: `main`
   - **Build Command**: `cd app-cozinha && npm install && npm run build`
   - **Publish Directory**: `app-cozinha/dist`

3. **Environment Variables**:
   ```
   VITE_API_BASE = https://edustock-backend.onrender.com
   ```

4. Clique em **"Create Static Site"**

URL: `https://edustock-cozinha.onrender.com`

#### 3.5. Deploy do App Alunos

1. Clique em **"New" → "Static Site"**
2. Configure:
   - **Name**: `edustock-alunos`
   - **Branch**: `main`
   - **Build Command**: `cd app-alunos && npm install && npm run build`
   - **Publish Directory**: `app-alunos/dist`

3. **Environment Variables**:
   ```
   VITE_API_BASE = https://edustock-backend.onrender.com
   ```

4. Clique em **"Create Static Site"**

URL: `https://edustock-alunos.onrender.com`

## 🔧 Configurações Pós-Deploy

### 1. Criar os Acessos Administrativos

Após o backend estar rodando, acesse o **Shell** do serviço (no Dashboard da
Render, entre no serviço `edustock-backend` → **"Shell"** no menu lateral).

São **dois** acessos distintos, para duas finalidades diferentes — crie os dois:

**a) Admin do painel React (dashboard `edustock-frontend`)** — necessário para
fazer login no dashboard e usar a tela de Módulos (`/admin/modulos`) e a gestão
de usuários. O sistema de autorização do painel usa o papel `ADMIN` do modelo
`Perfil` (conceito próprio, separado do superusuário do Django):

```bash
python manage.py criar_admin <usuario> <senha-forte>
```

> ⚠️ **Não use `createsuperuser` para isso.** Um superusuário do Django que
> faça login no painel React recebe o papel padrão `OPERADOR` e **não** consegue
> abrir a tela de Módulos nem gerenciar usuários. É `criar_admin` que cria o
> `Perfil` com papel `ADMIN`.

**b) Superusuário do Django Admin (`/admin/`)** — necessário para acessar o
Django Admin, onde se cadastram as Turmas e os PINs de acesso
(`/admin/core/turma/`, `/admin/core/pinacesso/`):

```bash
python manage.py createsuperuser
```

Podem ser a mesma pessoa (crie os dois com o mesmo usuário/senha, se preferir),
mas são registros e mecanismos independentes.

### 2. Atualizar CORS no Backend

Se os domínios da Render forem diferentes dos configurados, atualize as variáveis de ambiente do backend:

```
RENDER_EXTERNAL_HOSTNAME = edustock-backend.onrender.com
```

O código já está preparado para adicionar os domínios automaticamente.

### 3. Testar os Apps

Acesse cada URL e teste:

- **Admin**: https://edustock-frontend.onrender.com
- **Cozinha**: https://edustock-cozinha.onrender.com (PIN cadastrado no Django Admin)
- **Alunos**: https://edustock-alunos.onrender.com (PIN cadastrado no Django Admin, por turma)
- **Admin Django**: https://edustock-backend.onrender.com/admin

## ⚡ Plano Gratuito da Render

**Limitações do plano Free:**
- Serviços "dormem" após 15 minutos de inatividade
- Primeiro acesso pode demorar 30-60 segundos para "acordar"
- 750 horas/mês de uso (suficiente para 1 serviço 24/7)
- PostgreSQL: 256 MB RAM, 1 GB de armazenamento

**Dica**: Para evitar que o backend "durma", configure um serviço de ping (UptimeRobot, Cron-Job.org) para fazer requisições a cada 10 minutos.

## 🔄 Atualizações Futuras

Para atualizar o sistema após mudanças no código:

```bash
git add .
git commit -m "Descrição das mudanças"
git push origin main
```

A Render detectará o push e fará o redeploy automaticamente!

## 🛠️ Troubleshooting

### Backend não inicia
- Verifique os logs no Dashboard da Render
- Confirme que todas as variáveis de ambiente estão configuradas
- Verifique se o DATABASE_URL está correto

### Frontend mostra erro de API
- Confirme que VITE_API_BASE aponta para o backend correto
- Verifique CORS no backend
- Aguarde o backend "acordar" (pode levar ~30s)

### Mudanças no .env não aparecem
- Arquivos .env só são lidos no build
- Force um novo deploy: **"Manual Deploy" → "Deploy latest commit"**

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs de cada serviço no Dashboard da Render
2. Teste as APIs diretamente: `https://edustock-backend.onrender.com/api/produtos/`
3. Confirme que o banco de dados está online

## ✅ Checklist de Deploy

- [ ] Código commitado no GitHub
- [ ] Conta criada na Render
- [ ] PostgreSQL criado
- [ ] Backend deployado e rodando
- [ ] Frontend Admin deployado
- [ ] App Cozinha deployado
- [ ] App Alunos deployado
- [ ] Superusuário Django criado
- [ ] Todas as URLs testadas e funcionando

---

**🎉 Parabéns! Seu EduStock está no ar!** 🚀
