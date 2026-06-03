from rest_framework.routers import DefaultRouter
from .api_views import ProdutoViewSet, CategoriaViewSet

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")

urlpatterns = router.urls
