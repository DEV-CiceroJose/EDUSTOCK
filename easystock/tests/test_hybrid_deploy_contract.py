import re
from pathlib import Path

from django.test import SimpleTestCase


ROOT = Path(__file__).resolve().parents[2]


class HybridDeployContractTest(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.compose = (ROOT / "deploy" / "compose.yml").read_text(encoding="utf-8")
        cls.caddy = (ROOT / "deploy" / "Caddyfile").read_text(encoding="utf-8")
        cls.env_example = (ROOT / "deploy" / "compose.env.example").read_text(
            encoding="utf-8"
        )

    def _service_block(self, name):
        match = re.search(
            rf"(?ms)^  {re.escape(name)}:\n(.*?)(?=^  [a-z][a-z0-9_-]*:\n|^networks:\n|^volumes:\n)",
            self.compose,
        )
        self.assertIsNotNone(match, f"Serviço {name} ausente do Compose")
        return match.group(1)

    def test_vps_contem_apenas_proxy_api_e_banco(self):
        services = re.findall(r"(?m)^  ([a-z][a-z0-9_-]*):$", self.compose)
        self.assertEqual(services[:3], ["db", "api", "proxy"])
        self.assertNotIn("Dockerfile.web", self.compose)
        self.assertNotIn("app-alunos", self.compose)
        self.assertNotIn("app-cozinha", self.compose)

    def test_somente_proxy_publica_portas(self):
        self.assertNotIn("ports:", self._service_block("db"))
        self.assertNotIn("ports:", self._service_block("api"))
        proxy = self._service_block("proxy")
        self.assertIn("- '80:80'", proxy)
        self.assertIn("- '443:443'", proxy)

    def test_banco_fica_em_rede_interna(self):
        self.assertRegex(
            self.compose,
            r"(?ms)^networks:\n  backend:\n    internal: true$",
        )
        self.assertIn("- backend", self._service_block("db"))
        self.assertIn("- backend", self._service_block("api"))

    def test_api_recebe_as_tres_origens_render_para_cors_e_csrf(self):
        api = self._service_block("api")
        origins = (
            "${DASHBOARD_ORIGIN:?Informe a origem do Dashboard},"
            "${ALUNOS_ORIGIN:?Informe a origem de Alunos},"
            "${COZINHA_ORIGIN:?Informe a origem da Cozinha}"
        )
        self.assertIn(f"CORS_ALLOWED_ORIGINS: {origins}", api)
        self.assertIn(f"CSRF_TRUSTED_ORIGINS: {origins}", api)
        for name in ("DASHBOARD_ORIGIN", "ALUNOS_ORIGIN", "COZINHA_ORIGIN"):
            self.assertRegex(self.env_example, rf"(?m)^{name}=https://")

    def test_caddy_publica_somente_a_api(self):
        self.assertIn("{$API_HOST}", self.caddy)
        self.assertIn("reverse_proxy api:8000", self.caddy)
        self.assertNotIn("{$PAINEL_HOST}", self.caddy)
        self.assertNotIn("{$ALUNOS_HOST}", self.caddy)
        self.assertNotIn("{$COZINHA_HOST}", self.caddy)

    def test_backup_exige_destino_externo_e_testa_o_dump(self):
        backup = (ROOT / "deploy" / "scripts" / "backup_postgres.sh").read_text(
            encoding="utf-8"
        )
        restore = (ROOT / "deploy" / "scripts" / "verify_restore.sh").read_text(
            encoding="utf-8"
        )
        self.assertIn("BACKUP_REMOTE", backup)
        self.assertIn("pg_dump", backup)
        self.assertIn("pg_restore --list", backup)
        self.assertIn("sha256sum", backup)
        self.assertIn("rclone copyto", backup)
        self.assertIn("createdb", restore)
        self.assertRegex(restore, r"pg_restore .*--exit-on-error")
        self.assertIn("dropdb", restore)
