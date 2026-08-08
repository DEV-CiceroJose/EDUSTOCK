from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from core.models import (
    Cardapio,
    Categoria,
    FatorConsumo,
    FrequenciaDiaria,
    Grupo,
    Produto,
    Receita,
    ReceitaIngrediente,
)
from core.operacao import converter_consumo_para_estoque, gerar_plano_do_dia
from core.serializers import ProdutoSerializer, ReceitaIngredienteSerializer


class ConversaoConsumoTest(TestCase):
    def test_pacote_de_500g_converte_100g_em_02_pacote(self):
        produto = Produto(
            unidade="PC",
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("500"),
        )

        self.assertEqual(
            converter_consumo_para_estoque(produto, Decimal("100")),
            Decimal("0.2"),
        )

    def test_produto_sem_conversao_e_rejeitado(self):
        produto = Produto(
            nome="Caixa de leite",
            unidade="CX",
            unidade_consumo=None,
            conteudo_por_unidade=None,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Configure a conversão de unidade de 'Caixa de leite'.",
        ):
            converter_consumo_para_estoque(produto, Decimal("12"))


class ValidacaoConversaoConsumoTest(TestCase):
    def setUp(self):
        categoria = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Ingredientes", categoria=categoria)

    def test_produto_rejeita_conversao_incompleta(self):
        produto = Produto(
            nome="Arroz",
            grupo=self.grupo,
            unidade="PC",
            unidade_consumo="G",
            conteudo_por_unidade=None,
        )

        with self.assertRaises(ValidationError) as contexto:
            produto.full_clean()

        self.assertIn("conteudo_por_unidade", contexto.exception.message_dict)

    def test_ingrediente_rejeita_produto_sem_conversao(self):
        produto = Produto.objects.create(
            nome="Arroz em caixa",
            grupo=self.grupo,
            unidade="CX",
        )
        receita = Receita.objects.create(nome="Arroz", refeicao="ALMOCO")
        serializer = ReceitaIngredienteSerializer(
            data={
                "receita": receita.pk,
                "produto": produto.pk,
                "quantidade_por_aluno": "100.00",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("produto", serializer.errors)

    def test_patch_de_ingrediente_revalida_conversao_do_produto_atual(self):
        produto = Produto.objects.create(
            nome="Arroz em caixa",
            grupo=self.grupo,
            unidade="CX",
        )
        receita = Receita.objects.create(nome="Arroz", refeicao="ALMOCO")
        ingrediente = ReceitaIngrediente.objects.create(
            receita=receita,
            produto=produto,
            quantidade_por_aluno=Decimal("100"),
        )
        serializer = ReceitaIngredienteSerializer(
            ingrediente,
            data={"quantidade_por_aluno": "120.00"},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("produto", serializer.errors)

    def test_fator_rejeita_produto_sem_conversao(self):
        produto = Produto.objects.create(
            nome="Arroz em caixa",
            grupo=self.grupo,
            unidade="CX",
        )
        fator = FatorConsumo(
            produto=produto,
            quantidade_por_aluno=Decimal("100"),
        )

        with self.assertRaises(ValidationError) as contexto:
            fator.full_clean()

        self.assertIn("produto", contexto.exception.message_dict)

    def test_serializer_de_produto_expoe_e_valida_conversao(self):
        serializer = ProdutoSerializer(
            data={
                "nome": "Pacote de arroz",
                "grupo": self.grupo.pk,
                "unidade": "PC",
                "unidade_consumo": "G",
                "conteudo_por_unidade": None,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("conteudo_por_unidade", serializer.errors)

    def test_patch_rejeita_remover_conversao_de_produto_com_fator(self):
        produto = Produto.objects.create(
            nome="Macarrão",
            grupo=self.grupo,
            unidade="PC",
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("500"),
        )
        FatorConsumo.objects.create(
            produto=produto,
            quantidade_por_aluno=Decimal("100"),
        )
        serializer = ProdutoSerializer(
            produto,
            data={"unidade_consumo": None, "conteudo_por_unidade": None},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("unidade_consumo", serializer.errors)

    def test_patch_rejeita_remover_conversao_de_produto_em_receita(self):
        produto = Produto.objects.create(
            nome="Macarrão",
            grupo=self.grupo,
            unidade="PC",
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("500"),
        )
        receita = Receita.objects.create(nome="Macarrão", refeicao="ALMOCO")
        ReceitaIngrediente.objects.create(
            receita=receita,
            produto=produto,
            quantidade_por_aluno=Decimal("100"),
        )
        serializer = ProdutoSerializer(
            produto,
            data={"unidade_consumo": None, "conteudo_por_unidade": None},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("unidade_consumo", serializer.errors)

    def test_modelo_rejeita_remover_conversao_de_produto_com_fator(self):
        produto = Produto.objects.create(
            nome="Macarrão",
            grupo=self.grupo,
            unidade="PC",
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("500"),
        )
        FatorConsumo.objects.create(
            produto=produto,
            quantidade_por_aluno=Decimal("100"),
        )
        produto.unidade_consumo = None
        produto.conteudo_por_unidade = None

        with self.assertRaises(ValidationError) as contexto:
            produto.full_clean(exclude={"criado_por", "atualizado_por"})

        self.assertIn("unidade_consumo", contexto.exception.message_dict)

    def test_modelo_rejeita_remover_conversao_de_produto_em_receita(self):
        produto = Produto.objects.create(
            nome="Macarrão",
            grupo=self.grupo,
            unidade="PC",
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("500"),
        )
        receita = Receita.objects.create(nome="Macarrão", refeicao="ALMOCO")
        ReceitaIngrediente.objects.create(
            receita=receita,
            produto=produto,
            quantidade_por_aluno=Decimal("100"),
        )
        produto.unidade_consumo = None
        produto.conteudo_por_unidade = None

        with self.assertRaises(ValidationError) as contexto:
            produto.full_clean(exclude={"criado_por", "atualizado_por"})

        self.assertIn("unidade_consumo", contexto.exception.message_dict)

    def test_produto_sem_dependentes_pode_permanecer_sem_conversao(self):
        produto = Produto(
            nome="Caixa sem uso",
            grupo=self.grupo,
            unidade="CX",
            unidade_consumo=None,
            conteudo_por_unidade=None,
        )

        produto.full_clean(exclude={"criado_por", "atualizado_por"})


class PlanoConversaoConsumoTest(TestCase):
    def setUp(self):
        self.hoje = timezone.localdate()
        categoria = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Ingredientes", categoria=categoria)
        FrequenciaDiaria.objects.create(
            data=self.hoje,
            turno="INTEGRAL",
            turma="1A",
            quantidade_alunos=1,
        )

    def test_plano_legado_converte_consumo_pela_embalagem_do_produto(self):
        produto = Produto.objects.create(
            nome="Macarrão",
            grupo=self.grupo,
            unidade="PC",
            quantidade=Decimal("10"),
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("500"),
        )
        FatorConsumo.objects.create(
            produto=produto,
            quantidade_por_aluno=Decimal("100"),
        )

        plano = gerar_plano_do_dia(data=self.hoje, turno="INTEGRAL")

        self.assertEqual(plano["itens"][0]["quantidade"], "0.200")

    def test_plano_de_receita_converte_consumo_pela_embalagem_do_produto(self):
        produto = Produto.objects.create(
            nome="Macarrão",
            grupo=self.grupo,
            unidade="PC",
            quantidade=Decimal("10"),
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("500"),
        )
        receita = Receita.objects.create(nome="Macarrão", refeicao="ALMOCO")
        ReceitaIngrediente.objects.create(
            receita=receita,
            produto=produto,
            quantidade_por_aluno=Decimal("100"),
        )
        Cardapio.objects.create(
            data=self.hoje,
            refeicao="ALMOCO",
            receita=receita,
        )

        plano = gerar_plano_do_dia(
            data=self.hoje,
            turno="INTEGRAL",
            refeicao="ALMOCO",
        )

        self.assertEqual(plano["itens"][0]["quantidade"], "0.200")
