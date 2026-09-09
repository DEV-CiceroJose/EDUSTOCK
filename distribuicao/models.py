from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Aluno(models.Model):
    escola = models.ForeignKey('plataforma.Escola', on_delete=models.PROTECT)
    turma = models.ForeignKey('core.Turma', on_delete=models.PROTECT)
    nome = models.CharField(max_length=200)
    serie = models.CharField(max_length=40)
    sexo = models.CharField(max_length=1, choices=[('F', 'Feminino'), ('M', 'Masculino'), ('N', 'Não informado')])
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nome', 'id']
        indexes = [models.Index(fields=['escola', 'ativo', 'turma'])]


class Rodada(models.Model):
    TIPOS = [('ABSORVENTE', 'Absorventes'), ('KIT_ESCOLAR', 'Kit escolar'), ('FARDAMENTO', 'Fardamento')]
    ESTADOS = [('RASCUNHO', 'Rascunho'), ('LIBERADA', 'Liberada'), ('SUSPENSA', 'Suspensa'), ('ENCERRADA', 'Encerrada')]
    escola = models.ForeignKey('plataforma.Escola', on_delete=models.PROTECT)
    titulo = models.CharField(max_length=160)
    tipo = models.CharField(max_length=20, choices=TIPOS)
    estado = models.CharField(max_length=12, choices=ESTADOS, default='RASCUNHO')
    criado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    criado_em = models.DateTimeField(auto_now_add=True)
    liberado_em = models.DateTimeField(null=True)

    class Meta:
        ordering = ['-id']


class ItemRodada(models.Model):
    rodada = models.ForeignKey(Rodada, on_delete=models.CASCADE, related_name='itens')
    produto = models.ForeignKey('core.Produto', on_delete=models.PROTECT)
    quantidade = models.DecimalField(max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])

    class Meta:
        constraints = [models.UniqueConstraint(fields=['rodada', 'produto'], name='produto_unico_rodada'),
                       models.CheckConstraint(condition=models.Q(quantidade__gt=0), name='quantidade_entrega_positiva')]


class Destinatario(models.Model):
    rodada = models.ForeignKey(Rodada, on_delete=models.PROTECT, related_name='destinatarios')
    aluno = models.ForeignKey(Aluno, on_delete=models.PROTECT)
    turma = models.ForeignKey('core.Turma', on_delete=models.PROTECT)
    nome = models.CharField(max_length=200)
    turma_nome = models.CharField(max_length=50)
    serie = models.CharField(max_length=40)
    entregue_em = models.DateTimeField(null=True)
    responsavel = models.CharField(max_length=120, blank=True)
    pin = models.ForeignKey('core.PinAcesso', null=True, on_delete=models.PROTECT)
    movimentos = models.ManyToManyField('core.Movimentacao')

    class Meta:
        ordering = ['nome', 'id']
        constraints = [models.UniqueConstraint(fields=['rodada', 'aluno'], name='aluno_unico_rodada')]
