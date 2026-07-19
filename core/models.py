from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.contrib.auth.models import User
from django.utils import timezone


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
    fornecedor = models.ForeignKey(
        "Fornecedor", on_delete=models.PROTECT, null=True, blank=True, related_name="produtos"
    )
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


class Fornecedor(models.Model):
    nome = models.CharField(max_length=200)
    documento = models.CharField("CNPJ/CPF", max_length=20, blank=True)
    endereco = models.CharField(max_length=200, blank=True)
    telefone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    emite_nota_fiscal = models.BooleanField("Emite nota fiscal", default=True)
    aceita_fiado = models.BooleanField("Aceita fiado", default=False)
    ativo = models.BooleanField(default=True)
    observacao = models.TextField(blank=True)

    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="fornecedores_criados"
    )
    atualizado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="fornecedores_atualizados"
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "Fornecedor"
        verbose_name_plural = "Fornecedores"

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


class Entrada(models.Model):
    fornecedor = models.ForeignKey(
        "Fornecedor", on_delete=models.PROTECT, null=True, blank=True, related_name="entradas"
    )
    numero_nota_fiscal = models.CharField(max_length=20, blank=True)
    data = models.DateField(default=timezone.localdate)
    observacao = models.TextField(blank=True)
    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="entradas_criadas"
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-data", "-id"]
        verbose_name = "Entrada"
        verbose_name_plural = "Entradas"

    def __str__(self):
        return f"Entrada {self.data} - {self.fornecedor or 'sem fornecedor'}"

    @property
    def total(self):
        from decimal import Decimal
        return sum(
            (m.quantidade * m.preco_unitario for m in self.itens.all() if m.preco_unitario),
            Decimal("0"),
        )


class Movimentacao(models.Model):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"
    TIPO_CHOICES = [(ENTRADA, "Entrada"), (SAIDA, "Saída")]

    produto = models.ForeignKey("Produto", on_delete=models.PROTECT, related_name="movimentacoes")
    tipo = models.CharField(max_length=7, choices=TIPO_CHOICES)
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    entrada = models.ForeignKey(
        Entrada, on_delete=models.CASCADE, null=True, blank=True, related_name="itens"
    )
    motivo = models.CharField(max_length=120, blank=True)
    data = models.DateField(default=timezone.localdate)
    criado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="movimentacoes_criadas"
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-data", "-id"]
        verbose_name = "Movimentação"
        verbose_name_plural = "Movimentações"

    def __str__(self):
        return f"{self.tipo} {self.quantidade:.3f} {self.produto.nome}"


class FrequenciaDiaria(models.Model):
    MANHA = "MANHA"
    TARDE = "TARDE"
    INTEGRAL = "INTEGRAL"
    TURNO_CHOICES = [
        (MANHA, "Manhã"),
        (TARDE, "Tarde"),
        (INTEGRAL, "Integral"),
    ]

    data = models.DateField(default=timezone.localdate)
    turno = models.CharField(max_length=8, choices=TURNO_CHOICES)
    turma = models.CharField(max_length=20)
    quantidade_alunos = models.PositiveIntegerField()
    # Identificador do PIN/turma que enviou via app-alunos (vazio quando
    # o registro foi feito pelo painel administrativo).
    registrado_por_turma = models.CharField(
        max_length=20,
        blank=True,
        default="",
        verbose_name="Registrado pela turma (PIN)",
    )
    registrado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="frequencias_registradas"
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-data", "turno", "turma"]
        constraints = [
            models.UniqueConstraint(
                fields=["data", "turno", "turma"],
                name="unique_frequencia_por_turma_turno_dia",
            )
        ]
        verbose_name = "Frequência diária"
        verbose_name_plural = "Frequências diárias"

    def __str__(self):
        return f"{self.data} {self.turno} {self.turma}: {self.quantidade_alunos}"


class FatorConsumo(models.Model):
    produto = models.OneToOneField(
        Produto, on_delete=models.CASCADE, related_name="fator_consumo"
    )
    gramas_por_aluno = models.DecimalField(max_digits=6, decimal_places=2)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Fator de consumo"
        verbose_name_plural = "Fatores de consumo"

    def __str__(self):
        return f"{self.produto.nome}: {self.gramas_por_aluno}/aluno"


class Turma(models.Model):
    DS = "DS"
    TET = "TET"
    CURSO_CHOICES = [(DS, "Desenvolvimento de Sistemas"), (TET, "Eletrotécnica")]

    MANHA = "MANHA"
    TARDE = "TARDE"
    INTEGRAL = "INTEGRAL"
    TURNO_CHOICES = [(MANHA, "Manhã"), (TARDE, "Tarde"), (INTEGRAL, "Integral")]

    nome = models.CharField(max_length=50, unique=True)
    curso = models.CharField(max_length=3, choices=CURSO_CHOICES)
    ano = models.PositiveSmallIntegerField()
    turno = models.CharField(max_length=10, choices=TURNO_CHOICES, default=INTEGRAL)
    ativo = models.BooleanField(default=True)

    class Meta:
        ordering = ["curso", "ano", "nome"]
        verbose_name = "Turma"
        verbose_name_plural = "Turmas"

    def __str__(self):
        return self.nome


class PinAcesso(models.Model):
    ALUNO_REP = "ALUNO_REP"
    COZINHA = "COZINHA"
    PAPEL_CHOICES = [(ALUNO_REP, "Representante de turma"), (COZINHA, "Equipe da cozinha")]

    papel = models.CharField(max_length=10, choices=PAPEL_CHOICES, default=ALUNO_REP)
    turma = models.ForeignKey(
        Turma, on_delete=models.CASCADE, null=True, blank=True, related_name="pins"
    )
    pin = models.CharField(
        max_length=4,
        unique=True,
        validators=[RegexValidator(r"^\d{4}$", "PIN deve ter exatamente 4 dígitos.")],
    )
    titular = models.CharField(
        "Nome de quem escolheu o PIN", max_length=100, blank=True, default=""
    )
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["turma__nome", "papel"]
        verbose_name = "PIN de acesso"
        verbose_name_plural = "PINs de acesso"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(papel="ALUNO_REP", turma__isnull=False)
                    | Q(papel="COZINHA", turma__isnull=True)
                ),
                name="turma_obrigatoria_apenas_para_aluno_rep",
            )
        ]

    def __str__(self):
        alvo = self.turma.nome if self.turma else "Cozinha"
        return f"{alvo} — {self.pin}"
