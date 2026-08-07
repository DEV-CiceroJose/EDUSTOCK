# EduStock Demo Endurecida na Render Free

## Objetivo

Preparar e publicar uma demonstração descartável do EduStock em uma única
escola fictícia, corrigindo os riscos críticos de integridade, segurança,
testes e configuração identificados na auditoria de 7 de agosto de 2026.

A demonstração não será tratada como produção. Ela usará somente dados
fictícios e credenciais temporárias, poderá apresentar partida a frio e terá
banco PostgreSQL gratuito com validade limitada pela Render.

## Escopo

Esta entrega inclui:

- correção dos bloqueadores críticos de integridade de dados;
- endurecimento das configurações de produção;
- preparação idempotente de dados fictícios;
- atualização da esteira de testes e segurança;
- documentação operacional da demonstração;
- branch de release e pull request para `main`;
- publicação e validação na Render Free.

Esta entrega não inclui:

- arquitetura multi-escola;
- MFA;
- integrações externas;
- uploads e armazenamento de arquivos;
- alta disponibilidade;
- garantias de backup ou recuperação do banco gratuito;
- disponibilidade contínua sem partida a frio.

## Arquitetura da demonstração

A branch `new/demo-render-prontidao` parte de
`origin/new/subapps-fases-2-3`, que contém o PR 36. O pull request final terá
`main` como base.

A Render hospedará:

| Serviço | Tipo | Nome planejado |
| --- | --- | --- |
| API Django | Web Service Free | `edustock-demo-backend` |
| Dashboard | Static Site | `edustock-demo-admin` |
| Alunos | Static Site | `edustock-demo-alunos` |
| Cozinha | Static Site | `edustock-demo-cozinha` |
| Dados | PostgreSQL Free | `edustock-demo-db` |

O backend usará Gunicorn, WhiteNoise, PostgreSQL e o cache compartilhado em
banco já existente. Redis não será exigido para a demonstração. Os três
frontends serão compilados com as URLs públicas do novo backend.

## Dados fictícios e preparação inicial

Um comando Django idempotente preparará a demonstração. Ele será executado
depois das migrações e poderá ser executado novamente sem duplicar registros
nem substituir alterações feitas durante a demonstração.

O comando criará, quando ausentes:

- uma conta administrativa temporária;
- uma conta de operador;
- turmas integrais de exemplo;
- um PIN de representante e um PIN de cozinha;
- categorias, grupos, produtos e fornecedores fictícios;
- entradas, lotes e saldos fictícios;
- receita, ingredientes e cardápio de demonstração.

Usuários, senhas e PINs serão recebidos por variáveis de ambiente. Nenhuma
credencial será gravada no repositório, no log do comando ou na auditoria.
O comando só funcionará quando `DEMO_MODE=True`.

## Integridade do Dashboard

O modo de dados simulados continuará disponível para desenvolvimento e
testes locais. Em um build de produção:

- a aplicação sempre selecionará a API HTTP real;
- o controle “Usar dados mock” não será renderizado;
- um valor antigo de `localStorage` não poderá reativar o mock;
- um indicador visual identificará o ambiente como “Demonstração” quando
  `VITE_DEMO_MODE=true`.

Essa separação será determinada no momento do build, não por configuração
editável pelo usuário.

## Fila offline

Cada item da fila terá `operacao_id`, corpo, estado, número de tentativas,
data de criação, último erro e próxima tentativa permitida.

Os estados serão:

- `pending`: aguardando envio;
- `attention`: rejeitado definitivamente e aguardando ação do usuário.

O resultado de sincronização classificará respostas assim:

| Resultado | Comportamento |
| --- | --- |
| Sucesso 2xx | Remove da fila |
| Repetição idempotente confirmada | Remove da fila |
| Falha de rede | Mantém como `pending` |
| HTTP 429 | Mantém como `pending` e respeita `Retry-After` |
| HTTP 500–599 | Mantém como `pending` com retentativa posterior |
| HTTP 401/403 | Mantém a fila e pausa até novo login |
| HTTP 400/404/409/422 | Mantém como `attention`, com mensagem legível |

Alunos e Cozinha mostrarão um resumo de pendências. O usuário poderá tentar
novamente itens pendentes, revisar erros que exigem atenção e remover um item
somente após confirmação explícita. A troca de turma não enviará registros de
outra turma.

## Unidades de estoque e consumo

Produto e ingrediente passarão a separar a unidade de estoque da unidade de
consumo.

Cada produto terá:

- `unidade`: unidade contabilizada no estoque (`KG`, `L`, `UN`, `CX`, `PC`);
- `unidade_consumo`: unidade usada na receita (`G`, `ML`, `UN`);
- `conteudo_por_unidade`: quantidade da unidade de consumo contida em uma
  unidade de estoque.

Exemplos:

| Estoque | Consumo | Conteúdo |
| --- | --- | ---: |
| 1 KG de arroz | G | 1000 |
| 1 L de leite | ML | 1000 |
| 1 UN de ovo | UN | 1 |
| 1 PC de macarrão | G | 500 |
| 1 CX de ovos | UN | 12 |

O ingrediente armazenará `quantidade_por_aluno` na `unidade_consumo` do
produto. A quantidade retirada do estoque será:

`quantidade_por_aluno × total_alunos ÷ conteudo_por_unidade`.

Migrações converterão automaticamente apenas casos inequívocos: `KG` para
`G/1000`, `L` para `ML/1000` e `UN` para `UN/1`. Produtos `CX` e `PC`
precisarão de conteúdo configurado antes de participar de receita ou fator de
consumo. A API rejeitará combinações incompatíveis.

## Correções e trilha do estoque

`Produto.quantidade` e a validade derivada dos lotes serão somente leitura no
Django Admin. Saldos só poderão mudar pelos serviços transacionais de
movimentação.

Erros operacionais serão corrigidos por uma movimentação compensatória. Ela
terá tipo oposto, motivo obrigatório, responsável e referência à movimentação
original. Movimentações continuarão sem edição ou exclusão.

A auditoria registrará a correção e ambos os identificadores. Essa solução
preserva a cadeia histórica sem introduzir um mecanismo de exclusão.

## Segurança e contas

Quando `APP_ENV=production`:

- `DATABASE_URL`, `SECRET_KEY` e `PIN_LOOKUP_SECRET` serão obrigatórios;
- `DEBUG=True` será rejeitado;
- hosts e origens serão lidos de listas definidas por ambiente;
- origens locais de desenvolvimento não serão liberadas;
- HTTPS e cookies seguros permanecerão habilitados;
- uma política CSP compatível com os frontends será aplicada;
- o token do Dashboard terá duração configurável e menor na demonstração.

A autenticação rejeitará imediatamente usuários inativos e revogará seus
tokens. O Dashboard administrativo permitirá:

- ativar ou desativar usuário;
- definir uma nova senha temporária;
- revogar todas as sessões do usuário.

Senhas nunca aparecerão em resposta de API ou registro de auditoria. O comando
legado `criar_admin` passará a pedir senha de forma não exibida quando ela não
vier de uma variável segura.

Perfis novos exigirão seleção explícita de módulos. O comportamento legado
“nenhum módulo significa todos” será mantido apenas para perfis existentes até
uma migração controlada, e a interface avisará claramente esse estado.

## Configuração da Render

O `render.yaml` declarará os cinco recursos e suas variáveis. As URLs públicas
dos frontends serão incluídas em `ALLOWED_HOSTS`, CORS e CSRF por variáveis de
ambiente. Os builds dos sites estáticos receberão a URL do backend e
`VITE_DEMO_MODE=true`.

O backend executará, nesta ordem:

1. instalação das dependências;
2. coleta dos arquivos estáticos;
3. aplicação das migrações;
4. preparação idempotente dos dados fictícios;
5. inicialização pelo Gunicorn.

O health check `/api/health/` continuará validando banco e cache. Falha de
migração, preparação ou health check invalida a publicação.

## Testes e CI

A esteira instalará dependências de Dashboard, Alunos e Cozinha antes do E2E.
O seletor de senha usará papel e nome exatos para não confundir o campo com o
botão de visibilidade.

Serão adicionadas regressões para:

- mock impossível em build de produção;
- todas as classificações de falha da fila offline;
- conversões e incompatibilidades de unidade;
- proteção do saldo no Django Admin;
- movimentação compensatória;
- autenticação de usuário inativo e revogação de tokens;
- preparação idempotente da demo;
- configurações obrigatórias de produção.

O CI terá PostgreSQL para uma suíte de integração e checks de vulnerabilidade
para Python e para os três projetos JavaScript. Atualizações de dependência
serão escolhidas manualmente após teste; nenhuma correção forçada com mudança
incompatível será aplicada sem validação.

## Fluxo Git e publicação

Os commits serão incrementais, humanizados e atribuídos a `DEV-CiceroJose`.
Depois da verificação completa, a branch será enviada e um pull request pronto
para revisão será aberto contra `main`.

A proteção de `main` exigirá pull request e sucesso dos jobs de backend,
frontends, E2E, PostgreSQL e segurança. A branch da demonstração será usada
como fonte da Render antes da integração, permitindo validar o ambiente real
sem mesclar código não comprovado.

## Validação da demonstração

Depois do deploy serão verificados:

- health check público;
- abertura dos três sites estáticos;
- login administrativo;
- inventário, entrada e movimentação;
- login e contagem no app Alunos;
- login, plano e baixa no app Cozinha;
- sincronização offline e idempotência;
- bloqueio do modo mock em produção;
- ausência de dados e credenciais reais.

## Limitações e encerramento

O plano Free é destinado apenas à demonstração. O backend pode dormir após
inatividade e o PostgreSQL gratuito expira após 30 dias, sem backups. A
documentação incluirá a data de criação, a data prevista de expiração e os
passos para migrar para instâncias pagas.

A demonstração será considerada concluída quando todas as suítes estiverem
verdes, o PR estiver aberto, as quatro URLs responderem e os fluxos críticos
forem validados com os dados fictícios.
