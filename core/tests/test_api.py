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
