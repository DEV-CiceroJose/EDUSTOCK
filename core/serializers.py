from decimal import Decimal

from django.utils import timezone
from django.db import transaction
from rest_framework import serializers
from plataforma.permissions import escola_do_request, slugs_modulos_do_usuario

from .models import (
    BemPermanente,
    Cardapio,
    Categoria,
    Entrada,
    Fornecedor,
    Grupo,
    LoteEstoque,
    Movimentacao,
    OperacaoBaixaProducao,
    Produto,
    Receita,
    ReceitaIngrediente,
)


class CamposFinanceirosProtegidosMixin:
    campos_financeiros = ()

    def pode_ver_financeiro(self):
        request = self.context.get("request")
        return bool(
            request
            and request.user
            and request.user.is_authenticated
            and "financeiro" in slugs_modulos_do_usuario(request.user)
        )

    def get_fields(self):
        fields = super().get_fields()
        if not self.pode_ver_financeiro():
            for campo in self.campos_financeiros:
                fields.pop(campo, None)
        return fields


class BaixaProducaoItemSerializer(serializers.Serializer):
    produto_id = serializers.IntegerField(min_value=1)
    quantidade_override = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        min_value=Decimal("0.001"),
        required=False,
    )

    def validate(self, attrs):
        campos_extras = set(self.initial_data) - {"produto_id", "quantidade_override"}
        if campos_extras:
            raise serializers.ValidationError(
                f"Campos não reconhecidos: {', '.join(sorted(campos_extras))}."
            )
        return attrs


class BaixaProducaoRequestSerializer(serializers.Serializer):
    operacao_id = serializers.UUIDField()
    data = serializers.DateField(default=timezone.localdate)
    refeicao = serializers.ChoiceField(choices=OperacaoBaixaProducao.REFEICAO_CHOICES)
    itens = BaixaProducaoItemSerializer(many=True, required=False)

    def validate_data(self, value):
        if value != timezone.localdate():
            raise serializers.ValidationError(
                "A baixa de produção só pode ser registrada na data atual."
            )
        return value

    def validate(self, attrs):
        campos_extras = set(self.initial_data) - {"operacao_id", "data", "refeicao", "itens"}
        if campos_extras:
            raise serializers.ValidationError({
                "campos": f"Campos não reconhecidos: {', '.join(sorted(campos_extras))}."
            })

        ids = [item["produto_id"] for item in attrs.get("itens", [])]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError({
                "itens": "Cada produto pode aparecer apenas uma vez."
            })
        return attrs


class ConsultaBaixaProducaoSerializer(serializers.Serializer):
    operacao_id = serializers.UUIDField()


class PlanoProducaoQuerySerializer(serializers.Serializer):
    data = serializers.DateField(default=timezone.localdate)
    refeicao = serializers.ChoiceField(choices=OperacaoBaixaProducao.REFEICAO_CHOICES)


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "name"]


class ProdutoSerializer(CamposFinanceirosProtegidosMixin, serializers.ModelSerializer):
    campos_financeiros = ("ultimo_preco",)
    grupo_nome = serializers.CharField(source="grupo.nome", read_only=True)
    categoria = serializers.IntegerField(source="grupo.categoria_id", read_only=True)
    categoria_nome = serializers.CharField(source="grupo.categoria.name", read_only=True)
    criado_por_nome = serializers.CharField(source="criado_por.username", read_only=True)
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True, allow_null=True, default=None)
    ultimo_preco = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True, allow_null=True
    )

    class Meta:
        model = Produto
        fields = [
            "id", "nome",
            "grupo", "grupo_nome", "fornecedor", "fornecedor_nome",
            "categoria", "categoria_nome",
            "quantidade", "unidade", "estoque_minimo", "perecivel", "periodicidade",
            "validade", "ultimo_preco",
            "criado_por_nome", "criado_em", "atualizado_em",
        ]
        read_only_fields = ["quantidade", "criado_por_nome", "criado_em", "atualizado_em"]

    def validate(self, attrs):
        escola = escola_do_request(self.context.get("request"))
        grupo = attrs.get("grupo", getattr(self.instance, "grupo", None))
        fornecedor = attrs.get("fornecedor", getattr(self.instance, "fornecedor", None))
        if escola and grupo and grupo.escola_id != escola.pk:
            raise serializers.ValidationError({"grupo": "Grupo não pertence à escola autenticada."})
        if escola and fornecedor and fornecedor.escola_id != escola.pk:
            raise serializers.ValidationError({"fornecedor": "Fornecedor não pertence à escola autenticada."})
        return attrs


class GrupoSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.name", read_only=True)

    class Meta:
        model = Grupo
        fields = ["id", "nome", "categoria", "categoria_nome"]

    def validate_categoria(self, categoria):
        escola = escola_do_request(self.context.get("request"))
        if escola and categoria.escola_id != escola.pk:
            raise serializers.ValidationError("Categoria não pertence à escola autenticada.")
        return categoria


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


class MovimentacaoSerializer(CamposFinanceirosProtegidosMixin, serializers.ModelSerializer):
    campos_financeiros = ("preco_unitario",)
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)

    class Meta:
        model = Movimentacao
        fields = [
            "id", "produto", "produto_nome", "tipo", "quantidade",
            "preco_unitario", "entrada", "motivo", "data", "criado_em",
        ]
        read_only_fields = ["entrada", "criado_em"]

    def validate_produto(self, produto):
        escola = escola_do_request(self.context.get("request"))
        if escola and produto.escola_id != escola.pk:
            raise serializers.ValidationError("Produto não pertence à escola autenticada.")
        return produto


class EntradaItemSerializer(CamposFinanceirosProtegidosMixin, serializers.ModelSerializer):
    campos_financeiros = ("preco_unitario",)
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)
    codigo_lote = serializers.CharField(max_length=80, required=False, allow_blank=True)
    validade = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Movimentacao
        fields = [
            "produto", "produto_nome", "quantidade", "preco_unitario",
            "codigo_lote", "validade",
        ]

    def validate_produto(self, produto):
        request = self.context.get("request") or self.parent.context.get("request")
        escola = escola_do_request(request)
        if escola and produto.escola_id != escola.pk:
            raise serializers.ValidationError("Produto não pertence à escola autenticada.")
        return produto


class EntradaSerializer(CamposFinanceirosProtegidosMixin, serializers.ModelSerializer):
    campos_financeiros = ("total",)
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
        from decimal import Decimal, ROUND_HALF_UP
        return str(obj.total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

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
            itens=itens, user=user, escola=escola_do_request(request),
        )


class LoteEstoqueSerializer(CamposFinanceirosProtegidosMixin, serializers.ModelSerializer):
    campos_financeiros = ("preco_unitario",)
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)

    class Meta:
        model = LoteEstoque
        fields = [
            "id", "produto", "produto_nome", "entrada", "codigo", "validade",
            "quantidade", "preco_unitario", "criado_em",
        ]


class ReceitaIngredienteSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source="produto.nome", read_only=True)

    class Meta:
        model = ReceitaIngrediente
        fields = ["id", "produto", "produto_nome", "gramas_por_aluno"]


class ReceitaSerializer(serializers.ModelSerializer):
    ingredientes = ReceitaIngredienteSerializer(many=True, required=False)

    class Meta:
        model = Receita
        fields = ["id", "nome", "refeicao", "ativa", "observacao", "ingredientes"]

    def validate_ingredientes(self, ingredientes):
        escola = escola_do_request(self.context.get("request"))
        ids = []
        for item in ingredientes:
            produto = item["produto"]
            if escola and produto.escola_id != escola.pk:
                raise serializers.ValidationError("Todos os produtos devem pertencer à escola autenticada.")
            ids.append(produto.pk)
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Cada produto pode aparecer apenas uma vez.")
        return ingredientes

    @transaction.atomic
    def create(self, validated_data):
        ingredientes = validated_data.pop("ingredientes", [])
        receita = Receita.objects.create(**validated_data)
        ReceitaIngrediente.objects.bulk_create(
            [ReceitaIngrediente(receita=receita, **item) for item in ingredientes]
        )
        return receita

    @transaction.atomic
    def update(self, instance, validated_data):
        ingredientes = validated_data.pop("ingredientes", None)
        instance = super().update(instance, validated_data)
        if ingredientes is not None:
            instance.ingredientes.all().delete()
            ReceitaIngrediente.objects.bulk_create(
                [ReceitaIngrediente(receita=instance, **item) for item in ingredientes]
            )
        return instance


class CardapioSerializer(serializers.ModelSerializer):
    receita_nome = serializers.CharField(source="receita.nome", read_only=True)

    class Meta:
        model = Cardapio
        fields = ["id", "data", "refeicao", "receita", "receita_nome", "observacao"]

    def validate(self, attrs):
        receita = attrs.get("receita", getattr(self.instance, "receita", None))
        refeicao = attrs.get("refeicao", getattr(self.instance, "refeicao", None))
        if receita and refeicao and receita.refeicao != refeicao:
            raise serializers.ValidationError({"receita": "A receita deve pertencer à mesma refeição."})
        escola = escola_do_request(self.context.get("request"))
        if escola and receita and receita.escola_id != escola.pk:
            raise serializers.ValidationError({"receita": "Receita não pertence à escola autenticada."})
        return attrs
