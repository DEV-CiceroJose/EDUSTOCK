import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from plataforma.models import RegistroAuditoria

from .models import (
    AlocacaoLoteMovimentacao,
    Entrada,
    FrequenciaDiaria,
    LoteEstoque,
    Movimentacao,
    Produto,
)

logger = logging.getLogger(__name__)


@transaction.atomic
def registrar_movimentacao(*, produto, tipo, quantidade, motivo="", preco_unitario=None,
                           entrada=None, data=None, user=None, lote=None, escola=None):
    try:
        quantidade = Decimal(str(quantidade))
    except (InvalidOperation, TypeError, ValueError):
        logger.warning(
            "Movimentação rejeitada: quantidade inválida",
            extra={"produto_id": getattr(produto, "pk", None), "tipo": tipo},
        )
        raise ValidationError("A quantidade deve ser um número válido.") from None
    if quantidade <= 0:
        logger.warning(
            "Movimentação rejeitada: quantidade não positiva",
            extra={"produto_id": getattr(produto, "pk", None), "tipo": tipo},
        )
        raise ValidationError("A quantidade deve ser maior que zero.")

    escola = escola or produto.escola
    p = Produto.objects.select_for_update().get(pk=produto.pk, escola=escola)
    if entrada is not None and entrada.escola_id != escola.pk:
        raise ValidationError("A entrada e o produto devem pertencer à mesma escola.")
    if tipo == Movimentacao.SAIDA:
        if quantidade > p.quantidade:
            logger.warning(
                "Movimentação rejeitada: saldo insuficiente",
                extra={
                    "produto_id": p.pk,
                    "tipo": tipo,
                    "quantidade": str(quantidade),
                    "saldo": str(p.quantidade),
                },
            )
            raise ValidationError(
                f"Saída de {quantidade} excede o saldo atual ({p.quantidade})."
            )
        p.quantidade = p.quantidade - quantidade
    else:
        p.quantidade = p.quantidade + quantidade
    p.save(update_fields=["quantidade", "atualizado_em"])

    movimentacao = Movimentacao.objects.create(
        escola=escola, produto=p, tipo=tipo, quantidade=quantidade, motivo=motivo,
        preco_unitario=preco_unitario, entrada=entrada,
        data=data or timezone.localdate(), criado_por=user,
    )
    RegistroAuditoria.objects.create(
        user=user,
        escola=escola,
        acao="MOVIMENTOU",
        recurso="estoque",
        objeto_id=str(movimentacao.pk),
        detalhes={
            "produto_id": p.pk,
            "tipo": tipo,
            "quantidade": str(quantidade),
            "motivo": motivo,
        },
    )

    if tipo == Movimentacao.ENTRADA and lote is not None:
        lote_bloqueado = LoteEstoque.objects.select_for_update().get(pk=lote.pk, escola=escola)
        if lote_bloqueado.produto_id != p.pk:
            raise ValidationError("O lote informado não pertence ao produto.")
        lote_bloqueado.quantidade += quantidade
        lote_bloqueado.save(update_fields=["quantidade"])
        AlocacaoLoteMovimentacao.objects.create(
            movimentacao=movimentacao,
            lote=lote_bloqueado,
            quantidade=quantidade,
        )
    elif tipo == Movimentacao.SAIDA:
        restante = quantidade
        lotes = (
            LoteEstoque.objects.select_for_update()
            .filter(escola=escola, produto=p, quantidade__gt=0)
            .order_by(F("validade").asc(nulls_last=True), "criado_em", "id")
        )
        for lote_bloqueado in lotes:
            usada = min(restante, lote_bloqueado.quantidade)
            if usada <= 0:
                continue
            lote_bloqueado.quantidade -= usada
            lote_bloqueado.save(update_fields=["quantidade"])
            AlocacaoLoteMovimentacao.objects.create(
                movimentacao=movimentacao,
                lote=lote_bloqueado,
                quantidade=usada,
            )
            restante -= usada
            if restante <= 0:
                break

    menor_validade = (
        LoteEstoque.objects.filter(escola=escola, produto=p, quantidade__gt=0, validade__isnull=False)
        .order_by("validade")
        .values_list("validade", flat=True)
        .first()
    )
    possui_lotes = LoteEstoque.objects.filter(escola=escola, produto=p).exists()
    if possui_lotes and p.validade != menor_validade:
        p.validade = menor_validade
        p.save(update_fields=["validade", "atualizado_em"])

    return movimentacao


@transaction.atomic
def registrar_entrada(*, fornecedor=None, numero_nota_fiscal="", data=None, observacao="",
                      itens, user=None, escola=None):
    if not itens:
        logger.warning(
            "Entrada rejeitada: nenhum item informado",
            extra={"fornecedor_id": getattr(fornecedor, "pk", None)},
        )
        raise ValidationError("Informe ao menos um item.")
    escola = escola or getattr(fornecedor, "escola", None) or itens[0]["produto"].escola
    if fornecedor is not None and fornecedor.escola_id != escola.pk:
        raise ValidationError("O fornecedor deve pertencer à escola da entrada.")
    if any(item["produto"].escola_id != escola.pk for item in itens):
        raise ValidationError("Todos os itens da entrada devem pertencer à mesma escola.")
    entrada = Entrada.objects.create(
        escola=escola,
        fornecedor=fornecedor, numero_nota_fiscal=numero_nota_fiscal,
        data=data or timezone.localdate(), observacao=observacao, criado_por=user,
    )
    RegistroAuditoria.objects.create(
        user=user,
        escola=escola,
        acao="CRIOU",
        recurso="entrada",
        objeto_id=str(entrada.pk),
        detalhes={"fornecedor_id": getattr(fornecedor, "pk", None)},
    )
    for item in itens:
        produto = item["produto"]
        codigo_lote = str(item.get("codigo_lote") or f"ENT-{entrada.pk}-{produto.pk}").strip()
        lote, _ = LoteEstoque.objects.get_or_create(
            escola=escola,
            produto=produto,
            codigo=codigo_lote,
            defaults={
                "entrada": entrada,
                "validade": item.get("validade"),
                "preco_unitario": item.get("preco_unitario"),
            },
        )
        registrar_movimentacao(
            produto=produto, tipo=Movimentacao.ENTRADA,
            quantidade=item["quantidade"], preco_unitario=item.get("preco_unitario"),
            entrada=entrada, motivo="entrada", data=entrada.data, user=user, lote=lote,
            escola=escola,
        )
    return entrada


def _media_diaria_frequencia(*, data, turno=None, dias=30, escola=None):
    """Média dos totais diários de alunos nos últimos `dias` antes de `data`."""
    inicio = data - timedelta(days=dias)
    qs = FrequenciaDiaria.objects.filter(data__gte=inicio, data__lt=data)
    if escola is not None:
        qs = qs.filter(escola=escola)
    if turno:
        qs = qs.filter(turno=turno)
    totais_por_dia = qs.values("data").annotate(total=Sum("quantidade_alunos"))
    valores = [row["total"] for row in totais_por_dia]
    if not valores:
        return Decimal("0")
    return Decimal(sum(valores)) / Decimal(len(valores))


def total_frequencia(*, data, turno=None, escola=None):
    qs = FrequenciaDiaria.objects.filter(data=data)
    if escola is not None:
        qs = qs.filter(escola=escola)
    if turno:
        qs = qs.filter(turno=turno)
    return qs.aggregate(total=Sum("quantidade_alunos"))["total"] or 0


def calcular_previsao_producao(data, turno, escola=None):
    total_alunos = total_frequencia(data=data, turno=turno, escola=escola)
    media_historica = _media_diaria_frequencia(data=data, turno=turno, escola=escola)
    alerta_reducao = False
    if media_historica > 0:
        alerta_reducao = Decimal(total_alunos) < media_historica * Decimal("0.5")
    return {
        "total_alunos": total_alunos,
        "media_historica": float(media_historica.quantize(Decimal("0.01"))),
        "alerta_reducao": alerta_reducao,
    }


def calcular_resumo_dia(data, escola=None):
    """Resumo agregado do dia (todos os turnos) para o widget do dashboard."""
    total_alunos = total_frequencia(data=data, escola=escola)
    turmas_qs = FrequenciaDiaria.objects.filter(data=data)
    if escola is not None:
        turmas_qs = turmas_qs.filter(escola=escola)
    turmas = list(
        turmas_qs
        .values("turma")
        .annotate(quantidade_alunos=Sum("quantidade_alunos"))
        .order_by("turma")
    )
    media_historica = _media_diaria_frequencia(data=data, turno=None, escola=escola)
    variacao_pct = None
    alerta_reducao = False
    if media_historica > 0:
        variacao_pct = float(
            ((Decimal(total_alunos) - media_historica) / media_historica * 100).quantize(Decimal("0.1"))
        )
        alerta_reducao = Decimal(total_alunos) < media_historica * Decimal("0.5")
    return {
        "data": data.isoformat(),
        "total_alunos": total_alunos,
        "media_historica": float(media_historica.quantize(Decimal("0.01"))),
        "variacao_pct": variacao_pct,
        "alerta_reducao": alerta_reducao,
        "turmas": turmas,
    }
