# Operação, monitoramento e backup

Este guia cobre a arquitetura com frontends na Render e API/PostgreSQL na VPS
Hostinger.

## Indicadores mínimos

- `GET /api/health/` deve responder HTTP 200 e confirmar banco e cache;
- containers `db`, `api` e `proxy` devem permanecer saudáveis;
- uso de disco da VPS e do volume PostgreSQL deve ter margem para crescimento;
- certificados HTTPS não podem se aproximar da expiração;
- respostas 5xx, falhas repetidas de login e erros de sincronização devem gerar
  investigação;
- builds e deploys dos três sites Render precisam estar na mesma revisão
  aprovada da API.

Não exponha senha, PIN, token, `SECRET_KEY`, `PIN_LOOKUP_SECRET`, `.env` ou
`DATABASE_URL` em logs, capturas e chamados.

## Rotina operacional

Diariamente:

1. verificar health e estado dos containers;
2. confirmar sucesso do backup externo;
3. revisar erros recentes da API e do proxy;
4. observar espaço em disco e crescimento do banco.

Semanalmente:

1. executar a restauração automatizada em banco temporário;
2. testar login administrativo e por PIN;
3. confirmar uma operação crítica de estoque/merenda em homologação;
4. verificar os deploys e certificados.

Mensalmente:

1. revisar acessos administrativos e remover contas desnecessárias;
2. atualizar imagens e dependências após CI e homologação;
3. revisar retenção, capacidade, incidentes e tempo real de recuperação.

## Backup

`deploy/scripts/backup_postgres.sh` cria um dump PostgreSQL no formato custom,
valida o catálogo, gera checksum SHA-256 e envia a cópia para o remote definido
em `BACKUP_REMOTE`. O diretório local e o destino externo não podem apontar
para locais genéricos ou públicos.

Mantenha ao menos:

- uma cópia externa à VPS;
- criptografia e controle de acesso no destino;
- retenção compatível com a política de dados;
- registro de sucesso e falha de cada execução;
- uma versão conhecida do `.env` e procedimentos guardados em cofre seguro.

Os exemplos usam backup diário e restauração semanal. RPO e RTO definitivos
dependem da operação escolar e devem ser aprovados pelo responsável do serviço.

## Restauração

`deploy/scripts/verify_restore.sh` baixa a cópia externa `latest`, valida seu
checksum e restaura em um banco temporário. A verificação procura a tabela de
migrations e remove o banco temporário ao terminar.

Em um incidente real:

1. interrompa novas movimentações e registre o horário;
2. preserve evidências e identifique a última cópia válida;
3. restaure em banco separado, nunca diretamente sobre o banco danificado;
4. confira migrations e dados críticos com responsáveis da operação;
5. aponte a API para a instância recuperada em janela controlada;
6. valide health, logins, isolamento e fluxos críticos;
7. libere o acesso e documente causa, impacto e ações preventivas.

Uma restauração sem erro técnico ainda precisa de validação funcional dos
dados. Snapshot da Hostinger e volume Docker não substituem teste de restauração
de uma cópia independente.

## Alertas e limites

Até existir uma ferramenta de monitoramento dedicada, configure ao menos um
monitor HTTP externo para `/api/health/` e alertas de disco/CPU/memória da VPS.
Não use tráfego sintético para executar ações autenticadas ou alterar estoque.

Se o health falhar, verifique na ordem: resolução DNS/TLS, proxy, API, conexão
PostgreSQL, migrations e recursos da VPS. Evite reinícios sucessivos sem guardar
os logs que expliquem a falha.
