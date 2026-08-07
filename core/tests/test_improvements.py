from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from django.utils import timezone

from core.models import (
    AlocacaoLoteMovimentacao,
    Cardapio,
    Categoria,
    FrequenciaDiaria,
    Grupo,
    LoteEstoque,
    Movimentacao,
    Produto,
    Receita,
    ReceitaIngrediente,
)
from core.operacao import gerar_plano_do_dia
from core.services import registrar_entrada, registrar_movimentacao
from core.tests.utils import AutenticadoAPITestCase
from plataforma.models import Modulo


class CardapioPorRefeicaoTest(AutenticadoAPITestCase):
    def test_cada_refeicao_usa_a_propria_receita(self):
        hoje = timezone.localdate()
        grupo = Grupo.objects.create(nome="Ingredientes", categoria=Categoria.objects.create(name="Alimentos"))
        leite = Produto.objects.create(
            nome="Leite", grupo=grupo, unidade="L", quantidade=20,
            unidade_consumo="ML", conteudo_por_unidade=Decimal("1000"),
        )
        arroz = Produto.objects.create(
            nome="Arroz", grupo=grupo, unidade="KG", quantidade=20,
            unidade_consumo="G", conteudo_por_unidade=Decimal("1000"),
        )
        FrequenciaDiaria.objects.create(data=hoje, turno="INTEGRAL", turma="1A", quantidade_alunos=100)

        cafe = Receita.objects.create(nome="Leite matinal", refeicao="CAFE_MANHA")
        ReceitaIngrediente.objects.create(
            receita=cafe, produto=leite, quantidade_por_aluno=Decimal("200")
        )
        almoco = Receita.objects.create(nome="Arroz do almoço", refeicao="ALMOCO")
        ReceitaIngrediente.objects.create(
            receita=almoco, produto=arroz, quantidade_por_aluno=Decimal("100")
        )
        Cardapio.objects.create(data=hoje, refeicao="CAFE_MANHA", receita=cafe)
        Cardapio.objects.create(data=hoje, refeicao="ALMOCO", receita=almoco)

        plano_cafe = gerar_plano_do_dia(data=hoje, turno="INTEGRAL", refeicao="CAFE_MANHA")
        plano_almoco = gerar_plano_do_dia(data=hoje, turno="INTEGRAL", refeicao="ALMOCO")

        self.assertEqual([item["produto_nome"] for item in plano_cafe["itens"]], ["Leite"])
        self.assertEqual([item["produto_nome"] for item in plano_almoco["itens"]], ["Arroz"])
        self.assertEqual(plano_cafe["origem_plano"], "cardapio")
        self.assertEqual(plano_almoco["receita"], "Arroz do almoço")


class LoteFefoTest(AutenticadoAPITestCase):
    def test_saida_consumo_prioriza_lote_que_vence_primeiro(self):
        hoje = timezone.localdate()
        grupo = Grupo.objects.create(nome="Grãos", categoria=Categoria.objects.create(name="Alimentos"))
        produto = Produto.objects.create(nome="Arroz", grupo=grupo, unidade="KG")

        registrar_entrada(itens=[{
            "produto": produto,
            "quantidade": Decimal("5"),
            "codigo_lote": "L1",
            "validade": hoje + timedelta(days=10),
        }], user=self.user)
        registrar_entrada(itens=[{
            "produto": produto,
            "quantidade": Decimal("10"),
            "codigo_lote": "L2",
            "validade": hoje + timedelta(days=30),
        }], user=self.user)

        movimento = registrar_movimentacao(
            produto=produto,
            tipo=Movimentacao.SAIDA,
            quantidade=Decimal("7"),
            motivo="consumo",
            user=self.user,
        )

        self.assertEqual(LoteEstoque.objects.get(codigo="L1").quantidade, Decimal("0"))
        self.assertEqual(LoteEstoque.objects.get(codigo="L2").quantidade, Decimal("8"))
        self.assertEqual(AlocacaoLoteMovimentacao.objects.filter(movimentacao=movimento).count(), 2)


class FinanceiroProtegidoTest(AutenticadoAPITestCase):
    def test_api_remove_precos_quando_modulo_financeiro_esta_desativado(self):
        Modulo.objects.filter(slug="financeiro").update(ativo=False)
        grupo = Grupo.objects.create(nome="Geral", categoria=Categoria.objects.create(name="Alimentos"))
        produto = Produto.objects.create(nome="Arroz", grupo=grupo, unidade="KG")
        registrar_entrada(itens=[{
            "produto": produto,
            "quantidade": 5,
            "preco_unitario": Decimal("10.00"),
        }], user=self.user)

        produto_resp = self.client.get(f"/api/produtos/{produto.pk}/")
        movimentos_resp = self.client.get("/api/movimentacoes/")
        entradas_resp = self.client.get("/api/entradas/")

        self.assertNotIn("ultimo_preco", produto_resp.data)
        self.assertNotIn("preco_unitario", movimentos_resp.data["results"][0])
        self.assertNotIn("total", entradas_resp.data["results"][0])
        self.assertNotIn("preco_unitario", entradas_resp.data["results"][0]["itens"][0])


class FrequenciaIdempotenteTest(AutenticadoAPITestCase):
    def test_modelo_aceita_identificador_idempotente_unico(self):
        operacao_id = uuid4()
        primeira = FrequenciaDiaria.objects.create(
            data=timezone.localdate(),
            turno="INTEGRAL",
            turma="Teste",
            quantidade_alunos=20,
            operacao_id=operacao_id,
        )
        self.assertEqual(primeira.operacao_id, operacao_id)
