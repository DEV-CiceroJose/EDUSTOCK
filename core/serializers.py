from rest_framework import serializers
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "name"]


class ProdutoSerializer(serializers.ModelSerializer):
    grupo_nome = serializers.CharField(source="grupo.nome", read_only=True)
    categoria = serializers.IntegerField(source="grupo.categoria_id", read_only=True)
    categoria_nome = serializers.CharField(source="grupo.categoria.name", read_only=True)
    criado_por_nome = serializers.CharField(source="criado_por.username", read_only=True)

    class Meta:
        model = Produto
        fields = [
            "id", "nome", "numero_nota_fiscal",
            "grupo", "grupo_nome", "categoria", "categoria_nome",
            "quantidade", "unidade", "estoque_minimo", "perecivel", "periodicidade",
            "validade", "preco",
            "criado_por_nome", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_por_nome", "criado_em", "atualizado_em"]


class GrupoSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.name", read_only=True)

    class Meta:
        model = Grupo
        fields = ["id", "nome", "categoria", "categoria_nome"]


class BemPermanenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = BemPermanente
        fields = [
            "id", "nome", "numero_patrimonio", "localizacao", "responsavel",
            "estado_conservacao", "data_aquisicao", "observacao",
            "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]


class FornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = [
            "id", "nome", "documento", "endereco", "telefone", "email",
            "emite_nota_fiscal", "aceita_fiado", "ativo", "observacao",
            "criado_em", "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]
