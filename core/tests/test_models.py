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
