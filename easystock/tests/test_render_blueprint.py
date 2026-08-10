import re
from pathlib import Path

from django.test import SimpleTestCase


ROOT = Path(__file__).resolve().parents[2]
STATIC_SERVICES = (
    "edustock-demo-dashboard",
    "edustock-demo-alunos",
    "edustock-demo-cozinha",
)


class RenderBlueprintTest(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.blueprint = (ROOT / "render.yaml").read_text(encoding="utf-8")

    def _service_block(self, name):
        match = re.search(
            rf"(?ms)^  - type: web\n    name: {re.escape(name)}\n(.*?)(?=^  - type: web\n|^databases:\n)",
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
