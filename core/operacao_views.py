from datetime import datetime
import hashlib
import logging
from types import SimpleNamespace
from uuid import UUID, uuid4

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, connection
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import BaseThrottle

from plataforma.authentication import TokenAcessoAuthentication
from plataforma.permissions import RequerModuloAtivo, escola_do_request
from plataforma.models import Escola

from .models import FrequenciaDiaria, OperacaoBaixaProducao, Turma
from .operacao import (
    OperacaoIdReutilizado,
    RefeicaoJaBaixada,
    executar_baixa_idempotente,
    gerar_plano_do_dia,
)
from .operacao_auth import (
    PERFIL_ALUNO, PERFIL_COZINHA,
    autenticar_pin, criar_token, invalidar_token,
    requer_perfil_operacao,
)
from .services import calcular_previsao_producao, calcular_resumo_dia, total_frequencia
from .serializers import (
    BaixaProducaoRequestSerializer,
    ConsultaBaixaProducaoSerializer,
    PlanoProducaoQuerySerializer,
)


logger = logging.getLogger(__name__)


def _turma_ativa_da_sessao(sessao):
    """Resolve o cadastro atual para refletir renomes e desativações."""
    consulta = Turma.objects.filter(ativo=True, escola_id=sessao.get("escola_id"))
    if sessao.get("turma_id"):
        return consulta.filter(pk=sessao["turma_id"]).first()
    turma = consulta.filter(nome=sessao.get("turma", "")).first()
    if turma:
        return turma
    # Compatibilidade temporária com sessões emitidas antes do vínculo por ID.
    if sessao.get("turma") and sessao.get("turno"):
        return SimpleNamespace(nome=sessao["turma"], turno=sessao["turno"])
    return None


class HealthCheckView(APIView):
    """Sinal mínimo de disponibilidade, sem expor configuração interna."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        verificacoes = {"banco": False, "cache": False}
        try:
            connection.ensure_connection()
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                verificacoes["banco"] = cursor.fetchone()[0] == 1
        except Exception:
            logger.exception("Falha na verificação de saúde do banco")

        try:
            chave = "healthcheck:cache"
            valor = timezone.now().isoformat()
            cache.set(chave, valor, timeout=30)
            verificacoes["cache"] = cache.get(chave) == valor
        except Exception:
            logger.exception("Falha na verificação de saúde do cache")

        saudavel = all(verificacoes.values())
        return Response(
            {
                "status": "ok" if saudavel else "indisponivel",
                "verificacoes": verificacoes,
                "verificado_em": timezone.now().isoformat(),
            },
            status=status.HTTP_200_OK if saudavel else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def _identificador_cliente(request):
    return BaseThrottle().get_ident(request)


def _chave_tentativas_pin(request, perfil):
    identificador = _identificador_cliente(request)
    bruto = f"{identificador}:{perfil.casefold()}"
    digest = hashlib.sha256(bruto.encode("utf-8")).hexdigest()
    return f"operacao:pin-login-falhas:{digest}"


def _login_pin_bloqueado(request, perfil):
    limite = settings.PIN_LOGIN_MAX_TENTATIVAS
    return int(cache.get(_chave_tentativas_pin(request, perfil), 0)) >= limite


def _registrar_falha_pin(request, perfil):
    chave = _chave_tentativas_pin(request, perfil)
    janela = settings.PIN_LOGIN_JANELA_SEGUNDOS
    if cache.add(chave, 1, timeout=janela):
        return 1
    try:
        return cache.incr(chave)
    except ValueError:
        cache.set(chave, 1, timeout=janela)
        return 1


def _limpar_falhas_pin(request, perfil):
    cache.delete(_chave_tentativas_pin(request, perfil))


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

    # Sem isso, o DRF aplica SessionAuthentication por padrão e passa a
    # exigir CSRF sempre que o navegador tiver um cookie de sessão do
    # Django Admin (mesmo em outra aba/porta — cookies não são isolados
    # por porta em "localhost"), quebrando o login por PIN com
    # "CSRF Failed: CSRF token missing." Este módulo usa só o esquema de
    # token próprio (X-Operacao-Token), nunca sessão/cookie do Django.
    authentication_classes = []
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]

    def post(self, request):
        pin = str(request.data.get("pin", "")).strip()
        perfil = str(request.data.get("perfil", "")).strip().upper()
        escola = str(request.data.get("escola", "")).strip()

        if not pin or not perfil:
            return Response(
                {"detail": "Informe 'pin' e 'perfil'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if _login_pin_bloqueado(request, perfil):
            return Response(
                {
                    "detail": (
                        "Muitas tentativas de acesso. "
                        "Aguarde alguns minutos antes de tentar novamente."
                    )
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(settings.PIN_LOGIN_JANELA_SEGUNDOS)},
            )

        dados = autenticar_pin(perfil, pin, escola=escola)
        if not dados:
            tentativas = _registrar_falha_pin(request, perfil)
            logger.warning(
                "Falha de autenticação por PIN",
                extra={
                    "client_ip": _identificador_cliente(request),
                    "perfil_operacao": perfil,
                    "tentativas_na_janela": tentativas,
                },
            )
            return Response(
                {"detail": "PIN inválido."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        _limpar_falhas_pin(request, perfil)
        token = criar_token(
            perfil=dados["perfil"],
            turma=dados.get("turma", ""),
            turno=dados.get("turno", ""),
            turma_id=dados.get("turma_id"),
            pin_acesso_id=dados.get("pin_acesso_id"),
            pin_versao=dados.get("pin_versao", ""),
            escola_id=dados.get("escola_id"),
            escola_nome=dados.get("escola_nome", ""),
            escola_slug=dados.get("escola_slug", ""),
        )
        return Response({
            "token": token,
            "perfil": dados["perfil"],
            "turma": dados.get("turma", ""),
            "turno": dados.get("turno", ""),
            "escola": {
                "id": dados.get("escola_id"),
                "nome": dados.get("escola_nome", ""),
                "slug": dados.get("escola_slug", ""),
            },
        })


class OperacaoLogoutView(APIView):
    """DELETE /api/operacao/auth/ — invalida o token."""

    authentication_classes = []  # ver comentário em OperacaoLoginView
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]

    def delete(self, request):
        token = request.headers.get("X-Operacao-Token", "").strip()
        if token:
            invalidar_token(token)
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------
# Contagem de frequência
# --------------------------------------------------------------------------

MAX_ALUNOS_POR_TURMA = 45


class ContagemView(APIView):
    """
    POST — registra frequência de uma turma (app-alunos, perfil ALUNO_REP).
    GET  — retorna o total de alunos do dia/turno (app-cozinha, perfil COZINHA).

    Autenticação: header X-Operacao-Token (rejeita tokens de admin Django).
    """

    authentication_classes = []  # ver comentário em OperacaoLoginView
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]

    @requer_perfil_operacao(PERFIL_ALUNO)
    def post(self, request):
        sessao = request.sessao_operacao
        escola_id = sessao["escola_id"]
        turma_atual = _turma_ativa_da_sessao(sessao)
        if not turma_atual:
            return Response(
                {
                    "codigo": "turma_inativa",
                    "detail": "Esta turma não está ativa. Solicite a atualização do cadastro.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # A turma vem do cadastro atual, inclusive após renome.
        turma = turma_atual.nome
        turno = turma_atual.turno

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
            if not 1 <= quantidade_alunos <= MAX_ALUNOS_POR_TURMA:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {
                    "detail": (
                        "quantidade_alunos deve ser um inteiro entre "
                        f"1 e {MAX_ALUNOS_POR_TURMA}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        operacao_bruta = request.data.get("operacao_id")
        try:
            operacao_id = UUID(str(operacao_bruta)) if operacao_bruta else uuid4()
        except (TypeError, ValueError, AttributeError):
            return Response(
                {"detail": "operacao_id deve ser um UUID válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existente = FrequenciaDiaria.objects.filter(escola_id=escola_id, operacao_id=operacao_id).first()
        if existente:
            mesma_operacao = (
                existente.data == data
                and existente.turno == turno
                and existente.turma == turma
                and existente.quantidade_alunos == quantidade_alunos
            )
            if not mesma_operacao:
                return Response(
                    {"codigo": "operacao_id_reutilizado", "detail": "Este identificador já foi usado em outro registro."},
                    status=status.HTTP_409_CONFLICT,
                )
            previsao = calcular_previsao_producao(data, turno, escola=escola_id)
            return Response({
                "id": existente.id,
                "operacao_id": str(operacao_id),
                "data": data.isoformat(),
                "turno": turno,
                "turma": turma,
                "quantidade_alunos": quantidade_alunos,
                "previsao": previsao,
                "repetida": True,
            })

        try:
            freq = FrequenciaDiaria.objects.create(
                escola_id=escola_id,
                data=data,
                turno=turno,
                turma=turma,
                quantidade_alunos=quantidade_alunos,
                operacao_id=operacao_id,
                registrado_por_turma=sessao.get("turma", turma),
                registrado_por=None,  # app-alunos não usa User Django
            )
        except IntegrityError:
            return Response(
                {
                    "codigo": "frequencia_duplicada",
                    "detail": (
                        f"Frequência já registrada hoje para esta turma "
                        f"(turma '{turma}', turno {turno}, data {data.isoformat()})."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        previsao = calcular_previsao_producao(data, turno, escola=escola_id)
        return Response(
            {
                "id": freq.id,
                "operacao_id": str(operacao_id),
                "data": data.isoformat(),
                "turno": turno,
                "turma": turma,
                "quantidade_alunos": quantidade_alunos,
                "previsao": previsao,
                "repetida": False,
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
        escola_id = request.sessao_operacao["escola_id"]
        if turno and turno not in dict(FrequenciaDiaria.TURNO_CHOICES):
            return Response({"detail": "Turno inválido."}, status=status.HTTP_400_BAD_REQUEST)

        total = total_frequencia(data=data, turno=turno if turno else None, escola=escola_id)
        detalhes = (
            FrequenciaDiaria.objects
            .filter(escola_id=escola_id, data=data, **({} if not turno else {"turno": turno}))
            .values("turma", "turno", "quantidade_alunos")
            .order_by("turno", "turma")
        )
        return Response({
            "data": data.isoformat(),
            "turno": turno,
            "total_alunos": total,
            "turmas": list(detalhes),
        })


class StatusDoDiaView(APIView):
    """Estado sincronizado do dia para os dois aplicativos operacionais."""

    authentication_classes = []
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]

    @requer_perfil_operacao(PERFIL_ALUNO, PERFIL_COZINHA)
    def get(self, request):
        data, err = _parse_date(request.query_params.get("data"), default_today=True)
        if err:
            return err

        sessao = request.sessao_operacao
        escola_id = sessao["escola_id"]
        resposta = {
            "data": data.isoformat(),
            "perfil": sessao["perfil"],
            "sincronizado_em": timezone.now().isoformat(),
        }

        if sessao["perfil"] == PERFIL_ALUNO:
            turma = _turma_ativa_da_sessao(sessao)
            if not turma:
                return Response(
                    {
                        "codigo": "turma_inativa",
                        "detail": "Esta turma não está ativa. Solicite a atualização do cadastro.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            frequencia = FrequenciaDiaria.objects.filter(
                escola_id=escola_id,
                data=data,
                turno=turma.turno,
                turma=turma.nome,
            ).first()
            resposta.update({
                "turma": turma.nome,
                "turno": turma.turno,
                "frequencia_registrada": bool(frequencia),
                "frequencia": None if not frequencia else {
                    "id": frequencia.id,
                    "quantidade_alunos": frequencia.quantidade_alunos,
                    "registrada_em": frequencia.criado_em.isoformat(),
                },
                "historico_recente": list(
                    FrequenciaDiaria.objects.filter(escola_id=escola_id, turma=turma.nome)
                    .order_by("-data", "-criado_em")
                    .values("data", "quantidade_alunos", "criado_em")[:7]
                ),
            })
            return Response(resposta)

        operacoes = {
            item.refeicao: item
            for item in OperacaoBaixaProducao.objects.filter(escola_id=escola_id, data=data)
        }
        resposta["refeicoes"] = [
            {
                "refeicao": chave,
                "label": label,
                "baixa_realizada": chave in operacoes,
                "status": operacoes[chave].status if chave in operacoes else None,
                "atualizada_em": (
                    operacoes[chave].atualizado_em.isoformat()
                    if chave in operacoes else None
                ),
            }
            for chave, label in OperacaoBaixaProducao.REFEICAO_CHOICES
        ]
        resposta["historico_recente"] = [
            {
                "data": item.data.isoformat(),
                "refeicao": item.refeicao,
                "refeicao_label": item.get_refeicao_display(),
                "status": item.status,
                "atualizada_em": item.atualizado_em.isoformat(),
            }
            for item in OperacaoBaixaProducao.objects.filter(escola_id=escola_id).order_by("-data", "-atualizado_em")[:15]
        ]
        return Response(resposta)


# --------------------------------------------------------------------------
# Resumo geral — usado pelo dashboard autenticado
# --------------------------------------------------------------------------

class ResumoFrequenciaView(APIView):
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [IsAuthenticated, RequerModuloAtivo("merenda")]

    def get(self, request):
        data, err = _parse_date(request.query_params.get("data"), default_today=True)
        if err:
            return err
        return Response(calcular_resumo_dia(data, escola=escola_do_request(request)))


# --------------------------------------------------------------------------
# Plano do dia (app-cozinha)
# --------------------------------------------------------------------------

class PlanoDoDiaView(APIView):
    authentication_classes = []  # ver comentário em OperacaoLoginView
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]

    @requer_perfil_operacao(PERFIL_COZINHA)
    def get(self, request):
        serializer = PlanoProducaoQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {
                    "codigo": "consulta_invalida",
                    "detail": "Informe uma data e refeição válidas.",
                    "campos": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        dados = serializer.validated_data
        escola_id = request.sessao_operacao["escola_id"]
        plano = gerar_plano_do_dia(
            data=dados["data"],
            turno=FrequenciaDiaria.INTEGRAL,
            refeicao=dados["refeicao"],
            escola=escola_id,
        )
        operacao = OperacaoBaixaProducao.objects.filter(
            escola_id=escola_id,
            data=dados["data"],
            refeicao=dados["refeicao"],
        ).first()
        plano.update({
            "refeicao": dados["refeicao"],
            "refeicao_label": dict(OperacaoBaixaProducao.REFEICAO_CHOICES)[dados["refeicao"]],
            "baixa_realizada": bool(operacao),
            "status_baixa": operacao.status if operacao else None,
        })
        return Response(plano)


# --------------------------------------------------------------------------
# Baixa de produção (app-cozinha)
# --------------------------------------------------------------------------

class BaixaProducaoView(APIView):
    authentication_classes = []  # ver comentário em OperacaoLoginView
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]

    @requer_perfil_operacao(PERFIL_COZINHA)
    def post(self, request):
        serializer = BaixaProducaoRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "codigo": "payload_invalido",
                    "detail": "Dados inválidos para a baixa de produção.",
                    "campos": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        dados = serializer.validated_data
        escola_id = request.sessao_operacao["escola_id"]
        try:
            resultado = executar_baixa_idempotente(
                operacao_id=dados["operacao_id"],
                data=dados["data"],
                refeicao=dados["refeicao"],
                itens=dados.get("itens"),
                user=None,
                escola=escola_id,
            )
        except OperacaoIdReutilizado as exc:
            return Response(
                {"codigo": "operacao_id_reutilizado", "detail": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )
        except RefeicaoJaBaixada as exc:
            resultado_anterior = dict(exc.operacao.resultado)
            resultado_anterior["repetida"] = True
            return Response(
                {
                    "codigo": "refeicao_ja_baixada",
                    "detail": str(exc),
                    "resultado": resultado_anterior,
                },
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as exc:
            mensagem = exc.messages[0] if exc.messages else str(exc)
            return Response(
                {"codigo": "plano_invalido", "detail": mensagem},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(resultado, status=status.HTTP_200_OK)

    @requer_perfil_operacao(PERFIL_COZINHA)
    def get(self, request):
        serializer = ConsultaBaixaProducaoSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {
                    "codigo": "consulta_invalida",
                    "detail": "Informe um identificador de operação válido.",
                    "campos": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        operacao = OperacaoBaixaProducao.objects.filter(
            escola_id=request.sessao_operacao["escola_id"],
            operacao_id=serializer.validated_data["operacao_id"]
        ).first()
        if not operacao:
            return Response(
                {
                    "codigo": "operacao_nao_encontrada",
                    "detail": "A baixa de produção ainda não foi registrada.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        resultado = dict(operacao.resultado)
        resultado["repetida"] = True
        resultado["consultada"] = True
        return Response(resultado, status=status.HTTP_200_OK)
