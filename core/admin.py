from django.contrib import admin
from django import forms
from .models import Categoria, PinAcesso, Produto, Turma


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
        fields = ("papel", "turma", "novo_pin", "titular", "ativo")

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
        if PinAcesso.objects.exclude(pk=self.instance.pk).filter(
            pin_fingerprint=fingerprint
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


# 🔹 PinAcesso Inline
class PinAcessoInline(admin.TabularInline):
    model = PinAcesso
    form = PinAcessoForm
    extra = 3
    fields = ("novo_pin", "titular", "ativo")


# 🔹 Turma
@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display = ("nome", "curso", "ano", "turno", "ativo")
    list_filter = ("curso", "turno", "ativo")
    ordering = ("curso", "ano", "nome")
    inlines = [PinAcessoInline]


# 🔹 PinAcesso
@admin.register(PinAcesso)
class PinAcessoAdmin(admin.ModelAdmin):
    form = PinAcessoForm
    list_display = ("identificacao", "papel", "turma", "titular", "ativo")
    list_filter = ("papel", "ativo")
    search_fields = ("titular", "turma__nome")

    @admin.display(description="Acesso")
    def identificacao(self, obj):
        return str(obj)
