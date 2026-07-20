from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from plataforma.models import Perfil


class CriarAdminCommandTest(TestCase):
    def test_cria_usuario_com_papel_admin(self):
        out = StringIO()
        call_command("criar_admin", "admin", "senha-boa-123", stdout=out)
        user = User.objects.get(username="admin")
        self.assertEqual(user.perfil.papel, Perfil.ADMIN)
        self.assertIn("criado com sucesso", out.getvalue())

    def test_erro_se_usuario_ja_existe(self):
        User.objects.create_user(username="admin", password="x")
        with self.assertRaises(CommandError):
            call_command("criar_admin", "admin", "outrasenha")
