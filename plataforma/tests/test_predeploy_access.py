from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from plataforma.models import Escola, Municipio, Perfil, TokenAcesso, VinculoUsuario
from plataforma.permissions import garantir_vinculo_padrao


class PredeployAccessTest(TestCase):
    def setUp(self):
        self.rede = Municipio.objects.create(nome="Rede A", slug="rede-a")
        self.outra = Municipio.objects.create(nome="Rede B", slug="rede-b")
        self.escola = Escola.objects.create(nome="Escola A", slug="a", municipio=self.rede)
        self.gestor = User.objects.create_user(username="gestor-a")
        Perfil.objects.create(user=self.gestor, papel=Perfil.ADMIN)
        self.vinculo = VinculoUsuario.objects.create(
            user=self.gestor, municipio=self.rede, papel=VinculoUsuario.GESTOR_REDE
        )
        self.externo = User.objects.create_user(username="usuario-b")
        Perfil.objects.create(user=self.externo, papel=Perfil.OPERADOR)
        VinculoUsuario.objects.create(user=self.externo, municipio=self.outra, papel=VinculoUsuario.GESTOR_REDE)
        _, token = TokenAcesso.emitir(user=self.gestor, municipio=self.rede, escola=self.escola,
                                    expira_em=timezone.now() + timedelta(hours=1))
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

    def test_lista_usuarios_nao_expoe_outra_rede(self):
        resposta = self.client.get("/api/usuarios/")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual([u["username"] for u in resposta.data["results"]], ["gestor-a"])

    def test_nao_altera_usuario_de_outra_rede(self):
        resposta = self.client.patch(f"/api/usuarios/{self.externo.pk}/", {"papel": "ADMIN"}, format="json")
        self.assertEqual(resposta.status_code, 404)
        self.externo.perfil.refresh_from_db()
        self.assertEqual(self.externo.perfil.papel, Perfil.OPERADOR)

    def test_cria_e_lista_usuario_na_rede_atual(self):
        resposta = self.client.post(
            "/api/usuarios/",
            {"username": "operador-a", "papel": "OPERADOR", "modulos": ["inventario"]},
            format="json",
        )
        self.assertEqual(resposta.status_code, 201)
        criado = User.objects.get(username="operador-a")
        self.assertEqual(criado.vinculos_rede.get().municipio_id, self.rede.pk)
        self.assertEqual(list(criado.perfil.modulos.values_list("slug", flat=True)), ["inventario"])
        nomes = [u["username"] for u in self.client.get("/api/usuarios/").data["results"]]
        self.assertIn("operador-a", nomes)

    def test_nao_anexa_usuario_externo_a_um_vinculo_local(self):
        resposta = self.client.patch(f"/api/vinculos/{self.vinculo.pk}/", {"user": self.externo.pk}, format="json")
        self.assertEqual(resposta.status_code, 400)
        self.vinculo.refresh_from_db()
        self.assertEqual(self.vinculo.user_id, self.gestor.pk)

    def test_permite_editar_nome_da_escola_sem_alterar_rede(self):
        resposta = self.client.patch(f"/api/escolas/{self.escola.pk}/", {"nome": "Escola atualizada"}, format="json")
        self.assertEqual(resposta.status_code, 200)
        self.escola.refresh_from_db()
        self.assertEqual(self.escola.nome, "Escola atualizada")

    def test_revogar_ultimo_vinculo_nao_cria_acesso_legado(self):
        self.vinculo.ativo = False
        self.vinculo.save(update_fields=["ativo"])
        self.assertIsNone(garantir_vinculo_padrao(self.gestor))
        self.assertFalse(self.gestor.vinculos_rede.filter(ativo=True).exists())
        resposta = self.client.get("/api/produtos/")
        self.assertEqual(resposta.status_code, 401)

    def test_patch_escola_nao_transfere_dados_para_outra_rede(self):
        resposta = self.client.patch(f"/api/escolas/{self.escola.pk}/", {"municipio": self.outra.pk}, format="json")
        self.assertEqual(resposta.status_code, 400)
        self.escola.refresh_from_db()
        self.assertEqual(self.escola.municipio_id, self.rede.pk)

    def test_patch_vinculo_nao_transfere_acesso_para_outra_rede(self):
        resposta = self.client.patch(f"/api/vinculos/{self.vinculo.pk}/", {"municipio": self.outra.pk}, format="json")
        self.assertEqual(resposta.status_code, 400)
        self.vinculo.refresh_from_db()
        self.assertEqual(self.vinculo.municipio_id, self.rede.pk)
