from django.conf import settings
from django.test import SimpleTestCase


class CorsSettingsTest(SimpleTestCase):
    def test_permite_cabecalho_de_sessao_dos_subaplicativos(self):
        self.assertIn("x-operacao-token", settings.CORS_ALLOW_HEADERS)

    def test_preflight_libera_cabecalho_de_sessao(self):
        response = self.client.options(
            "/api/operacao/status-do-dia/",
            HTTP_ORIGIN="http://localhost:5174",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,x-operacao-token",
        )

        self.assertEqual(response.status_code, 200)
        allowed_headers = response.headers["Access-Control-Allow-Headers"].lower()
        self.assertIn("x-operacao-token", allowed_headers)
