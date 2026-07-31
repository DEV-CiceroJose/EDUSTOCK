from django.core.exceptions import ValidationError
from django.test import TestCase

from core.models import Categoria, Grupo, Movimentacao, Produto
from core.services import registrar_entrada, registrar_movimentacao


class ServicesLoggingTest(TestCase):
    def setUp(self):
        categoria = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=categoria)
        self.produto = Produto.objects.create(
            nome="Arroz",
            grupo=grupo,
            quantidade=2,
            unidade="KG",
        )

    def test_registra_rejeicao_por_saldo_insuficiente(self):
        with self.assertLogs("core.services", level="WARNING") as logs:
            with self.assertRaises(ValidationError):
                registrar_movimentacao(
                    produto=self.produto,
                    tipo=Movimentacao.SAIDA,
                    quantidade=3,
                )
        self.assertIn("saldo insuficiente", logs.output[0])

    def test_registra_entrada_sem_itens(self):
        with self.assertLogs("core.services", level="WARNING") as logs:
            with self.assertRaises(ValidationError):
                registrar_entrada(itens=[])
        self.assertIn("nenhum item informado", logs.output[0])
