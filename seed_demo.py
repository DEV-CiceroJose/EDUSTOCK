"""Popula o banco com dados de exemplo (idempotente). Rode: python manage.py shell < seed_demo.py"""
from datetime import date, timedelta
from core.models import Categoria, Grupo, Produto

hoje = date.today()
def d(n): return hoje + timedelta(days=n)

cats = {n: Categoria.objects.get_or_create(name=n)[0] for n in [
    "Material de Limpeza", "Gêneros Alimentícios", "Material de Escritório", "Higiene",
]}
grupos = {n: Grupo.objects.get_or_create(categoria=c, nome="Geral")[0] for n, c in cats.items()}

itens = [
    ("Arroz Branco Tipo 1", "NF-00231", "Gêneros Alimentícios", 48, "KG", d(95), "5.40", 0),
    ("Feijão Carioca", "NF-00231", "Gêneros Alimentícios", 30, "KG", d(20), "8.20", 0),
    ("Detergente Neutro", "NF-00198", "Material de Limpeza", 64, "UN", d(310), "2.15", 0),
    ("Água Sanitária 5L", "NF-00198", "Material de Limpeza", 12, "CX", d(8), "14.90", 0),
    ("Resma Papel A4", "NF-00210", "Material de Escritório", 25, "PC", None, "23.00", 0),
    ("Óleo de Soja 900ml", "NF-00231", "Gêneros Alimentícios", 40, "UN", d(-3), "6.75", 0),
    ("Sabonete Líquido", "NF-00255", "Higiene", 18, "L", d(140), "11.30", 0),
    ("Caneta Esferográfica Azul", "NF-00210", "Material de Escritório", 200, "UN", None, "0.90", 0),
    # estoque_minimo=20 e quantidade abaixo de 20% dele -> dispara alerta de reposição
    ("Álcool em Gel 500ml", "NF-00255", "Higiene", 2, "UN", d(200), "9.50", 20),
]
for nome, nf, cat, qtd, un, val, preco, estoque_minimo in itens:
    Produto.objects.get_or_create(
        nome=nome,
        defaults=dict(numero_nota_fiscal=nf, grupo=grupos[cat], quantidade=qtd,
                      unidade=un, validade=val, preco=preco, estoque_minimo=estoque_minimo),
    )
print("Categorias:", Categoria.objects.count(), "| Grupos:", Grupo.objects.count(), "| Produtos:", Produto.objects.count())
