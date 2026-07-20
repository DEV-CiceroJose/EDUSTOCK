from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LoginView, LogoutView, ModuloViewSet

router = DefaultRouter()
router.register(r"modulos", ModuloViewSet, basename="modulo")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
] + router.urls
