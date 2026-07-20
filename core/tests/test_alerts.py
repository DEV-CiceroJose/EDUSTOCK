from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from core.alerts import (
    CRITICO_DIAS,
    coletar_alertas,
    dias_ate_validade,
    is_estoque_critico,
    urgencia_validade,
)
from core.models import Categoria, Grupo, Produto
from core.tests.utils import AutenticadoAPITestCase


class AlertHelpersTest(TestCase):
    def test_dias_ate_validade(self):
        hoje = timezone.localdate()
        self.assertEqual(dias_ate_validade(hoje + timedelta(days=5), hoje), 5)
        self.assertEqual(dias_ate_validade(hoje - timedelta(days=1), hoje), -1)

    def test_urgencia_validade_critico_abaixo_de_7(self):
        for dias in (-1, 0, 6):
            self.assertEqual(urgencia_validade(dias), "critico")

    def test_urgencia_validade_alerta_entre_7_e_30(self):
        for dias in (7, 15, 30):
            self.assertEqual(urgencia_validade(dias), "alerta")

    def test_is_estoque_critico_esgotado(self):
        critico, urg = is_estoque_critico(0, 10)
        self.assertTrue(critico)
        self.assertEqual(urg, "critico")

    def test_is_estoque_critico_abaixo_20_porcento(self):
        critico, urg = is_estoque_critico(1, 10)
        self.assertTrue(critico)
        self.assertEqual(urg, "alerta")

    def test_is_estoque_critico_acima_20_porcento_nao_alerta(self):
        critico, urg = is_estoque_critico(3, 10)
        self.assertFalse(critico)
        self.assertIsNone(urg)

    def test_is_estoque_critico_minimo_zero_apenas_esgotado(self):
        critico, urg = is_estoque_critico(5, 0)
        self.assertFalse(critico)
        self.assertIsNone(urg)


class ColetarAlertasTest(TestCase):
    def setUp(self):
        self.hoje = timezone.localdate()
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Laticínios", categoria=self.cat)

    def _criar(self, nome, **kwargs):
        defaults = {"grupo": self.grupo, "unidade": "UN"}
        defaults.update(kwargs)
        return Produto.objects.create(nome=nome, **defaults)

    def test_validade_vencida_retorna_critico(self):
        self._criar("Leite", validade=self.hoje - timedelta(days=1))
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(len(result["validade"]), 1)
        item = result["validade"][0]
        self.assertEqual(item["urgencia"], "critico")
        self.assertEqual(item["motivo"], "Vencido")

    def test_validade_5_dias_retorna_critico(self):
        self._criar("Iogurte", validade=self.hoje + timedelta(days=5))
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(result["validade"][0]["urgencia"], "critico")
        self.assertEqual(result["validade"][0]["dias_validade"], 5)

    def test_validade_15_dias_retorna_alerta(self):
        self._criar("Queijo", validade=self.hoje + timedelta(days=15))
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(result["validade"][0]["urgencia"], "alerta")

    def test_validade_45_dias_nao_incluido(self):
        self._criar("Arroz", validade=self.hoje + timedelta(days=45))
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(result["validade"], [])

    def test_validade_null_nao_incluido(self):
        self._criar("Sal", validade=None)
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(result["validade"], [])

    def test_estoque_zero_retorna_critico(self):
        self._criar("Açúcar", quantidade=0, estoque_minimo=10)
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(len(result["estoque_critico"]), 1)
        item = result["estoque_critico"][0]
        self.assertEqual(item["urgencia"], "critico")
        self.assertEqual(item["motivo"], "Esgotado")

    def test_estoque_abaixo_20_porcento_incluido(self):
        self._criar("Farinha", quantidade=Decimal("1"), estoque_minimo=Decimal("10"))
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(len(result["estoque_critico"]), 1)
        self.assertEqual(result["estoque_critico"][0]["urgencia"], "alerta")

    def test_estoque_30_porcento_nao_incluido(self):
        self._criar("Óleo", quantidade=Decimal("3"), estoque_minimo=Decimal("10"))
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(result["estoque_critico"], [])

    def test_estoque_minimo_zero_qty_positiva_nao_incluido(self):
        self._criar("Sal", quantidade=Decimal("5"), estoque_minimo=0)
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(result["estoque_critico"], [])

    def test_filtro_tipo_validade(self):
        self._criar("Leite", validade=self.hoje + timedelta(days=3))
        self._criar("Arroz", quantidade=0, estoque_minimo=10)
        result = coletar_alertas(tipo="validade", hoje=self.hoje)
        self.assertEqual(len(result["validade"]), 1)
        self.assertEqual(result["estoque_critico"], [])

    def test_filtro_urgencia_critico(self):
        self._criar("Critico", validade=self.hoje + timedelta(days=3))
        self._criar("Alerta", validade=self.hoje + timedelta(days=15))
        result = coletar_alertas(urgencia="critico", hoje=self.hoje)
        self.assertEqual(len(result["validade"]), 1)
        self.assertEqual(result["validade"][0]["nome"], "Critico")

    def test_resumo_contagens(self):
        self._criar("Vencido", validade=self.hoje - timedelta(days=1), quantidade=10)
        self._criar("Esgotado", quantidade=0, estoque_minimo=5)
        result = coletar_alertas(hoje=self.hoje)
        self.assertEqual(result["resumo"]["vencidos"], 1)
        self.assertEqual(result["resumo"]["esgotados"], 1)
        self.assertEqual(result["resumo"]["total_validade"], 1)
        self.assertEqual(result["resumo"]["total_estoque_critico"], 1)


class AlertasApiTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        self.hoje = timezone.localdate()
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        Produto.objects.create(
            nome="Leite",
            grupo=grupo,
            unidade="UN",
            validade=self.hoje + timedelta(days=3),
        )
        Produto.objects.create(
            nome="Arroz",
            grupo=grupo,
            unidade="KG",
            quantidade=0,
            estoque_minimo=10,
        )

    def test_get_alertas_retorna_estrutura(self):
        resp = self.client.get("/api/alertas/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("resumo", resp.data)
        self.assertIn("validade", resp.data)
        self.assertIn("estoque_critico", resp.data)

    def test_get_alertas_tipo_validade(self):
        resp = self.client.get("/api/alertas/?tipo=validade")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["validade"]), 1)
        self.assertEqual(resp.data["estoque_critico"], [])

    def test_get_alertas_urgencia_critico_exclui_alerta(self):
        cat = Categoria.objects.create(name="Limpeza")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        Produto.objects.create(
            nome="Detergente",
            grupo=grupo,
            unidade="UN",
            validade=self.hoje + timedelta(days=15),
        )
        resp = self.client.get("/api/alertas/?urgencia=critico")
        self.assertEqual(resp.status_code, 200)
        nomes = [a["nome"] for a in resp.data["validade"]]
        self.assertIn("Leite", nomes)
        self.assertNotIn("Detergente", nomes)

    def test_get_alertas_tipo_invalido(self):
        resp = self.client.get("/api/alertas/?tipo=foo")
        self.assertEqual(resp.status_code, 400)

    def test_get_alertas_urgencia_invalida(self):
        resp = self.client.get("/api/alertas/?urgencia=foo")
        self.assertEqual(resp.status_code, 400)
