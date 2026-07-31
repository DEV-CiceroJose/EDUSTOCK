# Plano de deploy da fase 4

Este roteiro orienta a publicação da fase 4 com o menor risco possível. O
deploy de produção não faz parte da abertura do Pull Request e deve ser
executado separadamente, após revisão e aprovação.

## 1. Pré-deploy

- Confirmar que o Pull Request está aprovado e que o CI está verde.
- Criar e verificar um backup completo do PostgreSQL de produção.
- Conferir no ambiente do backend: `SECRET_KEY`, `PIN_LOOKUP_SECRET`,
  `DATABASE_URL`, `DEBUG=false`, `APP_ENV=production`, `ALLOWED_HOSTS` e
  `TRUSTED_PROXY_COUNT`.
- Confirmar que os domínios públicos dos três frontends apontam para a versão
  que será publicada.

## 2. Ordem de publicação

1. Publicar o backend no serviço de hospedagem atual.
2. Aguardar o health check e executar as migrations, incluindo
   `0018_alert_config_and_remove_legacy_product_fields`.
3. Validar login, consulta de inventário e alertas antes de publicar os
   frontends.
4. Publicar `frontend`, `app-alunos` e `app-cozinha`.
5. Invalidar cache/CDN, se houver, e repetir os testes rápidos abaixo.

A migration 0018 copia dados legados para entradas e movimentações e remove
colunas antigas de produto. Por isso, o backup do banco é obrigatório antes da
execução; não se deve aplicar essa migration diretamente em produção sem uma
cópia recuperável.

## 3. Smoke tests pós-deploy

- Abrir a landing pública em `/` no desktop e no celular.
- Entrar em `/login` e acessar o inventário autenticado.
- Criar uma entrada de estoque com nota fiscal e conferir a movimentação.
- Abrir os alertas e confirmar que a configuração administrativa é respeitada.
- Validar o login por PIN e o registro de presença em `app-alunos`.
- Validar o fluxo operacional de `app-cozinha`.
- Conferir logs do backend, erros do navegador e respostas 5xx durante os
  primeiros minutos.

## 4. Rollback

- Frontends: republicar a versão anterior conhecida como saudável.
- Backend: republicar o commit anterior e interromper novas escritas se houver
  inconsistência funcional.
- Banco: restaurar o backup completo caso a conversão da migration 0018 tenha
  produzido dados incorretos. Não executar `migrate` reverso de forma casual,
  pois os campos legados foram removidos intencionalmente.
- Após a recuperação, repetir os smoke tests e registrar o incidente antes de
  uma nova tentativa.

## 5. Acompanhamento

Manter a versão publicada e o identificador do backup registrados junto ao
commit do deploy. Monitorar autenticação, movimentações, alertas e presença no
primeiro período de uso; qualquer erro de dados deve bloquear novas alterações
até a análise do backup e dos logs.
