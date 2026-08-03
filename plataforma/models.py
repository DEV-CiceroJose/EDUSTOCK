import hashlib
import secrets

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


class Perfil(models.Model):
    ADMIN = "ADMIN"
    OPERADOR = "OPERADOR"
    PAPEL_CHOICES = [(ADMIN, "Administrador"), (OPERADOR, "Operador")]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="perfil")
    matricula = models.CharField(max_length=50, unique=True, null=True, blank=True)
    papel = models.CharField(max_length=10, choices=PAPEL_CHOICES, default=OPERADOR)
    modulos = models.ManyToManyField(
        Modulo,
        blank=True,
        related_name="perfis_autorizados",
        help_text="Vazio mantém acesso a todos os módulos ativos para compatibilidade.",
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
    def emitir(cls, *, user, expira_em):
        token = secrets.token_urlsafe(32)
        registro = cls.objects.create(
            token_hash=cls.calcular_hash(token),
            token_prefixo=token[:12],
            user=user,
            expira_em=expira_em,
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
