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
