from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from plataforma.models import Escola, Municipio, Perfil, TokenAcesso, VinculoUsuario

from core.models import (
    CardapioModeloMunicipal, CatalogoProdutoMunicipal, Categoria, Grupo,
    PinAcesso, Produto, Receita, RegistroRefeicao, Turma,
)


class RedeMultiEscolaTest(TestCase):
    def setUp(self):
        self.municipio = Municipio.objects.create(nome="Boa Gestão", uf="CE", slug="boa-gestao")
        self.escola_a = Escola.objects.create(municipio=self.municipio, nome="Escola A", slug="escola-a")
        self.escola_b = Escola.objects.create(municipio=self.municipio, nome="Escola B", slug="escola-b")
        self.outro_municipio = Municipio.objects.create(nome="Outro", uf="CE", slug="outro")
        self.escola_externa = Escola.objects.create(
            municipio=self.outro_municipio, nome="Escola Externa", slug="externa"
        )
        self.user = User.objects.create_user(username="gestora", password="senha-forte")
        Perfil.objects.create(user=self.user, papel=Perfil.ADMIN)
        VinculoUsuario.objects.create(
            user=self.user,
            municipio=self.municipio,
            papel=VinculoUsuario.GESTOR_REDE,
        )
        _, token = TokenAcesso.emitir(
            user=self.user,
            expira_em=timezone.now() + timedelta(hours=1),
            municipio=self.municipio,
            escola=self.escola_a,
            papel_rede=VinculoUsuario.GESTOR_REDE,
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

        self.produto_a = self._produto(self.escola_a, "Arroz A")
        self.produto_b = self._produto(self.escola_b, "Arroz B")

    @staticmethod
    def _produto(escola, nome):
        categoria = Categoria.objects.create(escola=escola, name=f"Merenda {escola.slug}")
        grupo = Grupo.objects.create(escola=escola, categoria=categoria, nome="Grãos")
        return Produto.objects.create(
            escola=escola,
            nome=nome,
            grupo=grupo,
            unidade="KG",
            quantidade=10,
            estoque_minimo=2,
            periodicidade="MENSAL",
        )

    def test_api_operacional_ignora_id_de_outra_escola(self):
        resposta = self.client.get(f"/api/produtos/?escola={self.escola_b.pk}")
        self.assertEqual(resposta.status_code, 200)
        nomes = [item["nome"] for item in resposta.data["results"]]
        self.assertEqual(nomes, ["Arroz A"])

    def test_painel_consolida_somente_escolas_autorizadas(self):
        RegistroRefeicao.objects.create(
            escola=self.escola_a, data=timezone.localdate(), refeicao="ALMOCO",
            porcoes_planejadas=100, porcoes_produzidas=95, porcoes_servidas=90,
            descarte_kg="1.250", custo_estimado="180.00",
        )
        RegistroRefeicao.objects.create(
            escola=self.escola_b, data=timezone.localdate(), refeicao="ALMOCO",
            porcoes_planejadas=80, porcoes_produzidas=80, porcoes_servidas=75,
            descarte_kg="0.500", custo_estimado="150.00",
        )
        RegistroRefeicao.objects.create(
            escola=self.escola_externa, data=timezone.localdate(), refeicao="ALMOCO",
            porcoes_planejadas=999, porcoes_produzidas=999, porcoes_servidas=999,
        )

        resposta = self.client.get("/api/rede/indicadores/")
        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertEqual(resposta.data["consolidado"]["escolas"], 2)
        self.assertEqual(resposta.data["consolidado"]["servidas"], 165)
        self.assertEqual({b["escola"]["id"] for b in resposta.data["por_escola"]}, {
            self.escola_a.pk, self.escola_b.pk,
        })

    def test_nao_troca_token_para_escola_de_outro_municipio(self):
        resposta = self.client.post(
            "/api/auth/escola/", {"escola_id": self.escola_externa.pk}, format="json"
        )
        self.assertEqual(resposta.status_code, 403)

    def test_conferencia_registra_snapshot_e_bloqueia_produto_de_outra_escola(self):
        resposta = self.client.post(
            "/api/contagens-estoque/",
            {"produto": self.produto_a.pk, "quantidade_fisica": "7.000"},
            format="json",
        )
        self.assertEqual(resposta.status_code, 201, resposta.content)
        self.assertEqual(resposta.data["quantidade_sistema"], "10.000")
        self.assertEqual(resposta.data["divergencia"], "-3.000")

        cruzada = self.client.post(
            "/api/contagens-estoque/",
            {"produto": self.produto_b.pk, "quantidade_fisica": "7.000"},
            format="json",
        )
        self.assertEqual(cruzada.status_code, 400)

        painel = self.client.get("/api/rede/indicadores/")
        escola_a = next(item for item in painel.data["por_escola"] if item["escola"]["id"] == self.escola_a.pk)
        self.assertEqual(escola_a["divergencias"]["itens_divergentes"], 1)
        self.assertEqual(escola_a["divergencias"]["quantidade_absoluta"], "3.000")

    def test_importacao_recusa_escola_nao_autorizada(self):
        arquivo = SimpleUploadedFile(
            "produtos.csv", b"nome;categoria;grupo;unidade\nFeijao;Merenda;Graos;KG\n",
            content_type="text/csv",
        )
        resposta = self.client.post(
            "/api/rede/importar-produtos/",
            {"escola_id": self.escola_externa.pk, "arquivo": arquivo},
            format="multipart",
        )
        self.assertEqual(resposta.status_code, 403)

    def test_importacao_csv_cria_produto_na_escola_escolhida(self):
        arquivo = SimpleUploadedFile(
            "produtos.csv",
            "nome;categoria;grupo;unidade;estoque_minimo;perecivel\nFeijão;Merenda;Grãos;KG;4,5;sim\n".encode("utf-8"),
            content_type="text/csv",
        )
        resposta = self.client.post(
            "/api/rede/importar-produtos/",
            {"escola_id": self.escola_b.pk, "arquivo": arquivo},
            format="multipart",
        )
        self.assertEqual(resposta.status_code, 200, resposta.content)
        produto = Produto.objects.get(escola=self.escola_b, nome="Feijão")
        self.assertTrue(produto.perecivel)
        self.assertEqual(produto.estoque_minimo, 4.5)

    def test_modelo_municipal_vira_receita_editavel_na_escola(self):
        catalogo = CatalogoProdutoMunicipal.objects.create(
            municipio=self.municipio, nome="Cenoura", categoria="Merenda",
            grupo="Hortaliças", unidade="KG", perecivel=True,
        )
        modelo = CardapioModeloMunicipal.objects.create(
            municipio=self.municipio, nome="Arroz com cenoura", refeicao="ALMOCO",
            ingredientes=[{"catalogo_produto_id": catalogo.pk, "gramas_por_aluno": "35"}],
        )
        resposta = self.client.post(
            f"/api/rede/cardapios-modelo/{modelo.pk}/aplicar/",
            {"escola_id": self.escola_b.pk},
            format="json",
        )
        self.assertEqual(resposta.status_code, 200, resposta.content)
        receita = Receita.objects.get(escola=self.escola_b, nome="Arroz com cenoura")
        self.assertEqual(receita.ingredientes.count(), 1)
        self.assertEqual(receita.ingredientes.get().produto.escola_id, self.escola_b.pk)


class PinMultiEscolaTest(TestCase):
    def setUp(self):
        municipio = Municipio.objects.create(nome="Rede", uf="CE", slug="rede")
        self.escola_a = Escola.objects.create(municipio=municipio, nome="A", slug="a")
        self.escola_b = Escola.objects.create(municipio=municipio, nome="B", slug="b")
        for escola in (self.escola_a, self.escola_b):
            turma = Turma.objects.create(
                escola=escola, nome="6A", curso="Fundamental", ano=6, turno="INTEGRAL"
            )
            acesso = PinAcesso(escola=escola, papel=PinAcesso.ALUNO_REP, turma=turma)
            acesso.definir_pin("1234")
            acesso.save()

    def test_pin_repetido_exige_escola_e_isola_frequencia(self):
        client = APIClient()
        ambiguo = client.post(
            "/api/operacao/auth/", {"perfil": "ALUNO_REP", "pin": "1234"}, format="json"
        )
        self.assertEqual(ambiguo.status_code, 401)

        login = client.post(
            "/api/operacao/auth/",
            {"perfil": "ALUNO_REP", "pin": "1234", "escola": "b"},
            format="json",
        )
        self.assertEqual(login.status_code, 200, login.content)
        self.assertEqual(login.data["escola"]["id"], self.escola_b.pk)
        client.credentials(HTTP_X_OPERACAO_TOKEN=login.data["token"])
        contagem = client.post("/api/operacao/contagem/", {"quantidade_alunos": 30}, format="json")
        self.assertEqual(contagem.status_code, 201, contagem.content)
        self.assertEqual(self.escola_a.frequencias_diarias.count(), 0)
        self.assertEqual(self.escola_b.frequencias_diarias.count(), 1)
