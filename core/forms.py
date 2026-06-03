from django import forms
from .models import Produto, Categoria

class DateInputBR(forms.DateInput):
    input_type = 'date'
    format = '%Y-%m-%d'  # HTML5 usa esse formato internamente


class ProdutoForm(forms.ModelForm):
    class Meta:
        model = Produto
        fields = [
            'nome',
            'numero_nota_fiscal',
            'categoria',
            'quantidade',
            'unidade',
            'validade',
            'preco'
        ]
        widgets = {
            'validade': DateInputBR(attrs={'class': 'form-control'}),
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'numero_nota_fiscal': forms.TextInput(attrs={'class': 'form-control'}),
            'categoria': forms.Select(attrs={'class': 'form-control'}),
            'quantidade': forms.NumberInput(attrs={'class': 'form-control'}),
            'unidade': forms.Select(attrs={'class': 'form-control'}),
            'preco': forms.NumberInput(attrs={'class': 'form-control'}),
        }
        labels = {
            'validade': 'Validade (dd/mm/aaaa)',
        }

    # 🔥 Aceitar formato brasileiro
    def clean_validade(self):
        data = self.cleaned_data.get('validade')
        return data


class CategoriaForm(forms.ModelForm):
    class Meta:
        model = Categoria
        fields = ['name']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
        }