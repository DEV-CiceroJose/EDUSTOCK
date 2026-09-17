# Deploy antigo da demonstração completa na Render

O Blueprint que publicava API e PostgreSQL gratuitos na Render foi
descontinuado. O `render.yaml` atual publica somente Dashboard, Alunos e Cozinha
como sites estáticos. A API Django e o banco PostgreSQL ficam na VPS Hostinger.

Não siga instruções antigas que mencionem `edustock-demo-api` ou
`edustock-demo-db`: esses recursos não fazem parte da configuração atual.

Use [DEPLOY.md](../DEPLOY.md) para a implantação híbrida e
[OPERACAO_MONITORAMENTO_E_BACKUP.md](OPERACAO_MONITORAMENTO_E_BACKUP.md) para
backup, restauração e monitoramento.
