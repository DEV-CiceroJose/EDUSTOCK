from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Escola, Modulo, Municipio, Perfil, VinculoUsuario


class MunicipioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Municipio
        fields = ["id", "nome", "uf", "slug", "codigo_ibge", "ativo"]


class EscolaSerializer(serializers.ModelSerializer):
    municipio_nome = serializers.CharField(source="municipio.nome", read_only=True)

    class Meta:
        model = Escola
        fields = [
            "id", "municipio", "municipio_nome", "nome", "slug",
            "codigo_inep", "ativa",
        ]


class VinculoUsuarioSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.CharField(source="user.username", read_only=True)
    escola_nome = serializers.CharField(source="escola.nome", read_only=True)
    municipio_nome = serializers.CharField(source="municipio.nome", read_only=True)

    class Meta:
        model = VinculoUsuario
        fields = [
            "id", "user", "usuario_nome", "municipio", "municipio_nome",
            "escola", "escola_nome", "papel", "ativo",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        municipio = getattr(getattr(request, "auth", None), "municipio", None)
        escola = attrs.get("escola", getattr(self.instance, "escola", None))
        if municipio and escola and escola.municipio_id != municipio.pk:
            raise serializers.ValidationError({"escola": "Escola fora do município autorizado."})
        return attrs


class ModuloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modulo
        fields = ["slug", "nome", "descricao", "ativo", "depende_de"]
        extra_kwargs = {"depende_de": {"read_only": True}}


class UsuarioSerializer(serializers.ModelSerializer):
    papel = serializers.ChoiceField(choices=Perfil.PAPEL_CHOICES, source="perfil.papel")
    password = serializers.CharField(write_only=True, required=False)
    modulos = serializers.SlugRelatedField(
        source="perfil.modulos",
        slug_field="slug",
        queryset=Modulo.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model = User
        fields = ["id", "username", "password", "papel", "modulos"]

    def create(self, validated_data):
        perfil_data = validated_data.pop("perfil")
        papel = perfil_data["papel"]
        modulos = perfil_data.get("modulos", [])
        # password é required=False: se omitido, create_user recebe None e
        # define uma senha inutilizável (conta criada pelo admin que definirá
        # a própria senha depois), em vez de levantar KeyError → HTTP 500.
        password = validated_data.pop("password", None)
        user = User.objects.create_user(username=validated_data["username"], password=password)
        perfil = Perfil.objects.create(user=user, papel=papel)
        if modulos:
            perfil.modulos.set(modulos)
        return user

    def update(self, instance, validated_data):
        papel_data = validated_data.pop("perfil", None)
        if papel_data:
            perfil = instance.perfil
            if "papel" in papel_data:
                perfil.papel = papel_data["papel"]
                perfil.save(update_fields=["papel"])
            if "modulos" in papel_data:
                perfil.modulos.set(papel_data["modulos"])
        return instance
