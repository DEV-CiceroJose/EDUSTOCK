from django.contrib import admin
from .models import Categoria, Produto


# 🔹 Categoria
@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)
    ordering = ('name',)


# 🔹 Produto
@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    
    # 📋 Colunas exibidas na lista
    list_display = (
        'nome',
        'numero_nota_fiscal',
        'grupo',
        'quantidade',
        'unidade',
        'validade',
        'preco',
        'criado_por',
        'atualizado_por',
        'atualizado_em'
    )

    # 🔍 Filtros laterais
    list_filter = (
        'grupo',
        'numero_nota_fiscal',
        'unidade',
        'validade',
        'criado_em',
    )

    # 🔎 Campo de busca
    search_fields = ('nome',)

    # 📑 Ordenação padrão
    ordering = ('nome',)

    # 🧾 Campos somente leitura (auditoria)
    readonly_fields = (
        'criado_por',
        'atualizado_por',
        'criado_em',
        'atualizado_em',
    )

    # 🧩 Organização dos campos no formulário
    fieldsets = (
        ('Informações do Produto', {
            'fields': ('nome', 'numero_nota_fiscal', 'grupo', 'quantidade', 'unidade')
        }),
        ('Detalhes', {
            'fields': ('validade', 'preco')
        }),
        ('Auditoria', {
            'fields': ('criado_por', 'atualizado_por', 'criado_em', 'atualizado_em')
        }),
    )

    # 🔥 Preencher automaticamente usuário logado
    def save_model(self, request, obj, form, change):
        if not obj.criado_por:
            obj.criado_por = request.user
        obj.atualizado_por = request.user
        super().save_model(request, obj, form, change)