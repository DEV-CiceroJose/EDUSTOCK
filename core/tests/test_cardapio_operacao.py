from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from core.models import Categoria, Grupo, Produto, Receita
from core.operacao_auth import PERFIL_ALUNO, PERFIL_COZINHA, criar_token
from plataforma.models import Escola, Modulo, Municipio


class CardapioOperacaoAPITests(APITestCase):
    def setUp(self):
        Modulo.objects.update_or_create(
            slug="merenda", defaults={"nome": "Merenda", "ativo": True}
        )
        municipio = Municipio.objects.create(nome="Cidade", uf="CE", slug="cidade-cardapio")
        self.escola = Escola.objects.create(municipio=municipio, nome="Escola A", slug="escola-a")
        self.outra_escola = Escola.objects.create(municipio=municipio, nome="Escola B", slug="escola-b")
        categoria = Categoria.objects.create(escola=self.escola, name="Alimentos")
        grupo = Grupo.objects.create(escola=self.escola, categoria=categoria, nome="Grãos")
        self.produto = Produto.objects.create(
            escola=self.escola,
            nome="Arroz",
            grupo=grupo,
            unidade="KG",
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("1000"),
        )
        outra_categoria = Categoria.objects.create(escola=self.outra_escola, name="Alimentos")
        outro_grupo = Grupo.objects.create(
            escola=self.outra_escola, categoria=outra_categoria, nome="Grãos"
        )
        self.produto_externo = Produto.objects.create(
            escola=self.outra_escola,
            nome="Feijão",
            grupo=outro_grupo,
            unidade="KG",
            unidade_consumo="G",
            conteudo_por_unidade=Decimal("1000"),
        )
        self.cozinha = APIClient()
        self.cozinha.credentials(HTTP_X_OPERACAO_TOKEN=criar_token(
            PERFIL_COZINHA, escola_id=self.escola.id
        ))
        self.aluno = APIClient()
        self.aluno.credentials(HTTP_X_OPERACAO_TOKEN=criar_token(
            PERFIL_ALUNO, escola_id=self.escola.id
        ))

    def test_cozinha_cadastra_receita_e_define_cardapio(self):
        receita = self.cozinha.post("/api/operacao/receitas/", {
            "nome": "Arroz colorido",
            "refeicao": "ALMOCO",
            "ativa": True,
            "observacao": "",
            "ingredientes": [{
                "produto": self.produto.id,
                "quantidade_por_aluno": "80.00",
            }],
        }, format="json")
        self.assertEqual(receita.status_code, 201, receita.content)
        self.assertEqual(Receita.objects.get().escola, self.escola)

        hoje = timezone.localdate().isoformat()
        cardapio = self.cozinha.post("/api/operacao/cardapio/", {
            "data": hoje,
            "refeicao": "ALMOCO",
            "receita": receita.data["id"],
            "observacao": "Servir com salada",
        }, format="json")
        self.assertEqual(cardapio.status_code, 201, cardapio.content)

        consulta = self.aluno.get(f"/api/operacao/cardapio/?data={hoje}")
        self.assertEqual(consulta.status_code, 200, consulta.content)
        self.assertEqual(consulta.data["refeicoes"][0]["receita_nome"], "Arroz colorido")
        self.assertEqual(consulta.data["refeicoes"][0]["observacao"], "Servir com salada")

    def test_salvar_novamente_atualiza_refeicao_do_dia(self):
        primeira = Receita.objects.create(
            escola=self.escola, nome="Arroz", refeicao="ALMOCO"
        )
        segunda = Receita.objects.create(
            escola=self.escola, nome="Macarrão", refeicao="ALMOCO"
        )
        payload = {
            "data": timezone.localdate().isoformat(),
            "refeicao": "ALMOCO",
            "receita": primeira.id,
            "observacao": "",
        }
        self.assertEqual(
            self.cozinha.post("/api/operacao/cardapio/", payload, format="json").status_code,
            201,
        )
        payload["receita"] = segunda.id
        atualizacao = self.cozinha.post("/api/operacao/cardapio/", payload, format="json")
        self.assertEqual(atualizacao.status_code, 200, atualizacao.content)
        self.assertEqual(atualizacao.data["receita_nome"], "Macarrão")

    def test_aluno_nao_pode_alterar_cardapio(self):
        resposta = self.aluno.post("/api/operacao/cardapio/", {}, format="json")
        self.assertEqual(resposta.status_code, 403)

    def test_receita_rejeita_produto_de_outra_escola(self):
        resposta = self.cozinha.post("/api/operacao/receitas/", {
            "nome": "Receita externa",
            "refeicao": "ALMOCO",
            "ingredientes": [{
                "produto": self.produto_externo.id,
                "quantidade_por_aluno": "10.00",
            }],
        }, format="json")
        self.assertEqual(resposta.status_code, 400, resposta.content)
        self.assertIn("ingredientes", resposta.data)

    def test_listagens_nao_expoem_dados_de_outra_escola(self):
        Receita.objects.create(
            escola=self.outra_escola, nome="Receita secreta", refeicao="ALMOCO"
        )
        produtos = self.cozinha.get("/api/operacao/produtos-receita/")
        receitas = self.cozinha.get("/api/operacao/receitas/")
        self.assertEqual([item["id"] for item in produtos.data], [self.produto.id])
        self.assertEqual(receitas.data, [])
