from datetime import datetime

from django.db import IntegrityError
from django.db.models import Sum
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FrequenciaDiaria
from .operacao import baixa_de_producao, gerar_plano_do_dia
from .operacao_auth import (
    PERFIL_ALUNO, PERFIL_COZINHA,
    autenticar_pin, criar_token, invalidar_token,
    requer_perfil_operacao,
)
from .services import calcular_previsao_producao, calcular_resumo_dia, total_frequencia


def _parse_date(value, default_today=False):
    if not value:
        if default_today:
            from django.utils import timezone
            return timezone.localdate(), None
        return None, Response(
            {"detail": "Parâmetro 'data' é obrigatório."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        return datetime.strptime(value, "%Y-%m-%d").date(), None
    except ValueError:
        return None, Response(
            {"detail": "Parâmetro 'data' inválido. Use YYYY-MM-DD."},
            status=status.HTTP_400_BAD_REQUEST,
        )


# --------------------------------------------------------------------------
# Autenticação por PIN
# --------------------------------------------------------------------------

class OperacaoLoginView(APIView):
    """
    POST /api/operacao/auth/
    Body: { "pin": "1234", "perfil": "ALUNO_REP" | "COZINHA" }
    Retorna: { "token", "perfil", "turma", "turno" }

    Este endpoint NÃO usa a autenticação Django — qualquer request pode
    chamar, mas só PINs válidos geram um token de sessão.
    """

    def post(self, request):
        pin = str(request.data.get("pin", "")).strip()
        perfil = str(request.data.get("perfil", "")).strip().upper()

        if not pin or not perfil:
            return Response(
                {"detail": "Informe 'pin' e 'perfil'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dados = autenticar_pin(perfil, pin)
        if not dados:
            return Response(
                {"detail": "PIN inválido."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token = criar_token(
            perfil=dados["perfil"],
            turma=dados.get("turma", ""),
            turno=dados.get("turno", ""),
        )
        return Response({
            "token": token,
            "perfil": dados["perfil"],
            "turma": dados.get("turma", ""),
            "turno": dados.get("turno", ""),
        })


class OperacaoLogoutView(APIView):
    """DELETE /api/operacao/auth/ — invalida o token."""

    def delete(self, request):
        token = request.headers.get("X-Operacao-Token", "").strip()
        if token:
            invalidar_token(token)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------
# Contagem de frequência
# --------------------------------------------------------------------------

class ContagemView(APIView):
    """
    POST — registra frequência de uma turma (app-alunos, perfil ALUNO_REP).
    GET  — retorna o total de alunos do dia/turno (app-cozinha, perfil COZINHA).

    Autenticação: header X-Operacao-Token (rejeita tokens de admin Django).
    """

    @requer_perfil_operacao(PERFIL_ALUNO)
    def post(self, request):
        sessao = request.sessao_operacao
        # turma e turno vêm da sessão autenticada pelo PIN
        turma = sessao["turma"]
        turno = sessao["turno"]

        quantidade_alunos = request.data.get("quantidade_alunos")
        data, err = _parse_date(request.data.get("data"), default_today=True)
        if err:
            return err

        # Permite override de turma/turno do body (para sessões de cozinha
        # registrando manualmente), mas a sessão ALUNO sempre usa os seus.
        turma = turma or (request.data.get("turma") or "").strip()
        turno = turno or request.data.get("turno")

        if not turma:
            return Response({"detail": "Informe a turma."}, status=status.HTTP_400_BAD_REQUEST)
        if turno not in dict(FrequenciaDiaria.TURNO_CHOICES):
            return Response({"detail": "Turno inválido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            quantidade_alunos = int(quantidade_alunos)
            if quantidade_alunos <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"detail": "quantidade_alunos deve ser um inteiro maior que zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            freq = FrequenciaDiaria.objects.create(
                data=data,
                turno=turno,
                turma=turma,
                quantidade_alunos=quantidade_alunos,
                registrado_por_turma=sessao.get("turma", turma),
                registrado_por=None,  # app-alunos não usa User Django
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        f"Frequência já registrada hoje para esta turma "
                        f"(turma '{turma}', turno {turno}, data {data.isoformat()})."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        previsao = calcular_previsao_producao(data, turno)
        return Response(
            {
                "id": freq.id,
                "data": data.isoformat(),
                "turno": turno,
                "turma": turma,
                "quantidade_alunos": quantidade_alunos,
                "previsao": previsao,
            },
            status=status.HTTP_201_CREATED,
        )

    @requer_perfil_operacao(PERFIL_COZINHA, PERFIL_ALUNO)
    def get(self, request):
        """Retorna total de alunos registrados para o dia/turno."""
        data, err = _parse_date(request.query_params.get("data"), default_today=True)
        if err:
            return err
        turno = request.query_params.get("turno")
        if turno and turno not in dict(FrequenciaDiaria.TURNO_CHOICES):
            return Response({"detail": "Turno inválido."}, status=status.HTTP_400_BAD_REQUEST)

        total = total_frequencia(data=data, turno=turno if turno else None)
        detalhes = (
            FrequenciaDiaria.objects
            .filter(data=data, **({} if not turno else {"turno": turno}))
            .values("turma", "turno", "quantidade_alunos")
            .order_by("turno", "turma")
        )
        return Response({
            "data": data.isoformat(),
            "turno": turno,
            "total_alunos": total,
            "turmas": list(detalhes),
        })


# --------------------------------------------------------------------------
# Resumo geral (sem proteção de perfil — usado pelo dashboard admin)
# --------------------------------------------------------------------------

class ResumoFrequenciaView(APIView):
    def get(self, request):
        data, err = _parse_date(request.query_params.get("data"), default_today=True)
        if err:
            return err
        return Response(calcular_resumo_dia(data))


# --------------------------------------------------------------------------
# Plano do dia (app-cozinha)
# --------------------------------------------------------------------------

class PlanoDoDiaView(APIView):

    @requer_perfil_operacao(PERFIL_COZINHA)
    def get(self, request):
        data, err = _parse_date(request.query_params.get("data"), default_today=True)
        if err:
            return err
        turno = request.query_params.get("turno")
        if turno not in dict(FrequenciaDiaria.TURNO_CHOICES):
            return Response(
                {"detail": "Parâmetro 'turno' é obrigatório. Use MANHA, TARDE ou INTEGRAL."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(gerar_plano_do_dia(data=data, turno=turno))


# --------------------------------------------------------------------------
# Baixa de produção (app-cozinha)
# --------------------------------------------------------------------------

class BaixaProducaoView(APIView):

    @requer_perfil_operacao(PERFIL_COZINHA)
    def post(self, request):
        data, err = _parse_date(request.data.get("data"), default_today=True)
        if err:
            return err
        turno = request.data.get("turno")
        if turno not in dict(FrequenciaDiaria.TURNO_CHOICES):
            return Response({"detail": "Turno inválido."}, status=status.HTTP_400_BAD_REQUEST)
        itens = request.data.get("itens")
        # user=None — baixa feita pelo app-cozinha, sem vínculo a User Django
        return Response(
            baixa_de_producao(data=data, turno=turno, itens_override=itens, user=None),
            status=status.HTTP_200_OK,
        )
