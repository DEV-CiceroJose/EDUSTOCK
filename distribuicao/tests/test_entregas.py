from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase

from plataforma.models import Escola, Municipio
from core.models import Categoria, Grupo, Produto, LoteEstoque, Turma, PinAcesso
from distribuicao.models import Aluno, Rodada, ItemRodada, Destinatario
from distribuicao.services import mudar_estado, entregar


class EntregasTest(TestCase):
    def setUp(self):
        municipio = Municipio.objects.create(nome='Rede', slug='teste-entregas', uf='CE')
        self.escola = Escola.objects.create(nome='Escola', slug='teste', municipio=municipio)
        self.turma = Turma.objects.create(escola=self.escola, nome='1 A', curso='DS', ano=1)
        self.user = User.objects.create_user('gestora')
        self.menina = Aluno.objects.create(escola=self.escola, turma=self.turma, nome='Ana', serie='1', sexo='F')
        self.menino = Aluno.objects.create(escola=self.escola, turma=self.turma, nome='José', serie='1', sexo='M')
        categoria = Categoria.objects.create(escola=self.escola, name='Materiais')
        grupo = Grupo.objects.create(escola=self.escola, categoria=categoria, nome='Kits')
        self.produto = Produto.objects.create(escola=self.escola, grupo=grupo, nome='Kit', unidade='UN', quantidade=10)
        LoteEstoque.objects.create(escola=self.escola, produto=self.produto, quantidade=10)
        self.pin = PinAcesso.objects.create(escola=self.escola, turma=self.turma, pin='8274')
        self.sessao = {'escola_id': self.escola.pk, 'turma_id': self.turma.pk, 'pin_acesso_id': self.pin.pk}
        self.rodada = Rodada.objects.create(escola=self.escola, titulo='Setembro', tipo='ABSORVENTE', criado_por=self.user)
        ItemRodada.objects.create(rodada=self.rodada, produto=self.produto, quantidade=2)

    def liberar(self):
        return mudar_estado(self.rodada.pk, self.escola, 'LIBERADA', self.user)

    def test_publico_e_historico_fixados_na_liberacao(self):
        self.liberar()
        self.assertEqual(list(Destinatario.objects.values_list('aluno_id', flat=True)), [self.menina.pk])
        self.menina.nome = 'Novo nome'
        self.menina.save()
        self.assertEqual(Destinatario.objects.get().nome, 'Ana')

    def test_repeticao_nao_baixa_duas_vezes(self):
        self.liberar()
        alvo = Destinatario.objects.get()
        entregar(alvo.pk, self.sessao)
        entregar(alvo.pk, self.sessao)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal('8'))
        self.assertEqual(alvo.movimentos.count(), 1)

    def test_estorno_avulso_nao_desfaz_estoque_de_entrega_confirmada(self):
        from core.services import registrar_estorno

        self.liberar()
        alvo = Destinatario.objects.get()
        entregar(alvo.pk, self.sessao)
        movimento = alvo.movimentos.get()
        with self.assertRaisesMessage(ValidationError, 'entrega de aluno'):
            registrar_estorno(movimentacao=movimento, motivo='Correção de estoque', user=self.user)
        self.produto.refresh_from_db()
        alvo.refresh_from_db()
        self.assertEqual(self.produto.quantidade, Decimal('8'))
        self.assertIsNotNone(alvo.entregue_em)

    def test_suspensa_e_outra_turma_nao_entregam(self):
        self.liberar()
        alvo = Destinatario.objects.get()
        with self.assertRaises(ValidationError):
            entregar(alvo.pk, {**self.sessao, 'turma_id': 99999})
        mudar_estado(self.rodada.pk, self.escola, 'SUSPENSA', self.user)
        with self.assertRaises(ValidationError):
            entregar(alvo.pk, self.sessao)

    def test_falta_de_saldo_reverte_toda_entrega(self):
        ItemRodada.objects.filter(rodada=self.rodada).update(quantidade=11)
        self.liberar()
        alvo = Destinatario.objects.get()
        with self.assertRaises(ValidationError):
            entregar(alvo.pk, self.sessao)
        alvo.refresh_from_db()
        self.produto.refresh_from_db()
        self.assertIsNone(alvo.entregue_em)
        self.assertEqual(self.produto.quantidade, Decimal('10'))

    def test_kit_inclui_todos_e_encerramento_e_final(self):
        self.rodada.tipo = 'KIT_ESCOLAR'
        self.rodada.save()
        self.liberar()
        self.assertEqual(Destinatario.objects.count(), 2)
        mudar_estado(self.rodada.pk, self.escola, 'ENCERRADA', self.user)
        with self.assertRaises(ValidationError):
            self.liberar()
