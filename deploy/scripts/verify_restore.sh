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

: "${BACKUP_REMOTE:?Informe BACKUP_REMOTE no arquivo de ambiente}"
command -v docker >/dev/null 2>&1 || { echo "docker não encontrado" >&2; exit 1; }
command -v rclone >/dev/null 2>&1 || { echo "rclone não encontrado" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum não encontrado" >&2; exit 1; }

temporary_dir=$(mktemp -d)
restore_db="edustock_restore_$(date -u +%Y%m%d%H%M%S)_$$"

cleanup() {
    docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/compose.yml" \
        exec -T db dropdb -U edustock --if-exists "$restore_db" >/dev/null 2>&1 || true
    rm -rf -- "$temporary_dir"
}
trap cleanup EXIT HUP INT TERM

if [ "$#" -gt 0 ]; then
    source_dir=$(CDPATH= cd -- "$(dirname -- "$1")" && pwd)
    source_name=$(basename -- "$1")
    test -f "$source_dir/$source_name.sha256"
    (cd "$source_dir" && sha256sum -c "$source_name.sha256")
    cp -- "$source_dir/$source_name" "$temporary_dir/latest.dump"
    (cd "$temporary_dir" && sha256sum latest.dump > latest.dump.sha256)
else
    remote=${BACKUP_REMOTE%/}
    rclone copyto "$remote/latest.dump" "$temporary_dir/latest.dump"
    rclone copyto "$remote/latest.dump.sha256" "$temporary_dir/latest.dump.sha256"
fi

(cd "$temporary_dir" && sha256sum -c latest.dump.sha256)

docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/compose.yml" \
    exec -T db createdb -U edustock "$restore_db"
docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/compose.yml" \
    exec -T db pg_restore -U edustock --exit-on-error -d "$restore_db" \
    < "$temporary_dir/latest.dump"
docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/compose.yml" \
    exec -T db psql -U edustock -d "$restore_db" -v ON_ERROR_STOP=1 \
    -c 'SELECT COUNT(*) FROM django_migrations;'

echo "Restauração validada em banco temporário: $restore_db"
