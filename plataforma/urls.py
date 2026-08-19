from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    EscolaViewSet, LoginView, LogoutView, MeuPerfilView, ModuloViewSet,
    MunicipioViewSet, TrocarEscolaView, UsuarioViewSet, VinculoUsuarioViewSet,
)

router = DefaultRouter()
router.register(r"modulos", ModuloViewSet, basename="modulo")
router.register(r"usuarios", UsuarioViewSet, basename="usuario")
router.register(r"municipios", MunicipioViewSet, basename="municipio")
router.register(r"escolas", EscolaViewSet, basename="escola")
router.register(r"vinculos", VinculoUsuarioViewSet, basename="vinculo")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeuPerfilView.as_view(), name="auth-me"),
    path("auth/escola/", TrocarEscolaView.as_view(), name="auth-escola"),
] + router.urls
