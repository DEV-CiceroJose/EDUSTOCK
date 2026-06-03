from django.shortcuts import render, get_object_or_404, redirect
from .models import Produto, Categoria
from .forms import ProdutoForm, CategoriaForm
from django.contrib.auth.decorators import login_required


# 🔍 LISTAR + PESQUISAR PRODUTOS
#@login_required
def lista_produtos(request):
    busca = request.GET.get('q')

    produtos = Produto.objects.all()

    if busca:
        produtos = produtos.filter(nome__icontains=busca)

    return render(request, 'produtos/lista.html', {
        'produtos': produtos
    })


# ➕ CRIAR PRODUTO
#@login_required
def criar_produto(request):
    form = ProdutoForm(request.POST or None)

    if form.is_valid():
        produto = form.save(commit=False)
        produto.criado_por = request.user
        produto.atualizado_por = request.user
        produto.save()
        return redirect('lista_produtos')

    return render(request, 'produtos/form.html', {'form': form})


# ✏️ EDITAR PRODUTO
#@login_required
def editar_produto(request, id):
    produto = get_object_or_404(Produto, id=id)
    form = ProdutoForm(request.POST or None, instance=produto)

    if form.is_valid():
        produto = form.save(commit=False)
        produto.atualizado_por = request.user
        produto.save()
        return redirect('lista_produtos')

    return render(request, 'produtos/form.html', {'form': form})


# ❌ DELETAR PRODUTO
#@login_required
def deletar_produto(request, id):
    produto = get_object_or_404(Produto, id=id)

    if request.method == 'POST':
        produto.delete()
        return redirect('lista_produtos')

    return render(request, 'produtos/confirmar_delete.html', {'produto': produto})


# 🗂️ CATEGORIAS

#@login_required
def lista_categorias(request):
    categorias = Categoria.objects.all()
    return render(request, 'categorias/lista.html', {'categorias': categorias})


#@login_required
def criar_categoria(request):
    form = CategoriaForm(request.POST or None)

    if form.is_valid():
        form.save()
        return redirect('lista_categorias')

    return render(request, 'categorias/form.html', {'form': form})