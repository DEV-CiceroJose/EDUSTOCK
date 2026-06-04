from datetime import date
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.test import TestCase
from core.models import Categoria, Grupo, Produto, BemPermanente


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
