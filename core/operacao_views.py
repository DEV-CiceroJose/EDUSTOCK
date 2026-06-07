from datetime import datetime

from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FrequenciaDiaria
from .operacao import baixa_de_producao, gerar_plano_do_dia
from .services import calcular_previsao_producao, calcular_resumo_dia


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


class ContagemView(APIView):
    def post(self, request):
        turma = (request.data.get("turma") or "").strip()
        turno = request.data.get("turno")
        quantidade_alunos = request.data.get("quantidade_alunos")
        data, err = _parse_date(request.data.get("data"), default_today=True)
        if err:
            return err

        if not turma:
            return Response({"detail": "Informe a turma."}, status=status.HTTP_400_BAD_REQUEST)
        if turno not in dict(FrequenciaDiaria.TURNO_CHOICES):
            return Response({"detail": "Turno inválido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            quantidade_alunos = int(quantidade_alunos)
            if quantidade_alunos < 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"detail": "quantidade_alunos deve ser um inteiro não negativo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user if request.user.is_authenticated else None
        try:
            freq = FrequenciaDiaria.objects.create(
                data=data,
                turno=turno,
                turma=turma,
                quantidade_alunos=quantidade_alunos,
                registrado_por=user,
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        f"Já existe contagem para a turma '{turma}' no turno "
                        f"{turno} em {data.isoformat()}."
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


class ResumoFrequenciaView(APIView):
    def get(self, request):
        data, err = _parse_date(request.query_params.get("data"), default_today=True)
        if err:
            return err
        return Response(calcular_resumo_dia(data))


class PlanoDoDiaView(APIView):
    def get(self, request):
        data, err = _parse_date(request.query_params.get("data"), default_today=True)
        if err:
            return err
        turno = request.query_params.get("turno")
        if turno not in dict(FrequenciaDiaria.TURNO_CHOICES):
            return Response({"detail": "Parâmetro 'turno' é obrigatório e inválido."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(gerar_plano_do_dia(data=data, turno=turno))


class BaixaProducaoView(APIView):
    def post(self, request):
        data, err = _parse_date(request.data.get("data"), default_today=True)
        if err:
            return err
        turno = request.data.get("turno")
        if turno not in dict(FrequenciaDiaria.TURNO_CHOICES):
            return Response({"detail": "Turno inválido."}, status=status.HTTP_400_BAD_REQUEST)
        itens = request.data.get("itens")
        user = request.user if request.user.is_authenticated else None
        return Response(
            baixa_de_producao(data=data, turno=turno, itens_override=itens, user=user),
            status=status.HTTP_200_OK,
        )
