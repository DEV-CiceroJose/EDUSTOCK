from django.urls import path
from rest_framework.routers import DefaultRouter
from .api_views import (
    ProdutoViewSet, CategoriaViewSet, GrupoViewSet,
    BemPermanenteViewSet, FornecedorViewSet,
    MovimentacaoViewSet, EntradaViewSet, AlertasView, PrestacaoContasView,
    LoteEstoqueViewSet, ReceitaViewSet, CardapioViewSet,
)
from .operacao_views import (
    ContagemView, ResumoFrequenciaView, PlanoDoDiaView, BaixaProducaoView,
    HealthCheckView, OperacaoLoginView, OperacaoLogoutView, StatusDoDiaView,
)
from .rede_views import (
    CardapioModeloMunicipalViewSet, CatalogoProdutoMunicipalViewSet,
    ContagemEstoqueViewSet, ImportacaoProdutosView, IndicadoresRedeView,
    RegistroRefeicaoViewSet,
)

router = DefaultRouter()
router.register(r"produtos", ProdutoViewSet, basename="produto")
router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"grupos", GrupoViewSet, basename="grupo")
router.register(r"bens-permanentes", BemPermanenteViewSet, basename="bempermanente")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedor")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacao")
router.register(r"entradas", EntradaViewSet, basename="entrada")
router.register(r"lotes", LoteEstoqueViewSet, basename="lote")
router.register(r"receitas", ReceitaViewSet, basename="receita")
router.register(r"cardapios", CardapioViewSet, basename="cardapio")
router.register(r"registros-refeicao", RegistroRefeicaoViewSet, basename="registro-refeicao")
router.register(r"contagens-estoque", ContagemEstoqueViewSet, basename="contagem-estoque")
router.register(r"rede/catalogo-produtos", CatalogoProdutoMunicipalViewSet, basename="catalogo-municipal")
router.register(r"rede/cardapios-modelo", CardapioModeloMunicipalViewSet, basename="cardapio-modelo")

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("alertas/", AlertasView.as_view(), name="alertas"),
    path("relatorios/prestacao-contas/", PrestacaoContasView.as_view(), name="prestacao-contas"),
    path("rede/indicadores/", IndicadoresRedeView.as_view(), name="indicadores-rede"),
    path("rede/importar-produtos/", ImportacaoProdutosView.as_view(), name="importar-produtos-rede"),

    # --- Módulo de Operação da Merenda (Sub-projeto E) ---
    # Autenticação por PIN (não usa Django auth)
    path("operacao/auth/", OperacaoLoginView.as_view(), name="operacao-auth-login"),
    path("operacao/auth/logout/", OperacaoLogoutView.as_view(), name="operacao-auth-logout"),

    # app-alunos — contagem de frequência (POST: ALUNO_REP / GET: ALUNO_REP + COZINHA)
    path("operacao/contagem/", ContagemView.as_view(), name="operacao-contagem"),
    path("operacao/status-do-dia/", StatusDoDiaView.as_view(), name="operacao-status-dia"),

    # Dashboard admin — resumo sem autenticação de perfil
    path("operacao/resumo/", ResumoFrequenciaView.as_view(), name="operacao-resumo"),

    # app-cozinha — plano e baixa de produção (apenas COZINHA)
    path("operacao/plano-do-dia/", PlanoDoDiaView.as_view(), name="operacao-plano"),
    path("operacao/baixa-de-producao/", BaixaProducaoView.as_view(), name="operacao-baixa"),
] + router.urls
