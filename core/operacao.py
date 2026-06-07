from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError

from .models import FatorConsumo, Produto
from .services import calcular_previsao_producao, registrar_movimentacao, total_frequencia
from .models import Movimentacao

UNIDADES_EM_GRAMAS = {"KG", "L"}


def _money_qty(val):
    return str(val.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


def _calcular_quantidade_producao(*, fator, total_alunos, unidade):
    base = fator.gramas_por_aluno * Decimal(total_alunos)
    if unidade in UNIDADES_EM_GRAMAS:
        return base / Decimal("1000")
    return base


def _unidade_legivel(unidade, quantidade):
    q = Decimal(str(quantidade))
    labels = dict(Produto.UNIDADE_CHOICES)
    nome = labels.get(unidade, unidade).lower()
    if unidade == "KG":
        return f"{q.quantize(Decimal('0.1'))} kg".replace(".", ",")
    if unidade == "UN":
        return f"{int(q)} unidades" if q == int(q) else f"{q} unidades"
    return f"{q} {nome}"


def gerar_plano_do_dia(*, data, turno):
    total_alunos = total_frequencia(data=data, turno=turno)
    previsao = calcular_previsao_producao(data, turno)
    fatores = (
        FatorConsumo.objects.filter(ativo=True)
        .select_related("produto", "produto__grupo__categoria")
    )
    itens = []
    for f in fatores:
        p = f.produto
        qtd = _calcular_quantidade_producao(
            fator=f, total_alunos=total_alunos, unidade=p.unidade
        )
        if qtd <= 0:
            continue
        estoque_insuficiente = p.quantidade < qtd
        itens.append({
            "produto_id": p.id,
            "produto_nome": p.nome,
            "categoria_nome": p.grupo.categoria.name,
            "unidade": p.unidade,
            "quantidade": _money_qty(qtd),
            "quantidade_legivel": _unidade_legivel(p.unidade, qtd),
            "saldo_atual": _money_qty(p.quantidade),
            "estoque_insuficiente": estoque_insuficiente,
            "gramas_por_aluno": str(f.gramas_por_aluno),
        })
    return {
        "data": data.isoformat(),
        "turno": turno,
        "total_alunos": total_alunos,
        "previsao": previsao,
        "itens": itens,
    }


def baixa_de_producao(*, data, turno, itens_override=None, user=None):
    """
    Baixa cada item da ordem de produção individualmente.
    Falha em um item não impede os demais (cada saída é transacional).
    """
    plano = gerar_plano_do_dia(data=data, turno=turno)
    overrides = {}
    if itens_override:
        overrides = {int(i["produto_id"]): i for i in itens_override}

    resultados = []
    for item in plano["itens"]:
        pid = item["produto_id"]
        override = overrides.get(pid, {})
        qtd = override.get("quantidade_override") or item["quantidade"]
        try:
            produto = Produto.objects.get(pk=pid)
            mov = registrar_movimentacao(
                produto=produto,
                tipo=Movimentacao.SAIDA,
                quantidade=Decimal(str(qtd)),
                motivo="consumo",
                data=data,
                user=user,
            )
            resultados.append({
                "ok": True,
                "produto_id": pid,
                "produto_nome": item["produto_nome"],
                "quantidade": str(qtd),
                "movimentacao_id": mov.id,
            })
        except (ValidationError, Produto.DoesNotExist) as e:
            msg = e.messages[0] if isinstance(e, ValidationError) and e.messages else str(e)
            resultados.append({
                "ok": False,
                "produto_id": pid,
                "produto_nome": item["produto_nome"],
                "quantidade": str(qtd),
                "erro": msg,
            })
    return {
        "data": data.isoformat(),
        "turno": turno,
        "resultados": resultados,
        "sucesso": sum(1 for r in resultados if r["ok"]),
        "falhas": sum(1 for r in resultados if not r["ok"]),
    }
