from django.contrib import admin

from .models import Escola, Modulo, Municipio, Perfil, RegistroAuditoria, TokenAcesso, VinculoUsuario


@admin.register(Municipio)
class MunicipioAdmin(admin.ModelAdmin):
    list_display = ("nome", "uf", "codigo_ibge", "ativo")
    search_fields = ("nome", "codigo_ibge")
    list_filter = ("uf", "ativo")


@admin.register(Escola)
class EscolaAdmin(admin.ModelAdmin):
    list_display = ("nome", "municipio", "codigo_inep", "ativa")
    search_fields = ("nome", "codigo_inep")
    list_filter = ("municipio", "ativa")


@admin.register(VinculoUsuario)
class VinculoUsuarioAdmin(admin.ModelAdmin):
    list_display = ("user", "papel", "municipio", "escola", "ativo")
    list_filter = ("papel", "municipio", "escola", "ativo")
    search_fields = ("user__username", "escola__nome", "municipio__nome")


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
    list_display = ("user", "municipio", "escola", "papel_rede", "token_prefixo", "criado_em", "expira_em")
    readonly_fields = ("user", "municipio", "escola", "papel_rede", "token_hash", "token_prefixo", "criado_em", "expira_em")
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
