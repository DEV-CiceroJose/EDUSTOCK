from rest_framework.routers import DefaultRouter
from .api_views import (
    ProdutoViewSet, CategoriaViewSet, GrupoViewSet,
    BemPermanenteViewSet, FornecedorViewSet,
    MovimentacaoViewSet, EntradaViewSet,
)

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"grupos", GrupoViewSet, basename="grupo")
router.register(r"bens-permanentes", BemPermanenteViewSet, basename="bempermanente")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedor")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacao")
router.register(r"entradas", EntradaViewSet, basename="entrada")

urlpatterns = router.urls
