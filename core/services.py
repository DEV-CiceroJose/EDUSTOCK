from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Produto, Entrada, Movimentacao


@transaction.atomic
def registrar_movimentacao(*, produto, tipo, quantidade, motivo="", preco_unitario=None,
                           entrada=None, data=None, user=None):
    quantidade = Decimal(str(quantidade))
    if quantidade <= 0:
        raise ValidationError("A quantidade deve ser maior que zero.")

    p = Produto.objects.select_for_update().get(pk=produto.pk)
    if tipo == Movimentacao.SAIDA:
        if quantidade > p.quantidade:
            raise ValidationError(
                f"Saída de {quantidade} excede o saldo atual ({p.quantidade})."
            )
        p.quantidade = p.quantidade - quantidade
    else:
        p.quantidade = p.quantidade + quantidade
    p.save(update_fields=["quantidade", "atualizado_em"])

    return Movimentacao.objects.create(
        produto=p, tipo=tipo, quantidade=quantidade, motivo=motivo,
        preco_unitario=preco_unitario, entrada=entrada,
        data=data or timezone.localdate(), criado_por=user,
    )


@transaction.atomic
def registrar_entrada(*, fornecedor=None, numero_nota_fiscal="", data=None, observacao="",
                      itens, user=None):
    if not itens:
        raise ValidationError("Informe ao menos um item.")
    entrada = Entrada.objects.create(
        fornecedor=fornecedor, numero_nota_fiscal=numero_nota_fiscal,
        data=data or timezone.localdate(), observacao=observacao, criado_por=user,
    )
    for item in itens:
        registrar_movimentacao(
            produto=item["produto"], tipo=Movimentacao.ENTRADA,
            quantidade=item["quantidade"], preco_unitario=item.get("preco_unitario"),
            entrada=entrada, motivo="entrada", data=entrada.data, user=user,
        )
    return entrada
