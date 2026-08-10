# EduStock

Sistema de gestão de estoque e merenda escolar composto por uma API Django e
três interfaces React: o dashboard administrativo, o app Alunos e o app
Cozinha.

## Principais recursos

- inventário, fornecedores, lotes e alertas;
- entradas, saídas, baixa FEFO e estorno auditável;
- unidades de estoque e consumo com conversão explícita;
- cardápios, receitas e produção diária;
- usuários, módulos e permissões;
- contagem de alunos e produção por PIN;
- fila offline visível e reenvio idempotente nos apps operacionais;
- demonstração segura com dados exclusivamente fictícios.

## Arquitetura

| Componente | Diretório | Tecnologia |
| --- | --- | --- |
| API | `easystock/`, `core/`, `plataforma/` | Python 3.13, Django e DRF |
| Dashboard | `frontend/` | Node 22, React e Vite |
| Alunos | `app-alunos/` | Node 22, React, Vite e PWA |
| Cozinha | `app-cozinha/` | Node 22, React, Vite e PWA |
| Banco | — | PostgreSQL em deploy; SQLite no desenvolvimento |

## Execução local

Use Python 3.13 e Node 22. O roteiro completo, incluindo os quatro processos e
as variáveis locais, está em [COMO_RODAR.md](COMO_RODAR.md).

Resumo:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Em outro terminal, execute cada frontend com `npm ci` e `npm run dev` nos
diretórios `frontend/`, `app-alunos/` e `app-cozinha/`.

## Testes

```bash
python manage.py test
```

No dashboard:

```bash
cd frontend
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Nos apps Alunos e Cozinha, execute `npm ci`, `npm test` e `npm run build` em
cada diretório. Os fluxos críticos de navegador ficam no dashboard:

```bash
cd frontend
npm run test:e2e
```

## Publicação

- Demonstração temporária no plano gratuito da Render:
  [docs/DEPLOY_RENDER_FREE_DEMO.md](docs/DEPLOY_RENDER_FREE_DEMO.md).
- Checklist de validação antes de compartilhar:
  [docs/CHECKLIST_GO_LIVE_DEMO.md](docs/CHECKLIST_GO_LIVE_DEMO.md).
- Diretrizes de produção e migração para plano pago: [DEPLOY.md](DEPLOY.md).
- Monitoramento, retenção e backup:
  [docs/OPERACAO_MONITORAMENTO_E_BACKUP.md](docs/OPERACAO_MONITORAMENTO_E_BACKUP.md).

O Blueprint oficial é o arquivo `render.yaml`. Ele cria os serviços
`edustock-demo-api`, `edustock-demo-dashboard`, `edustock-demo-alunos`,
`edustock-demo-cozinha` e o banco `edustock-demo-db`.

Não há `.env.production` versionado. Segredos e credenciais são configurados
somente no painel da Render. A demonstração nunca deve receber dados pessoais,
estoque real, documentos reais ou credenciais reutilizadas.

## Apps operacionais

Os detalhes de instalação PWA, rotas e comportamento offline estão em
[APPs_ALUNO_E_COZINHA.md](APPs_ALUNO_E_COZINHA.md). PINs não ficam em arquivos
`.env`: em uma instalação normal são administrados no Django; na demonstração
são fornecidos à Render como variáveis secretas e aplicados pelo comando
idempotente `preparar_demo`.

## Licença e autoria

Distribuído sob a licença MIT. Desenvolvimento inicial por Cicero José, a
partir de um modelo Django de Anderson Vieira.
