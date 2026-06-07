from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import F, Q, Sum, DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce

from core.models import Entrada, Movimentacao, Produto

LINE_TOTAL = ExpressionWrapper(
    F("quantidade") * F("preco_unitario"),
    output_field=DecimalField(max_digits=12, decimal_places=2),
)


def _money(val):
    return str(Decimal(val).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _item_from_mov(mov):
    preco = mov.preco_unitario
    subtotal = (mov.quantidade * preco) if preco else Decimal("0")
    legado_nf = None
    if mov.entrada and not mov.entrada.numero_nota_fiscal and mov.produto.numero_nota_fiscal:
        legado_nf = mov.produto.numero_nota_fiscal
    return {
        "produto_nome": mov.produto.nome,
        "quantidade": str(mov.quantidade),
        "preco_unitario": str(preco) if preco is not None else None,
        "subtotal": _money(subtotal),
        "numero_nota_fiscal_legado": legado_nf,
    }


def _documento_from_entrada(entrada):
    itens = [_item_from_mov(m) for m in entrada.itens.all()]
    return {
        "entrada_id": entrada.id,
        "numero_nota_fiscal": entrada.numero_nota_fiscal or "",
        "data": entrada.data.isoformat(),
        "total": _money(entrada.total),
        "legado": False,
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


def _produtos_legado(inicio, fim):
    return (
        Produto.objects.select_related("fornecedor", "grupo__categoria")
        .filter(criado_em__date__gte=inicio, criado_em__date__lte=fim)
        .exclude(Q(numero_nota_fiscal="") | Q(numero_nota_fiscal__isnull=True))
        .exclude(movimentacoes__entrada__isnull=False)
        .distinct()
    )


def _documentos_legado_por_fornecedor(produtos):
    grupos = defaultdict(list)
    for p in produtos:
        grupos[p.fornecedor_id].append(p)

    blocos = {}
    for fid, prods in grupos.items():
        nf_grupos = defaultdict(list)
        for p in prods:
            nf_grupos[p.numero_nota_fiscal].append(p)

        documentos = []
        for nf, itens_prod in nf_grupos.items():
            itens = []
            total = Decimal("0")
            data_doc = max(p.criado_em.date() for p in itens_prod).isoformat()
            for p in itens_prod:
                preco = p.preco
                subtotal = (p.quantidade * preco) if preco else Decimal("0")
                total += subtotal
                itens.append({
                    "produto_nome": p.nome,
                    "quantidade": str(p.quantidade),
                    "preco_unitario": str(preco) if preco is not None else None,
                    "subtotal": _money(subtotal),
                    "numero_nota_fiscal_legado": p.numero_nota_fiscal,
                })
            documentos.append({
                "entrada_id": None,
                "numero_nota_fiscal": nf,
                "data": data_doc,
                "total": _money(total),
                "legado": True,
                "itens": itens,
            })

        fornecedor = prods[0].fornecedor
        blocos[fid] = {
            "fornecedor_id": fid,
            "fornecedor_nome": fornecedor.nome if fornecedor else "Sem fornecedor",
            "documento": fornecedor.documento if fornecedor else "",
            "documentos": documentos,
            "total_fornecedor": sum(Decimal(d["total"]) for d in documentos),
        }
    return blocos


def _adicionar_legado_ao_resumo(produtos, cat_totals, cat_names):
    extra = Decimal("0")
    for p in produtos:
        if not p.grupo or not p.grupo.categoria_id:
            continue
        preco = p.preco
        sub = (p.quantidade * preco) if preco else Decimal("0")
        cid = p.grupo.categoria_id
        cat_totals[cid] = cat_totals.get(cid, Decimal("0")) + sub
        cat_names[cid] = p.grupo.categoria.name
        extra += sub
    return extra


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

    legado_produtos = list(_produtos_legado(inicio, fim))
    for fid, bloco in _documentos_legado_por_fornecedor(legado_produtos).items():
        if fid in por_fornecedor:
            por_fornecedor[fid]["documentos"].extend(bloco["documentos"])
            por_fornecedor[fid]["total_fornecedor"] += bloco["total_fornecedor"]
        else:
            por_fornecedor[fid] = bloco

    cat_totals, cat_names = _resumo_por_categoria(inicio, fim)
    total_geral = sum(cat_totals.values(), Decimal("0"))
    total_geral += _adicionar_legado_ao_resumo(legado_produtos, cat_totals, cat_names)

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
