from django.db import IntegrityError
from django.test import TestCase

from core.models import PinAcesso, Turma


class TurmaModelTest(TestCase):
    def test_cria_turma(self):
        t = Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1, turno=Turma.INTEGRAL)
        self.assertEqual(str(t), "1º DS-A")

    def test_nome_unico(self):
        Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1)
        with self.assertRaises(IntegrityError):
            Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1)


class PinAcessoModelTest(TestCase):
    def setUp(self):
        self.turma = Turma.objects.create(nome="1º DS-A", curso=Turma.DS, ano=1)

    def test_pin_de_turma_valido(self):
        p = PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=self.turma, pin="1234")
        self.assertEqual(str(p), "1º DS-A — 1234")

    def test_pin_de_cozinha_valido(self):
        p = PinAcesso.objects.create(papel=PinAcesso.COZINHA, turma=None, pin="9999")
        self.assertEqual(str(p), "Cozinha — 9999")

    def test_aluno_rep_sem_turma_falha(self):
        with self.assertRaises(IntegrityError):
            PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=None, pin="1111")

    def test_cozinha_com_turma_falha(self):
        with self.assertRaises(IntegrityError):
            PinAcesso.objects.create(papel=PinAcesso.COZINHA, turma=self.turma, pin="2222")

    def test_pin_duplicado_falha(self):
        PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=self.turma, pin="1234")
        outra_turma = Turma.objects.create(nome="1º DS-B", curso=Turma.DS, ano=1)
        with self.assertRaises(IntegrityError):
            PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=outra_turma, pin="1234")

    def test_papel_default_e_aluno_rep(self):
        p = PinAcesso(turma=self.turma, pin="5555")
        self.assertEqual(p.papel, PinAcesso.ALUNO_REP)
