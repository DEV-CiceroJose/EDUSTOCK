"""Popula o banco com dados de exemplo (idempotente). Rode: python manage.py shell < seed_demo.py"""
from datetime import date, timedelta
from core.models import Categoria, Produto

hoje = date.today()
def d(n): return hoje + timedelta(days=n)

cats = {n: Categoria.objects.get_or_create(name=n)[0] for n in [
    "Material de Limpeza", "Gêneros Alimentícios", "Material de Escritório", "Higiene",
]}

itens = [
    ("Arroz Branco Tipo 1", "NF-00231", "Gêneros Alimentícios", 48, "KG", d(95), "5.40"),
    ("Feijão Carioca", "NF-00231", "Gêneros Alimentícios", 30, "KG", d(20), "8.20"),
    ("Detergente Neutro", "NF-00198", "Material de Limpeza", 64, "UN", d(310), "2.15"),
    ("Água Sanitária 5L", "NF-00198", "Material de Limpeza", 12, "CX", d(8), "14.90"),
    ("Resma Papel A4", "NF-00210", "Material de Escritório", 25, "PC", None, "23.00"),
    ("Óleo de Soja 900ml", "NF-00231", "Gêneros Alimentícios", 40, "UN", d(-3), "6.75"),
    ("Sabonete Líquido", "NF-00255", "Higiene", 18, "L", d(140), "11.30"),
    ("Caneta Esferográfica Azul", "NF-00210", "Material de Escritório", 200, "UN", None, "0.90"),
]
for nome, nf, cat, qtd, un, val, preco in itens:
    Produto.objects.get_or_create(
        nome=nome,
        defaults=dict(numero_nota_fiscal=nf, categoria=cats[cat], quantidade=qtd,
                      unidade=un, validade=val, preco=preco),
    )
print("Categorias:", Categoria.objects.count(), "| Produtos:", Produto.objects.count())
