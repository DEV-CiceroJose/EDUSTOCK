from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from plataforma.models import Modulo, Perfil, TokenAcesso


class LoginViewTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="joao", password="senha-boa-123")
        # A migração 0002_seed_modulos já popula "inventario", "merenda" e
        # outros módulos como ativos. Ajustamos os dados existentes em vez
        # de criar registros novos para não colidir com o slug único.
        Modulo.objects.update(ativo=False)
        Modulo.objects.filter(slug="inventario").update(ativo=True)

    def test_login_com_credenciais_corretas_retorna_token_e_modulos(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "joao", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["papel"], Perfil.OPERADOR)
        self.assertEqual(resp.data["modulos_ativos"], ["inventario"])

    def test_login_com_senha_errada_retorna_401(self):
        resp = self.client.post(
            "/api/auth/login/", {"username": "joao", "password": "errada"}, format="json"
        )
        self.assertEqual(resp.status_code, 401)


class LogoutViewTest(APITestCase):
    def test_logout_invalida_token(self):
        user = User.objects.create_user(username="joao", password="senha-boa-123")
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        resp = self.client.post(
            "/api/auth/logout/", HTTP_AUTHORIZATION=f"Token {token.token}"
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(TokenAcesso.objects.filter(pk=token.pk).exists())


class ModuloViewSetTest(APITestCase):
    def setUp(self):
        # A migração 0002_seed_modulos já popula "inventario", "merenda" e
        # outros 4 módulos como ativos. Para exercitar exatamente o cenário
        # do brief (2 módulos, merenda dependendo de inventario), removemos
        # os módulos extras e normalizamos os dois que nos interessam em vez
        # de criar registros novos, o que colidiria com o slug único.
        Modulo.objects.exclude(slug__in=["inventario", "merenda"]).delete()
        self.inventario, _ = Modulo.objects.update_or_create(
            slug="inventario",
            defaults={"nome": "Inventário", "ativo": True, "depende_de": None},
        )
        self.merenda, _ = Modulo.objects.update_or_create(
            slug="merenda",
            defaults={"nome": "Merenda", "ativo": True, "depende_de": self.inventario},
        )

    def _autenticar(self, papel):
        user = User.objects.create_user(username=f"user-{papel.lower()}", password="x")
        Perfil.objects.create(user=user, papel=papel)
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

    def test_admin_lista_modulos(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.get("/api/modulos/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_admin_desativa_modulo_sem_dependentes(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.patch(f"/api/modulos/{self.merenda.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.merenda.refresh_from_db()
        self.assertFalse(self.merenda.ativo)

    def test_nao_desativa_modulo_com_dependente_ativo(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.patch(f"/api/modulos/{self.inventario.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.inventario.refresh_from_db()
        self.assertTrue(self.inventario.ativo)

    def test_operador_nao_pode_togglear(self):
        self._autenticar(Perfil.OPERADOR)
        resp = self.client.patch(f"/api/modulos/{self.merenda.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 403)
