# Deploy do EduStock

Este documento define o caminho de publicação. Para montar agora uma
demonstração descartável no plano gratuito, siga o roteiro específico em
[docs/DEPLOY_RENDER_FREE_DEMO.md](docs/DEPLOY_RENDER_FREE_DEMO.md).

## Arquitetura declarada

O `render.yaml` é a fonte de verdade do deploy e usa Python 3.13, Node 22 no
pipeline dos sites e PostgreSQL 18.

| Recurso | Nome no Blueprint | Tipo |
| --- | --- | --- |
| API Django | `edustock-demo-api` | Web Service |
| Dashboard | `edustock-demo-dashboard` | Static Site |
| App Alunos | `edustock-demo-alunos` | Static Site |
| App Cozinha | `edustock-demo-cozinha` | Static Site |
| Banco | `edustock-demo-db` | Render Postgres |

O backend executa `build.sh`, que instala dependências, coleta arquivos
estáticos, aplica migrations e, quando `DEMO_MODE=true`, executa
`python manage.py preparar_demo`. O processo web usa
`gunicorn easystock.wsgi:application` e o health check é `GET /api/health/`.

## Configuração segura

- Não versionar `.env`, `.env.local` ou `.env.production`.
- Manter `SECRET_KEY` e `PIN_LOOKUP_SECRET` estáveis, distintos e secretos.
- Usar `APP_ENV=production`, `DEBUG=false` e hosts/origens explícitos.
- Manter `DATABASE_URL` ligada ao banco pelo Blueprint.
- Nunca escrever senhas, PINs, tokens ou URLs internas nos logs.
- Em demonstração, usar somente dados fictícios e credenciais exclusivas.

As sete variáveis `sync: false` da demonstração devem ser preenchidas no painel
da Render, sem adicioná-las ao repositório:

```text
DEMO_ADMIN_USERNAME
DEMO_ADMIN_PASSWORD
DEMO_OPERATOR_USERNAME
DEMO_OPERATOR_PASSWORD
DEMO_ALUNOS_PIN
DEMO_COZINHA_PIN
DEMO_EXPIRES_AT
```

`DEMO_EXPIRES_AT` deve ser uma data/hora futura em ISO 8601, com fuso. O comando
de preparação falha se uma variável estiver ausente, se a data tiver expirado
ou se credenciais que deveriam ser distintas forem iguais.

## Demonstração gratuita versus produção

O plano Free serve para avaliação e apresentação, não para operação escolar. O
Web Service gratuito pode adormecer após 15 minutos sem tráfego e leva cerca de
um minuto para despertar. O filesystem é efêmero. O PostgreSQL Free tem 1 GB,
expira 30 dias após a criação e não oferece backup gerenciado nem recuperação.

Antes de qualquer uso real:

1. migrar API e banco para instâncias pagas compatíveis com a carga;
2. habilitar e testar recuperação e backups;
3. trocar todas as credenciais e desabilitar `DEMO_MODE`;
4. remover dados fictícios ou criar um banco limpo;
5. revisar domínio, CORS, CSRF, observabilidade e alertas;
6. executar o checklist completo de homologação;
7. definir responsáveis, retenção, resposta a incidentes e janela de mudança.

A Render informa que bancos pagos recebem recuperação point-in-time conforme o
plano do workspace. A migração deve ser agendada porque a alteração do tipo da
instância pode causar alguns minutos de indisponibilidade.

## Atualizações

Publicações devem partir de uma branch revisada e com CI verde. Após o merge, a
Render pode redeployar os serviços ligados ao repositório. Alterações em
variáveis de build dos sites estáticos também exigem novo deploy.

Depois de cada atualização:

1. acompanhar o build e procurar falhas de migration;
2. validar `GET /api/health/`;
3. executar [docs/CHECKLIST_GO_LIVE_DEMO.md](docs/CHECKLIST_GO_LIVE_DEMO.md);
4. confirmar que os logs não contêm segredos;
5. registrar a versão publicada e o responsável.

## Fontes oficiais

- [Deploy gratuito e limitações](https://render.com/docs/free)
- [Planos do Render Postgres](https://render.com/docs/postgresql-refresh)
- [Recuperação e backups do PostgreSQL](https://render.com/docs/postgresql-backups)
- [Deploy de Django na Render](https://render.com/docs/deploy-django)
- [Referência do Blueprint](https://render.com/docs/blueprint-spec)
