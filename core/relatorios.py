from decimal import Decimal, ROUND_HALF_UP

from django.db.models import F, Sum, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce

from core.models import Entrada, Movimentacao

LINE_TOTAL = ExpressionWrapper(
    F("quantidade") * F("preco_unitario"),
    output_field=DecimalField(max_digits=12, decimal_places=2),
)


def _money(val):
    return str(Decimal(val).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _item_from_mov(mov):
    preco = mov.preco_unitario
    subtotal = (mov.quantidade * preco) if preco else Decimal("0")
    return {
        "produto_nome": mov.produto.nome,
        "quantidade": str(mov.quantidade),
        "preco_unitario": str(preco) if preco is not None else None,
        "subtotal": _money(subtotal),
    }


def _documento_from_entrada(entrada):
    itens = [_item_from_mov(m) for m in entrada.itens.all()]
    return {
        "entrada_id": entrada.id,
        "numero_nota_fiscal": entrada.numero_nota_fiscal or "",
        "data": entrada.data.isoformat(),
        "total": _money(entrada.total),
        "itens": itens,
    }


def _resumo_por_categoria(inicio, fim):
    rows = (
        Movimentacao.objects.filter(
            entrada__isnull=False,
            entrada__data__gte=inicio,
            entrada__data__lte=fim,
            tipo=Movimentacao.ENTRADA,
            preco_unitario__isnull=False,
        )
        .values("produto__grupo__categoria_id", "produto__grupo__categoria__name")
        .annotate(total=Coalesce(Sum(LINE_TOTAL), Decimal("0")))
    )
    cat_totals = {}
    cat_names = {}
    for r in rows:
        cid = r["produto__grupo__categoria_id"]
        cat_totals[cid] = r["total"]
        cat_names[cid] = r["produto__grupo__categoria__name"]
    return cat_totals, cat_names


def gerar_prestacao_contas(*, inicio, fim):
    entradas = (
        Entrada.objects.filter(data__gte=inicio, data__lte=fim)
        .select_related("fornecedor")
        .prefetch_related("itens__produto__grupo__categoria")
        .order_by("data", "id")
    )

    por_fornecedor = {}
    for entrada in entradas:
        fid = entrada.fornecedor_id
        if fid not in por_fornecedor:
            por_fornecedor[fid] = {
                "fornecedor_id": fid,
                "fornecedor_nome": entrada.fornecedor.nome if entrada.fornecedor else "Sem fornecedor",
                "documento": entrada.fornecedor.documento if entrada.fornecedor else "",
                "documentos": [],
                "total_fornecedor": Decimal("0"),
            }
        doc = _documento_from_entrada(entrada)
        por_fornecedor[fid]["documentos"].append(doc)
        por_fornecedor[fid]["total_fornecedor"] += Decimal(doc["total"])

    cat_totals, cat_names = _resumo_por_categoria(inicio, fim)
    total_geral = sum(cat_totals.values(), Decimal("0"))

    por_categoria = [
        {
            "categoria_id": cid,
            "categoria_nome": cat_names[cid],
            "total": _money(total),
        }
        for cid, total in sorted(cat_totals.items(), key=lambda x: cat_names[x[0]])
    ]

    fornecedores = []
    for bloco in por_fornecedor.values():
        fornecedores.append({
            "fornecedor_id": bloco["fornecedor_id"],
            "fornecedor_nome": bloco["fornecedor_nome"],
            "documento": bloco["documento"],
            "total_fornecedor": _money(bloco["total_fornecedor"]),
            "documentos": sorted(bloco["documentos"], key=lambda d: (d["data"], d["numero_nota_fiscal"])),
        })
    fornecedores.sort(key=lambda f: f["fornecedor_nome"] or "")

    return {
        "periodo": {"inicio": inicio.isoformat(), "fim": fim.isoformat()},
        "resumo_financeiro": {
            "total_geral": _money(total_geral),
            "por_categoria": por_categoria,
        },
        "fornecedores": fornecedores,
    }
