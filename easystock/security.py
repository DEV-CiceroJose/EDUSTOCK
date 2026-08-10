import os
from collections.abc import Mapping
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured


REQUIRED_PRODUCTION_ENV = (
    "DATABASE_URL",
    "SECRET_KEY",
    "PIN_LOOKUP_SECRET",
    "ALLOWED_HOSTS",
    "CORS_ALLOWED_ORIGINS",
)
TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def csv_env(name, env=os.environ):
    """Return a normalized comma-separated environment variable."""
    return [item.strip() for item in env.get(name, "").split(",") if item.strip()]


def _is_local_hostname(hostname):
    return hostname in LOCAL_HOSTS or hostname.endswith(".localhost")


def _validate_hosts(name, hosts):
    if not hosts:
        raise ImproperlyConfigured(f"{name} precisa conter ao menos um host em produ\u00e7\u00e3o.")
    for host in hosts:
        raw_host = host.strip().lower()
        if "://" in raw_host or any(marker in raw_host for marker in "/?#"):
            raise ImproperlyConfigured(
                f"{name} deve conter apenas nomes de host em produ\u00e7\u00e3o."
            )
        if raw_host.startswith("[") and "]" in raw_host:
            normalized = raw_host[1 : raw_host.index("]")]
        elif raw_host.count(":") == 1:
            normalized = raw_host.split(":", 1)[0]
        else:
            normalized = raw_host
        if (
            "*" in raw_host
            or raw_host.startswith(".")
            or _is_local_hostname(normalized)
        ):
            raise ImproperlyConfigured(
                f"{name} não pode conter localhost, loopback ou wildcard em produção."
            )


def _validate_origins(name, origins):
    if not origins:
        raise ImproperlyConfigured(f"{name} precisa conter ao menos uma origem em produ\u00e7\u00e3o.")
    for origin in origins:
        parsed = urlparse(origin)
        if parsed.scheme != "https":
            raise ImproperlyConfigured(
                f"{name} deve conter apenas origens HTTPS em produção."
            )
        if not parsed.hostname or _is_local_hostname(parsed.hostname.lower()):
            raise ImproperlyConfigured(
                f"{name} não pode conter localhost ou loopback em produção."
            )
        if parsed.path not in ("", "/") or parsed.params or parsed.query or parsed.fragment:
            raise ImproperlyConfigured(
                f"{name} deve conter origens, não URLs com caminho ou parâmetros."
            )


def validate_production_env(env: Mapping[str, str]) -> dict[str, object]:
    """Validate and normalize production values without importing settings."""
    missing = [name for name in REQUIRED_PRODUCTION_ENV if not env.get(name, "").strip()]
    if missing:
        raise ImproperlyConfigured(
            "Variáveis obrigatórias ausentes em produção: " + ", ".join(missing)
        )

    if env.get("DEBUG", "").strip().lower() in TRUE_VALUES:
        raise ImproperlyConfigured("DEBUG não pode ser habilitado em produção.")

    allowed_hosts = csv_env("ALLOWED_HOSTS", env)
    cors_origins = csv_env("CORS_ALLOWED_ORIGINS", env)
    csrf_origins = csv_env("CSRF_TRUSTED_ORIGINS", env) or list(cors_origins)
    database_url = env["DATABASE_URL"].strip()
    if urlparse(database_url).scheme not in {"postgres", "postgresql"}:
        raise ImproperlyConfigured("DATABASE_URL deve apontar para PostgreSQL em produ\u00e7\u00e3o.")
    _validate_hosts("ALLOWED_HOSTS", allowed_hosts)
    _validate_origins("CORS_ALLOWED_ORIGINS", cors_origins)
    _validate_origins("CSRF_TRUSTED_ORIGINS", csrf_origins)

    return {
        "DATABASE_URL": database_url,
        "SECRET_KEY": env["SECRET_KEY"].strip(),
        "PIN_LOOKUP_SECRET": env["PIN_LOOKUP_SECRET"].strip(),
        "ALLOWED_HOSTS": allowed_hosts,
        "CORS_ALLOWED_ORIGINS": cors_origins,
        "CSRF_TRUSTED_ORIGINS": csrf_origins,
        "DEBUG": False,
    }
