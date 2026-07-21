from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from plataforma.models import Modulo, Perfil
from plataforma.permissions import EhAdmin, RequerModuloAtivo


class RequerModuloAtivoTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        Modulo.objects.get_or_create(slug="inventario", defaults={"nome": "Inventário", "ativo": True})

    def test_permite_quando_modulo_ativo(self):
        permission = RequerModuloAtivo("inventario")()
        request = self.factory.get("/api/produtos/")
        self.assertTrue(permission.has_permission(request, None))

    def test_bloqueia_quando_modulo_inativo(self):
        Modulo.objects.filter(slug="inventario").update(ativo=False)
        permission = RequerModuloAtivo("inventario")()
        request = self.factory.get("/api/produtos/")
        self.assertFalse(permission.has_permission(request, None))

    def test_permite_quando_modulo_nao_existe(self):
        permission = RequerModuloAtivo("modulo-inexistente")()
        request = self.factory.get("/api/produtos/")
        self.assertTrue(permission.has_permission(request, None))


class EhAdminTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_permite_quando_is_staff(self):
        user = User.objects.create_user(username="admin1", password="x", is_staff=True)
        request = self.factory.get("/")
        request.user = user
        self.assertTrue(EhAdmin().has_permission(request, None))

    def test_bloqueia_quando_nao_staff(self):
        user = User.objects.create_user(username="op1", password="x")
        request = self.factory.get("/")
        request.user = user
        self.assertFalse(EhAdmin().has_permission(request, None))

    def test_bloqueia_papel_admin_da_aplicacao_sem_is_staff(self):
        """Perfil.papel=ADMIN sozinho não basta mais — é preciso ser is_staff."""
        user = User.objects.create_user(username="semstaff", password="x")
        Perfil.objects.create(user=user, papel=Perfil.ADMIN)
        request = self.factory.get("/")
        request.user = user
        self.assertFalse(EhAdmin().has_permission(request, None))
