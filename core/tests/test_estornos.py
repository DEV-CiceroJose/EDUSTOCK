from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Categoria, Grupo, LoteEstoque, Movimentacao, Produto
from core.services import registrar_estorno, registrar_movimentacao
from core.tests.utils import AutenticadoAPITestCase
from plataforma.models import Modulo, Perfil, TokenAcesso
from django.utils import timezone
from datetime import timedelta


class RegistrarEstornoTest(TestCase):
    def setUp(self):
        categoria = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=categoria)
        self.produto = Produto.objects.create(
            nome="Arroz", grupo=grupo, quantidade=10, unidade="KG"
        )
        self.lote = LoteEstoque.objects.create(
            produto=self.produto, codigo="LEGADO-TESTE", quantidade=Decimal("10")
        )
        self.admin = User.objects.create_user(username="admin-estorno")

    def test_estorno_cria_movimento_oposto_e_restaura_saldo(self):
        original = registrar_movimentacao(
            produto=self.produto, tipo=Movimentacao.SAIDA,
            quantidade=Decimal("2"), motivo="consumo", user=self.admin,
        )
        estorno = registrar_estorno(
            movimentacao=original, motivo="lançamento incorreto", user=self.admin,
        )
        self.assertEqual(estorno.tipo, Movimentacao.ENTRADA)
        self.assertEqual(estorno.corrige_movimentacao, original)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal("10"))

    def test_nao_permite_estornar_duas_vezes(self):
        original = registrar_movimentacao(
            produto=self.produto, tipo=Movimentacao.SAIDA,
            quantidade=Decimal("2"), motivo="consumo", user=self.admin,
        )
        registrar_estorno(
            movimentacao=original, motivo="lançamento incorreto", user=self.admin,
        )
        with self.assertRaises(ValidationError):
            registrar_estorno(
                movimentacao=original, motivo="nova tentativa", user=self.admin,
            )

    def test_nao_permite_estornar_um_estorno(self):
        original = registrar_movimentacao(
            produto=self.produto, tipo=Movimentacao.SAIDA,
            quantidade=Decimal("2"), motivo="consumo", user=self.admin,
        )
        estorno = registrar_estorno(
            movimentacao=original, motivo="lancamento incorreto", user=self.admin,
        )
        with self.assertRaises(ValidationError):
            registrar_estorno(
                movimentacao=estorno, motivo="nova tentativa", user=self.admin,
            )

    def test_motivo_do_estorno_precisa_ter_cinco_caracteres(self):
        original = registrar_movimentacao(
            produto=self.produto, tipo=Movimentacao.ENTRADA,
            quantidade=Decimal("2"), motivo="entrada", user=self.admin,
            lote=self.lote,
        )
        with self.assertRaises(ValidationError):
            registrar_estorno(movimentacao=original, motivo="erro", user=self.admin)

    def test_estorno_de_saida_restaura_lotes_alocados(self):
        original = registrar_movimentacao(
            produto=self.produto, tipo=Movimentacao.SAIDA,
            quantidade=Decimal("2"), motivo="consumo", user=self.admin,
        )
        registrar_estorno(
            movimentacao=original, motivo="lançamento incorreto", user=self.admin,
        )
        self.lote.refresh_from_db()
        self.assertEqual(self.lote.quantidade, Decimal("10"))


class EstornoApiTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        categoria = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=categoria)
        self.produto = Produto.objects.create(
            nome="Arroz", grupo=grupo, quantidade=10, unidade="KG"
        )
        LoteEstoque.objects.create(
            produto=self.produto, codigo="LEGADO-API", quantidade=Decimal("10")
        )
        self.movimentacao = registrar_movimentacao(
            produto=self.produto, tipo=Movimentacao.SAIDA,
            quantidade=Decimal("2"), motivo="consumo", user=self.user,
        )

    def test_admin_estorna_movimentacao_e_recebe_201(self):
        response = self.client.post(
            f"/api/movimentacoes/{self.movimentacao.id}/estornar/",
            {"motivo": "lançamento incorreto"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["tipo"], Movimentacao.ENTRADA)
        self.assertEqual(response.data["corrige_movimentacao"], self.movimentacao.id)

    def test_operador_nao_pode_estornar_movimentacao(self):
        operador = User.objects.create_user(username="operador-estorno")
        Perfil.objects.create(user=operador, papel=Perfil.OPERADOR)
        token = TokenAcesso.objects.create(
            user=operador, expira_em=timezone.now() + timedelta(hours=1)
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

        response = client.post(
            f"/api/movimentacoes/{self.movimentacao.id}/estornar/",
            {"motivo": "lançamento incorreto"},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.content)

    def test_api_nao_permite_estornar_um_estorno(self):
        primeiro = self.client.post(
            f"/api/movimentacoes/{self.movimentacao.id}/estornar/",
            {"motivo": "lancamento incorreto"},
            format="json",
        )
        self.assertEqual(primeiro.status_code, 201, primeiro.content)

        response = self.client.post(
            f"/api/movimentacoes/{primeiro.data['id']}/estornar/",
            {"motivo": "nova tentativa"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.content)

    def test_admin_sem_modulo_movimentacoes_ativo_nao_estorna(self):
        Modulo.objects.filter(slug="movimentacoes").update(ativo=False)

        response = self.client.post(
            f"/api/movimentacoes/{self.movimentacao.id}/estornar/",
            {"motivo": "lancamento incorreto"},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.content)
