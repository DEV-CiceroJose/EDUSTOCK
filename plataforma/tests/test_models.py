from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from plataforma.models import Modulo, Perfil, TokenAcesso


class ModuloModelTest(TestCase):
    def test_str_retorna_nome(self):
        m = Modulo.objects.create(slug="custom_modulo", nome="Módulo Customizado")
        self.assertEqual(str(m), "Módulo Customizado")

    def test_depende_de_permite_autorreferencia(self):
        base = Modulo.objects.create(slug="base_modulo", nome="Módulo Base")
        dependente = Modulo.objects.create(slug="dep_modulo", nome="Módulo Dependente", depende_de=base)
        self.assertEqual(dependente.depende_de, base)
        self.assertIn(dependente, base.dependentes.all())


class PerfilModelTest(TestCase):
    def test_default_papel_e_operador(self):
        user = User.objects.create_user(username="joao", password="senha123")
        perfil = Perfil.objects.create(user=user)
        self.assertEqual(perfil.papel, Perfil.OPERADOR)

    def test_permite_dois_perfis_sem_matricula(self):
        u1 = User.objects.create_user(username="joao", password="senha123")
        u2 = User.objects.create_user(username="maria", password="senha123")
        Perfil.objects.create(user=u1)
        Perfil.objects.create(user=u2)  # não deve levantar IntegrityError


class TokenAcessoModelTest(TestCase):
    def test_expirado_property(self):
        user = User.objects.create_user(username="joao", password="senha123")
        token_valido = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        token_vencido = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() - timedelta(hours=1)
        )
        self.assertFalse(token_valido.expirado)
        self.assertTrue(token_vencido.expirado)
