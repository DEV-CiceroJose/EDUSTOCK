from core.models import Categoria
from core.tests.utils import AutenticadoAPITestCase


class ApiPaginationTest(AutenticadoAPITestCase):
    def test_lista_tem_metadados_e_limite_padrao(self):
        Categoria.objects.bulk_create(
            [Categoria(name=f"Categoria {index:03d}") for index in range(101)]
        )

        response = self.client.get("/api/categorias/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 101)
        self.assertEqual(len(response.data["results"]), 100)
        self.assertIsNotNone(response.data["next"])

    def test_page_size_customizado_respeita_limite_maximo(self):
        Categoria.objects.bulk_create(
            [Categoria(name=f"Categoria {index:03d}") for index in range(101)]
        )

        response = self.client.get("/api/categorias/?page_size=500")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 101)
        self.assertIsNone(response.data["next"])
