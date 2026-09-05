from django.contrib import admin
from django import forms
from .models import (
    BemPermanente,
    Cardapio,
    CardapioModeloMunicipal,
    CatalogoProdutoMunicipal,
    Categoria,
    ConfiguracaoAlertas,
    ContagemEstoque,
    Entrada,
    FatorConsumo,
    Fornecedor,
    FrequenciaDiaria,
    Grupo,
    LoteEstoque,
    Movimentacao,
    OperacaoBaixaProducao,
    PinAcesso,
    Produto,
    Receita,
    ReceitaIngrediente,
    RegistroRefeicao,
    Turma,
)


@admin.register(ContagemEstoque)
class ContagemEstoqueAdmin(admin.ModelAdmin):
    list_display = ("data", "escola", "produto", "quantidade_sistema", "quantidade_fisica", "divergencia")
    list_filter = ("escola", "data")
    search_fields = ("produto__nome",)
    readonly_fields = ("escola", "produto", "data", "quantidade_sistema", "quantidade_fisica", "observacao", "criado_por", "criado_em")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CatalogoProdutoMunicipal)
class CatalogoProdutoMunicipalAdmin(admin.ModelAdmin):
    list_display = ("nome", "municipio", "categoria", "grupo", "unidade", "ativo")
    list_filter = ("municipio", "categoria", "ativo")
    search_fields = ("nome", "categoria", "grupo")


@admin.register(CardapioModeloMunicipal)
class CardapioModeloMunicipalAdmin(admin.ModelAdmin):
    list_display = ("nome", "municipio", "refeicao", "ativo")
    list_filter = ("municipio", "refeicao", "ativo")


@admin.register(RegistroRefeicao)
class RegistroRefeicaoAdmin(admin.ModelAdmin):
    list_display = ("data", "escola", "refeicao", "porcoes_planejadas", "porcoes_produzidas", "porcoes_servidas", "descarte_kg")
    list_filter = ("escola", "refeicao", "fonte", "cardapio_atendido")
    date_hierarchy = "data"


class PinAcessoForm(forms.ModelForm):
    novo_pin = forms.CharField(
        label="PIN",
        min_length=4,
        max_length=4,
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Informe 4 dígitos. Por segurança, o PIN atual não é exibido.",
    )

    class Meta:
        model = PinAcesso
        fields = ("escola", "papel", "turma", "novo_pin", "titular", "ativo")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["novo_pin"].required = not bool(self.instance.pk)

    def clean_novo_pin(self):
        pin = (self.cleaned_data.get("novo_pin") or "").strip()
        if not pin and self.instance.pk:
            return ""
        if not (len(pin) == 4 and pin.isdigit()):
            raise forms.ValidationError("PIN deve ter exatamente 4 dígitos.")
        fingerprint = PinAcesso.gerar_fingerprint(pin)
        escola = self.cleaned_data.get("escola") or self.instance.escola
        if PinAcesso.objects.exclude(pk=self.instance.pk).filter(
            escola=escola, pin_fingerprint=fingerprint
        ).exists():
            raise forms.ValidationError("Este PIN já está em uso.")
        return pin

    def save(self, commit=True):
        obj = super().save(commit=False)
        novo_pin = self.cleaned_data.get("novo_pin")
        if novo_pin:
            obj.definir_pin(novo_pin)
        if commit:
            obj.save()
            self.save_m2m()
        return obj


# 🔹 Categoria
@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('id', 'escola', 'name')
    list_filter = ('escola',)
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Grupo)
class GrupoAdmin(admin.ModelAdmin):
    list_display = ("nome", "escola", "categoria")
    list_filter = ("escola", "categoria",)
    search_fields = ("nome", "categoria__name")
    ordering = ("categoria__name", "nome")


# 🔹 Produto
@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    
    # 📋 Colunas exibidas na lista
    list_display = (
        'nome',
        'escola',
        'grupo',
        'quantidade',
        'unidade',
        'unidade_consumo',
        'conteudo_por_unidade',
        'validade',
        'criado_por',
        'atualizado_por',
        'atualizado_em'
    )

    # 🔍 Filtros laterais
    list_filter = (
        'escola',
        'grupo',
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
        'quantidade',
        'validade',
        'criado_por',
        'atualizado_por',
        'criado_em',
        'atualizado_em',
    )

    # 🧩 Organização dos campos no formulário
    fieldsets = (
        ('Informações do Produto', {
            'fields': (
                'escola', 'nome', 'grupo', 'fornecedor', 'quantidade', 'unidade',
                'unidade_consumo', 'conteudo_por_unidade',
            )
        }),
        ('Detalhes', {
            'fields': ('estoque_minimo', 'perecivel', 'periodicidade', 'validade')
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


@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "escola",
        "documento",
        "telefone",
        "emite_nota_fiscal",
        "aceita_fiado",
        "ativo",
    )
    list_filter = ("escola", "ativo", "emite_nota_fiscal", "aceita_fiado")
    search_fields = ("nome", "documento", "email", "telefone")
    ordering = ("nome",)


@admin.register(BemPermanente)
class BemPermanenteAdmin(admin.ModelAdmin):
    list_display = (
        "nome",
        "numero_patrimonio",
        "localizacao",
        "responsavel",
        "estado_conservacao",
    )
    list_filter = ("estado_conservacao", "localizacao")
    search_fields = ("nome", "numero_patrimonio", "responsavel", "localizacao")
    readonly_fields = ("criado_por", "atualizado_por", "criado_em", "atualizado_em")

    def save_model(self, request, obj, form, change):
        if not obj.criado_por:
            obj.criado_por = request.user
        obj.atualizado_por = request.user
        super().save_model(request, obj, form, change)


class RegistroEstoqueSomenteLeituraAdmin(admin.ModelAdmin):
    """Ledger financeiro/estoque deve ser consultado, nunca editado no admin."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Entrada)
class EntradaAdmin(RegistroEstoqueSomenteLeituraAdmin):
    list_display = (
        "id",
        "data",
        "fornecedor",
        "numero_nota_fiscal",
        "total",
        "criado_por",
    )
    list_filter = ("data", "fornecedor")
    search_fields = ("numero_nota_fiscal", "fornecedor__nome")
    date_hierarchy = "data"


@admin.register(Movimentacao)
class MovimentacaoAdmin(RegistroEstoqueSomenteLeituraAdmin):
    list_display = (
        "id",
        "data",
        "tipo",
        "produto",
        "quantidade",
        "preco_unitario",
        "motivo",
        "criado_por",
    )
    list_filter = ("tipo", "data", "produto__grupo__categoria")
    search_fields = ("produto__nome", "motivo", "entrada__numero_nota_fiscal")
    date_hierarchy = "data"


@admin.register(FrequenciaDiaria)
class FrequenciaDiariaAdmin(admin.ModelAdmin):
    list_display = (
        "data",
        "escola",
        "turno",
        "turma",
        "quantidade_alunos",
        "registrado_por_turma",
        "registrado_por",
    )
    list_filter = ("escola", "turno", "data")
    search_fields = ("turma", "registrado_por_turma")
    date_hierarchy = "data"


@admin.register(FatorConsumo)
class FatorConsumoAdmin(admin.ModelAdmin):
    list_display = ("produto", "quantidade_por_aluno", "ativo")
    list_filter = ("ativo", "produto__grupo__categoria")
    search_fields = ("produto__nome",)
    autocomplete_fields = ("produto",)


class ReceitaIngredienteInline(admin.TabularInline):
    model = ReceitaIngrediente
    extra = 1
    autocomplete_fields = ("produto",)


@admin.register(Receita)
class ReceitaAdmin(admin.ModelAdmin):
    list_display = ("nome", "escola", "refeicao", "ativa")
    list_filter = ("escola", "refeicao", "ativa")
    search_fields = ("nome",)
    inlines = (ReceitaIngredienteInline,)


@admin.register(Cardapio)
class CardapioAdmin(admin.ModelAdmin):
    list_display = ("data", "escola", "refeicao", "receita")
    list_filter = ("escola", "refeicao", "data")
    date_hierarchy = "data"
    autocomplete_fields = ("receita",)


@admin.register(LoteEstoque)
class LoteEstoqueAdmin(admin.ModelAdmin):
    list_display = ("codigo", "produto", "validade", "quantidade", "entrada")
    list_filter = ("validade", "produto__grupo__categoria")
    search_fields = ("codigo", "produto__nome", "entrada__numero_nota_fiscal")
    readonly_fields = ("produto", "entrada", "codigo", "validade", "quantidade", "preco_unitario", "criado_em")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(OperacaoBaixaProducao)
class OperacaoBaixaProducaoAdmin(admin.ModelAdmin):
    list_display = ("operacao_id", "data", "refeicao", "status", "criado_em")
    list_filter = ("status", "refeicao", "data")
    search_fields = ("operacao_id",)
    readonly_fields = (
        "operacao_id",
        "data",
        "refeicao",
        "itens_solicitados",
        "status",
        "resultado",
        "criado_em",
        "atualizado_em",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# 🔹 PinAcesso Inline
class PinAcessoInline(admin.TabularInline):
    model = PinAcesso
    form = PinAcessoForm
    extra = 3
    fields = ("novo_pin", "titular", "ativo")


# 🔹 Turma
@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display = ("nome", "escola", "curso", "ano", "turno", "ativo")
    list_filter = ("escola", "curso", "turno", "ativo")
    ordering = ("curso", "ano", "nome")
    inlines = [PinAcessoInline]


# 🔹 PinAcesso
@admin.register(PinAcesso)
class PinAcessoAdmin(admin.ModelAdmin):
    form = PinAcessoForm
    list_display = ("identificacao", "escola", "papel", "turma", "titular", "ativo")
    list_filter = ("escola", "papel", "ativo")
    search_fields = ("titular", "turma__nome")

    @admin.display(description="Acesso")
    def identificacao(self, obj):
        return str(obj)


@admin.register(ConfiguracaoAlertas)
class ConfiguracaoAlertasAdmin(admin.ModelAdmin):
    fieldsets = (
        ("Escola", {"fields": ("escola",)}),
        ("Validade", {"fields": ("critico_dias", "alerta_dias")}),
        ("Estoque", {"fields": ("estoque_percentual",)}),
        ("Auditoria", {"fields": ("atualizado_em",)}),
    )
    readonly_fields = ("atualizado_em",)

    def has_add_permission(self, request):
        return True

    def has_delete_permission(self, request, obj=None):
        return False
