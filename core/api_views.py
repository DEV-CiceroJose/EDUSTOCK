from rest_framework import viewsets, filters
from .models import Produto, Categoria, Grupo
from .serializers import ProdutoSerializer, CategoriaSerializer, GrupoSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all().order_by("name")
    serializer_class = CategoriaSerializer


class ProdutoViewSet(viewsets.ModelViewSet):
    serializer_class = ProdutoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]

    def get_queryset(self):
        qs = Produto.objects.select_related(
            "grupo__categoria", "criado_por", "atualizado_por"
        ).all()
        grupo = self.request.query_params.get("grupo")
        categoria = self.request.query_params.get("categoria")
        if grupo:
            qs = qs.filter(grupo_id=grupo)
        if categoria:
            qs = qs.filter(grupo__categoria_id=categoria)
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
