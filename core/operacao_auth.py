"""
Autenticação leve para os endpoints /api/operacao/*.

Como o app-alunos e o app-cozinha usam PINs (não usuários Django),
adotamos tokens de sessão simples gerados no login via PIN.

Fluxo:
  1. POST /api/operacao/auth/  { pin, perfil }
     → valida o PIN contra os registros de PinAcesso no banco
     → retorna { token, turma, turno, perfil }  (token é um UUID de sessão)
  2. Cada request subseqüente inclui   X-Operacao-Token: <token>
  3. O decorador `requer_perfil_operacao` valida o token e o perfil.

Tokens ficam no cache compartilhado configurado pelo Django. Redis é
preferido em produção; o backend de banco também suporta múltiplos workers.

IMPORTANTE: tokens de admin Django são rejeitados com HTTP 403 nestes endpoints.
"""

import uuid
import hashlib
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response

# --------------------------------------------------------------------------
# Armazenamento compartilhado das sessões de operação
# --------------------------------------------------------------------------
TOKEN_TTL_HORAS = getattr(settings, "OPERACAO_TOKEN_TTL_HORAS", 12)
TOKEN_TTL_SEGUNDOS = int(TOKEN_TTL_HORAS * 60 * 60)
CHAVE_SESSAO_PREFIXO = "operacao:sessao:"

PERFIL_ALUNO = "ALUNO_REP"
PERFIL_COZINHA = "COZINHA"
PERFIS_VALIDOS = {PERFIL_ALUNO, PERFIL_COZINHA}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def _chave_sessao(token: str) -> str:
    digest = hashlib.sha256(str(token).encode("utf-8")).hexdigest()
    return f"{CHAVE_SESSAO_PREFIXO}{digest}"


def criar_token(
    perfil: str,
    turma: str = "",
    turno: str = "",
    turma_id: int | None = None,
    pin_acesso_id: int | None = None,
    pin_versao: str = "",
) -> str:
    token = str(uuid.uuid4())
    cache.set(_chave_sessao(token), {
        "perfil": perfil,
        "turma": turma,
        "turno": turno,
        "turma_id": turma_id,
        "pin_acesso_id": pin_acesso_id,
        "pin_versao": pin_versao,
    }, timeout=TOKEN_TTL_SEGUNDOS)
    return token


def validar_token(token: str) -> dict | None:
    """Retorna o dict da sessão ou None se inválido/expirado."""
    chave = _chave_sessao(token)
    sessao = cache.get(chave)
    if not sessao:
        return None

    pin_acesso_id = sessao.get("pin_acesso_id")
    if not pin_acesso_id:
        return sessao

    from core.models import PinAcesso

    pin_atual = PinAcesso.objects.filter(pk=pin_acesso_id, ativo=True).only(
        "pin_fingerprint"
    ).first()
    if not pin_atual or pin_atual.pin_fingerprint != sessao.get("pin_versao"):
        cache.delete(chave)
        return None
    return sessao


def invalidar_token(token: str) -> None:
    cache.delete(_chave_sessao(token))


# --------------------------------------------------------------------------
# Leitura dos PINs no banco (Turma / PinAcesso)
# --------------------------------------------------------------------------

def _dados_pin_aluno(pin: str) -> dict | None:
    """Localiza um PIN ativo sem expor nem manter o segredo em texto puro."""
    from core.models import PinAcesso

    pin_acesso = PinAcesso.objects.filter(
        papel=PinAcesso.ALUNO_REP,
        ativo=True,
        pin_fingerprint=PinAcesso.gerar_fingerprint(pin),
    ).select_related("turma").first()
    if not pin_acesso or not pin_acesso.confere_pin(pin):
        return None
    return {
        "pin_acesso_id": pin_acesso.id,
        "pin_versao": pin_acesso.pin_fingerprint,
        "turma_id": pin_acesso.turma_id,
        "turma": pin_acesso.turma.nome,
        "turno": pin_acesso.turma.turno,
    }


def _pin_cozinha(pin: str):
    from core.models import PinAcesso

    pin_acesso = PinAcesso.objects.filter(
        papel=PinAcesso.COZINHA,
        ativo=True,
        pin_fingerprint=PinAcesso.gerar_fingerprint(pin),
    ).only("id", "pin", "pin_fingerprint").first()
    return pin_acesso if pin_acesso and pin_acesso.confere_pin(pin) else None


# --------------------------------------------------------------------------
# Login via PIN
# --------------------------------------------------------------------------

def autenticar_pin(perfil: str, pin: str) -> dict | None:
    """
    Valida o PIN para o perfil informado.
    Retorna dict com dados da sessão ou None se inválido.
    """
    if perfil == PERFIL_ALUNO:
        dados = _dados_pin_aluno(pin)
        if not dados:
            return None
        return {"perfil": PERFIL_ALUNO, **dados}

    if perfil == PERFIL_COZINHA:
        pin_acesso = _pin_cozinha(pin)
        if not pin_acesso:
            return None
        return {
            "perfil": PERFIL_COZINHA,
            "turma": "",
            "turno": "",
            "pin_acesso_id": pin_acesso.id,
            "pin_versao": pin_acesso.pin_fingerprint,
        }

    return None


# --------------------------------------------------------------------------
# Decorador de proteção para views de operação
# --------------------------------------------------------------------------

def requer_perfil_operacao(*perfis):
    """
    Decorador para views DRF.
    Uso:
        @requer_perfil_operacao(PERFIL_ALUNO, PERFIL_COZINHA)
        def post(self, request): ...

    Regras:
    - Se o request tiver um usuário Django autenticado (token admin), rejeita
      com 403 — mantém o isolamento entre painel admin e apps de operação.
    - Lê o header X-Operacao-Token e valida no cache compartilhado.
    - Se o perfil da sessão não estiver entre os `perfis` permitidos, rejeita.
    """
    perfis_permitidos = set(perfis) if perfis else PERFIS_VALIDOS

    def decorator(method):
        @wraps(method)
        def wrapper(self, request, *args, **kwargs):
            # Bloqueia admin Django com 403
            if request.user and request.user.is_authenticated:
                return Response(
                    {"detail": "Acesso negado. Use o token de operação, não credenciais de admin."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            token = request.headers.get("X-Operacao-Token", "").strip()
            if not token:
                return Response(
                    {"detail": "Header X-Operacao-Token ausente."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            sessao = validar_token(token)
            if not sessao:
                return Response(
                    {"detail": "Token inválido ou expirado."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            if sessao["perfil"] not in perfis_permitidos:
                return Response(
                    {"detail": f"Perfil '{sessao['perfil']}' não autorizado neste endpoint."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Injeta a sessão no request para as views acessarem
            request.sessao_operacao = sessao
            return method(self, request, *args, **kwargs)

        return wrapper
    return decorator
