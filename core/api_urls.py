from rest_framework.routers import DefaultRouter
from .api_views import ProdutoViewSet, CategoriaViewSet, GrupoViewSet

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"grupos", GrupoViewSet, basename="grupo")

urlpatterns = router.urls
