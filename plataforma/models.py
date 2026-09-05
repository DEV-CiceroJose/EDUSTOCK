import hashlib
import secrets

from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Modulo(models.Model):
    slug = models.SlugField(unique=True)
    nome = models.CharField(max_length=100)
    descricao = models.CharField(max_length=255, blank=True)
    ativo = models.BooleanField(default=True)
    depende_de = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="dependentes"
    )

    class Meta:
        ordering = ["nome"]
        verbose_name = "Módulo"
        verbose_name_plural = "Módulos"

    def __str__(self):
        return self.nome


class Municipio(models.Model):
    """Entidade compradora e limite superior de isolamento da plataforma."""

    nome = models.CharField(max_length=150)
    uf = models.CharField(max_length=2, default="CE")
    slug = models.SlugField(unique=True)
    codigo_ibge = models.CharField(max_length=7, unique=True, null=True, blank=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "Município"
        verbose_name_plural = "Municípios"

    def __str__(self):
        return f"{self.nome}/{self.uf}"


class Escola(models.Model):
    """Unidade operacional cujos dados nunca podem vazar para outra escola."""

    municipio = models.ForeignKey(
        Municipio, on_delete=models.PROTECT, related_name="escolas"
    )
    nome = models.CharField(max_length=180)
    slug = models.SlugField()
    codigo_inep = models.CharField(max_length=8, unique=True, null=True, blank=True)
    ativa = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["municipio__nome", "nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["municipio", "slug"], name="unique_escola_slug_municipio"
            )
        ]
        verbose_name = "Escola"
        verbose_name_plural = "Escolas"

    def __str__(self):
        return f"{self.nome} · {self.municipio}"


def escola_padrao_id():
    """Compatibilidade para instalações e integrações anteriores ao multi-escola."""

    municipio, _ = Municipio.objects.get_or_create(
        slug="municipio-piloto",
        defaults={"nome": "Município Piloto", "uf": "CE"},
    )
    escola, _ = Escola.objects.get_or_create(
        municipio=municipio,
        slug="escola-piloto",
        defaults={"nome": "Escola Piloto"},
    )
    return escola.pk


class VinculoUsuario(models.Model):
    GESTOR_REDE = "GESTOR_REDE"
    GESTOR_ESCOLA = "GESTOR_ESCOLA"
    NUTRICIONISTA = "NUTRICIONISTA"
    OPERADOR = "OPERADOR"
    PAPEL_CHOICES = [
        (GESTOR_REDE, "Gestor da rede"),
        (GESTOR_ESCOLA, "Gestor escolar"),
        (NUTRICIONISTA, "Nutricionista"),
        (OPERADOR, "Operador"),
    ]
    PAPEIS_COM_ESCOPO_DE_REDE = {GESTOR_REDE, NUTRICIONISTA}
    PAPEIS_COM_ESCOLA_OBRIGATORIA = {GESTOR_ESCOLA, OPERADOR}

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vinculos_rede")
    municipio = models.ForeignKey(
        Municipio, on_delete=models.CASCADE, related_name="vinculos_usuarios"
    )
    escola = models.ForeignKey(
        Escola,
        on_delete=models.CASCADE,
        related_name="vinculos_usuarios",
        null=True,
        blank=True,
    )
    papel = models.CharField(max_length=16, choices=PAPEL_CHOICES)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["user__username", "municipio__nome", "escola__nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "municipio", "escola", "papel"],
                condition=models.Q(escola__isnull=False),
                name="unique_vinculo_usuario_escola_papel",
            ),
            models.UniqueConstraint(
                fields=["user", "municipio", "papel"],
                condition=models.Q(escola__isnull=True),
                name="unique_vinculo_usuario_rede_papel",
            )
        ]
        verbose_name = "Vínculo de usuário"
        verbose_name_plural = "Vínculos de usuários"

    def clean(self):
        super().clean()
        if self.escola_id and self.escola.municipio_id != self.municipio_id:
            raise ValidationError({"escola": "A escola deve pertencer ao município informado."})
        if self.papel in self.PAPEIS_COM_ESCOLA_OBRIGATORIA and not self.escola_id:
            raise ValidationError({"escola": "Este papel exige uma escola vinculada."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        escopo = self.escola.nome if self.escola_id else self.municipio.nome
        return f"{self.user.username} · {self.get_papel_display()} · {escopo}"


class Perfil(models.Model):
    ADMIN = "ADMIN"
    OPERADOR = "OPERADOR"
    PAPEL_CHOICES = [(ADMIN, "Administrador"), (OPERADOR, "Operador")]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="perfil")
    matricula = models.CharField(max_length=50, unique=True, null=True, blank=True)
    papel = models.CharField(max_length=10, choices=PAPEL_CHOICES, default=OPERADOR)
    acesso_legado = models.BooleanField(
        default=False,
        help_text="Mantém o acesso amplo apenas para perfis migrados sem módulos explícitos.",
    )
    modulos = models.ManyToManyField(
        Modulo,
        blank=True,
        related_name="perfis_autorizados",
        help_text="Selecione explicitamente os módulos permitidos.",
    )

    class Meta:
        verbose_name = "Perfil"
        verbose_name_plural = "Perfis"

    def __str__(self):
        return f"{self.user.username} ({self.papel})"


class TokenAcessoManager(models.Manager):
    def create(self, **kwargs):
        if "token_hash" not in kwargs:
            token = secrets.token_urlsafe(32)
            kwargs["token_hash"] = TokenAcesso.calcular_hash(token)
            kwargs["token_prefixo"] = token[:12]
            registro = super().create(**kwargs)
            # Compatibilidade de código em memória; o valor nunca é persistido.
            registro.token = token
            return registro
        return super().create(**kwargs)


class TokenAcesso(models.Model):
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    token_prefixo = models.CharField(max_length=12, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens_acesso")
    municipio = models.ForeignKey(
        Municipio, on_delete=models.CASCADE, related_name="tokens_acesso", null=True, blank=True
    )
    escola = models.ForeignKey(
        Escola, on_delete=models.CASCADE, related_name="tokens_acesso", null=True, blank=True
    )
    papel_rede = models.CharField(max_length=16, choices=VinculoUsuario.PAPEL_CHOICES, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()
    objects = TokenAcessoManager()

    class Meta:
        verbose_name = "Token de acesso"
        verbose_name_plural = "Tokens de acesso"

    def __str__(self):
        return f"{self.user.username} · {self.token_prefixo}…"

    @staticmethod
    def calcular_hash(token):
        return hashlib.sha256(str(token).encode("utf-8")).hexdigest()

    @classmethod
    def emitir(
        cls,
        *,
        user,
        expira_em,
        municipio=None,
        escola=None,
        papel_rede="",
    ):
        token = secrets.token_urlsafe(32)
        registro = cls.objects.create(
            token_hash=cls.calcular_hash(token),
            token_prefixo=token[:12],
            user=user,
            expira_em=expira_em,
            municipio=municipio,
            escola=escola,
            papel_rede=papel_rede,
        )
        return registro, token

    @property
    def expirado(self):
        return timezone.now() > self.expira_em


class RegistroAuditoria(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registros_auditoria",
    )
    escola = models.ForeignKey(
        Escola,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registros_auditoria",
    )
    acao = models.CharField(max_length=40)
    recurso = models.CharField(max_length=80)
    objeto_id = models.CharField(max_length=80, blank=True)
    detalhes = models.JSONField(default=dict, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Registro de auditoria"
        verbose_name_plural = "Registros de auditoria"

    def __str__(self):
        return f"{self.criado_em:%Y-%m-%d %H:%M} · {self.acao} · {self.recurso}"
