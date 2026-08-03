from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Modulo, Perfil


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
