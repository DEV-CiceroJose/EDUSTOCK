import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from plataforma.models import Perfil


class CriarAdminCommandTest(TestCase):
    def test_cria_usuario_com_papel_admin(self):
        out = StringIO()
        with patch.dict(os.environ, {"EDUSTOCK_ADMIN_PASSWORD": "senha-boa-123"}, clear=False):
            call_command("criar_admin", "admin", "--password-env", "EDUSTOCK_ADMIN_PASSWORD", stdout=out)
            user = User.objects.get(username="admin")
            self.assertEqual(user.perfil.papel, Perfil.ADMIN)
            self.assertTrue(user.is_staff)
            self.assertIn("criado com sucesso", out.getvalue())

    def test_pede_senha_sem_aceitar_argumento_posicional(self):
        with patch("plataforma.management.commands.criar_admin.getpass.getpass", return_value="senha-boa-123") as getpass:
            call_command("criar_admin", "admin")

        getpass.assert_called_once_with("Senha: ")
        self.assertTrue(User.objects.get(username="admin").check_password("senha-boa-123"))

    def test_erro_se_password_env_nao_existe(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(CommandError):
                call_command("criar_admin", "admin", "--password-env", "AUSENTE")

    def test_erro_se_usuario_ja_existe(self):
        User.objects.create_user(username="admin", password="x")
        with self.assertRaises(CommandError):
            call_command("criar_admin", "admin", "--password-env", "EDUSTOCK_ADMIN_PASSWORD")
