from rest_framework.test import APITestCase
from core.models import Categoria, Grupo, Produto


class GrupoApiTest(APITestCase):
    def test_lista_e_cria_grupo(self):
        cat = Categoria.objects.create(name="Alimentos")
        resp = self.client.post(
            "/api/grupos/", {"nome": "Carboidratos", "categoria": cat.id}, format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["categoria_nome"], "Alimentos")

        resp = self.client.get("/api/grupos/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)


class ProdutoApiTest(APITestCase):
    def setUp(self):
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Carboidratos", categoria=self.cat)

    def test_cria_produto_com_grupo_e_expoe_derivados(self):
        resp = self.client.post("/api/produtos/", {
            "nome": "Arroz", "grupo": self.grupo.id, "quantidade": "48",
            "unidade": "KG", "estoque_minimo": "10", "perecivel": False,
            "periodicidade": "MENSAL",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["grupo_nome"], "Carboidratos")
        self.assertEqual(resp.data["categoria_nome"], "Alimentos")
        self.assertEqual(resp.data["categoria"], self.cat.id)
        self.assertEqual(resp.data["periodicidade"], "MENSAL")

    def test_filtra_por_categoria(self):
        Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=1, unidade="KG")
        outra = Categoria.objects.create(name="Limpeza")
        g2 = Grupo.objects.create(nome="Geral", categoria=outra)
        Produto.objects.create(nome="Sabão", grupo=g2, quantidade=1, unidade="UN")

        resp = self.client.get(f"/api/produtos/?categoria={self.cat.id}")
        self.assertEqual(resp.status_code, 200)
        nomes = [p["nome"] for p in resp.data]
        self.assertEqual(nomes, ["Arroz"])


class BemPermanenteApiTest(APITestCase):
    def test_crud_basico(self):
        resp = self.client.post("/api/bens-permanentes/", {
            "nome": "Projetor", "numero_patrimonio": "PAT-77",
            "localizacao": "Sala 3", "responsavel": "Coordenação",
            "estado_conservacao": "BOM",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        bem_id = resp.data["id"]

        resp = self.client.get("/api/bens-permanentes/")
        self.assertEqual(len(resp.data), 1)

        resp = self.client.delete(f"/api/bens-permanentes/{bem_id}/")
        self.assertEqual(resp.status_code, 204)


class FornecedorApiTest(APITestCase):
    def test_crud_e_filtro(self):
        resp = self.client.post("/api/fornecedores/", {
            "nome": "Atacadão", "documento": "12.345.678/0001-99",
            "emite_nota_fiscal": True, "aceita_fiado": False,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertTrue(resp.data["ativo"])

        # cria um fiado/inativo
        self.client.post("/api/fornecedores/", {
            "nome": "Seu Zé (fiado)", "emite_nota_fiscal": False,
            "aceita_fiado": True, "ativo": False,
        }, format="json")

        # lista todos
        resp = self.client.get("/api/fornecedores/")
        self.assertEqual(len(resp.data), 2)

        # filtro aceita_fiado=true
        resp = self.client.get("/api/fornecedores/?aceita_fiado=true")
        nomes = [f["nome"] for f in resp.data]
        self.assertEqual(nomes, ["Seu Zé (fiado)"])

        # filtro ativo=false
        resp = self.client.get("/api/fornecedores/?ativo=false")
        self.assertEqual(len(resp.data), 1)

    def test_busca_por_nome(self):
        self.client.post("/api/fornecedores/", {"nome": "Papelaria Central"}, format="json")
        self.client.post("/api/fornecedores/", {"nome": "Distribuidora Sul"}, format="json")
        resp = self.client.get("/api/fornecedores/?search=papel")
        self.assertEqual([f["nome"] for f in resp.data], ["Papelaria Central"])


class ProdutoFornecedorApiTest(APITestCase):
    def setUp(self):
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=self.cat)

    def test_produto_expoe_e_aceita_fornecedor(self):
        from core.models import Fornecedor
        f = Fornecedor.objects.create(nome="Atacadão")
        resp = self.client.post("/api/produtos/", {
            "nome": "Arroz", "grupo": self.grupo.id, "quantidade": "1",
            "unidade": "KG", "fornecedor": f.id,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["fornecedor"], f.id)
        self.assertEqual(resp.data["fornecedor_nome"], "Atacadão")

    def test_produto_sem_fornecedor_tem_nome_nulo(self):
        resp = self.client.post("/api/produtos/", {
            "nome": "Feijão", "grupo": self.grupo.id, "quantidade": "1", "unidade": "KG",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertIsNone(resp.data["fornecedor"])
        self.assertIsNone(resp.data["fornecedor_nome"])


class MovimentacaoApiTest(APITestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG")

    def test_post_saida_atualiza_saldo(self):
        resp = self.client.post("/api/movimentacoes/", {
            "produto": self.p.id, "tipo": "SAIDA", "quantidade": "4", "motivo": "consumo",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["produto_nome"], "Arroz")
        self.p.refresh_from_db()
        from decimal import Decimal
        self.assertEqual(self.p.quantidade, Decimal("6.000"))

    def test_saida_excede_saldo_400(self):
        resp = self.client.post("/api/movimentacoes/", {
            "produto": self.p.id, "tipo": "SAIDA", "quantidade": "999",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_filtro_por_tipo(self):
        self.client.post("/api/movimentacoes/", {"produto": self.p.id, "tipo": "SAIDA", "quantidade": "1"}, format="json")
        self.client.post("/api/movimentacoes/", {"produto": self.p.id, "tipo": "ENTRADA", "quantidade": "1"}, format="json")
        resp = self.client.get("/api/movimentacoes/?tipo=SAIDA")
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["tipo"], "SAIDA")

    def test_append_only(self):
        self.client.post("/api/movimentacoes/", {"produto": self.p.id, "tipo": "ENTRADA", "quantidade": "1"}, format="json")
        mid = self.client.get("/api/movimentacoes/").data[0]["id"]
        self.assertEqual(self.client.delete(f"/api/movimentacoes/{mid}/").status_code, 405)
        self.assertEqual(self.client.patch(f"/api/movimentacoes/{mid}/", {"quantidade": "2"}, format="json").status_code, 405)


class EntradaApiTest(APITestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p1 = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=0, unidade="KG")
        self.p2 = Produto.objects.create(nome="Feijão", grupo=self.grupo, quantidade=0, unidade="KG")

    def test_cria_entrada_com_itens_e_atualiza_saldos(self):
        resp = self.client.post("/api/entradas/", {
            "numero_nota_fiscal": "NF-100",
            "itens": [
                {"produto": self.p1.id, "quantidade": "5", "preco_unitario": "4.00"},
                {"produto": self.p2.id, "quantidade": "3", "preco_unitario": "8.00"},
            ],
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(len(resp.data["itens"]), 2)
        self.assertEqual(resp.data["total"], "44.00")
        self.p1.refresh_from_db(); self.p2.refresh_from_db()
        from decimal import Decimal
        self.assertEqual(self.p1.quantidade, Decimal("5.000"))
        self.assertEqual(self.p2.quantidade, Decimal("3.000"))

    def test_entrada_append_only(self):
        self.client.post("/api/entradas/", {
            "itens": [{"produto": self.p1.id, "quantidade": "1"}],
        }, format="json")
        eid = self.client.get("/api/entradas/").data[0]["id"]
        self.assertEqual(self.client.delete(f"/api/entradas/{eid}/").status_code, 405)


class ProdutoQuantidadeReadOnlyTest(APITestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)

    def test_patch_quantidade_ignorado(self):
        from decimal import Decimal
        p = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG")
        resp = self.client.patch(f"/api/produtos/{p.id}/", {"quantidade": "999"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        p.refresh_from_db()
        self.assertEqual(p.quantidade, Decimal("10.000"))  # inalterado
