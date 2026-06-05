from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from django.utils import timezone

from .models import Produto, Movimentacao

_Q3 = Decimal("0.001")
_Q2 = Decimal("0.01")


def _q(valor, exp):
    return Decimal(valor).quantize(exp, rounding=ROUND_HALF_UP)


def sugerir_compras(*, horizonte=1, semanas=4):
    horizonte = max(1, int(horizonte))
    semanas = max(1, int(semanas))
    hoje = timezone.localdate()
    janela_inicio = hoje - timedelta(days=semanas * 7)

    consumo = {
        row["produto"]: row["total"]
        for row in Movimentacao.objects.filter(
            tipo=Movimentacao.SAIDA, motivo="consumo",
            data__gte=janela_inicio, data__lte=hoje,
        ).values("produto").annotate(total=Sum("quantidade"))
    }

    itens = []
    custo_total = Decimal("0")
    for p in Produto.objects.select_related("grupo", "fornecedor").all():
        consumo_total = Decimal(consumo.get(p.id, 0))
        consumo_semanal = consumo_total / Decimal(semanas)
        sugerido = consumo_semanal * horizonte + p.estoque_minimo - p.quantidade
        if sugerido <= 0:
            continue
        sugerido = _q(sugerido, _Q3)
        consumo_semanal = _q(consumo_semanal, _Q3)
        custo = _q(sugerido * p.preco, _Q2) if p.preco is not None else None
        if custo is not None:
            custo_total += custo
        itens.append({
            "produto": p.id,
            "produto_nome": p.nome,
            "unidade": p.unidade,
            "saldo": str(p.quantidade),
            "estoque_minimo": str(p.estoque_minimo),
            "consumo_semanal": str(consumo_semanal),
            "sugerido": str(sugerido),
            "fornecedor": p.fornecedor_id,
            "fornecedor_nome": p.fornecedor.nome if p.fornecedor_id else None,
            "preco": str(p.preco) if p.preco is not None else None,
            "custo_estimado": str(custo) if custo is not None else None,
        })

    itens.sort(key=lambda i: ((i["fornecedor_nome"] or "￿"), i["produto_nome"]))
    return {
        "itens": itens,
        "total_itens": len(itens),
        "custo_total_estimado": str(_q(custo_total, _Q2)),
    }
