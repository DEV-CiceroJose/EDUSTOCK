from datetime import timedelta

from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed

from plataforma.authentication import TokenAcessoAuthentication
from plataforma.models import TokenAcesso


class TokenAcessoAuthenticationTest(TestCase):
    def setUp(self):
        self.auth = TokenAcessoAuthentication()
        self.user = User.objects.create_user(username="joao", password="x")
        self.factory = RequestFactory()

    def test_sem_header_retorna_none(self):
        request = self.factory.get("/api/produtos/")
        self.assertIsNone(self.auth.authenticate(request))

    def test_token_valido_autentica(self):
        token = TokenAcesso.objects.create(
            user=self.user, expira_em=timezone.now() + timedelta(hours=1)
        )
        request = self.factory.get(
            "/api/produtos/", HTTP_AUTHORIZATION=f"Token {token.token}"
        )
        user, auth_token = self.auth.authenticate(request)
        self.assertEqual(user, self.user)
        self.assertEqual(auth_token, token)

    def test_token_expirado_levanta_erro(self):
        token = TokenAcesso.objects.create(
            user=self.user, expira_em=timezone.now() - timedelta(hours=1)
        )
        request = self.factory.get(
            "/api/produtos/", HTTP_AUTHORIZATION=f"Token {token.token}"
        )
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_token_de_usuario_inativo_e_revogado(self):
        token = TokenAcesso.objects.create(
            user=self.user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        request = self.factory.get(
            "/api/produtos/", HTTP_AUTHORIZATION=f"Token {token.token}"
        )

        with self.assertRaises(AuthenticationFailed) as erro:
            self.auth.authenticate(request)

        self.assertEqual(str(erro.exception.detail), "Usuário inativo.")
        self.assertFalse(TokenAcesso.objects.filter(pk=token.pk).exists())

    def test_token_invalido_levanta_erro(self):
        request = self.factory.get(
            "/api/produtos/", HTTP_AUTHORIZATION="Token nao-existe-e-nao-e-uuid"
        )
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_authenticate_header_retorna_keyword(self):
        self.assertEqual(self.auth.authenticate_header(None), "Token")
