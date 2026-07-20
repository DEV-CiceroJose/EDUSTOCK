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
