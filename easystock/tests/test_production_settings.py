from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from easystock.security import csv_env, validate_production_env


class ProductionEnvironmentTest(SimpleTestCase):
    def valid_env(self, **overrides):
        env = {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql://demo:fake@db.invalid:5432/edustock_demo",
            "SECRET_KEY": "s" * 64,
            "PIN_LOOKUP_SECRET": "p" * 64,
            "ALLOWED_HOSTS": " edustock-demo-api.onrender.com,api.demo.invalid ",
            "CORS_ALLOWED_ORIGINS": (
                " https://edustock-demo-dashboard.onrender.com,"
                "https://edustock-demo-alunos.onrender.com "
            ),
        }
        env.update(overrides)
        return env

    def test_csv_env_normaliza_e_descarta_itens_vazios(self):
        env = {"HOSTS": " demo.invalid, , api.demo.invalid ,,"}

        self.assertEqual(csv_env("HOSTS", env), ["demo.invalid", "api.demo.invalid"])

    def test_producao_exige_todas_as_variaveis_obrigatorias(self):
        required = (
            "DATABASE_URL",
            "SECRET_KEY",
            "PIN_LOOKUP_SECRET",
            "ALLOWED_HOSTS",
            "CORS_ALLOWED_ORIGINS",
        )
        for name in required:
            with self.subTest(name=name):
                env = self.valid_env()
                env.pop(name)
                with self.assertRaisesMessage(ImproperlyConfigured, name):
                    validate_production_env(env)

    def test_producao_rejeita_listas_obrigatorias_sem_valores(self):
        for name in ("ALLOWED_HOSTS", "CORS_ALLOWED_ORIGINS"):
            with self.subTest(name=name):
                with self.assertRaisesMessage(ImproperlyConfigured, name):
                    validate_production_env(self.valid_env(**{name: " , , "}))

    def test_producao_exige_database_url_postgresql(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "DATABASE_URL"):
            validate_production_env(self.valid_env(DATABASE_URL="sqlite:///db.sqlite3"))

    def test_producao_rejeita_debug(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "DEBUG"):
            validate_production_env(self.valid_env(DEBUG="true"))

    def test_producao_rejeita_localhost_em_hosts_cors_e_csrf(self):
        invalid_values = (
            ("ALLOWED_HOSTS", "localhost"),
            ("ALLOWED_HOSTS", "127.0.0.1"),
            ("ALLOWED_HOSTS", "http://demo.invalid"),
            ("CORS_ALLOWED_ORIGINS", "http://localhost:5173"),
            ("CSRF_TRUSTED_ORIGINS", "https://127.0.0.1:5173"),
        )
        for name, value in invalid_values:
            with self.subTest(name=name, value=value):
                with self.assertRaisesMessage(ImproperlyConfigured, name):
                    validate_production_env(self.valid_env(**{name: value}))

    def test_producao_rejeita_origem_sem_https(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "HTTPS"):
            validate_production_env(
                self.valid_env(CORS_ALLOWED_ORIGINS="http://demo.invalid")
            )

    def test_producao_devolve_valores_normalizados(self):
        values = validate_production_env(self.valid_env())

        self.assertEqual(
            values["ALLOWED_HOSTS"],
            ["edustock-demo-api.onrender.com", "api.demo.invalid"],
        )
        self.assertEqual(
            values["CSRF_TRUSTED_ORIGINS"], values["CORS_ALLOWED_ORIGINS"]
        )
        self.assertFalse(values["DEBUG"])
