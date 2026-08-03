from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from plataforma.models import Modulo, Perfil
from plataforma.permissions import (
    EhAdmin,
    LeituraOuAdmin,
    RequerModuloAtivo,
    usuario_admin_do_estoque,
)


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

    def test_bloqueia_quando_modulo_nao_existe(self):
        permission = RequerModuloAtivo("modulo-inexistente")()
        request = self.factory.get("/api/produtos/")
        self.assertFalse(permission.has_permission(request, None))


class EhAdminTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_permite_papel_admin(self):
        user = User.objects.create_user(username="admin1", password="x")
        Perfil.objects.create(user=user, papel=Perfil.ADMIN)
        request = self.factory.get("/")
        request.user = user
        self.assertTrue(EhAdmin().has_permission(request, None))

    def test_bloqueia_papel_operador_mesmo_quando_staff(self):
        user = User.objects.create_user(username="op1", password="x", is_staff=True)
        Perfil.objects.create(user=user, papel=Perfil.OPERADOR)
        request = self.factory.get("/")
        request.user = user
        self.assertFalse(EhAdmin().has_permission(request, None))

    def test_bloqueia_usuario_sem_perfil(self):
        user = User.objects.create_user(username="semperfil", password="x", is_staff=True)
        request = self.factory.get("/")
        request.user = user
        self.assertFalse(EhAdmin().has_permission(request, None))


class AutorizacaoEstoqueTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def _request(self, method, user):
        request = getattr(self.factory, method)("/")
        request.user = user
        return request

    def test_papel_admin_pode_alterar_cadastro(self):
        user = User.objects.create_user(username="admin-estoque", password="x")
        Perfil.objects.create(user=user, papel=Perfil.ADMIN)
        self.assertTrue(usuario_admin_do_estoque(user))
        self.assertTrue(
            LeituraOuAdmin().has_permission(self._request("post", user), None)
        )

    def test_operador_pode_ler_mas_nao_alterar_cadastro(self):
        user = User.objects.create_user(username="operador-estoque", password="x")
        Perfil.objects.create(user=user, papel=Perfil.OPERADOR)
        permission = LeituraOuAdmin()
        self.assertTrue(permission.has_permission(self._request("get", user), None))
        self.assertFalse(permission.has_permission(self._request("post", user), None))
        self.assertFalse(permission.has_permission(self._request("delete", user), None))

    def test_staff_continua_administrador_operacional(self):
        user = User.objects.create_user(
            username="staff-estoque", password="x", is_staff=True
        )
        Perfil.objects.create(user=user, papel=Perfil.OPERADOR)
        self.assertTrue(usuario_admin_do_estoque(user))
