# EASYSTOCK — Frontend (React + Vite)

Interface do sistema de controle de estoque, estética "almoxarifado industrial".
Consome a API REST do backend Django **ou** roda sozinho em modo demonstração.

## Rodar (modo demonstração — sem backend)

```bash
cd frontend
npm install
npm run dev
```

Abre em http://localhost:5173. Os dados ficam em `localStorage` (mock que
espelha o contrato da API do Django). Para zerar: limpe o storage do navegador.

## Conectar ao backend Django real

1. Suba o Django com a API REST (na raiz do projeto):
   ```bash
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```
   Endpoints expostos:
   - `GET/POST       /api/produtos/`
   - `GET/PATCH/DEL  /api/produtos/<id>/`  · busca: `?search=`
   - `GET/POST       /api/categorias/`
   - `DELETE         /api/categorias/<id>/`

2. No `frontend/.env`, troque para a API real:
   ```env
   VITE_USE_MOCK=false
   VITE_API_URL=http://localhost:8000/api
   ```

3. Reinicie o `npm run dev`. Pronto — mesma UI, agora sobre o Django.

## Estrutura

```
src/
  api/        camada de dados (mock + http real, mesmo contrato)
  components/ design system (Button, Badge, Toast, ConfirmDialog, Layout)
  lib/        formatação (moeda BRL, datas BR, status de validade)
  pages/      Produtos, Formulário de Produto, Categorias
```

> O backend Python permanece **intacto** — a API REST foi adicionada por cima
> dos models/forms/admin existentes, sem reescrever a lógica.
