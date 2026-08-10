from decimal import Decimal
from django.core.exceptions import ValidationError
from django.test import TestCase
from core.models import Categoria, Grupo, LoteEstoque, Produto, Movimentacao
from core.services import registrar_movimentacao, registrar_entrada


class ServicoSaldoTest(TestCase):
    def setUp(self):
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG")
        self.lote = LoteEstoque.objects.create(
            produto=self.p, codigo="LEGADO-TESTE", quantidade=Decimal("10")
        )

    def test_entrada_direta_sem_lote_falha_sem_alterar_saldo(self):
        with self.assertRaisesMessage(ValidationError, "lote"):
            registrar_movimentacao(
                produto=self.p, tipo=Movimentacao.ENTRADA, quantidade=5
            )
        self.p.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("10.000"))

    def test_saida_subtrai(self):
        registrar_movimentacao(produto=self.p, tipo=Movimentacao.SAIDA, quantidade=4, motivo="consumo")
        self.p.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("6.000"))

    def test_saida_maior_que_saldo_falha_sem_alterar(self):
        with self.assertRaises(ValidationError):
            registrar_movimentacao(produto=self.p, tipo=Movimentacao.SAIDA, quantidade=999)
        self.p.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("10.000"))

    def test_saida_falha_atomicamente_quando_lotes_nao_cobrem_saldo(self):
        self.lote.quantidade = Decimal("3")
        self.lote.save(update_fields=["quantidade"])

        with self.assertRaisesMessage(ValidationError, "lotes"):
            registrar_movimentacao(
                produto=self.p,
                tipo=Movimentacao.SAIDA,
                quantidade=Decimal("4"),
                motivo="consumo",
            )

        self.p.refresh_from_db()
        self.lote.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("10.000"))
        self.assertEqual(self.lote.quantidade, Decimal("3.000"))
        self.assertFalse(Movimentacao.objects.filter(tipo=Movimentacao.SAIDA).exists())

    def test_quantidade_zero_falha(self):
        with self.assertRaises(ValidationError):
            registrar_movimentacao(produto=self.p, tipo=Movimentacao.ENTRADA, quantidade=0)

    def test_tipo_invalido_nao_pode_aumentar_saldo(self):
        with self.assertRaisesMessage(ValidationError, "tipo"):
            registrar_movimentacao(produto=self.p, tipo="AJUSTE", quantidade=5)

        self.p.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("10.000"))

    def test_registrar_entrada_cria_itens_e_soma(self):
        p2 = Produto.objects.create(nome="Feijão", grupo=self.grupo, quantidade=0, unidade="KG")
        entrada = registrar_entrada(
            fornecedor=None, numero_nota_fiscal="NF-9", data=None, observacao="",
            itens=[
                {"produto": self.p, "quantidade": Decimal("2"), "preco_unitario": Decimal("3.00")},
                {"produto": p2, "quantidade": Decimal("7"), "preco_unitario": Decimal("8.00")},
            ],
            user=None,
        )
        self.p.refresh_from_db(); p2.refresh_from_db()
        self.assertEqual(self.p.quantidade, Decimal("12.000"))
        self.assertEqual(p2.quantidade, Decimal("7.000"))
        self.assertEqual(entrada.itens.count(), 2)
        self.assertEqual(entrada.total, Decimal("62.00"))

    def test_registrar_entrada_sem_itens_falha(self):
        with self.assertRaises(ValidationError):
            registrar_entrada(fornecedor=None, numero_nota_fiscal="", data=None, observacao="", itens=[], user=None)
