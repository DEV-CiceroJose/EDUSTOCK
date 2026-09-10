from decimal import Decimal

from datetime import timedelta

from django.db.models import Q, Sum
from django.utils import timezone

from plataforma.permissions import slugs_modulos_do_usuario

from .alerts import coletar_alertas
from .models import (
    OperacaoBaixaProducao,
    Produto,
    RegistroRefeicao,
    Turma,
    Cardapio,
    ContagemEstoque,
    FrequenciaDiaria,
)
from plataforma.models import RegistroAuditoria
from .services import calcular_resumo_dia


_ORDEM_PRIORIDADE = {"alta": 0, "media": 1, "baixa": 2}
_ORDEM_ACOES = {
    "TURMAS_PENDENTES": 0,
    "REFEICAO_PENDENTE": 1,
    "ESTOQUE_CRITICO": 2,
    "DIVERGENCIA_ESTOQUE": 3,
}
_RECURSOS_POR_MODULO = {
    "merenda": {"frequencia", "frequencia_diaria", "cardapio", "refeicao", "producao", "operacao_baixa"},
    "inventario": {"estoque", "entrada", "produtos", "produto", "contagem"},
    "alertas": {"alerta"},
    "distribuicao": {"aluno", "rodada", "distribuicao"},
    "rede": {"escola", "usuario", "vinculo_usuario"},
}


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
        "proximas_acoes": _proximas_acoes(escola=escola, data=data, modulos=modulos),
        "tendencia": _tendencia_sete_dias(escola=escola, data=data) if "merenda" in modulos else [],
        "atividade_recente": _atividade_recente(escola=escola, modulos=modulos),
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


def _proximas_acoes(*, escola, data, modulos):
    acoes = []
    if "merenda" in modulos:
        frequencias = FrequenciaDiaria.objects.filter(escola=escola, data=data).values("turma")
        if Turma.objects.filter(escola=escola, ativo=True).exclude(nome__in=frequencias).exists():
            acoes.append(_acao(
                "TURMAS_PENDENTES", "alta", "Registrar frequência das turmas",
                "Há turmas ativas sem frequência registrada para hoje.", "/merenda",
            ))

        baixas_concluidas = OperacaoBaixaProducao.objects.filter(
            escola=escola,
            data=data,
            status=OperacaoBaixaProducao.CONCLUIDA,
        ).values("refeicao")
        if Cardapio.objects.filter(escola=escola, data=data).exclude(
            refeicao__in=baixas_concluidas
        ).exists():
            acoes.append(_acao(
                "REFEICAO_PENDENTE", "alta", "Confirmar produção da refeição",
                "Há uma refeição do cardápio sem baixa de produção concluída.", "/merenda",
            ))

    if "alertas" in modulos:
        alertas = coletar_alertas(escola=escola)
        itens_criticos = [*alertas["validade"], *alertas["estoque_critico"]]
        if any(item["urgencia"] == "critico" for item in itens_criticos):
            acoes.append(_acao(
                "ESTOQUE_CRITICO", "alta", "Verificar estoque crítico",
                "Há itens críticos que precisam de atenção.", "/alertas",
            ))

    if "inventario" in modulos and _ha_divergencia_recente(escola=escola, data=data):
        acoes.append(_acao(
            "DIVERGENCIA_ESTOQUE", "media", "Conferir divergência de estoque",
            "A última contagem física recente diverge do saldo do sistema.", "/alertas",
        ))

    return sorted(
        acoes,
        key=lambda item: (_ORDEM_PRIORIDADE[item["prioridade"]], _ORDEM_ACOES[item["codigo"]]),
    )


def _acao(codigo, prioridade, titulo, descricao, href):
    return {
        "codigo": codigo,
        "prioridade": prioridade,
        "titulo": titulo,
        "descricao": descricao,
        "href": href,
    }


def _ha_divergencia_recente(*, escola, data):
    inicio = data - timedelta(days=6)
    contagens = ContagemEstoque.objects.filter(
        escola=escola,
        data__range=(inicio, data),
    ).order_by("produto_id", "-data", "-id")
    produtos_processados = set()
    for contagem in contagens:
        if contagem.produto_id in produtos_processados:
            continue
        produtos_processados.add(contagem.produto_id)
        if contagem.quantidade_fisica != contagem.quantidade_sistema:
            return True
    return False


def _tendencia_sete_dias(*, escola, data):
    inicio = data - timedelta(days=6)
    totais_por_dia = {
        item["data"]: item
        for item in RegistroRefeicao.objects.filter(
            escola=escola,
            data__range=(inicio, data),
        ).values("data").annotate(
            planejadas=Sum("porcoes_planejadas"),
            produzidas=Sum("porcoes_produzidas"),
            servidas=Sum("porcoes_servidas"),
        )
    }
    return [
        {
            "data": dia.isoformat(),
            "planejadas": totais_por_dia.get(dia, {}).get("planejadas") or 0,
            "produzidas": totais_por_dia.get(dia, {}).get("produzidas") or 0,
            "servidas": totais_por_dia.get(dia, {}).get("servidas") or 0,
        }
        for dia in (inicio + timedelta(days=indice) for indice in range(7))
    ]


def _atividade_recente(*, escola, modulos):
    recursos_autorizados = set().union(
        *(_RECURSOS_POR_MODULO.get(modulo, set()) for modulo in modulos)
    )
    if not recursos_autorizados:
        return []
    recurso_filter = Q()
    for recurso in recursos_autorizados:
        recurso_filter |= Q(recurso__iexact=recurso)
    atividade = RegistroAuditoria.objects.filter(escola=escola).filter(recurso_filter)
    return [
        {
            "id": registro.id,
            "acao": registro.acao,
            "recurso": registro.recurso,
            "ator": _nome_ator(registro.user),
            "criado_em": registro.criado_em.isoformat(),
        }
        for registro in atividade.select_related("user").order_by("-criado_em", "-id")[:8]
    ]


def _nome_ator(user):
    if not user:
        return "Sistema"
    return user.get_full_name().strip() or user.username or "Sistema"
