from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import (
    Cardapio,
    FatorConsumo,
    FrequenciaDiaria,
    Movimentacao,
    OperacaoBaixaProducao,
    Produto,
)
from .services import calcular_previsao_producao, registrar_movimentacao, total_frequencia

class OperacaoIdReutilizado(Exception):
    pass


class RefeicaoJaBaixada(Exception):
    def __init__(self, operacao):
        self.operacao = operacao
        super().__init__("A baixa desta refeição já foi realizada hoje.")


def _money_qty(val):
    return str(val.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


def converter_consumo_para_estoque(produto, quantidade_consumo):
    if not produto.unidade_consumo or not produto.conteudo_por_unidade:
        raise ValidationError(
            f"Configure a conversão de unidade de '{produto.nome}'."
        )
    if not Produto.conversao_dimensional_compativel(
        produto.unidade, produto.unidade_consumo
    ):
        raise ValidationError(
            f"A conversão de unidade de '{produto.nome}' é incompatível."
        )
    return Decimal(quantidade_consumo) / produto.conteudo_por_unidade


def _calcular_quantidade_producao(*, fator, total_alunos):
    quantidade_consumo = fator.quantidade_por_aluno * Decimal(total_alunos)
    return converter_consumo_para_estoque(fator.produto, quantidade_consumo)


def _unidade_legivel(unidade, quantidade):
    q = Decimal(str(quantidade))
    labels = dict(Produto.UNIDADE_CHOICES)
    nome = labels.get(unidade, unidade).lower()
    if unidade == "KG":
        return f"{q.quantize(Decimal('0.1'))} kg".replace(".", ",")
    if unidade == "UN":
        return f"{int(q)} unidades" if q == int(q) else f"{q} unidades"
    return f"{q} {nome}"


def gerar_plano_do_dia(*, data, turno, refeicao=None):
    total_alunos = total_frequencia(data=data, turno=turno)
    previsao = calcular_previsao_producao(data, turno)
    cardapio = None
    if refeicao:
        cardapio = (
            Cardapio.objects.filter(data=data, refeicao=refeicao, receita__ativa=True)
            .select_related("receita")
            .prefetch_related("receita__ingredientes__produto__grupo__categoria")
            .first()
        )
    fatores = (
        cardapio.receita.ingredientes.all()
        if cardapio
        else FatorConsumo.objects.filter(ativo=True)
        .select_related("produto", "produto__grupo__categoria")
        .order_by("produto_id")
    )
    itens = []
    for f in fatores:
        p = f.produto
        qtd = _calcular_quantidade_producao(fator=f, total_alunos=total_alunos)
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
            "quantidade_por_aluno": str(f.quantidade_por_aluno),
        })
    return {
        "data": data.isoformat(),
        "turno": turno,
        "total_alunos": total_alunos,
        "previsao": previsao,
        "itens": itens,
        "receita": cardapio.receita.nome if cardapio else None,
        "origem_plano": "cardapio" if cardapio else "fatores_legados",
    }


def baixa_de_producao(*, data, turno, refeicao=None, itens_override=None, user=None):
    """
    Baixa cada item da ordem de produção individualmente.
    Falha em um item não impede os demais (cada saída é transacional).
    """
    plano = gerar_plano_do_dia(data=data, turno=turno, refeicao=refeicao)
    overrides = {}
    if itens_override:
        overrides = {int(i["produto_id"]): i for i in itens_override}

    ids_plano = {item["produto_id"] for item in plano["itens"]}
    ids_desconhecidos = sorted(set(overrides) - ids_plano)
    if ids_desconhecidos:
        raise ValidationError(
            "Os produtos informados não fazem parte do plano atual: "
            + ", ".join(str(produto_id) for produto_id in ids_desconhecidos)
            + "."
        )

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


def _normalizar_itens_solicitados(itens):
    normalizados = []
    for item in itens or []:
        normalizado = {"produto_id": int(item["produto_id"])}
        if "quantidade_override" in item:
            normalizado["quantidade_override"] = str(item["quantidade_override"])
        normalizados.append(normalizado)
    return sorted(normalizados, key=lambda item: item["produto_id"])


@transaction.atomic
def executar_baixa_idempotente(*, operacao_id, data, refeicao, itens=None, user=None):
    itens_normalizados = _normalizar_itens_solicitados(itens)
    operacao_existente = (
        OperacaoBaixaProducao.objects.select_for_update()
        .filter(operacao_id=operacao_id)
        .first()
    )

    if operacao_existente:
        mesma_requisicao = (
            operacao_existente.data == data
            and operacao_existente.refeicao == refeicao
            and operacao_existente.itens_solicitados == itens_normalizados
        )
        if not mesma_requisicao:
            raise OperacaoIdReutilizado(
                "Este identificador já foi usado em outra baixa de produção."
            )

        resultado_anterior = dict(operacao_existente.resultado)
        resultado_anterior["repetida"] = True
        return resultado_anterior

    operacao, criada = OperacaoBaixaProducao.objects.select_for_update().get_or_create(
        data=data,
        refeicao=refeicao,
        defaults={
            "operacao_id": operacao_id,
            "itens_solicitados": itens_normalizados,
            "status": OperacaoBaixaProducao.CONCLUIDA,
            "resultado": {},
        },
    )

    if not criada:
        if operacao.operacao_id == operacao_id:
            resultado_anterior = dict(operacao.resultado)
            resultado_anterior["repetida"] = True
            return resultado_anterior
        raise RefeicaoJaBaixada(operacao)

    resultado = baixa_de_producao(
        data=data,
        turno=FrequenciaDiaria.INTEGRAL,
        refeicao=refeicao,
        itens_override=itens_normalizados,
        user=user,
    )
    status_operacao = (
        OperacaoBaixaProducao.PARCIAL
        if resultado["falhas"] > 0
        else OperacaoBaixaProducao.CONCLUIDA
    )
    resultado.update({
        "operacao_id": str(operacao_id),
        "refeicao": refeicao,
        "refeicao_label": operacao.get_refeicao_display(),
        "status_operacao": status_operacao,
        "repetida": False,
    })

    operacao.status = status_operacao
    operacao.resultado = resultado
    operacao.save(update_fields=["status", "resultado", "atualizado_em"])
    return resultado
