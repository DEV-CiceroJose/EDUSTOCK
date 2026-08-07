from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.utils.crypto import salted_hmac
from django.utils import timezone


REFEICAO_CHOICES = [
    ("CAFE_MANHA", "Café da manhã"),
    ("ALMOCO", "Almoço"),
    ("LANCHE_TARDE", "Lanche da tarde"),
]


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
    UNIDADE_CONSUMO_CHOICES = [
        ("G", "Grama"),
        ("ML", "Mililitro"),
        ("UN", "Unidade"),
    ]
    PERIODICIDADE_CHOICES = [
        ("SEMANAL", "Semanal"),
        ("MENSAL", "Mensal"),
        ("EVENTUAL", "Eventual"),
    ]

    nome = models.CharField("Nome", max_length=200)
    grupo = models.ForeignKey("Grupo", on_delete=models.PROTECT, related_name="produtos")
    fornecedor = models.ForeignKey(
        "Fornecedor", on_delete=models.PROTECT, null=True, blank=True, related_name="produtos"
    )
    quantidade = models.DecimalField("Quantidade", max_digits=10, decimal_places=3, default=0)
    unidade = models.CharField(max_length=2, choices=UNIDADE_CHOICES)
    unidade_consumo = models.CharField(
        max_length=2,
        choices=UNIDADE_CONSUMO_CHOICES,
        null=True,
        blank=True,
    )
    conteudo_por_unidade = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    estoque_minimo = models.DecimalField(
        "Estoque mínimo", max_digits=10, decimal_places=3, default=0
    )
    perecivel = models.BooleanField("Perecível", default=False)
    periodicidade = models.CharField(
        max_length=8, choices=PERIODICIDADE_CHOICES, default="EVENTUAL"
    )
    validade = models.DateField("Validade", null=True, blank=True, db_index=True)
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

    def clean(self):
        super().clean()
        if self.unidade_consumo and self.conteudo_por_unidade is None:
            raise ValidationError(
                {"conteudo_por_unidade": "Informe o conteúdo por unidade de estoque."}
            )
        if self.conteudo_por_unidade is not None and not self.unidade_consumo:
            raise ValidationError(
                {"unidade_consumo": "Informe a unidade usada no consumo."}
            )


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


class LoteEstoque(models.Model):
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT, related_name="lotes")
    entrada = models.ForeignKey(
        Entrada,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lotes",
    )
    codigo = models.CharField(max_length=80)
    validade = models.DateField(null=True, blank=True, db_index=True)
    quantidade = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = [models.F("validade").asc(nulls_last=True), "criado_em"]
        constraints = [
            models.UniqueConstraint(fields=["produto", "codigo"], name="unique_lote_por_produto"),
            models.CheckConstraint(condition=Q(quantidade__gte=0), name="lote_quantidade_nao_negativa"),
        ]
        verbose_name = "Lote de estoque"
        verbose_name_plural = "Lotes de estoque"

    def __str__(self):
        return f"{self.produto.nome} · {self.codigo}"


class Movimentacao(models.Model):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"
    TIPO_CHOICES = [(ENTRADA, "Entrada"), (SAIDA, "Saída")]

    produto = models.ForeignKey("Produto", on_delete=models.PROTECT, related_name="movimentacoes")
    tipo = models.CharField(max_length=7, choices=TIPO_CHOICES, db_index=True)
    quantidade = models.DecimalField(max_digits=10, decimal_places=3)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    entrada = models.ForeignKey(
        Entrada, on_delete=models.CASCADE, null=True, blank=True, related_name="itens"
    )
    motivo = models.CharField(max_length=120, blank=True)
    data = models.DateField(default=timezone.localdate, db_index=True)
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


class AlocacaoLoteMovimentacao(models.Model):
    movimentacao = models.ForeignKey(
        Movimentacao,
        on_delete=models.CASCADE,
        related_name="alocacoes_lote",
    )
    lote = models.ForeignKey(
        LoteEstoque,
        on_delete=models.PROTECT,
        related_name="alocacoes",
    )
    quantidade = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["movimentacao", "lote"],
                name="unique_alocacao_lote_movimentacao",
            )
        ]
        verbose_name = "Alocação de lote"
        verbose_name_plural = "Alocações de lotes"


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
    operacao_id = models.UUIDField(null=True, blank=True, unique=True, editable=False)
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
    quantidade_por_aluno = models.DecimalField(max_digits=6, decimal_places=2)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Fator de consumo"
        verbose_name_plural = "Fatores de consumo"

    def __str__(self):
        return f"{self.produto.nome}: {self.quantidade_por_aluno}/aluno"

    def clean(self):
        super().clean()
        if self.produto_id and (
            not self.produto.unidade_consumo
            or self.produto.conteudo_por_unidade is None
        ):
            raise ValidationError(
                {"produto": "Configure a conversão de unidade do produto."}
            )


class Receita(models.Model):
    nome = models.CharField(max_length=150, unique=True)
    refeicao = models.CharField(max_length=12, choices=REFEICAO_CHOICES)
    ativa = models.BooleanField(default=True)
    observacao = models.TextField(blank=True)

    class Meta:
        ordering = ["refeicao", "nome"]

    def __str__(self):
        return self.nome


class ReceitaIngrediente(models.Model):
    receita = models.ForeignKey(Receita, on_delete=models.CASCADE, related_name="ingredientes")
    produto = models.ForeignKey(Produto, on_delete=models.PROTECT, related_name="usos_em_receitas")
    quantidade_por_aluno = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    class Meta:
        ordering = ["produto__nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["receita", "produto"],
                name="unique_ingrediente_por_receita",
            )
        ]

    def __str__(self):
        return f"{self.receita}: {self.produto}"

    def clean(self):
        super().clean()
        if self.produto_id and (
            not self.produto.unidade_consumo
            or self.produto.conteudo_por_unidade is None
        ):
            raise ValidationError(
                {"produto": "Configure a conversão de unidade do produto."}
            )


class Cardapio(models.Model):
    data = models.DateField(db_index=True)
    refeicao = models.CharField(max_length=12, choices=REFEICAO_CHOICES)
    receita = models.ForeignKey(Receita, on_delete=models.PROTECT, related_name="cardapios")
    observacao = models.TextField(blank=True)

    class Meta:
        ordering = ["-data", "refeicao"]
        constraints = [
            models.UniqueConstraint(
                fields=["data", "refeicao"],
                name="unique_cardapio_por_refeicao_dia",
            )
        ]

    def clean(self):
        super().clean()
        if self.receita_id and self.refeicao != self.receita.refeicao:
            raise ValidationError({"receita": "A receita deve pertencer à mesma refeição."})

    def __str__(self):
        return f"{self.data} · {self.get_refeicao_display()} · {self.receita}"


class OperacaoBaixaProducao(models.Model):
    CAFE_MANHA = "CAFE_MANHA"
    ALMOCO = "ALMOCO"
    LANCHE_TARDE = "LANCHE_TARDE"
    REFEICAO_CHOICES = [
        (CAFE_MANHA, "Café da manhã"),
        (ALMOCO, "Almoço"),
        (LANCHE_TARDE, "Lanche da tarde"),
    ]
    CONCLUIDA = "CONCLUIDA"
    PARCIAL = "PARCIAL"
    STATUS_CHOICES = [
        (CONCLUIDA, "Concluída"),
        (PARCIAL, "Parcial"),
    ]

    operacao_id = models.UUIDField(unique=True, editable=False)
    data = models.DateField(db_index=True)
    refeicao = models.CharField(max_length=12, choices=REFEICAO_CHOICES)
    itens_solicitados = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    resultado = models.JSONField(default=dict)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-criado_em"]
        constraints = [
            models.UniqueConstraint(
                fields=["data", "refeicao"],
                name="unique_baixa_producao_por_refeicao_dia",
            )
        ]
        verbose_name = "Operação de baixa de produção"
        verbose_name_plural = "Operações de baixa de produção"

    def __str__(self):
        return f"{self.operacao_id} — {self.data} {self.get_refeicao_display()}"


class Turma(models.Model):
    DS = "DS"
    TET = "TET"
    CURSO_CHOICES = [(DS, "Desenvolvimento de Sistemas"), (TET, "Eletrotécnica")]

    INTEGRAL = "INTEGRAL"
    TURNO_CHOICES = [(INTEGRAL, "Integral")]

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
        max_length=128,
        editable=False,
    )
    pin_fingerprint = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
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
        return f"{alvo} — PIN protegido"

    @staticmethod
    def _pin_em_formato_hash(valor):
        try:
            identify_hasher(valor)
            return True
        except (TypeError, ValueError):
            return False

    def definir_pin(self, pin):
        pin = str(pin).strip()
        RegexValidator(
            r"^\d{4}$", "PIN deve ter exatamente 4 dígitos."
        )(pin)
        self.pin_fingerprint = self.gerar_fingerprint(pin)
        self.pin = make_password(pin)

    @staticmethod
    def gerar_fingerprint(pin):
        return salted_hmac(
            "core.PinAcesso.pin",
            str(pin),
            secret=settings.PIN_LOOKUP_SECRET,
            algorithm="sha256",
        ).hexdigest()

    def confere_pin(self, pin):
        return bool(self.pin and check_password(str(pin), self.pin))

    def save(self, *args, **kwargs):
        if not self._pin_em_formato_hash(self.pin):
            pin_aberto = str(self.pin).strip()
            RegexValidator(
                r"^\d{4}$", "PIN deve ter exatamente 4 dígitos."
            )(pin_aberto)
            fingerprint = self.gerar_fingerprint(pin_aberto)
            if type(self).objects.exclude(pk=self.pk).filter(
                pin_fingerprint=fingerprint
            ).exists():
                raise ValidationError({"pin": "Este PIN já está em uso."})
            self.definir_pin(pin_aberto)
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.pin and not self._pin_em_formato_hash(self.pin):
            RegexValidator(
                r"^\d{4}$", "PIN deve ter exatamente 4 dígitos."
            )(str(self.pin).strip())
        if self.papel == self.ALUNO_REP and self.turma_id is None:
            raise ValidationError(
                "Representante de turma exige uma turma selecionada."
            )
        if self.papel == self.COZINHA and self.turma_id is not None:
            raise ValidationError(
                "PIN de cozinha não deve ter turma vinculada."
            )


class ConfiguracaoAlertas(models.Model):
    """Parâmetros globais editáveis pela administração da escola."""

    critico_dias = models.PositiveSmallIntegerField(
        "Prazo crítico de validade (dias)",
        default=7,
        help_text="Produtos com menos dias que este valor são classificados como críticos.",
    )
    alerta_dias = models.PositiveSmallIntegerField(
        "Antecedência padrão de validade (dias)",
        default=30,
        help_text="Janela padrão usada para listar produtos próximos do vencimento.",
    )
    estoque_percentual = models.PositiveSmallIntegerField(
        "Limiar de estoque baixo (%)",
        default=20,
        help_text="Percentual do estoque mínimo abaixo do qual o produto gera alerta.",
    )
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuração de alertas"
        verbose_name_plural = "Configuração de alertas"

    def __str__(self):
        return "Parâmetros globais de alertas"

    def clean(self):
        super().clean()
        if self.critico_dias >= self.alerta_dias:
            raise ValidationError(
                {"critico_dias": "O prazo crítico deve ser menor que a antecedência padrão."}
            )
        if not 1 <= self.estoque_percentual <= 100:
            raise ValidationError(
                {"estoque_percentual": "Informe um percentual entre 1 e 100."}
            )

    def save(self, *args, **kwargs):
        self.pk = 1
        self.full_clean()
        return super().save(*args, **kwargs)

    @classmethod
    def carregar(cls):
        configuracao, _ = cls.objects.get_or_create(pk=1)
        return configuracao


class CacheEntry(models.Model):
    """Tabela interna usada pelo backend DatabaseCache do Django."""

    cache_key = models.CharField(max_length=255, primary_key=True)
    value = models.TextField()
    expires = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "edustock_cache"
        verbose_name = "Entrada interna de cache"
        verbose_name_plural = "Entradas internas de cache"

