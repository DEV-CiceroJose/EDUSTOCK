from django.contrib import admin

from .models import Modulo, Perfil, RegistroAuditoria, TokenAcesso


@admin.register(Modulo)
class ModuloAdmin(admin.ModelAdmin):
    list_display = ("nome", "slug", "ativo", "depende_de")
    list_filter = ("ativo",)
    search_fields = ("nome", "slug")


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ("user", "papel", "matricula")
    list_filter = ("papel",)
    filter_horizontal = ("modulos",)
    search_fields = ("user__username", "matricula")


@admin.register(TokenAcesso)
class TokenAcessoAdmin(admin.ModelAdmin):
    list_display = ("user", "token_prefixo", "criado_em", "expira_em")
    readonly_fields = ("user", "token_hash", "token_prefixo", "criado_em", "expira_em")
    search_fields = ("user__username", "token_prefixo")

    def has_add_permission(self, request):
        return False


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    list_display = ("criado_em", "user", "acao", "recurso", "objeto_id")
    list_filter = ("acao", "recurso", "criado_em")
    search_fields = ("user__username", "recurso", "objeto_id")
    readonly_fields = ("user", "acao", "recurso", "objeto_id", "detalhes", "criado_em")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
