from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from plataforma.models import Modulo, Perfil, TokenAcesso

MODULOS_PADRAO = ["inventario", "movimentacoes", "fornecedores", "alertas", "relatorios", "merenda"]


class AutenticadoAPITestCase(APITestCase):
    """
    Base para testes de API que precisam de um usuário autenticado com
    todos os módulos ativos. Popula um usuário ADMIN e autentica o
    `self.client` via header Authorization antes de cada teste.
    """

    def setUp(self):
        inventario = None
        for slug in MODULOS_PADRAO:
            modulo, _ = Modulo.objects.get_or_create(
                slug=slug, defaults={"nome": slug.capitalize(), "ativo": True}
            )
            if slug == "inventario":
                inventario = modulo
        Modulo.objects.filter(slug="merenda").update(depende_de=inventario)

        self.user = User.objects.create_user(username="teste-admin", password="senha-boa-123")
        Perfil.objects.create(user=self.user, papel=Perfil.ADMIN)
        self.token = TokenAcesso.objects.create(
            user=self.user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.token}")
