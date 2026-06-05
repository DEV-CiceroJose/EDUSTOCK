from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from core.models import Categoria, Grupo, Produto, Fornecedor, Movimentacao
from core.compras import sugerir_compras


class SugerirComprasTest(TestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.forn = Fornecedor.objects.create(nome="Atacadão")
        self.p = Produto.objects.create(
            nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG",
            estoque_minimo=5, preco="2.00", fornecedor=self.forn,
        )

    def _saida(self, qtd, motivo="consumo", dias_atras=1):
        Movimentacao.objects.create(
            produto=self.p, tipo=Movimentacao.SAIDA, quantidade=qtd, motivo=motivo,
            data=timezone.localdate() - timedelta(days=dias_atras),
        )

    def test_sugere_por_consumo_mais_minimo(self):
        self._saida(28, motivo="consumo", dias_atras=3)
        r = sugerir_compras(horizonte=1, semanas=4)
        item = next(i for i in r["itens"] if i["produto"] == self.p.id)
        self.assertEqual(item["consumo_semanal"], "7.000")
        self.assertEqual(item["sugerido"], "2.000")
        self.assertEqual(item["custo_estimado"], "4.00")
        self.assertEqual(item["fornecedor_nome"], "Atacadão")

    def test_ignora_saidas_nao_consumo_e_entradas(self):
        self._saida(100, motivo="perda", dias_atras=2)
        Movimentacao.objects.create(produto=self.p, tipo=Movimentacao.ENTRADA, quantidade=50, motivo="entrada")
        r = sugerir_compras(horizonte=1, semanas=4)
        self.assertEqual([i for i in r["itens"] if i["produto"] == self.p.id], [])

    def test_horizonte_multiplica_consumo(self):
        self._saida(28, motivo="consumo", dias_atras=3)
        r = sugerir_compras(horizonte=2, semanas=4)
        item = next(i for i in r["itens"] if i["produto"] == self.p.id)
        self.assertEqual(item["sugerido"], "9.000")

    def test_resumo(self):
        self._saida(28, motivo="consumo", dias_atras=3)
        r = sugerir_compras(horizonte=1, semanas=4)
        self.assertEqual(r["total_itens"], len(r["itens"]))
        self.assertEqual(r["custo_total_estimado"], "4.00")


class SugestaoComprasEndpointTest(APITestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p = Produto.objects.create(
            nome="Feijão", grupo=self.grupo, quantidade=2, unidade="KG", estoque_minimo=10
        )

    def test_get_retorna_sugestao(self):
        resp = self.client.get("/api/sugestao-compras/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("itens", resp.data)
        self.assertIn("total_itens", resp.data)
        self.assertIn("custo_total_estimado", resp.data)
        item = next(i for i in resp.data["itens"] if i["produto"] == self.p.id)
        self.assertEqual(item["sugerido"], "8.000")

    def test_params_invalidos_usam_default(self):
        resp = self.client.get("/api/sugestao-compras/?horizonte=abc&semanas=-5")
        self.assertEqual(resp.status_code, 200)
        item = next(i for i in resp.data["itens"] if i["produto"] == self.p.id)
        self.assertEqual(item["sugerido"], "8.000")
