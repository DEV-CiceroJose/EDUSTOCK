import os
import runpy
from pathlib import Path
from unittest.mock import patch

from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings


SETTINGS_PATH = Path(__file__).resolve().parents[2] / "easystock" / "settings.py"


def carregar_settings(**env):
    with patch.dict(os.environ, env, clear=True):
        return runpy.run_path(str(SETTINGS_PATH))


class DeploySettingsTest(SimpleTestCase):
    def test_preflight_permite_sessao_operacional_no_dominio_configurado(self):
        config = carregar_settings(
            CORS_ALLOWED_ORIGINS=" https://alunos.example.com, https://cozinha.example.com, "
        )
        with override_settings(
            CORS_ALLOWED_ORIGINS=config["CORS_ALLOWED_ORIGINS"],
            CORS_ALLOW_HEADERS=config.get("CORS_ALLOW_HEADERS", default_headers),
        ):
            resposta = self.client.options(
                "/api/operacao/resumo/",
                HTTP_ORIGIN="https://cozinha.example.com",
                HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
                HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-operacao-token,content-type",
            )
            self.assertEqual(resposta["access-control-allow-origin"], "https://cozinha.example.com")
            self.assertIn("x-operacao-token", resposta["access-control-allow-headers"])
            negada = self.client.options(
                "/api/operacao/resumo/",
                HTTP_ORIGIN="https://nao-autorizado.example.com",
                HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
            )
            self.assertNotIn("access-control-allow-origin", negada)

    def test_producao_exige_banco_explicito(self):
        with self.assertRaises(ImproperlyConfigured):
            carregar_settings(APP_ENV="production", SECRET_KEY="test-only")

    def test_producao_recusa_debug(self):
        with self.assertRaises(ImproperlyConfigured):
            carregar_settings(APP_ENV="production", SECRET_KEY="test-only", DEBUG="true",
                              DATABASE_URL="postgresql://test:test@localhost/test")

    def test_origens_csrf_podem_ser_configuradas_separadamente(self):
        config = carregar_settings(
            CORS_ALLOWED_ORIGINS="https://alunos.example.com",
            CSRF_TRUSTED_ORIGINS=" https://painel.example.com, ",
        )
        self.assertIn("https://painel.example.com", config["CSRF_TRUSTED_ORIGINS"])
        self.assertIn("https://alunos.example.com", config["CSRF_TRUSTED_ORIGINS"])
