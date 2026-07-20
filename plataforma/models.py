import uuid

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

    class Meta:
        verbose_name = "Perfil"
        verbose_name_plural = "Perfis"

    def __str__(self):
        return f"{self.user.username} ({self.papel})"


class TokenAcesso(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens_acesso")
    criado_em = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()

    class Meta:
        verbose_name = "Token de acesso"
        verbose_name_plural = "Tokens de acesso"

    def __str__(self):
        return f"{self.user.username} · {self.token}"

    @property
    def expirado(self):
        return timezone.now() > self.expira_em
