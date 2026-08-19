import csv
import io
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from plataforma.models import RegistroAuditoria
from plataforma.permissions import (
    EhGestorRede,
    PodeVerPainelRede,
    escola_do_request,
    escolas_autorizadas_do_usuario,
)

from .models import (
    CardapioModeloMunicipal,
    CatalogoProdutoMunicipal,
    Categoria,
    ContagemEstoque,
    Grupo,
    Movimentacao,
    Produto,
    Receita,
    ReceitaIngrediente,
    RegistroRefeicao,
)


class RegistroRefeicaoSerializer(serializers.ModelSerializer):
    escola_nome = serializers.CharField(source="escola.nome", read_only=True)

    class Meta:
        model = RegistroRefeicao
        fields = [
            "id", "escola", "escola_nome", "operacao", "data", "refeicao",
            "porcoes_planejadas", "porcoes_produzidas", "porcoes_servidas",
            "sobra_limpa_kg", "descarte_kg", "custo_estimado", "cardapio_atendido",
            "fonte", "observacao", "atualizado_em",
        ]
        read_only_fields = ["escola", "fonte", "atualizado_em"]

    def validate(self, attrs):
        produzidas = attrs.get("porcoes_produzidas", getattr(self.instance, "porcoes_produzidas", 0))
        servidas = attrs.get("porcoes_servidas", getattr(self.instance, "porcoes_servidas", 0))
        if servidas > produzidas:
            raise serializers.ValidationError({"porcoes_servidas": "Não pode superar as porções produzidas."})
        operacao = attrs.get("operacao", getattr(self.instance, "operacao", None))
        escola = escola_do_request(self.context.get("request"))
        if operacao and escola and operacao.escola_id != escola.pk:
            raise serializers.ValidationError({"operacao": "Operação não pertence à escola autenticada."})
        return attrs


class RegistroRefeicaoViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroRefeicaoSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return RegistroRefeicao.objects.filter(
            escola=escola_do_request(self.request)
        ).select_related("escola", "operacao")

    def perform_create(self, serializer):
        serializer.save(escola=escola_do_request(self.request), fonte=RegistroRefeicao.MANUAL)


class ContagemEstoqueSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)
    divergencia = serializers.DecimalField(max_digits=10, decimal_places=3, read_only=True)

    class Meta:
        model = ContagemEstoque
        fields = [
            "id", "produto", "produto_nome", "data", "quantidade_sistema",
            "quantidade_fisica", "divergencia", "observacao", "criado_em",
        ]
        read_only_fields = ["quantidade_sistema", "criado_em"]

    def validate_produto(self, produto):
        escola = escola_do_request(self.context.get("request"))
        if escola and produto.escola_id != escola.pk:
            raise serializers.ValidationError("Produto não pertence à escola autenticada.")
        return produto


class ContagemEstoqueViewSet(viewsets.ModelViewSet):
    serializer_class = ContagemEstoqueSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return ContagemEstoque.objects.filter(
            escola=escola_do_request(self.request)
        ).select_related("produto")

    def perform_create(self, serializer):
        produto = serializer.validated_data["produto"]
        serializer.save(
            escola=escola_do_request(self.request),
            quantidade_sistema=produto.quantidade,
            criado_por=self.request.user,
        )


class CatalogoProdutoMunicipalSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogoProdutoMunicipal
        fields = [
            "id", "municipio", "nome", "categoria", "grupo", "unidade",
            "estoque_minimo_sugerido", "perecivel", "ativo",
        ]
        read_only_fields = ["municipio"]


class CatalogoProdutoMunicipalViewSet(viewsets.ModelViewSet):
    serializer_class = CatalogoProdutoMunicipalSerializer
    permission_classes = [IsAuthenticated, EhGestorRede]

    def _municipio(self):
        return getattr(self.request.auth, "municipio", None)

    def get_queryset(self):
        return CatalogoProdutoMunicipal.objects.filter(municipio=self._municipio())

    def perform_create(self, serializer):
        serializer.save(municipio=self._municipio())

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def aplicar(self, request, pk=None):
        item = self.get_object()
        escola = escolas_autorizadas_do_usuario(request.user).filter(
            pk=request.data.get("escola_id"), municipio=item.municipio
        ).first()
        if not escola:
            return Response({"detail": "Escola não autorizada."}, status=status.HTTP_403_FORBIDDEN)
        categoria, _ = Categoria.objects.get_or_create(escola=escola, name=item.categoria)
        grupo, _ = Grupo.objects.get_or_create(escola=escola, categoria=categoria, nome=item.grupo)
        produto, criada = Produto.objects.get_or_create(
            escola=escola,
            nome=item.nome,
            defaults={
                "grupo": grupo,
                "unidade": item.unidade,
                "estoque_minimo": item.estoque_minimo_sugerido,
                "perecivel": item.perecivel,
                "periodicidade": "EVENTUAL",
                "criado_por": request.user,
                "atualizado_por": request.user,
            },
        )
        return Response({"produto_id": produto.pk, "criado": criada})


class CardapioModeloMunicipalSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardapioModeloMunicipal
        fields = ["id", "municipio", "nome", "refeicao", "ingredientes", "ativo"]
        read_only_fields = ["municipio"]


class CardapioModeloMunicipalViewSet(viewsets.ModelViewSet):
    serializer_class = CardapioModeloMunicipalSerializer
    permission_classes = [IsAuthenticated, EhGestorRede]

    def get_queryset(self):
        return CardapioModeloMunicipal.objects.filter(municipio=self.request.auth.municipio)

    def perform_create(self, serializer):
        serializer.save(municipio=self.request.auth.municipio)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def aplicar(self, request, pk=None):
        modelo = self.get_object()
        escola = escolas_autorizadas_do_usuario(request.user).filter(
            pk=request.data.get("escola_id"), municipio=modelo.municipio
        ).first()
        if not escola:
            return Response({"detail": "Escola não autorizada."}, status=status.HTTP_403_FORBIDDEN)

        ingredientes = []
        for item in modelo.ingredientes:
            catalogo = CatalogoProdutoMunicipal.objects.filter(
                pk=item.get("catalogo_produto_id"), municipio=modelo.municipio, ativo=True
            ).first()
            if not catalogo:
                return Response(
                    {"detail": "O modelo contém item ausente do catálogo municipal."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            categoria, _ = Categoria.objects.get_or_create(escola=escola, name=catalogo.categoria)
            grupo, _ = Grupo.objects.get_or_create(
                escola=escola, categoria=categoria, nome=catalogo.grupo
            )
            produto, _ = Produto.objects.get_or_create(
                escola=escola,
                nome=catalogo.nome,
                defaults={
                    "grupo": grupo, "unidade": catalogo.unidade,
                    "estoque_minimo": catalogo.estoque_minimo_sugerido,
                    "perecivel": catalogo.perecivel, "periodicidade": "EVENTUAL",
                    "criado_por": request.user, "atualizado_por": request.user,
                },
            )
            ingredientes.append((produto, _decimal(item.get("gramas_por_aluno"))))

        receita, criada = Receita.objects.update_or_create(
            escola=escola,
            nome=modelo.nome,
            defaults={"refeicao": modelo.refeicao, "ativa": True},
        )
        receita.ingredientes.all().delete()
        ReceitaIngrediente.objects.bulk_create([
            ReceitaIngrediente(receita=receita, produto=produto, gramas_por_aluno=gramas)
            for produto, gramas in ingredientes
        ])
        return Response({"receita_id": receita.pk, "criada": criada, "ingredientes": len(ingredientes)})


def _decimal(valor, padrao="0"):
    try:
        bruto = str(valor if valor not in (None, "") else padrao).strip().replace(",", ".")
        return Decimal(bruto)
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("valor numérico inválido") from None


class ImportacaoProdutosView(APIView):
    permission_classes = [IsAuthenticated, EhGestorRede]

    @transaction.atomic
    def post(self, request):
        escola = escolas_autorizadas_do_usuario(request.user).filter(
            pk=request.data.get("escola_id") or getattr(request.auth, "escola_id", None)
        ).first()
        if not escola:
            return Response({"detail": "Escola não autorizada."}, status=status.HTTP_403_FORBIDDEN)
        arquivo = request.FILES.get("arquivo")
        if not arquivo:
            return Response({"detail": "Envie o CSV no campo 'arquivo'."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            texto = arquivo.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response({"detail": "O CSV deve estar em UTF-8."}, status=status.HTTP_400_BAD_REQUEST)

        leitor = csv.DictReader(io.StringIO(texto), delimiter=";" if ";" in texto.splitlines()[0] else ",")
        obrigatorias = {"nome", "categoria", "grupo", "unidade"}
        if not leitor.fieldnames or not obrigatorias.issubset(set(leitor.fieldnames)):
            return Response(
                {"detail": "Colunas obrigatórias: nome, categoria, grupo e unidade."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        criados = atualizados = 0
        erros = []
        for linha, row in enumerate(leitor, start=2):
            try:
                unidade = str(row["unidade"]).strip().upper()
                if unidade not in dict(Produto.UNIDADE_CHOICES):
                    raise ValueError("unidade inválida")
                categoria, _ = Categoria.objects.get_or_create(escola=escola, name=row["categoria"].strip())
                grupo, _ = Grupo.objects.get_or_create(escola=escola, categoria=categoria, nome=row["grupo"].strip())
                _, criada = Produto.objects.update_or_create(
                    escola=escola,
                    nome=row["nome"].strip(),
                    defaults={
                        "grupo": grupo,
                        "unidade": unidade,
                        "estoque_minimo": _decimal(row.get("estoque_minimo")),
                        "perecivel": str(row.get("perecivel", "")).strip().lower() in {"1", "sim", "true"},
                        "periodicidade": "EVENTUAL",
                        "criado_por": request.user,
                        "atualizado_por": request.user,
                    },
                )
                criados += int(criada)
                atualizados += int(not criada)
            except (ValueError, TypeError) as exc:
                erros.append({"linha": linha, "erro": str(exc)})
        if erros:
            transaction.set_rollback(True)
            return Response({"detail": "Importação cancelada; corrija as linhas.", "erros": erros}, status=400)
        RegistroAuditoria.objects.create(
            user=request.user, escola=escola, acao="IMPORTOU", recurso="produtos",
            detalhes={"criados": criados, "atualizados": atualizados},
        )
        return Response({"escola_id": escola.pk, "criados": criados, "atualizados": atualizados})


class IndicadoresRedeView(APIView):
    permission_classes = [IsAuthenticated, PodeVerPainelRede]

    def get(self, request):
        try:
            fim = datetime.fromisoformat(request.query_params.get("fim", "")).date()
        except ValueError:
            fim = timezone.localdate()
        try:
            inicio = datetime.fromisoformat(request.query_params.get("inicio", "")).date()
        except ValueError:
            inicio = fim - timedelta(days=29)
        escolas = escolas_autorizadas_do_usuario(request.user).select_related("municipio")
        escola_id = request.query_params.get("escola")
        if escola_id:
            escolas = escolas.filter(pk=escola_id)
        blocos = []
        totais = {"planejadas": 0, "produzidas": 0, "servidas": 0, "sobra_kg": Decimal("0"), "descarte_kg": Decimal("0"), "custo": Decimal("0")}
        for escola in escolas:
            produtos = Produto.objects.filter(escola=escola)
            registros = RegistroRefeicao.objects.filter(escola=escola, data__range=(inicio, fim))
            agg = registros.aggregate(
                planejadas=Sum("porcoes_planejadas"), produzidas=Sum("porcoes_produzidas"),
                servidas=Sum("porcoes_servidas"), sobra=Sum("sobra_limpa_kg"),
                descarte=Sum("descarte_kg"), custo=Sum("custo_estimado"),
            )
            valores = {
                "planejadas": agg["planejadas"] or 0, "produzidas": agg["produzidas"] or 0,
                "servidas": agg["servidas"] or 0, "sobra_kg": agg["sobra"] or Decimal("0"),
                "descarte_kg": agg["descarte"] or Decimal("0"), "custo": agg["custo"] or Decimal("0"),
            }
            for chave in totais:
                totais[chave] += valores[chave]
            perdas_validade = Movimentacao.objects.filter(
                escola=escola, data__range=(inicio, fim), tipo=Movimentacao.SAIDA,
                motivo__icontains="valid",
            ).aggregate(total=Sum("quantidade"))["total"] or Decimal("0")
            contagens = ContagemEstoque.objects.filter(escola=escola, data__range=(inicio, fim))
            divergencias = [contagem.divergencia for contagem in contagens]
            servidas = valores["servidas"]
            blocos.append({
                "escola": {"id": escola.pk, "nome": escola.nome, "slug": escola.slug},
                "estoque": {
                    "itens": produtos.count(),
                    "criticos": produtos.filter(Q(quantidade__lte=0) | Q(estoque_minimo__gt=0, quantidade__lte=F("estoque_minimo"))).count(),
                    "perdas_por_validade": str(perdas_validade),
                },
                "refeicoes": {**{k: str(v) if isinstance(v, Decimal) else v for k, v in valores.items()},
                    "custo_por_refeicao": str((valores["custo"] / servidas).quantize(Decimal("0.01"))) if servidas else None,
                    "aderencia_cardapio_pct": round(100 * registros.filter(cardapio_atendido=True).count() / registros.count(), 1) if registros.exists() else None,
                },
                "economia_estimada": None,
                "economia_observacao": "Requer baseline auditada do piloto.",
                "divergencias": {
                    "conferencias": len(divergencias),
                    "itens_divergentes": sum(1 for valor in divergencias if valor != 0),
                    "quantidade_absoluta": str(sum((abs(valor) for valor in divergencias), Decimal("0"))),
                },
                "origens": {
                    "registros_refeicao": list(registros.values_list("id", flat=True)),
                    "contagens_estoque": list(contagens.values_list("id", flat=True)),
                },
            })
        custo_por_refeicao = totais["custo"] / totais["servidas"] if totais["servidas"] else None
        return Response({
            "periodo": {"inicio": inicio.isoformat(), "fim": fim.isoformat()},
            "consolidado": {
                **{k: str(v) if isinstance(v, Decimal) else v for k, v in totais.items()},
                "custo_por_refeicao": str(custo_por_refeicao.quantize(Decimal("0.01"))) if custo_por_refeicao else None,
                "escolas": len(blocos),
            },
            "por_escola": blocos,
        })
