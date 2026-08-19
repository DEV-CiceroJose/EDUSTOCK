from datetime import datetime

from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import OuterRef, Subquery
from plataforma.permissions import LeituraOuAdmin, RequerModuloAtivo, escola_do_request
from .models import (
    BemPermanente, Cardapio, Categoria, Entrada, Fornecedor, Grupo,
    LoteEstoque, Movimentacao, Produto, Receita,
)
from .serializers import (
    ProdutoSerializer, CategoriaSerializer, GrupoSerializer,
    BemPermanenteSerializer, FornecedorSerializer,
    MovimentacaoSerializer, EntradaSerializer, LoteEstoqueSerializer,
    ReceitaSerializer, CardapioSerializer,
)
from .services import registrar_movimentacao
from .alerts import coletar_alertas
from .relatorios import gerar_prestacao_contas
from plataforma.permissions import slugs_modulos_do_usuario


def _parse_date_param(value, label):
    if not value:
        return None, Response({"detail": f"Parâmetro '{label}' é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        return datetime.strptime(value, "%Y-%m-%d").date(), None
    except ValueError:
        return None, Response({"detail": f"Parâmetro '{label}' inválido. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)


class AlertasView(APIView):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("alertas")]

    def get(self, request):
        tipo = request.query_params.get("tipo")
        urgencia = request.query_params.get("urgencia")
        dias_validade = request.query_params.get("dias_validade")
        if tipo and tipo not in ("validade", "estoque"):
            return Response({"detail": "tipo inválido"}, status=status.HTTP_400_BAD_REQUEST)
        if urgencia and urgencia not in ("critico", "alerta"):
            return Response({"detail": "urgencia inválida"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if dias_validade is not None:
                dias_validade = int(dias_validade)
                if not 1 <= dias_validade <= 365:
                    raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"detail": "dias_validade deve ser um inteiro entre 1 e 365."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            coletar_alertas(
                tipo=tipo,
                urgencia=urgencia,
                dias_alerta=dias_validade,
                escola=escola_do_request(request),
            )
        )


class PrestacaoContasView(APIView):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("relatorios")]

    def get(self, request):
        inicio, err = _parse_date_param(request.query_params.get("inicio"), "inicio")
        if err:
            return err
        fim, err = _parse_date_param(request.query_params.get("fim"), "fim")
        if err:
            return err
        if inicio > fim:
            return Response(
                {"detail": "inicio não pode ser posterior a fim."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(gerar_prestacao_contas(
            inicio=inicio,
            fim=fim,
            incluir_financeiro="financeiro" in slugs_modulos_do_usuario(request.user),
            escola=escola_do_request(request),
        ))


class EscolaScopedViewSetMixin:
    """Impõe o escopo autenticado; IDs enviados pelo cliente não mudam a escola."""

    def escola_atual(self):
        return escola_do_request(self.request)

    def perform_create(self, serializer):
        serializer.save(escola=self.escola_atual())


class CategoriaViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario"), LeituraOuAdmin]
    serializer_class = CategoriaSerializer

    def get_queryset(self):
        return Categoria.objects.filter(escola=self.escola_atual()).order_by("name")


class ProdutoViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario"), LeituraOuAdmin]
    serializer_class = ProdutoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def get_queryset(self):
        ultimo_preco = (
            Movimentacao.objects.filter(
                produto_id=OuterRef("pk"),
                tipo=Movimentacao.ENTRADA,
                preco_unitario__isnull=False,
            )
            .order_by("-data", "-id")
            .values("preco_unitario")[:1]
        )
        qs = Produto.objects.select_related(
            "grupo__categoria", "fornecedor", "criado_por", "atualizado_por"
        ).filter(escola=self.escola_atual()).annotate(ultimo_preco=Subquery(ultimo_preco))
        grupo = self.request.query_params.get("grupo")
        categoria = self.request.query_params.get("categoria")
        fornecedor = self.request.query_params.get("fornecedor")
        if grupo:
            qs = qs.filter(grupo_id=grupo)
        if categoria:
            qs = qs.filter(grupo__categoria_id=categoria)
        if fornecedor:
            qs = qs.filter(fornecedor_id=fornecedor)
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(escola=self.escola_atual(), criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)


class GrupoViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario"), LeituraOuAdmin]
    serializer_class = GrupoSerializer

    def get_queryset(self):
        return Grupo.objects.filter(escola=self.escola_atual()).select_related("categoria")


class BemPermanenteViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario"), LeituraOuAdmin]
    serializer_class = BemPermanenteSerializer

    def get_queryset(self):
        return BemPermanente.objects.filter(escola=self.escola_atual())

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(escola=self.escola_atual(), criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)


class FornecedorViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("fornecedores"), LeituraOuAdmin]
    serializer_class = FornecedorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome", "documento"]

    def get_queryset(self):
        qs = Fornecedor.objects.filter(escola=self.escola_atual())
        for campo in ("emite_nota_fiscal", "aceita_fiado", "ativo"):
            valor = self.request.query_params.get(campo)
            if valor is not None:
                qs = qs.filter(**{campo: valor.lower() in ("1", "true", "sim")})
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(escola=self.escola_atual(), criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)


class MovimentacaoViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("movimentacoes")]
    serializer_class = MovimentacaoSerializer
    http_method_names = ["get", "post", "head", "options"]  # append-only

    def get_queryset(self):
        qs = Movimentacao.objects.filter(escola=self.escola_atual()).select_related("produto", "entrada")
        params = self.request.query_params
        if params.get("produto"):
            qs = qs.filter(produto_id=params["produto"])
        if params.get("tipo"):
            qs = qs.filter(tipo=params["tipo"])
        if params.get("data_de"):
            qs = qs.filter(data__gte=params["data_de"])
        if params.get("data_ate"):
            qs = qs.filter(data__lte=params["data_ate"])
        return qs

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        user = request.user if request.user.is_authenticated else None
        try:
            mov = registrar_movimentacao(
                produto=d["produto"], tipo=d["tipo"], quantidade=d["quantidade"],
                motivo=d.get("motivo", ""), preco_unitario=d.get("preco_unitario"),
                data=d.get("data"), user=user,
                escola=self.escola_atual(),
            )
        except DjangoValidationError as e:
            return Response({"detail": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        out = self.get_serializer(mov)
        return Response(out.data, status=status.HTTP_201_CREATED)


class EntradaViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("movimentacoes")]
    serializer_class = EntradaSerializer
    http_method_names = ["get", "post", "head", "options"]  # append-only

    def get_queryset(self):
        return Entrada.objects.filter(escola=self.escola_atual()).select_related("fornecedor").prefetch_related("itens__produto")

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            entrada = ser.save()
        except DjangoValidationError as e:
            return Response({"detail": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        out = self.get_serializer(entrada)
        return Response(out.data, status=status.HTTP_201_CREATED)


class LoteEstoqueViewSet(EscolaScopedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario")]
    serializer_class = LoteEstoqueSerializer

    def get_queryset(self):
        qs = LoteEstoque.objects.filter(escola=self.escola_atual()).select_related("produto", "entrada")
        if self.request.query_params.get("produto"):
            qs = qs.filter(produto_id=self.request.query_params["produto"])
        if self.request.query_params.get("ativos") in ("1", "true"):
            qs = qs.filter(quantidade__gt=0)
        return qs


class ReceitaViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("merenda"), LeituraOuAdmin]
    serializer_class = ReceitaSerializer

    def get_queryset(self):
        return Receita.objects.filter(escola=self.escola_atual()).prefetch_related("ingredientes__produto")


class CardapioViewSet(EscolaScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("merenda"), LeituraOuAdmin]
    serializer_class = CardapioSerializer

    def get_queryset(self):
        return Cardapio.objects.filter(escola=self.escola_atual()).select_related("receita")
