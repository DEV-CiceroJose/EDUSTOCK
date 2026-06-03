from rest_framework import viewsets, filters
from .models import Produto, Categoria
from .serializers import ProdutoSerializer, CategoriaSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all().order_by("name")
    serializer_class = CategoriaSerializer


class ProdutoViewSet(viewsets.ModelViewSet):
    # select_related evita N+1 ao serializar categoria/criado_por
    queryset = Produto.objects.select_related("categoria", "criado_por").order_by("nome")
    serializer_class = ProdutoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]  # casa com ?search= usado pelo frontend

    # Preenche a auditoria com o usuário logado (espelha o admin)
    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(criado_por=user, atualizado_por=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(atualizado_por=user)
