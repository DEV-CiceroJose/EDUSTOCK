from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from plataforma.permissions import slugs_modulos_do_usuario

from .alerts import coletar_alertas
from .models import (
    OperacaoBaixaProducao,
    Produto,
    RegistroRefeicao,
    Turma,
)
from .services import calcular_resumo_dia


def montar_dashboard_operacional(*, escola, data, user):
    modulos = sorted(slugs_modulos_do_usuario(user))
    presenca = _resumo_presenca(escola=escola, data=data) if "merenda" in modulos else None
    refeicoes = _resumo_refeicoes(escola=escola, data=data) if "merenda" in modulos else None
    estoque = (
        _resumo_estoque(escola=escola)
        if {"inventario", "alertas"}.intersection(modulos)
        else None
    )
    return {
        "data": data.isoformat(),
        "escola": {"id": escola.id, "nome": escola.nome},
        "modulos": modulos,
        "presenca": presenca,
        "refeicoes": refeicoes,
        "estoque": estoque,
        "proximas_acoes": [],
        "tendencia": [],
        "atividade_recente": [],
        "atualizado_em": timezone.localtime().isoformat(),
    }


def _resumo_presenca(*, escola, data):
    resumo = calcular_resumo_dia(data, escola=escola)
    return {
        "total_alunos": resumo["total_alunos"],
        "turmas_registradas": len(resumo["turmas"]),
        "turmas_esperadas": Turma.objects.filter(escola=escola, ativo=True).count(),
        "media_historica": resumo["media_historica"],
        "variacao_pct": resumo["variacao_pct"],
    }


def _resumo_refeicoes(*, escola, data):
    registros = RegistroRefeicao.objects.filter(escola=escola, data=data)
    totais = registros.aggregate(
        previstas=Sum("porcoes_planejadas"),
        produzidas=Sum("porcoes_produzidas"),
        servidas=Sum("porcoes_servidas"),
        descarte_kg=Sum("descarte_kg"),
    )
    registros_por_refeicao = {registro.refeicao: registro for registro in registros}
    operacoes_por_refeicao = {
        operacao.refeicao: operacao
        for operacao in OperacaoBaixaProducao.objects.filter(escola=escola, data=data)
    }
    etapas = []
    for refeicao, rotulo in OperacaoBaixaProducao.REFEICAO_CHOICES:
        operacao = operacoes_por_refeicao.get(refeicao)
        if operacao:
            status = operacao.status
        elif refeicao in registros_por_refeicao:
            status = "AGUARDANDO_BAIXA"
        else:
            status = "SEM_REGISTRO"
        etapas.append({"refeicao": refeicao, "rotulo": rotulo, "status": status})
    return {
        "previstas": totais["previstas"] or 0,
        "produzidas": totais["produzidas"] or 0,
        "servidas": totais["servidas"] or 0,
        "descarte_kg": f"{totais['descarte_kg'] or Decimal('0'):.3f}",
        "etapas": etapas,
    }


def _resumo_estoque(*, escola):
    alertas = coletar_alertas(escola=escola)
    itens_validade = {item["produto_id"]: item for item in alertas["validade"]}
    itens_estoque = {item["produto_id"]: item for item in alertas["estoque_critico"]}
    itens_em_alerta = {**itens_validade, **itens_estoque}
    ids_criticos = {
        produto_id
        for produto_id, item in itens_em_alerta.items()
        if item["urgencia"] == "critico"
    }
    ids_atencao = {
        produto_id
        for produto_id, item in itens_em_alerta.items()
        if item["urgencia"] == "alerta" and produto_id not in ids_criticos
    }
    vencidos = {
        produto_id
        for produto_id, item in itens_validade.items()
        if item.get("dias_validade", 0) < 0
    }
    proximos_vencimento = {
        produto_id
        for produto_id, item in itens_validade.items()
        if item.get("dias_validade", 0) >= 0
    }
    itens = Produto.objects.filter(escola=escola).count()
    return {
        "itens": itens,
        "adequados": max(itens - len(itens_em_alerta), 0),
        "atencao": len(ids_atencao),
        "criticos": len(ids_criticos),
        "vencidos": len(vencidos),
        "proximos_vencimento": len(proximos_vencimento),
    }
