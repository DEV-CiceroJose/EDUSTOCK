# 🏫 EduStock - Operação da Alimentação Escolar

Camada operacional que conecta presença real, previsão de produção, consumo
rastreável, baixa FEFO e indicadores municipais. Desenvolvida com Django e React.

## 🏛️ Redes municipais

A EduStock possui hierarquia Município/Secretaria → Escola, perfis por escopo,
isolamento autenticado dos dados, painel municipal, catálogo central, importação
CSV e indicadores de impacto. Instalações anteriores são migradas para uma escola
piloto padrão sem reescrever o histórico.

O guia de produto, as rotas e os portões de evidência para o Centelha estão em
[`docs/CENTELHA_PREPARACAO.md`](docs/CENTELHA_PREPARACAO.md).

## Principais recursos

- inventário, fornecedores, lotes e alertas;
- entradas, saídas, baixa FEFO e estorno auditável;
- unidades de estoque e consumo com conversão explícita;
- cardápios, receitas e produção diária;
- usuários, módulos e permissões;
- contagem de alunos e produção por PIN;
- fila offline visível e reenvio idempotente nos apps operacionais;
- demonstração segura com dados exclusivamente fictícios.
- hierarquia Município/Secretaria → Escola, vínculos e indicadores municipais.

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

- Arquitetura híbrida (frontends na Render e API/banco na Hostinger):
  [DEPLOY.md](DEPLOY.md).
- Decisões de domínio, responsabilidades e critérios da publicação definitiva:
  [docs/ACORDO_PUBLICACAO_HOSTINGER_RENDER.md](docs/ACORDO_PUBLICACAO_HOSTINGER_RENDER.md).
- Operação da VPS: [deploy/README.md](deploy/README.md).
- Checklist de validação antes de compartilhar:
  [docs/CHECKLIST_GO_LIVE_DEMO.md](docs/CHECKLIST_GO_LIVE_DEMO.md).
- Monitoramento, retenção e backup:
  [docs/OPERACAO_MONITORAMENTO_E_BACKUP.md](docs/OPERACAO_MONITORAMENTO_E_BACKUP.md).

O Blueprint `render.yaml` cria somente os sites estáticos `edustock-dashboard`,
`edustock-alunos` e `edustock-cozinha`. API Django e PostgreSQL são publicados
na VPS com o pacote da pasta `deploy/`; somente o proxy HTTPS fica exposto.

Não há `.env.production` versionado. Segredos e credenciais são configurados
somente no ambiente da VPS. A Render recebe apenas as URLs públicas da API
necessárias durante o build dos sites.

## Apps operacionais

Os detalhes de instalação PWA, rotas e comportamento offline estão em
[APPs_ALUNO_E_COZINHA.md](APPs_ALUNO_E_COZINHA.md). PINs não ficam em arquivos
`.env`: em uma instalação normal são administrados no Django; na demonstração
são cadastrados por um administrador autorizado no backend.

## Licença e autoria

Distribuído sob a licença MIT. Desenvolvimento inicial por Cicero José, a
partir de um modelo Django de Anderson Vieira.
