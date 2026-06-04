from rest_framework import serializers
from .models import Produto, Categoria, Grupo, BemPermanente, Fornecedor, Entrada, Movimentacao


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "name"]


class ProdutoSerializer(serializers.ModelSerializer):
    grupo_nome = serializers.CharField(source="grupo.nome", read_only=True)
    categoria = serializers.IntegerField(source="grupo.categoria_id", read_only=True)
    categoria_nome = serializers.CharField(source="grupo.categoria.name", read_only=True)
    criado_por_nome = serializers.CharField(source="criado_por.username", read_only=True)
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True, allow_null=True, default=None)

    class Meta:
        model = Produto
        fields = [
            "id", "nome", "numero_nota_fiscal",
            "grupo", "grupo_nome", "fornecedor", "fornecedor_nome",
            "categoria", "categoria_nome",
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


class MovimentacaoSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)

    class Meta:
        model = Movimentacao
        fields = [
            "id", "produto", "produto_nome", "tipo", "quantidade",
            "preco_unitario", "entrada", "motivo", "data", "criado_em",
        ]
        read_only_fields = ["entrada", "criado_em"]


class EntradaItemSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)

    class Meta:
        model = Movimentacao
        fields = ["produto", "produto_nome", "quantidade", "preco_unitario"]


class EntradaSerializer(serializers.ModelSerializer):
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True, allow_null=True, default=None)
    itens = EntradaItemSerializer(many=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = Entrada
        fields = [
            "id", "fornecedor", "fornecedor_nome", "numero_nota_fiscal",
            "data", "observacao", "itens", "total", "criado_em",
        ]
        read_only_fields = ["criado_em"]

    def get_total(self, obj):
        return str(obj.total)

    def create(self, validated_data):
        from .services import registrar_entrada
        itens = validated_data.pop("itens")
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None
        return registrar_entrada(
            fornecedor=validated_data.get("fornecedor"),
            numero_nota_fiscal=validated_data.get("numero_nota_fiscal", ""),
            data=validated_data.get("data"),
            observacao=validated_data.get("observacao", ""),
            itens=itens, user=user,
        )
