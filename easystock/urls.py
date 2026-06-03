"""
URL configuration for easystock project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from core import views


urlpatterns = [
    path("admin/", admin.site.urls),

    # 🔌 API REST (consumida pelo frontend React)
    path("api/", include("core.api_urls")),

     # 📦 Produtos
    path('produtos/', views.lista_produtos, name='lista_produtos'),
    path('produtos/novo/', views.criar_produto, name='criar_produto'),
    path('produtos/<int:id>/editar/', views.editar_produto, name='editar_produto'),
    path('produtos/<int:id>/deletar/', views.deletar_produto, name='deletar_produto'),

    # 🗂️ Categorias
    path('categorias/', views.lista_categorias, name='lista_categorias'),
    path('categorias/nova/', views.criar_categoria, name='criar_categoria'),
]
