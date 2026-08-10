import os
from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from core.models import Entrada, LoteEstoque, Movimentacao, PinAcesso, Produto, Turma
from plataforma.management.commands.preparar_demo import (
    DEMO_ADMIN_MATRICULA,
    DEMO_OPERATOR_MATRICULA,
)
from plataforma.models import Perfil, TokenAcesso


class PrepararDemoCommandTest(TestCase):
    def demo_env(self, **overrides):
        env = {
            "DEMO_ADMIN_USERNAME": "admin.demo",
            "DEMO_ADMIN_PASSWORD": "Senha-Ficticia-123",
            "DEMO_OPERATOR_USERNAME": "operador.demo",
            "DEMO_OPERATOR_PASSWORD": "Senha-Ficticia-456",
            "DEMO_ALUNOS_PIN": "1357",
            "DEMO_COZINHA_PIN": "2468",
            "DEMO_EXPIRES_AT": (timezone.now() + timedelta(days=30)).isoformat(),
        }
        env.update(overrides)
        return env

    def run_demo(self, env=None, **kwargs):
        desired = env or self.demo_env()
        isolated_demo_env = {name: "" for name in self.demo_env()}
        isolated_demo_env.update(desired)
        with patch.dict(os.environ, isolated_demo_env, clear=False):
            call_command("preparar_demo", **kwargs)

    @override_settings(DEMO_MODE=True)
    def test_preparar_demo_pode_rodar_duas_vezes_sem_duplicar(self):
        env = self.demo_env()

        self.run_demo(env)
        counts = {
            model: model.objects.count()
            for model in (User, Turma, PinAcesso, Produto, Entrada, Movimentacao, LoteEstoque)
        }
        self.run_demo(env)

        self.assertEqual(User.objects.filter(username=env["DEMO_ADMIN_USERNAME"]).count(), 1)
        self.assertEqual(User.objects.filter(username=env["DEMO_OPERATOR_USERNAME"]).count(), 1)
        self.assertEqual(PinAcesso.objects.filter(papel=PinAcesso.COZINHA).count(), 1)
        self.assertEqual(
            PinAcesso.objects.filter(papel=PinAcesso.ALUNO_REP).count(), 1
        )
        for model, count in counts.items():
            with self.subTest(model=model.__name__):
                self.assertEqual(model.objects.count(), count)

        admin = User.objects.get(username=env["DEMO_ADMIN_USERNAME"])
        operador = User.objects.get(username=env["DEMO_OPERATOR_USERNAME"])
        self.assertTrue(admin.is_staff and admin.is_superuser)
        self.assertEqual(admin.perfil.papel, Perfil.ADMIN)
        self.assertEqual(operador.perfil.papel, Perfil.OPERADOR)
        self.assertTrue(
            Entrada.objects.filter(numero_nota_fiscal="DEMO-FICTICIA-001").exists()
        )
        self.assertTrue(Movimentacao.objects.filter(tipo=Movimentacao.ENTRADA).exists())
        self.assertTrue(LoteEstoque.objects.filter(quantidade__gt=0).exists())

    @override_settings(DEMO_MODE=True)
    def test_rotaciona_senhas_e_pins_sem_criar_novos_registros(self):
        self.run_demo()
        admin = User.objects.get(username=self.demo_env()["DEMO_ADMIN_USERNAME"])
        operador = User.objects.get(username=self.demo_env()["DEMO_OPERATOR_USERNAME"])
        TokenAcesso.emitir(user=admin, expira_em=timezone.now() + timedelta(hours=1))
        TokenAcesso.emitir(user=operador, expira_em=timezone.now() + timedelta(hours=1))
        rotated = self.demo_env(
            DEMO_ADMIN_PASSWORD="Senha-Ficticia-Nova-123",
            DEMO_OPERATOR_PASSWORD="Senha-Ficticia-Nova-456",
            DEMO_ALUNOS_PIN="9753",
            DEMO_COZINHA_PIN="8642",
        )

        self.run_demo(rotated)

        admin = User.objects.get(username=rotated["DEMO_ADMIN_USERNAME"])
        operador = User.objects.get(username=rotated["DEMO_OPERATOR_USERNAME"])
        self.assertTrue(admin.check_password(rotated["DEMO_ADMIN_PASSWORD"]))
        self.assertTrue(operador.check_password(rotated["DEMO_OPERATOR_PASSWORD"]))
        self.assertTrue(
            PinAcesso.objects.get(papel=PinAcesso.ALUNO_REP).confere_pin(
                rotated["DEMO_ALUNOS_PIN"]
            )
        )
        self.assertTrue(
            PinAcesso.objects.get(papel=PinAcesso.COZINHA).confere_pin(
                rotated["DEMO_COZINHA_PIN"]
            )
        )
        self.assertEqual(User.objects.count(), 2)
        self.assertEqual(PinAcesso.objects.count(), 2)
        self.assertFalse(TokenAcesso.objects.filter(user__in=(admin, operador)).exists())

    @override_settings(DEMO_MODE=True)
    def test_rotaciona_usernames_no_mesmo_usuario_e_revoga_tokens(self):
        original = self.demo_env()
        self.run_demo(original)
        admin_original = User.objects.get(username=original["DEMO_ADMIN_USERNAME"])
        operador_original = User.objects.get(username=original["DEMO_OPERATOR_USERNAME"])
        TokenAcesso.emitir(
            user=admin_original, expira_em=timezone.now() + timedelta(hours=1)
        )
        TokenAcesso.emitir(
            user=operador_original, expira_em=timezone.now() + timedelta(hours=1)
        )
        rotated = self.demo_env(
            DEMO_ADMIN_USERNAME="admin.rotacionado.demo",
            DEMO_ADMIN_PASSWORD="Senha-Admin-Rotacionada-123",
            DEMO_OPERATOR_USERNAME="operador.rotacionado.demo",
            DEMO_OPERATOR_PASSWORD="Senha-Operador-Rotacionada-456",
        )

        self.run_demo(rotated)
        self.run_demo(rotated)

        admin = User.objects.get(username=rotated["DEMO_ADMIN_USERNAME"])
        operador = User.objects.get(username=rotated["DEMO_OPERATOR_USERNAME"])
        self.assertEqual(admin.pk, admin_original.pk)
        self.assertEqual(operador.pk, operador_original.pk)
        self.assertFalse(User.objects.filter(username=original["DEMO_ADMIN_USERNAME"]).exists())
        self.assertFalse(User.objects.filter(username=original["DEMO_OPERATOR_USERNAME"]).exists())
        self.assertFalse(User.objects.filter(is_superuser=True).exclude(pk=admin.pk).exists())
        self.assertFalse(TokenAcesso.objects.filter(user__in=(admin, operador)).exists())
        self.assertEqual(admin.perfil.matricula, DEMO_ADMIN_MATRICULA)
        self.assertEqual(operador.perfil.matricula, DEMO_OPERATOR_MATRICULA)
        self.assertEqual(User.objects.count(), 2)

    @override_settings(DEMO_MODE=True)
    def test_rotacao_rejeita_username_que_pertence_a_outra_conta(self):
        original = self.demo_env()
        self.run_demo(original)
        User.objects.create_user(username="conta-real-ficticia")

        with self.assertRaisesMessage(CommandError, "j\u00e1 pertence"):
            self.run_demo(
                self.demo_env(DEMO_ADMIN_USERNAME="conta-real-ficticia")
            )

        self.assertTrue(User.objects.filter(username=original["DEMO_ADMIN_USERNAME"]).exists())
        self.assertTrue(User.objects.filter(username="conta-real-ficticia").exists())

    @override_settings(DEMO_MODE=True)
    def test_recusa_demo_expirada_sem_gravar_dados(self):
        expired = self.demo_env(
            DEMO_EXPIRES_AT=(timezone.now() - timedelta(seconds=1)).isoformat()
        )

        with self.assertRaisesMessage(CommandError, "expirada"):
            self.run_demo(expired)

        self.assertFalse(User.objects.exists())

    @override_settings(DEMO_MODE=False)
    def test_recusa_quando_modo_demo_esta_desativado(self):
        with self.assertRaisesMessage(CommandError, "DEMO_MODE"):
            self.run_demo()

    @override_settings(DEMO_MODE=True)
    def test_exige_as_sete_variaveis_e_nao_imprime_segredos(self):
        env = self.demo_env()
        secret_values = list(env.values())
        for name in tuple(env):
            with self.subTest(name=name):
                incomplete = dict(env)
                incomplete.pop(name)
                with self.assertRaisesMessage(CommandError, name):
                    self.run_demo(incomplete)

        output = StringIO()
        self.run_demo(env, stdout=output)
        rendered = output.getvalue()
        for secret in secret_values:
            self.assertNotIn(secret, rendered)
