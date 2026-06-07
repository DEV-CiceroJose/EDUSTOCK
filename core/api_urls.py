from django.urls import path
from rest_framework.routers import DefaultRouter
from .api_views import (
    ProdutoViewSet, CategoriaViewSet, GrupoViewSet,
    BemPermanenteViewSet, FornecedorViewSet,
    MovimentacaoViewSet, EntradaViewSet, AlertasView, PrestacaoContasView,
)
from .operacao_views import (
    ContagemView, ResumoFrequenciaView, PlanoDoDiaView, BaixaProducaoView,
)

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"grupos", GrupoViewSet, basename="grupo")
router.register(r"bens-permanentes", BemPermanenteViewSet, basename="bempermanente")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedor")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacao")
router.register(r"entradas", EntradaViewSet, basename="entrada")

urlpatterns = [
    path("alertas/", AlertasView.as_view(), name="alertas"),
    path("relatorios/prestacao-contas/", PrestacaoContasView.as_view(), name="prestacao-contas"),
    path("operacao/contagem/", ContagemView.as_view(), name="operacao-contagem"),
    path("operacao/resumo/", ResumoFrequenciaView.as_view(), name="operacao-resumo"),
    path("operacao/plano-do-dia/", PlanoDoDiaView.as_view(), name="operacao-plano"),
    path("operacao/baixa-de-producao/", BaixaProducaoView.as_view(), name="operacao-baixa"),
] + router.urls
