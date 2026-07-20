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

Tokens ficam em memória (dict) — reiniciar o servidor invalida todos.
Em produção seria cache distribuído (Redis), mas para o escopo do projeto
isso é adequado.

IMPORTANTE: tokens de admin Django são rejeitados com HTTP 403 nestes endpoints.
"""

import uuid
from datetime import datetime, timedelta
from functools import wraps

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response

# --------------------------------------------------------------------------
# Armazenamento em memória das sessões de operação
# --------------------------------------------------------------------------
# { token_str: { perfil, turma, turno, criado_em } }
_SESSOES: dict[str, dict] = {}

TOKEN_TTL_HORAS = getattr(settings, "OPERACAO_TOKEN_TTL_HORAS", 12)

PERFIL_ALUNO = "ALUNO_REP"
PERFIL_COZINHA = "COZINHA"
PERFIS_VALIDOS = {PERFIL_ALUNO, PERFIL_COZINHA}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def _sessao_expirada(sessao: dict) -> bool:
    limite = sessao["criado_em"] + timedelta(hours=TOKEN_TTL_HORAS)
    return datetime.utcnow() > limite


def criar_token(perfil: str, turma: str = "", turno: str = "") -> str:
    token = str(uuid.uuid4())
    _SESSOES[token] = {
        "perfil": perfil,
        "turma": turma,
        "turno": turno,
        "criado_em": datetime.utcnow(),
    }
    return token


def validar_token(token: str) -> dict | None:
    """Retorna o dict da sessão ou None se inválido/expirado."""
    sessao = _SESSOES.get(token)
    if not sessao:
        return None
    if _sessao_expirada(sessao):
        del _SESSOES[token]
        return None
    return sessao


def invalidar_token(token: str) -> None:
    _SESSOES.pop(token, None)


# --------------------------------------------------------------------------
# Leitura dos PINs no banco (Turma / PinAcesso)
# --------------------------------------------------------------------------

def _pins_alunos() -> dict[str, dict]:
    """Retorna mapa { pin: { turma, turno } } a partir de PinAcesso ativos."""
    from core.models import PinAcesso

    return {
        p.pin: {"turma": p.turma.nome, "turno": p.turma.turno}
        for p in PinAcesso.objects.filter(
            papel=PinAcesso.ALUNO_REP, ativo=True
        ).select_related("turma")
    }


def _pin_valido_cozinha(pin: str) -> bool:
    from core.models import PinAcesso

    return PinAcesso.objects.filter(
        papel=PinAcesso.COZINHA, ativo=True, pin=pin
    ).exists()


# --------------------------------------------------------------------------
# Login via PIN
# --------------------------------------------------------------------------

def autenticar_pin(perfil: str, pin: str) -> dict | None:
    """
    Valida o PIN para o perfil informado.
    Retorna dict com dados da sessão ou None se inválido.
    """
    if perfil == PERFIL_ALUNO:
        mapa = _pins_alunos()
        dados = mapa.get(pin)
        if not dados:
            return None
        return {"perfil": PERFIL_ALUNO, **dados}

    if perfil == PERFIL_COZINHA:
        if not _pin_valido_cozinha(pin):
            return None
        return {"perfil": PERFIL_COZINHA, "turma": "", "turno": ""}

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
    - Lê o header X-Operacao-Token, valida na memória de sessões.
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
