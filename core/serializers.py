from rest_framework import serializers
from .models import Produto, Categoria


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "name"]


class ProdutoSerializer(serializers.ModelSerializer):
    # Campos de leitura que o frontend React consome
    categoria_nome = serializers.CharField(source="categoria.name", read_only=True)
    criado_por_nome = serializers.CharField(source="criado_por.username", read_only=True)

    class Meta:
        model = Produto
        fields = [
            "id",
            "nome",
            "numero_nota_fiscal",
            "categoria",
            "categoria_nome",
            "quantidade",
            "unidade",
            "validade",
            "preco",
            "criado_por_nome",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_por_nome", "criado_em", "atualizado_em"]
