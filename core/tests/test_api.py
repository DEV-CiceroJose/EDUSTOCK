from rest_framework.test import APITestCase
from core.models import Categoria, Grupo


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


from core.models import Produto


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
