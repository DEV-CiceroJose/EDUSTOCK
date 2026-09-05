# Preparação do protótipo para VPS Hostinger

## Escopo

Análise iniciada na branch `new/centelha-multiescola-base`, a partir de `cd96a8f`,
com correções de navegação, sessão e configuração de publicação reunidas na
branch `edustock-vps`.
Nenhum recurso da Hostinger foi provisionado ou alterado nesta etapa.
O ambiente real da VPS e seus domínios ainda precisam ser verificados.

## Problemas identificados

| Prioridade | Evidência na base analisada | Tratamento |
| --- | --- | --- |
| Alta | O middleware não liberava `X-Operacao-Token`; o navegador bloqueava requisições autenticadas dos PWAs entre origens. | Cabeçalho permitido e teste de preflight, incluindo rejeição de origem não autorizada. |
| Alta | As origens aceitas estavam fixas em localhost/Render. | `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` configuráveis por ambiente. |
| Alta | A autenticação por token não verificava `user.is_active`. | Usuários desativados não podem reutilizar tokens ainda válidos. |
| Alta | Produção sem `DATABASE_URL` caía silenciosamente no SQLite; `DEBUG=True` era aceito. | A inicialização agora recusa essas configurações. |
| Média | `STATICFILES_STORAGE` não configurava o armazenamento de estáticos no Django 6. | Migração para `STORAGES`, com WhiteNoise e arquivos com hash/compressão. |
| Média | Títulos e rótulos do menu alteravam a altura das seções na expansão. | Alturas estáveis, rótulos sem quebra de linha e expansão por teclado. |
| Média | Logout disponível apenas no perfil e aguardando a rede para limpar a sessão. | Ação “Sair” no menu desktop/mobile e perfil; limpeza local imediata e tentativa de revogação no servidor com prazo de 5 segundos. |
| Média | Busca do cabeçalho tinha um estado separado do filtro do inventário. | Conexão com o filtro existente, validada no navegador. |
| Média | A tarefa E2E da CI inicia os três frontends, mas instalava dependências de apenas dois. | Instalação do app Cozinha incluída. |
| Média | Carregamento inicial do painel municipal bloqueava o lint por atualização síncrona de estado em efeito. | Consulta inicial assíncrona, com descarte da resposta após desmontar a tela. |
| Atenção no deploy | Os três arquivos `.env.production` ainda apontam para a Render. | Injetar explicitamente as URLs da VPS ao gerar os builds; manter os valores existentes preserva a publicação atual na Render. |

Quando não há conexão, sair remove a sessão deste navegador, mas não pode
garantir a revogação remota. O token remoto permanece sujeito à expiração.

## Configuração mínima da VPS

Manter Django/Gunicorn, PostgreSQL e os três builds React existentes. Um proxy
HTTPS, como Nginx, entrega os frontends e encaminha a API para Gunicorn escutando
apenas em `127.0.0.1:8000`. PostgreSQL e o Redis opcional não devem ficar expostos
na internet. Usar um usuário de serviço sem privilégios administrativos.

O arquivo `deploy/vps.env.example` lista as variáveis necessárias. O Django não
lê esse arquivo automaticamente: o gerenciador do serviço deve injetá-las no
ambiente. Não versionar o arquivo preenchido nem senhas/backups.

- Usar Python 3.13 e Node 22.12+ ou 24, conforme as ferramentas do projeto.
- Definir quatro domínios: painel, alunos, cozinha e API. Os nomes `example.com`
  são somente exemplos e precisam ser substituídos.
- Criar `SECRET_KEY` e `PIN_LOOKUP_SECRET` diferentes e aleatórios. Preservar
  `PIN_LOOKUP_SECRET` ao migrar dados existentes, pois os PINs dependem dela.
- Manter `APP_ENV=production`, `DEBUG=False` e `DATABASE_URL` explícita apontando
  para PostgreSQL. Hospedar o banco em armazenamento persistente.
- Configurar `ALLOWED_HOSTS` com nomes de host sem protocolo. As origens CORS/CSRF
  incluem `https://`, separadas por vírgula, sem barra final.
- Fazer o proxy sobrescrever `Host` e `X-Forwarded-Proto` corretamente. Ajustar
  `TRUSTED_PROXY_COUNT` se houver outra camada de proxy além da VPS.
- Habilitar certificado HTTPS e renovação automática antes de liberar os apps.
  O aviso `security.W021` é esperado enquanto HSTS preload permanecer desativado;
  não ativar preload sem validar a política de HTTPS dos domínios.

## Sequência de publicação

1. Escolher a revisão a publicar, conferir as diferenças e fazer backup do banco
   atual. Usar a revisão conferida da branch `edustock-vps`.
2. Preparar diretório da aplicação, ambiente Python e instalar `requirements.txt`.
3. Com as variáveis de produção injetadas, executar:

   ```sh
   python manage.py check --deploy
   python manage.py migrate
   python manage.py collectstatic --noinput
   ```

   As migrations criam `edustock_cache`; sem Redis esse cache compartilha sessões
   operacionais e limites de tentativas entre os processos do servidor.
4. Configurar Gunicorn como serviço com reinício automático e logs, usando
   `easystock.wsgi:application` e bind local `127.0.0.1:8000`.
5. Executar `npm ci` e `npm run build` em `frontend`, `app-alunos` e `app-cozinha`,
   preservando `packages/operacao-shared` ao lado dos três projetos. Injetar no
   build do painel `VITE_API_URL=https://api.DOMINIO/api`; nos PWAs,
   `VITE_API_BASE=https://api.DOMINIO`. Trocar variáveis exige gerar novo build.
6. Servir os respectivos diretórios `dist` nos três domínios HTTPS. Configurar
   fallback para `/index.html` nas rotas do painel e evitar cache prolongado de
   `index.html`, `service-worker.js` e manifestos dos PWAs.
7. Criar os acessos administrativos e operacionais previstos para a demonstração.
   Não executar `seed_demo.py` em um banco com dados reais sem revisar seu efeito.
8. Configurar backup externo periódico com restauração testada. Snapshot da VPS
   sozinho não substitui cópia recuperável fora do servidor.

## Critérios antes de liberar a demonstração

- `/api/health/` retorna 200 e confirma banco/cache.
- Login, logout e nova tentativa de usar o token encerrado foram testados na API.
- Abrir uma rota interna diretamente e atualizar a página não retorna 404.
- Navegação, busca e saída funcionam em computador e celular.
- Alunos e Cozinha autenticam e sincronizam entre os domínios reais, sem erros
  CORS/CSRF; testar também a fila offline e a retomada da conexão.
- Acessos de escola/rede correspondem ao público da demonstração.
- Reiniciar o serviço mantém os dados; recuperar um backup em banco separado.

## Limites e acompanhamento

### Verificação adicional em PostgreSQL — 04/09/2026

A branch `edustock-vps` inclui o job `Backend PostgreSQL` no GitHub Actions.
Ele inicia um PostgreSQL 16 temporário, aplica todas as migrações em um banco
vazio e executa a suíte completa do servidor. As credenciais declaradas nesse job
são exclusivas do banco descartável de CI.

A primeira execução aplicou as migrações, mas revelou dados de teste fora do
contrato de `Turma.curso` e restauração incompleta do banco nos testes históricos
de migração. Esses testes agora usam um curso válido e restauram as migrações
atuais de todos os apps antes da limpeza do banco.

Conferir o resultado da revisão a publicar em
[Actions da branch](https://github.com/DEV-CiceroJose/EDUSTOCK/actions?query=branch%3Aedustock-vps).
Essa execução não substitui a migração dos dados existentes, a restauração de
backup nem os testes nos domínios reais da VPS.

### Segunda revisão: sessão, falhas de rede e isolamento

Foram encontrados e corrigidos problemas adicionais antes da publicação:

- Uma resposta 401 das consultas autenticadas do dashboard encerra a sessão e
  retorna ao login com explicação. Um 403 mantém a sessão; a rejeição tardia de
  uma requisição antiga não encerra um login mais recente. O motivo da expiração
  permanece disponível ao recarregar a página e é limpo no novo login/logout.
- Usuários e Módulos tratam falhas HTTP/rede e oferecem nova tentativa. Alterações
  de papel/módulo são revertidas visualmente quando falham. A troca de escola
  informa falhas sem apresentar uma confirmação de sucesso.
- Endereços inexistentes mostram uma página com ação de retorno, em vez de tela
  vazia.
- A administração de usuários foi limitada às redes autorizadas. Contas com
  vínculos em redes fora desse escopo não podem ser alteradas por essa API.
  Contas legadas sem vínculo continuam restritas à compatibilidade da rede piloto.
- Revogar o último vínculo não recria acesso padrão; tokens são rejeitados e o
  login fica bloqueado enquanto não houver vínculo ativo.
- Alterações de escolas/vínculos não transferem o município nem anexam usuários
  de outra rede a vínculos locais pela API.

Validação desta rodada: 19 testes de backend e 30 testes focados do dashboard
aprovados. A reexecução E2E após atualizar dependências passou em dez cenários e
revelou perda intermitente do aviso de expiração. Após a correção, esse cenário
passou em cinco repetições consecutivas, incluindo recarregamento do login.
Lint, TypeScript e build do painel aprovados; nenhuma migration nova necessária.
Os testes da primeira revisão continuam registrados abaixo como histórico, sem
implicar que toda a suíte foi repetida nesta rodada.

### Dependências dos três aplicativos

A auditoria de dependências de produção encontrou avisos em bibliotecas dos
lockfiles. Foram aplicadas atualizações dentro das faixas já aceitas pelo projeto:

- Painel: DOMPurify `3.4.14` e Nano ID `3.3.18`.
- Alunos e Cozinha: Nano ID `3.3.18`, PostCSS `8.5.28` e React Router/DOM `7.18.3`.

A consulta final `npm audit --omit=dev` (com `--package-lock-only` no painel e
Alunos) retornou zero vulnerabilidades nos três projetos. Isso cobre os avisos
conhecidos consultados para as dependências de produção, não uma auditoria de
todas as ferramentas de desenvolvimento ou de todo o sistema.

Após atualizar as dependências, Alunos passou nos 26 testes e Cozinha nos 30;
ambos geraram seus builds. Os dois testes de exportação do painel também passaram.

Referências dos avisos corrigidos: [DOMPurify](https://github.com/advisories/GHSA-55q2-fjhq-7xh7),
[Nano ID](https://github.com/advisories/GHSA-2v37-7h3g-55p8),
[PostCSS](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) e
[React Router](https://github.com/advisories/GHSA-qwww-vcr4-c8h2).

A UI mínima do protótipo está atendida no escopo revisado. As próximas etapas
obrigatórias são aplicar a configuração da VPS, confirmar PostgreSQL/HTTPS,
testar restauração de backup e validar os fluxos completos por PIN e fila offline
nos domínios finais. Os módulos continuam sendo globais por instalação; não
representam configurações independentes por município.

### Validação realizada em 03/09/2026

- Suíte de referência do backend: 205 testes aprovados. Após as correções,
  11 testes focados em configuração, autenticação e revogação aprovados.
- Dashboard: 124 testes unitários aprovados considerando a execução geral e a
  reexecução do arquivo de preservação ajustado. Duas verificações antigas que
  exigiam as classes responsáveis pelo deslocamento do menu foram substituídas
  pelo teste de geometria e clique no navegador.
- App Alunos: 26 testes aprovados; App Cozinha: 30 testes aprovados.
- Lint e TypeScript do dashboard aprovados. Builds dos três aplicativos gerados
  com sucesso após instalação reproduzível com `npm ci`.
- Nove cenários E2E do dashboard aprovados: entrada, busca, criação de produto,
  entrada de estoque, permissões, merenda, navegação e celular.
- API Django real com banco SQLite temporário: login 200, health 200, logout 204
  e reutilização do token revogado rejeitada com 401. O preflight operacional
  passou no navegador, permitindo que um token inválido recebesse 401 da API
  em vez de falhar por CORS. Isso não equivale à validação do fluxo completo por
  PIN nos domínios de produção.
- Inspeção visual em 1280×900 e 390×844; sem transbordamento horizontal no celular
  nem erros de execução da página no fluxo real de login/logout.
- `collectstatic`: 157 arquivos copiados e 453 processados. `check --deploy`:
  apenas o aviso `security.W021`, sem ativar HSTS preload automaticamente.

As primeiras execuções simultâneas de Vitest no OneDrive falharam ao iniciar
workers. A validação final dos frontends foi executada numa cópia temporária
fora do OneDrive, com um worker por suíte, preservando os lockfiles do projeto.
Na segunda revisão, apenas as dependências identificadas acima foram atualizadas
nos lockfiles; os manifests mantiveram as faixas de versão existentes.

A análise não constitui uma auditoria completa de segurança ou uma validação da
infraestrutura remota. Testes locais com SQLite não comprovam migração nem
concorrência no PostgreSQL. Os testes E2E existentes usam API simulada; registrar
separadamente os testes com API real e os que ainda faltam na VPS.

O modo de dados simulados em Configurações deve
permanecer desativado ao demonstrar a integração real.

Referências: [Django: arquivos estáticos](https://docs.djangoproject.com/en/6.0/howto/static-files/)
e [django-cors-headers: configuração](https://github.com/adamchainz/django-cors-headers).
