# Operação da API e banco na VPS

Esta pasta sobe três serviços: PostgreSQL, API Django/Gunicorn e Caddy. Somente
o Caddy publica as portas 80 e 443. Os três frontends são publicados pela
Render e não são construídos nesta VPS.

## Pré-requisitos

- VPS Linux com Docker Engine e Docker Compose;
- DNS de `API_HOST` apontando para o IP público da VPS;
- portas 80/443 liberadas e SSH restrito aos administradores;
- destino externo configurado no `rclone` para os backups;
- revisão aprovada e imagem da API identificada por versão.

## Primeira instalação

No diretório `deploy/` da VPS:

```sh
cp compose.env.example .env
chmod 600 .env
```

Preencha todos os campos de `.env`. Gere valores aleatórios e diferentes para
`SECRET_KEY`, `PIN_LOOKUP_SECRET` e `POSTGRES_PASSWORD`. As origens devem
ser URLs HTTPS completas, sem barra final. Use somente caracteres hexadecimais
na senha do PostgreSQL, pois ela compõe a URL interna de conexão.

Valide e inicie:

```sh
docker compose --env-file .env -f compose.yml config --quiet
docker compose --env-file .env -f compose.yml pull db proxy
docker compose --env-file .env -f compose.yml build api
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml ps
```

O primeiro início espera o PostgreSQL, aplica migrations, coleta arquivos
estáticos e inicia o Gunicorn. O Caddy solicita o certificado automaticamente.

## Verificação

```sh
set -a
. ./.env
set +a
curl --fail --show-error "https://${API_HOST}/api/health/"
docker compose --env-file .env -f compose.yml logs --tail=100 api proxy
```

Também valide o preflight CORS a partir de cada origem e os fluxos autenticados
nos três sites. Resposta do health não comprova permissões, PINs ou isolamento
entre escolas.

## Backup externo

Configure um remote do `rclone`, por exemplo `edustock-backups`, e ajuste
`BACKUP_REMOTE` no `.env`. Depois execute:

```sh
./scripts/backup_postgres.sh
./scripts/verify_restore.sh
```

O primeiro comando produz dump customizado, valida seu catálogo, gera SHA-256 e
envia dump e checksum ao destino externo. O segundo baixa a cópia `latest`,
confere o checksum e restaura em um banco temporário. Ele não sobrescreve o
banco em uso.

Somente depois desse teste instale as entradas sugeridas em `cron.example`,
ajustando o caminho `/opt/edustock/deploy` à instalação real. Proteja os logs e
monitore falhas do cron. Snapshot da VPS complementa, mas não substitui, uma
cópia externa restaurável.

## Atualização

```sh
./scripts/backup_postgres.sh
docker compose --env-file .env -f compose.yml pull db proxy
docker compose --env-file .env -f compose.yml build api
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml ps
```

Confira migrations e logs antes de liberar usuários. Não execute
`docker compose down --volumes`: o volume contém o banco. Preserve também
`.env`, a configuração do `rclone` e os volumes do Caddy.
