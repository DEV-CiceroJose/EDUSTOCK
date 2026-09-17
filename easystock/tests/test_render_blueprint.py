import re
from pathlib import Path

from django.test import SimpleTestCase


ROOT = Path(__file__).resolve().parents[2]
STATIC_SERVICES = (
    "edustock-dashboard",
    "edustock-alunos",
    "edustock-cozinha",
)


class RenderBlueprintTest(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.blueprint = (ROOT / "render.yaml").read_text(encoding="utf-8")

    def _service_block(self, name):
        match = re.search(
            rf"(?ms)^  - type: web\n    name: {re.escape(name)}\n(.*?)(?=^  - type: web\n|\Z)",
            self.blueprint,
        )
        self.assertIsNotNone(match, f"Serviço {name} ausente do render.yaml")
        return match.group(1)

    def test_sites_estaticos_fixam_node_22(self):
        for service in STATIC_SERVICES:
            with self.subTest(service=service):
                block = self._service_block(service)
                self.assertRegex(
                    block,
                    r'(?m)^      - key: NODE_VERSION\n        value: "22\.22\.0"$',
                )

    def test_render_publica_somente_os_tres_frontends(self):
        self.assertEqual(self.blueprint.count("    runtime: static\n"), 3)
        self.assertNotIn("runtime: python", self.blueprint)
        self.assertNotRegex(self.blueprint, r"(?m)^databases:")
        self.assertNotIn("edustock-demo-api", self.blueprint)

    def test_builds_exigem_api_https_configurada_fora_do_repositorio(self):
        dashboard = self._service_block("edustock-dashboard")
        self.assertRegex(
            dashboard,
            r"(?m)^      - key: VITE_API_URL\n        sync: false$",
        )
        self.assertIn("node deploy/validate-render-env.mjs dashboard", dashboard)

        for service in ("edustock-alunos", "edustock-cozinha"):
            with self.subTest(service=service):
                block = self._service_block(service)
                self.assertRegex(
                    block,
                    r"(?m)^      - key: VITE_API_BASE\n        sync: false$",
                )
                self.assertIn("node deploy/validate-render-env.mjs pwa", block)

    def test_sites_tem_rewrite_spa_e_cabecalhos_de_seguranca(self):
        for service in STATIC_SERVICES:
            with self.subTest(service=service):
                block = self._service_block(service)
                self.assertIn("source: /*\n        destination: /index.html", block)
                self.assertIn("name: Content-Security-Policy", block)
                self.assertIn("name: X-Content-Type-Options", block)
                self.assertIn("name: Referrer-Policy", block)
                self.assertIn("https://fonts.googleapis.com", block)
                self.assertIn("https://fonts.gstatic.com", block)
