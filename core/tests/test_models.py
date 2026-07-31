from datetime import date
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.test import TestCase
from core.models import Categoria, ConfiguracaoAlertas, Grupo, Produto, BemPermanente


class GrupoModelTest(TestCase):
    def test_grupo_pertence_a_categoria(self):
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Carboidratos", categoria=cat)
        self.assertEqual(grupo.categoria, cat)
        self.assertIn("Carboidratos", str(grupo))

    def test_grupo_unico_por_categoria(self):
        cat = Categoria.objects.create(name="Alimentos")
        Grupo.objects.create(nome="Geral", categoria=cat)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Grupo.objects.create(nome="Geral", categoria=cat)


class ProdutoModelTest(TestCase):
    def setUp(self):
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=self.cat)

    def test_novos_campos_e_defaults(self):
        p = Produto.objects.create(
            nome="Arroz", grupo=self.grupo, quantidade=Decimal("48.5"), unidade="KG"
        )
        self.assertEqual(p.estoque_minimo, Decimal("0"))
        self.assertFalse(p.perecivel)
        self.assertEqual(p.periodicidade, "EVENTUAL")
        self.assertEqual(p.quantidade, Decimal("48.5"))
        self.assertEqual(p.grupo.categoria, self.cat)


class BemPermanenteModelTest(TestCase):
    def test_cria_bem_permanente(self):
        b = BemPermanente.objects.create(
            nome="Notebook Dell", numero_patrimonio="PAT-001",
            localizacao="Lab Informática", responsavel="Prof. Marcelo",
            estado_conservacao="BOM", data_aquisicao=date(2025, 1, 10),
        )
        self.assertEqual(str(b), "Notebook Dell")

    def test_patrimonio_unico(self):
        BemPermanente.objects.create(nome="A", numero_patrimonio="PAT-9")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                BemPermanente.objects.create(nome="B", numero_patrimonio="PAT-9")


class ProdutoFinalTest(TestCase):
    def test_grupo_obrigatorio_e_categoria_removida(self):
        cat = Categoria.objects.create(name="Limpeza")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        p = Produto.objects.create(nome="Sabão", grupo=grupo, quantidade=5, unidade="UN")
        # categoria não é mais campo do Produto
        self.assertFalse(hasattr(p, "categoria"))

    def test_categoria_em_uso_protegida(self):
        from django.db.models import ProtectedError
        cat = Categoria.objects.create(name="Papelaria")
        Grupo.objects.create(nome="Geral", categoria=cat)
        with self.assertRaises(ProtectedError):
            cat.delete()


class FornecedorModelTest(TestCase):
    def test_defaults(self):
        from core.models import Fornecedor
        f = Fornecedor.objects.create(nome="Atacadão Escolar")
        self.assertTrue(f.emite_nota_fiscal)
        self.assertFalse(f.aceita_fiado)
        self.assertTrue(f.ativo)
        self.assertEqual(str(f), "Atacadão Escolar")

    def test_produto_com_e_sem_fornecedor(self):
        from core.models import Fornecedor
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        p1 = Produto.objects.create(nome="Sem forn", grupo=grupo, quantidade=1, unidade="UN")
        self.assertIsNone(p1.fornecedor)
        f = Fornecedor.objects.create(nome="Fornecedor X")
        p2 = Produto.objects.create(nome="Com forn", grupo=grupo, quantidade=1, unidade="UN", fornecedor=f)
        self.assertEqual(p2.fornecedor, f)

    def test_fornecedor_em_uso_protegido(self):
        from django.db.models import ProtectedError
        from core.models import Fornecedor
        cat = Categoria.objects.create(name="Limpeza")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        f = Fornecedor.objects.create(nome="Protegido")
        Produto.objects.create(nome="Item", grupo=grupo, quantidade=1, unidade="UN", fornecedor=f)
        with self.assertRaises(ProtectedError):
            f.delete()


class MovimentacaoModelTest(TestCase):
    def _produto(self):
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        return Produto.objects.create(nome="Arroz", grupo=grupo, quantidade=10, unidade="KG")

    def test_cria_movimentacao_e_entrada(self):
        from core.models import Entrada, Movimentacao
        p = self._produto()
        e = Entrada.objects.create(numero_nota_fiscal="NF-1")
        m = Movimentacao.objects.create(produto=p, tipo=Movimentacao.ENTRADA, quantidade=5, entrada=e, preco_unitario="2.00")
        self.assertEqual(m.entrada, e)
        self.assertEqual(list(e.itens.all()), [m])
        self.assertEqual(str(m), "ENTRADA 5.000 Arroz")

    def test_entrada_total(self):
        from core.models import Entrada, Movimentacao
        p = self._produto()
        e = Entrada.objects.create()
        Movimentacao.objects.create(produto=p, tipo=Movimentacao.ENTRADA, quantidade=3, entrada=e, preco_unitario="2.00")
        Movimentacao.objects.create(produto=p, tipo=Movimentacao.ENTRADA, quantidade=2, entrada=e, preco_unitario="5.00")
        from decimal import Decimal
        self.assertEqual(e.total, Decimal("16.00"))

    def test_produto_com_movimentacao_protegido(self):
        from django.db.models import ProtectedError
        from core.models import Movimentacao
        p = self._produto()
        Movimentacao.objects.create(produto=p, tipo=Movimentacao.SAIDA, quantidade=1)
        with self.assertRaises(ProtectedError):
            p.delete()


class ConfiguracaoAlertasModelTest(TestCase):
    def test_configuracao_e_singleton(self):
        from django.core.exceptions import ValidationError

        configuracao = ConfiguracaoAlertas.carregar()
        configuracao.alerta_dias = 45
        configuracao.save()

        outra = ConfiguracaoAlertas(critico_dias=5, alerta_dias=20)
        with self.assertRaises(ValidationError):
            outra.save()

        self.assertEqual(ConfiguracaoAlertas.objects.count(), 1)
        self.assertEqual(ConfiguracaoAlertas.carregar().alerta_dias, 45)

    def test_prazo_critico_deve_ser_menor_que_alerta(self):
        from django.core.exceptions import ValidationError

        configuracao = ConfiguracaoAlertas(
            critico_dias=30, alerta_dias=20, estoque_percentual=20
        )
        with self.assertRaises(ValidationError):
            configuracao.save()
