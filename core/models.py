from django.db import models
from django.contrib.auth.models import User


class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    matricula = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"{self.user.username} - {self.matricula}"


class Categoria(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Produto(models.Model):
    
    UNIDADE_CHOICES = [
        ('UN', 'Unidade'),
        ('KG', 'Quilograma'),
        ('L', 'Litro'),
        ('CX', 'Caixa'),
        ('PC', 'Pacote'),
    ]
    
    nome = models.CharField("Nome",max_length=200)
    numero_nota_fiscal = models.CharField("Número da Nota Fiscal", max_length=12, null=True, blank=True)
    categoria = models.ForeignKey('Categoria', on_delete=models.CASCADE)
    quantidade = models.FloatField("Quantidade")
    unidade = models.CharField(max_length=2, choices=UNIDADE_CHOICES)
    validade = models.DateField("Validade",  null=True, blank=True)
    preco = models.DecimalField("Preço", max_digits=10, decimal_places=2, null=True, blank=True)

    #  Auditoria
    criado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='produtos_criados')
    atualizado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='produtos_atualizados')

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nome


