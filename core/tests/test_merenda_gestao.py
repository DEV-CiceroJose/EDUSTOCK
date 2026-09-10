from uuid import uuid4

from django.utils import timezone

from core.models import OperacaoBaixaProducao
from core.tests.utils import AutenticadoAPITestCase
from plataforma.models import Escola, Modulo, Perfil, escola_padrao_id


class MerendaGestaoApiTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        self.hoje = timezone.localdate()
        self.escola = Escola.objects.get(pk=escola_padrao_id())

    def test_admin_consulta_plano_com_token_do_dashboard(self):
        resposta = self.client.get(
            "/api/merenda/plano-do-dia/",
            {"data": self.hoje.isoformat(), "refeicao": "ALMOCO"},
        )

        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertEqual(resposta.json()["data"], self.hoje.isoformat())
        self.assertEqual(resposta.json()["refeicao"], "ALMOCO")
        self.assertEqual(resposta.json()["refeicao_label"], "Almoço")

    def test_operador_com_modulo_merenda_consulta_plano(self):
        perfil = self.user.perfil
        perfil.papel = Perfil.OPERADOR
        perfil.save(update_fields=["papel"])
        perfil.modulos.set(
            Modulo.objects.filter(slug__in=["inventario", "merenda"])
        )

        resposta = self.client.get(
            "/api/merenda/plano-do-dia/",
            {"data": self.hoje.isoformat(), "refeicao": "CAFE_MANHA"},
        )

        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertEqual(resposta.json()["refeicao"], "CAFE_MANHA")

    def test_baixa_de_gestao_usa_escola_autenticada(self):
        operacao_id = uuid4()

        resposta = self.client.post(
            "/api/merenda/baixa-de-producao/",
            {
                "operacao_id": str(operacao_id),
                "data": self.hoje.isoformat(),
                "refeicao": "LANCHE_TARDE",
            },
            format="json",
        )

        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertEqual(resposta.json()["operacao_id"], str(operacao_id))
        operacao = OperacaoBaixaProducao.objects.get(operacao_id=operacao_id)
        self.assertEqual(operacao.escola, self.escola)
        self.assertEqual(operacao.refeicao, "LANCHE_TARDE")

    def test_rotas_de_gestao_exigem_login(self):
        self.client.credentials()

        resposta = self.client.get(
            "/api/merenda/plano-do-dia/",
            {"data": self.hoje.isoformat(), "refeicao": "ALMOCO"},
        )

        self.assertEqual(resposta.status_code, 401)

    def test_consulta_rejeita_usuario_sem_escola_autorizada(self):
        Escola.objects.update(ativa=False)

        resposta = self.client.get(
            "/api/merenda/plano-do-dia/",
            {"data": self.hoje.isoformat(), "refeicao": "ALMOCO"},
        )

        self.assertEqual(resposta.status_code, 403)
        self.assertEqual(
            resposta.json()["detail"],
            "Nenhuma escola autorizada para este usuário.",
        )

    def test_baixa_rejeita_usuario_sem_escola_autorizada(self):
        Escola.objects.update(ativa=False)

        resposta = self.client.post(
            "/api/merenda/baixa-de-producao/",
            {
                "operacao_id": str(uuid4()),
                "data": self.hoje.isoformat(),
                "refeicao": "ALMOCO",
            },
            format="json",
        )

        self.assertEqual(resposta.status_code, 403)
        self.assertFalse(OperacaoBaixaProducao.objects.exists())
