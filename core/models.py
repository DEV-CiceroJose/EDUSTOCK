from django.db import models
from django.contrib.auth.models import User


class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    matricula = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"{self.user.username} - {self.matricula}"


class Categoria(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"

    def __str__(self):
        return self.name


class Grupo(models.Model):
    nome = models.CharField(max_length=100)
    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name="grupos"
    )

    class Meta:
        ordering = ["categoria__name", "nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["categoria", "nome"], name="unique_grupo_por_categoria"
            )
        ]

    def __str__(self):
        return f"{self.categoria.name} › {self.nome}"


class Produto(models.Model):
    UNIDADE_CHOICES = [
        ("UN", "Unidade"),
        ("KG", "Quilograma"),
        ("L", "Litro"),
        ("CX", "Caixa"),
        ("PC", "Pacote"),
    ]
    PERIODICIDADE_CHOICES = [
        ("SEMANAL", "Semanal"),
        ("MENSAL", "Mensal"),
        ("EVENTUAL", "Eventual"),
    ]

    nome = models.CharField("Nome", max_length=200)
    numero_nota_fiscal = models.CharField(
        "Número da Nota Fiscal", max_length=12, null=True, blank=True
    )
    grupo = models.ForeignKey("Grupo", on_delete=models.PROTECT, related_name="produtos")
    quantidade = models.DecimalField("Quantidade", max_digits=10, decimal_places=3, default=0)
    unidade = models.CharField(max_length=2, choices=UNIDADE_CHOICES)
    estoque_minimo = models.DecimalField(
        "Estoque mínimo", max_digits=10, decimal_places=3, default=0
    )
    perecivel = models.BooleanField("Perecível", default=False)
    periodicidade = models.CharField(
        max_length=8, choices=PERIODICIDADE_CHOICES, default="EVENTUAL"
    )
    validade = models.DateField("Validade", null=True, blank=True)
    preco = models.DecimalField("Preço", max_digits=10, decimal_places=2, null=True, blank=True)

    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="produtos_criados"
    )
    atualizado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="produtos_atualizados"
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class BemPermanente(models.Model):
    ESTADO_CHOICES = [
        ("NOVO", "Novo"),
        ("BOM", "Bom"),
        ("REGULAR", "Regular"),
        ("RUIM", "Ruim"),
        ("INSERVIVEL", "Inservível"),
    ]

    nome = models.CharField(max_length=200)
    numero_patrimonio = models.CharField(max_length=50, null=True, blank=True, unique=True)
    localizacao = models.CharField(max_length=150, blank=True)
    responsavel = models.CharField(max_length=150, blank=True)
    estado_conservacao = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="BOM")
    data_aquisicao = models.DateField(null=True, blank=True)
    observacao = models.TextField(blank=True)

    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="bens_criados"
    )
    atualizado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="bens_atualizados"
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "Bem permanente"
        verbose_name_plural = "Bens permanentes"

    def __str__(self):
        return self.nome
