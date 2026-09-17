#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY_DIR=$(dirname "$SCRIPT_DIR")
ENV_FILE=${ENV_FILE:-$DEPLOY_DIR/.env}

if [ ! -f "$ENV_FILE" ]; then
    echo "Arquivo de ambiente não encontrado: $ENV_FILE" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${BACKUP_DIR:?Informe BACKUP_DIR no arquivo de ambiente}"
: "${BACKUP_REMOTE:?Informe BACKUP_REMOTE no arquivo de ambiente}"

case "$BACKUP_DIR" in
    ""|/|/var|/var/backups)
        echo "BACKUP_DIR precisa apontar para um diretório dedicado." >&2
        exit 1
        ;;
esac

command -v docker >/dev/null 2>&1 || { echo "docker não encontrado" >&2; exit 1; }
command -v rclone >/dev/null 2>&1 || { echo "rclone não encontrado" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum não encontrado" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
umask 077

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
filename="edustock-$timestamp.dump"
temporary="$BACKUP_DIR/.$filename.tmp"
final="$BACKUP_DIR/$filename"
latest="$BACKUP_DIR/latest.dump"

cleanup() {
    rm -f -- "$temporary"
}
trap cleanup EXIT HUP INT TERM

docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/compose.yml" \
    exec -T db pg_dump -U edustock -Fc edustock > "$temporary"

test -s "$temporary"
docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/compose.yml" \
    exec -T db pg_restore --list < "$temporary" >/dev/null

mv -- "$temporary" "$final"
(cd "$BACKUP_DIR" && sha256sum "$filename" > "$filename.sha256")
cp -- "$final" "$latest"
(cd "$BACKUP_DIR" && sha256sum "latest.dump" > "latest.dump.sha256")

remote=${BACKUP_REMOTE%/}
rclone copyto "$final" "$remote/$filename"
rclone copyto "$final.sha256" "$remote/$filename.sha256"
rclone copyto "$latest" "$remote/latest.dump"
rclone copyto "$latest.sha256" "$remote/latest.dump.sha256"

retention=${BACKUP_RETENTION_DAYS:-14}
case "$retention" in
    ''|*[!0-9]*)
        echo "BACKUP_RETENTION_DAYS precisa ser um número inteiro." >&2
        exit 1
        ;;
esac
find "$BACKUP_DIR" -type f \( -name 'edustock-*.dump' -o -name 'edustock-*.dump.sha256' \) \
    -mtime "+$retention" -delete

echo "Backup validado e enviado para $remote: $filename"
