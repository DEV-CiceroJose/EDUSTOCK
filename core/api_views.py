from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor, Entrada, Movimentacao
from .serializers import (
    ProdutoSerializer, CategoriaSerializer, GrupoSerializer,
    BemPermanenteSerializer, FornecedorSerializer,
    MovimentacaoSerializer, EntradaSerializer,
)
from .services import registrar_movimentacao


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all().order_by("name")
    serializer_class = CategoriaSerializer


class ProdutoViewSet(viewsets.ModelViewSet):
    serializer_class = ProdutoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def get_queryset(self):
        qs = Produto.objects.select_related(
            "grupo__categoria", "fornecedor", "criado_por", "atualizado_por"
        ).all()
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
        serializer.save(criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)


class GrupoViewSet(viewsets.ModelViewSet):
    queryset = Grupo.objects.select_related("categoria").all()
    serializer_class = GrupoSerializer


class BemPermanenteViewSet(viewsets.ModelViewSet):
    queryset = BemPermanente.objects.all()
    serializer_class = BemPermanenteSerializer

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)


class FornecedorViewSet(viewsets.ModelViewSet):
    serializer_class = FornecedorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome", "documento"]

    def get_queryset(self):
        qs = Fornecedor.objects.all()
        for campo in ("emite_nota_fiscal", "aceita_fiado", "ativo"):
            valor = self.request.query_params.get(campo)
            if valor is not None:
                qs = qs.filter(**{campo: valor.lower() in ("1", "true", "sim")})
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)


class MovimentacaoViewSet(viewsets.ModelViewSet):
    serializer_class = MovimentacaoSerializer
    http_method_names = ["get", "post", "head", "options"]  # append-only

    def get_queryset(self):
        qs = Movimentacao.objects.select_related("produto", "entrada").all()
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
            )
        except DjangoValidationError as e:
            return Response({"detail": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        out = self.get_serializer(mov)
        return Response(out.data, status=status.HTTP_201_CREATED)


class EntradaViewSet(viewsets.ModelViewSet):
    serializer_class = EntradaSerializer
    http_method_names = ["get", "post", "head", "options"]  # append-only

    def get_queryset(self):
        return Entrada.objects.select_related("fornecedor").prefetch_related("itens__produto").all()

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            entrada = ser.save()
        except DjangoValidationError as e:
            return Response({"detail": e.messages}, status=status.HTTP_400_BAD_REQUEST)
        out = self.get_serializer(entrada)
        return Response(out.data, status=status.HTTP_201_CREATED)
