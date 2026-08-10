from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from plataforma.models import Modulo, Perfil, RegistroAuditoria, TokenAcesso


class LoginViewTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="joao", password="senha-boa-123")
        # A migração 0002_seed_modulos já popula "inventario", "merenda" e
        # outros módulos como ativos. Ajustamos os dados existentes em vez
        # de criar registros novos para não colidir com o slug único.
        Modulo.objects.update(ativo=False)
        Modulo.objects.filter(slug="inventario").update(ativo=True)

    def test_login_com_credenciais_corretas_retorna_token_e_modulos(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "joao", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["papel"], Perfil.OPERADOR)
        self.assertFalse(resp.data["is_staff"])
        self.assertEqual(resp.data["username"], "joao")
        self.assertEqual(resp.data["nome"], "joao")
        self.assertEqual(resp.data["modulos_ativos"], ["inventario"])

    def test_login_retorna_first_name_como_nome_quando_definido(self):
        self.user.first_name = "João Silva"
        self.user.save(update_fields=["first_name"])
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "joao", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["nome"], "João Silva")

    def test_login_retorna_is_staff_true_para_usuario_staff(self):
        User.objects.create_user(username="root", password="senha-boa-123", is_staff=True)
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "root", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertTrue(resp.data["is_staff"])

    def test_login_retorna_apenas_modulos_atribuidos_ao_operador(self):
        fornecedor = Modulo.objects.get(slug="fornecedores")
        fornecedor.ativo = True
        fornecedor.save(update_fields=["ativo"])
        inventario = Modulo.objects.get(slug="inventario")
        perfil, _ = Perfil.objects.get_or_create(user=self.user)
        perfil.modulos.set([inventario])

        resp = self.client.post(
            "/api/auth/login/",
            {"username": "joao", "password": "senha-boa-123"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["modulos_ativos"], ["inventario"])

    def test_login_com_senha_errada_retorna_401(self):
        resp = self.client.post(
            "/api/auth/login/", {"username": "joao", "password": "errada"}, format="json"
        )
        self.assertEqual(resp.status_code, 401)

    def test_login_bloqueia_apos_cinco_falhas(self):
        for _ in range(5):
            resposta = self.client.post(
                "/api/auth/login/",
                {"username": "joao", "password": "errada"},
                format="json",
            )
            self.assertEqual(resposta.status_code, 401)
        bloqueada = self.client.post(
            "/api/auth/login/",
            {"username": "joao", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(bloqueada.status_code, 429)
        self.assertIn("Retry-After", bloqueada.headers)


class LogoutViewTest(APITestCase):
    def test_logout_invalida_token(self):
        user = User.objects.create_user(username="joao", password="senha-boa-123")
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        resp = self.client.post(
            "/api/auth/logout/", HTTP_AUTHORIZATION=f"Token {token.token}"
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(TokenAcesso.objects.filter(pk=token.pk).exists())


class ModuloViewSetTest(APITestCase):
    def setUp(self):
        # A migração 0002_seed_modulos já popula "inventario", "merenda" e
        # outros 4 módulos como ativos. Para exercitar exatamente o cenário
        # do brief (2 módulos, merenda dependendo de inventario), removemos
        # os módulos extras e normalizamos os dois que nos interessam em vez
        # de criar registros novos, o que colidiria com o slug único.
        Modulo.objects.exclude(slug__in=["inventario", "merenda"]).delete()
        self.inventario, _ = Modulo.objects.update_or_create(
            slug="inventario",
            defaults={"nome": "Inventário", "ativo": True, "depende_de": None},
        )
        self.merenda, _ = Modulo.objects.update_or_create(
            slug="merenda",
            defaults={"nome": "Merenda", "ativo": True, "depende_de": self.inventario},
        )

    def _autenticar(self, papel, *, is_staff=False):
        user = User.objects.create_user(
            username=f"user-{papel}-{is_staff}", password="x", is_staff=is_staff
        )
        Perfil.objects.create(user=user, papel=papel)
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

    def test_admin_lista_modulos(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.get("/api/modulos/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 2)

    def test_admin_desativa_modulo_sem_dependentes(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.patch(f"/api/modulos/{self.merenda.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.merenda.refresh_from_db()
        self.assertFalse(self.merenda.ativo)

    def test_nao_desativa_modulo_com_dependente_ativo(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.patch(f"/api/modulos/{self.inventario.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.inventario.refresh_from_db()
        self.assertTrue(self.inventario.ativo)

    def test_operador_staff_nao_pode_togglear(self):
        self._autenticar(Perfil.OPERADOR, is_staff=True)
        resp = self.client.patch(f"/api/modulos/{self.merenda.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_operador_staff_nao_pode_listar_modulos(self):
        self._autenticar(Perfil.OPERADOR, is_staff=True)
        resp = self.client.get("/api/modulos/")
        self.assertEqual(resp.status_code, 403)


class UsuarioViewSetTest(APITestCase):
    def _autenticar_admin(self):
        admin = User.objects.create_user(username="admin1", password="x")
        Perfil.objects.create(user=admin, papel=Perfil.ADMIN)
        token = TokenAcesso.objects.create(
            user=admin, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

    def test_admin_cria_operador(self):
        self._autenticar_admin()
        modulo = Modulo.objects.get(slug="inventario")
        resp = self.client.post("/api/usuarios/", {
            "username": "maria", "password": "senha-boa-123", "papel": "OPERADOR", "modulos": [modulo.slug],
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        maria = User.objects.get(username="maria")
        self.assertEqual(maria.perfil.papel, "OPERADOR")

    def test_admin_altera_papel_de_usuario(self):
        self._autenticar_admin()
        u = User.objects.create_user(username="maria", password="x")
        Perfil.objects.create(user=u, papel=Perfil.OPERADOR)
        resp = self.client.patch(f"/api/usuarios/{u.id}/", {"papel": "ADMIN"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        u.refresh_from_db()
        self.assertEqual(u.perfil.papel, "ADMIN")

    def test_operador_nao_pode_criar_usuario(self):
        operador = User.objects.create_user(username="op1", password="x", is_staff=True)
        Perfil.objects.create(user=operador, papel=Perfil.OPERADOR)
        token = TokenAcesso.objects.create(
            user=operador, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")
        resp = self.client.post("/api/usuarios/", {
            "username": "outro", "password": "senha-boa-123", "papel": "OPERADOR",
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_operador_staff_nao_pode_listar_usuarios(self):
        operador = User.objects.create_user(username="op-lista", password="x", is_staff=True)
        Perfil.objects.create(user=operador, papel=Perfil.OPERADOR)
        token = TokenAcesso.objects.create(
            user=operador, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

        resp = self.client.get("/api/usuarios/")

        self.assertEqual(resp.status_code, 403)

    def test_admin_cria_usuario_sem_senha(self):
        """password é required=False: criar sem senha deve dar 201, não 500."""
        self._autenticar_admin()
        modulo = Modulo.objects.get(slug="inventario")
        resp = self.client.post("/api/usuarios/", {
            "username": "joao", "papel": "OPERADOR", "modulos": [modulo.slug],
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        joao = User.objects.get(username="joao")
        self.assertEqual(joao.perfil.papel, "OPERADOR")
        # sem senha usável — não pode autenticar por senha, mas a conta existe
        self.assertFalse(joao.has_usable_password())

    def test_novo_operador_exige_modulos_explicitos(self):
        self._autenticar_admin()

        resposta = self.client.post(
            "/api/usuarios/", {"username": "sem-modulos", "papel": "OPERADOR"}, format="json"
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("modulos", resposta.data)

    def test_perfil_legado_sem_modulos_permanece_compativel(self):
        self._autenticar_admin()
        legado = User.objects.create_user(username="legado", password="x")
        Perfil.objects.create(user=legado, papel=Perfil.OPERADOR)

        resposta = self.client.patch(f"/api/usuarios/{legado.pk}/", {"papel": "OPERADOR"}, format="json")

        self.assertEqual(resposta.status_code, 200, resposta.content)

    def test_admin_desativa_usuario_e_revoga_todos_os_tokens(self):
        self._autenticar_admin()
        operador = User.objects.create_user(username="maria", password="x")
        Perfil.objects.create(user=operador, papel=Perfil.OPERADOR)
        TokenAcesso.objects.create(user=operador, expira_em=timezone.now() + timedelta(hours=1))
        TokenAcesso.objects.create(user=operador, expira_em=timezone.now() + timedelta(hours=1))

        resposta = self.client.patch(f"/api/usuarios/{operador.pk}/", {"is_active": False}, format="json")

        self.assertEqual(resposta.status_code, 200, resposta.content)
        operador.refresh_from_db()
        self.assertFalse(operador.is_active)
        self.assertFalse(TokenAcesso.objects.filter(user=operador).exists())

    def test_nao_desativa_ultimo_admin_ativo(self):
        self._autenticar_admin()
        admin = User.objects.get(username="admin1")

        resposta = self.client.patch(f"/api/usuarios/{admin.pk}/", {"is_active": False}, format="json")

        self.assertEqual(resposta.status_code, 400)
        admin.refresh_from_db()
        self.assertTrue(admin.is_active)

    def test_admin_redefine_senha_sem_auditar_segredo_e_revoga_sessoes(self):
        self._autenticar_admin()
        operador = User.objects.create_user(username="maria", password="senha-antiga")
        Perfil.objects.create(user=operador, papel=Perfil.OPERADOR)
        TokenAcesso.objects.create(user=operador, expira_em=timezone.now() + timedelta(hours=1))

        resposta = self.client.post(
            f"/api/usuarios/{operador.pk}/senha/", {"password": "Nova-Senha-123"}, format="json"
        )

        self.assertEqual(resposta.status_code, 204, resposta.content)
        operador.refresh_from_db()
        self.assertTrue(operador.check_password("Nova-Senha-123"))
        self.assertFalse(TokenAcesso.objects.filter(user=operador).exists())
        auditoria = RegistroAuditoria.objects.latest("id")
        self.assertEqual(auditoria.detalhes, {"campos": ["password"]})
        self.assertNotIn("Nova-Senha-123", str(auditoria.detalhes))

    def test_admin_revoga_sessoes_sem_alterar_usuario(self):
        self._autenticar_admin()
        operador = User.objects.create_user(username="maria", password="senha-antiga")
        Perfil.objects.create(user=operador, papel=Perfil.OPERADOR)
        TokenAcesso.objects.create(user=operador, expira_em=timezone.now() + timedelta(hours=1))

        resposta = self.client.post(f"/api/usuarios/{operador.pk}/revogar-sessoes/", format="json")

        self.assertEqual(resposta.status_code, 204, resposta.content)
        operador.refresh_from_db()
        self.assertTrue(operador.check_password("senha-antiga"))
        self.assertFalse(TokenAcesso.objects.filter(user=operador).exists())


class MeuPerfilViewTest(APITestCase):
    def _autenticar(self, user):
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

    def test_atualiza_o_proprio_nome(self):
        user = User.objects.create_user(username="maria", password="x")
        self._autenticar(user)
        resp = self.client.patch("/api/auth/me/", {"nome": "Maria Souza"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["nome"], "Maria Souza")
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Maria Souza")

    def test_nome_vazio_retorna_400_e_nao_altera_first_name(self):
        user = User.objects.create_user(username="maria", password="x", first_name="Original")
        self._autenticar(user)
        resp = self.client.patch("/api/auth/me/", {"nome": "   "}, format="json")
        self.assertEqual(resp.status_code, 400)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Original")

    def test_sem_autenticacao_retorna_401(self):
        resp = self.client.patch("/api/auth/me/", {"nome": "Maria"}, format="json")
        self.assertEqual(resp.status_code, 401)
