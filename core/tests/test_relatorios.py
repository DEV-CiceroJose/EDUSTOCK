from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from core.models import Categoria, Fornecedor, Grupo, Produto
from core.relatorios import gerar_prestacao_contas
from core.services import registrar_entrada
from core.tests.utils import AutenticadoAPITestCase


class PrestacaoContasTest(TestCase):
    def setUp(self):
        self.cat_alim = Categoria.objects.create(name="Alimentos")
        self.cat_lim = Categoria.objects.create(name="Limpeza")
        self.grupo_alim = Grupo.objects.create(nome="Geral", categoria=self.cat_alim)
        self.grupo_lim = Grupo.objects.create(nome="Geral", categoria=self.cat_lim)
        self.forn = Fornecedor.objects.create(nome="Atacadão", documento="12.345.678/0001-99")
        self.hoje = timezone.localdate()
        self.inicio = self.hoje.replace(day=1)
        self.fim = self.hoje

    def _criar_produto(self, nome, grupo, **kwargs):
        return Produto.objects.create(nome=nome, grupo=grupo, unidade="UN", **kwargs)

    def test_total_entrada_via_sum(self):
        p1 = self._criar_produto("Arroz", self.grupo_alim, quantidade=0)
        p2 = self._criar_produto("Feijão", self.grupo_alim, quantidade=0)
        registrar_entrada(
            fornecedor=self.forn,
            numero_nota_fiscal="NF-9",
            data=self.hoje,
            observacao="",
            itens=[
                {"produto": p1, "quantidade": Decimal("2"), "preco_unitario": Decimal("3.00")},
                {"produto": p2, "quantidade": Decimal("7"), "preco_unitario": Decimal("8.00")},
            ],
            user=None,
        )
        result = gerar_prestacao_contas(inicio=self.inicio, fim=self.fim)
        doc = result["fornecedores"][0]["documentos"][0]
        self.assertEqual(doc["total"], "62.00")

    def test_resumo_por_categoria(self):
        p1 = self._criar_produto("Arroz", self.grupo_alim, quantidade=0)
        p2 = self._criar_produto("Detergente", self.grupo_lim, quantidade=0)
        registrar_entrada(
            fornecedor=self.forn, numero_nota_fiscal="NF-1", data=self.hoje, observacao="",
            itens=[
                {"produto": p1, "quantidade": Decimal("10"), "preco_unitario": Decimal("5.00")},
                {"produto": p2, "quantidade": Decimal("4"), "preco_unitario": Decimal("2.50")},
            ],
            user=None,
        )
        result = gerar_prestacao_contas(inicio=self.inicio, fim=self.fim)
        cats = {c["categoria_nome"]: c["total"] for c in result["resumo_financeiro"]["por_categoria"]}
        self.assertEqual(cats["Alimentos"], "50.00")
        self.assertEqual(cats["Limpeza"], "10.00")
        self.assertEqual(result["resumo_financeiro"]["total_geral"], "60.00")

    def test_exclui_entrada_fora_periodo(self):
        p = self._criar_produto("Arroz", self.grupo_alim, quantidade=0)
        registrar_entrada(
            fornecedor=self.forn, numero_nota_fiscal="NF-old", data=self.hoje - timedelta(days=40),
            observacao="",
            itens=[{"produto": p, "quantidade": Decimal("1"), "preco_unitario": Decimal("10.00")}],
            user=None,
        )
        result = gerar_prestacao_contas(inicio=self.inicio, fim=self.fim)
        self.assertEqual(result["fornecedores"], [])

    def test_agrupa_por_fornecedor(self):
        p = self._criar_produto("Arroz", self.grupo_alim, quantidade=0)
        registrar_entrada(
            fornecedor=self.forn, numero_nota_fiscal="NF-1", data=self.hoje, observacao="",
            itens=[{"produto": p, "quantidade": Decimal("1"), "preco_unitario": Decimal("10.00")}],
            user=None,
        )
        registrar_entrada(
            fornecedor=self.forn, numero_nota_fiscal="NF-2", data=self.hoje, observacao="",
            itens=[{"produto": p, "quantidade": Decimal("2"), "preco_unitario": Decimal("5.00")}],
            user=None,
        )
        result = gerar_prestacao_contas(inicio=self.inicio, fim=self.fim)
        self.assertEqual(len(result["fornecedores"]), 1)
        self.assertEqual(len(result["fornecedores"][0]["documentos"]), 2)
        self.assertEqual(result["fornecedores"][0]["total_fornecedor"], "20.00")

    def test_relatorio_usa_apenas_documentos_de_entrada(self):
        p = self._criar_produto("Arroz", self.grupo_alim, quantidade=0)
        registrar_entrada(
            fornecedor=self.forn, numero_nota_fiscal="NF-ATUAL", data=self.hoje, observacao="",
            itens=[{"produto": p, "quantidade": Decimal("1"), "preco_unitario": Decimal("10.00")}],
            user=None,
        )
        result = gerar_prestacao_contas(inicio=self.inicio, fim=self.fim)
        documento = result["fornecedores"][0]["documentos"][0]
        self.assertEqual(documento["numero_nota_fiscal"], "NF-ATUAL")
        self.assertNotIn("legado", documento)
        self.assertNotIn("numero_nota_fiscal_legado", documento["itens"][0])


class PrestacaoContasApiTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p = Produto.objects.create(nome="Arroz", grupo=grupo, quantidade=0, unidade="KG")
        self.hoje = timezone.localdate().isoformat()

    def test_api_params_obrigatorios(self):
        resp = self.client.get("/api/relatorios/prestacao-contas/")
        self.assertEqual(resp.status_code, 400)

    def test_api_periodo_valido(self):
        self.client.post("/api/entradas/", {
            "numero_nota_fiscal": "NF-100",
            "data": self.hoje,
            "itens": [{"produto": self.p.id, "quantidade": "5", "preco_unitario": "4.00"}],
        }, format="json")
        resp = self.client.get(
            f"/api/relatorios/prestacao-contas/?inicio={self.hoje}&fim={self.hoje}"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("periodo", resp.data)
        self.assertIn("resumo_financeiro", resp.data)
        self.assertIn("fornecedores", resp.data)
        self.assertEqual(resp.data["resumo_financeiro"]["total_geral"], "20.00")

    def test_api_inicio_maior_que_fim(self):
        resp = self.client.get(
            "/api/relatorios/prestacao-contas/?inicio=2026-05-31&fim=2026-05-01"
        )
        self.assertEqual(resp.status_code, 400)
