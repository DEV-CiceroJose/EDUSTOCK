# Infraestrutura híbrida Hostinger + Render

## Objetivo

Separar a publicação de produção do EduStock em duas camadas:

- Render: Dashboard, App Alunos e App Cozinha como Static Sites.
- Hostinger VPS: proxy HTTPS, Django/Gunicorn e PostgreSQL persistente.

O banco deve permanecer privado, a API deve aceitar apenas as origens HTTPS
declaradas dos três frontends e a publicação deve falhar cedo quando a URL da
API não tiver sido configurada na Render.

## Entregas

1. Converter `render.yaml` para três sites estáticos, sem API nem banco.
2. Simplificar `deploy/compose.yml` para `proxy`, `api` e `db`.
3. Restringir redes e portas: somente o proxy publica 80/443.
4. Validar as URLs de API no momento do build da Render.
5. Incluir backup PostgreSQL com checksum, cópia externa obrigatória e teste de
   restauração em banco temporário.
6. Atualizar CI e documentação de DNS, variáveis, primeira publicação,
   atualização e recuperação.

## Contratos verificáveis

- O Blueprint contém exatamente três serviços `runtime: static`.
- Nenhum banco ou backend é provisionado pela Render.
- `VITE_API_URL` e `VITE_API_BASE` são obrigatórios e aceitam apenas HTTPS.
- PostgreSQL e Django não publicam portas no host.
- CORS e CSRF recebem as três origens completas da Render.
- O backup não é considerado concluído sem checksum, validação do arquivo e
  cópia para um remoto configurado no rclone.
- A restauração é testada em banco separado e nunca sobrescreve o banco ativo.

## Validação

1. Testes de contrato do Blueprint e do pacote Hostinger.
2. Validação do Docker Compose e do Caddyfile.
3. Inicialização descartável de PostgreSQL + API e health check.
4. `pg_dump` e `pg_restore` em banco separado.
5. Testes Django completos, testes/builds dos três frontends e E2E críticos.

O deploy real, a criação de DNS e o cadastro de segredos continuam sendo ações
operacionais posteriores e exigem acesso confirmado às duas contas.
