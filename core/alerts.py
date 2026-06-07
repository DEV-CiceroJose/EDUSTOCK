from decimal import Decimal
from datetime import timedelta

from django.db.models import Q, F, Value
from django.db.models.functions import Cast
from django.utils import timezone

from core.models import Produto

CRITICO_DIAS = 7
ALERTA_DIAS = 30


def dias_ate_validade(validade, hoje=None):
    hoje = hoje or timezone.localdate()
    return (validade - hoje).days


def urgencia_validade(dias):
    if dias < CRITICO_DIAS:
        return "critico"
    return "alerta"


def is_estoque_critico(quantidade, estoque_minimo):
    q = Decimal(str(quantidade))
    m = Decimal(str(estoque_minimo or 0))
    if q <= 0:
        return True, "critico"
    if m > 0 and q < m * Decimal("0.2"):
        return True, "alerta"
    return False, None


def _base_qs():
    return Produto.objects.select_related("grupo", "grupo__categoria", "fornecedor")


def queryset_validade(hoje=None):
    hoje = hoje or timezone.localdate()
    limite = hoje + timedelta(days=ALERTA_DIAS)
    return _base_qs().filter(validade__isnull=False, validade__lte=limite)


def queryset_estoque_critico():
    limiar = Cast(Value(Decimal("0.2")), Produto._meta.get_field("estoque_minimo"))
    return _base_qs().filter(
        Q(quantidade__lte=0)
        | Q(estoque_minimo__gt=0, quantidade__lt=F("estoque_minimo") * limiar)
    )


def _motivo_validade(dias):
    if dias < 0:
        return "Vencido"
    if dias == 0:
        return "Vence hoje"
    return f"Vence em {dias} dias"


def _motivo_estoque(quantidade, unidade):
    q = Decimal(str(quantidade))
    if q <= 0:
        return "Esgotado"
    label = dict(Produto.UNIDADE_CHOICES).get(unidade, unidade).lower()
    qtd_fmt = f"{q.normalize():f}".rstrip("0").rstrip(".")
    return f"Saldo: {qtd_fmt} {label}"


def _serializar_validade(produto, hoje):
    dias = dias_ate_validade(produto.validade, hoje)
    return {
        "produto_id": produto.id,
        "nome": produto.nome,
        "grupo_nome": produto.grupo.nome,
        "fornecedor_nome": produto.fornecedor.nome if produto.fornecedor else None,
        "motivo": _motivo_validade(dias),
        "urgencia": urgencia_validade(dias),
        "dias_validade": dias,
    }


def _serializar_estoque(produto):
    _, urgencia = is_estoque_critico(produto.quantidade, produto.estoque_minimo)
    return {
        "produto_id": produto.id,
        "nome": produto.nome,
        "grupo_nome": produto.grupo.nome,
        "fornecedor_nome": produto.fornecedor.nome if produto.fornecedor else None,
        "motivo": _motivo_estoque(produto.quantidade, produto.unidade),
        "urgencia": urgencia,
        "quantidade": str(produto.quantidade),
        "estoque_minimo": str(produto.estoque_minimo),
    }


def coletar_alertas(*, tipo=None, urgencia=None, hoje=None):
    hoje = hoje or timezone.localdate()

    validade_items = []
    estoque_items = []

    if tipo in (None, "validade"):
        for p in queryset_validade(hoje):
            item = _serializar_validade(p, hoje)
            if urgencia is None or item["urgencia"] == urgencia:
                validade_items.append(item)

    if tipo in (None, "estoque"):
        for p in queryset_estoque_critico():
            item = _serializar_estoque(p)
            if urgencia is None or item["urgencia"] == urgencia:
                estoque_items.append(item)

    vencidos = sum(1 for a in validade_items if a["urgencia"] == "critico")
    esgotados = sum(1 for a in estoque_items if a["urgencia"] == "critico")

    return {
        "resumo": {
            "vencidos": vencidos,
            "esgotados": esgotados,
            "total_validade": len(validade_items),
            "total_estoque_critico": len(estoque_items),
        },
        "validade": validade_items,
        "estoque_critico": estoque_items,
    }
