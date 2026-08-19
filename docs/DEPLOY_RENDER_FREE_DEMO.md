# Deploy da demonstração no Render Free

Este roteiro publica uma demonstração temporária e descartável do EduStock com
dados exclusivamente fictícios. O plano Free não é adequado para produção nem
para dados de escolas, alunos, servidores, fornecedores ou estoque reais.

## O que será criado

O `render.yaml` cria estes recursos:

| Nome | Tipo | Endereço declarado |
| --- | --- | --- |
| `edustock-demo-api` | Web Service Python Free | `https://edustock-demo-api.onrender.com` |
| `edustock-demo-dashboard` | Static Site | `https://edustock-demo-dashboard.onrender.com` |
| `edustock-demo-alunos` | Static Site | `https://edustock-demo-alunos.onrender.com` |
| `edustock-demo-cozinha` | Static Site | `https://edustock-demo-cozinha.onrender.com` |
| `edustock-demo-db` | PostgreSQL 18 Free | sem URL pública de aplicação |

A API usa Python 3.13.5. Os três sites são construídos com Node 22.22.0, fixado
em cada serviço por `NODE_VERSION`, conforme o mecanismo oficial da Render. O
banco se conecta à API pela referência `fromDatabase` do Blueprint; não copie a
URL do banco para arquivos do repositório.

## Limitações que precisam ser aceitas

Segundo a documentação da Render:

- um Web Service Free adormece após 15 minutos sem tráfego;
- o primeiro acesso seguinte leva cerca de um minuto para despertar;
- o filesystem do serviço é efêmero e é apagado em reinícios e redeploys;
- cada workspace recebe 750 horas de instância Free por mês;
- somente um Render Postgres Free pode ficar ativo por workspace;
- o PostgreSQL Free tem 1 GB e expira 30 dias após a criação;
- após a expiração do banco há 14 dias para upgrade antes da exclusão;
- banco Free não tem recuperação nem backup lógico gerenciado;
- a própria Render orienta a não usar instâncias Free em produção.

Esta demo persiste somente no PostgreSQL. Não use SQLite, uploads locais ou
arquivos do processo web como armazenamento.

## 1. Preparar contas e repositório

1. Tenha uma conta na [Render](https://dashboard.render.com/) e acesso ao
   repositório GitHub do EduStock.
2. Confirme que a branch `new/demo-render-prontidao` contém `render.yaml` e
   `build.sh`.
3. Confirme que o CI da branch está verde.
4. Não crie `.env.production`. Não faça commit de senhas, PINs ou chaves.
5. Escolha credenciais novas, exclusivas da demonstração e sem relação com
   pessoas reais.
6. Abra a lista de bancos do workspace. Se já houver um Postgres Free ativo:
   - não o exclua se ele pertencer a outro sistema;
   - para manter ambos, crie a demo em outro workspace ou migre deliberadamente
     um dos bancos para uma instância paga;
   - só remova o banco existente se ele for descartável, estiver no escopo da
     operação e a perda dos dados tiver sido aceita;
   - não aponte o EduStock para um banco de outra aplicação.

## 2. Criar o Blueprint

1. No painel da Render, escolha **New > Blueprint**.
2. Conecte o repositório do EduStock.
3. Selecione exatamente a branch `new/demo-render-prontidao`.
4. Confirme que a Render detectou o `render.yaml` da raiz.
5. Revise os cinco recursos e mantenha os planos `free` declarados.
6. Preencha as sete variáveis solicitadas pelo Blueprint.
7. Aplique o Blueprint e acompanhe todos os builds.

O formato está baseado na [referência oficial do Blueprint](https://render.com/docs/blueprint-spec)
e no [guia oficial de Django](https://render.com/docs/deploy-django).

## 3. Preencher as sete variáveis secretas

O `render.yaml` marca exatamente estas variáveis como `sync: false`, sem valor
versionado:

```text
DEMO_ADMIN_USERNAME
DEMO_ADMIN_PASSWORD
DEMO_OPERATOR_USERNAME
DEMO_OPERATOR_PASSWORD
DEMO_ALUNOS_PIN
DEMO_COZINHA_PIN
DEMO_EXPIRES_AT
```

Regras:

- use nomes de usuário fictícios e distintos;
- use senhas fortes, distintas e nunca reutilizadas;
- use PINs de quatro dígitos fictícios e distintos;
- informe `DEMO_EXPIRES_AT` em ISO 8601, no futuro e com fuso;
- guarde os valores em um gerenciador de senhas;
- compartilhe somente com os avaliadores autorizados;
- não cole os valores em logs, issues, PRs, documentos ou capturas.

As demais variáveis de produção já são declaradas no Blueprint. `SECRET_KEY` e
`PIN_LOOKUP_SECRET` são geradas pela Render; `DATABASE_URL` vem de
`edustock-demo-db`.

## 4. Acompanhar o primeiro deploy

O build da API executa, nesta ordem:

1. instalação das dependências;
2. coleta de arquivos estáticos;
3. migrations;
4. `python manage.py preparar_demo`, pois `DEMO_MODE=true`.

O comando de demo é idempotente: um redeploy atualiza as contas, os PINs e o
inventário fictício sem duplicar a carga inicial. Se faltar uma das sete
variáveis, se a data tiver expirado ou se houver conflito de identidade, o
build falha sem preparar uma demo parcial.

No plano Free não dependa de Shell da Render. A preparação foi incorporada ao
`build.sh` justamente para ser reproduzível pelo deploy.

## 5. Confirmar saúde e rotas

Aguarde os quatro serviços indicarem deploy concluído. Então valide:

| Verificação | Endereço |
| --- | --- |
| Health da API | `https://edustock-demo-api.onrender.com/api/health/` |
| Landing do dashboard | `https://edustock-demo-dashboard.onrender.com/` |
| Login administrativo | `https://edustock-demo-dashboard.onrender.com/login` |
| Inventário | `https://edustock-demo-dashboard.onrender.com/inventario` |
| Movimentações e estorno | `https://edustock-demo-dashboard.onrender.com/movimentacoes` |
| Login Alunos | `https://edustock-demo-alunos.onrender.com/login` |
| Registro Alunos | `https://edustock-demo-alunos.onrender.com/registrar` |
| Login Cozinha | `https://edustock-demo-cozinha.onrender.com/login` |
| Produção Cozinha | `https://edustock-demo-cozinha.onrender.com/producao` |

O health deve retornar HTTP 200 depois que a API despertar. Use
`DEMO_ADMIN_USERNAME` e `DEMO_ADMIN_PASSWORD` no dashboard. Use
`DEMO_ALUNOS_PIN` e `DEMO_COZINHA_PIN` apenas nos respectivos apps. A conta de
operador pode validar as restrições de permissão com as variáveis
`DEMO_OPERATOR_USERNAME` e `DEMO_OPERATOR_PASSWORD`.

Execute [CHECKLIST_GO_LIVE_DEMO.md](CHECKLIST_GO_LIVE_DEMO.md) antes de enviar
os links.

## 6. Rotacionar credenciais e renovar a validade

1. Abra `edustock-demo-api` no painel da Render.
2. Em **Environment**, troque usuários, senhas e PINs comprometidos.
3. Atualize `DEMO_EXPIRES_AT` somente se a demonstração ainda for autorizada.
4. Salve as variáveis e faça **Manual Deploy > Deploy latest commit**.
5. Acompanhe o build até `preparar_demo` concluir.
6. Teste os quatro logins e confirme que credenciais antigas falham.
7. Atualize o registro seguro de acessos; não atualize arquivos Git.

Trocar nome ou senha das contas demonstrativas revoga os tokens administrativos
anteriores. A rotação dos PINs atualiza os acessos operacionais no novo deploy.

## 7. Atualizar o código

1. Faça merge somente após CI e revisão.
2. Acompanhe o redeploy automático ou use **Deploy latest commit**.
3. Não escolha **Clear build cache** sem necessidade diagnosticada.
4. Valide health, migrations, logins e os fluxos do checklist.
5. Se um build falhar, mantenha o último deploy saudável e investigue os logs
   sem copiar segredos.

## 8. Expiração, recriação e migração paga

Registre a data de criação de `edustock-demo-db` e programe avisos antes de 30
dias. Para uma nova demo descartável, recrie os recursos pelo Blueprint com
novas credenciais; não importe dados reais.

Antes de qualquer implantação real:

1. migre o Web Service e o PostgreSQL para instâncias pagas;
2. planeje alguns minutos de indisponibilidade na troca de tipo do banco;
3. habilite e teste recuperação point-in-time e backups lógicos;
4. use um banco limpo e defina `DEMO_MODE=false`;
5. rotacione todos os segredos e remova os acessos de demonstração;
6. revise capacidade, domínios, CORS, CSRF, alertas e retenção;
7. faça uma restauração de teste antes do go-live.

## Fontes oficiais

- [Deploy gratuito e limitações](https://render.com/docs/free)
- [PostgreSQL Free: 1 GB e expiração](https://render.com/docs/postgresql-refresh)
- [Recuperação e backups do PostgreSQL](https://render.com/docs/postgresql-backups)
- [Deploy de Django](https://render.com/docs/deploy-django)
- [Especificação de Blueprint](https://render.com/docs/blueprint-spec)
- [Configuração da versão do Node.js](https://render.com/docs/node-version)
