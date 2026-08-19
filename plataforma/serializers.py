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
        fields = ["id", "username", "password", "is_active", "papel", "modulos"]

    def validate(self, attrs):
        perfil_data = attrs.get("perfil", {})
        if self.instance is None and perfil_data.get("papel") == Perfil.OPERADOR:
            if not perfil_data.get("modulos"):
                raise serializers.ValidationError(
                    {"modulos": "Selecione ao menos um módulo para o novo operador."}
                )
        if self.instance is not None and "password" in attrs:
            raise serializers.ValidationError(
                {"password": "Use a ação de redefinição de senha."}
            )
        return attrs

    def create(self, validated_data):
        perfil_data = validated_data.pop("perfil")
        papel = perfil_data["papel"]
        modulos = perfil_data.get("modulos", [])
        # password é required=False: se omitido, create_user recebe None e
        # define uma senha inutilizável (conta criada pelo admin que definirá
        # a própria senha depois), em vez de levantar KeyError → HTTP 500.
        password = validated_data.pop("password", None)
        user = User.objects.create_user(password=password, **validated_data)
        perfil = Perfil.objects.create(user=user, papel=papel)
        if modulos:
            perfil.modulos.set(modulos)
        return user

    def update(self, instance, validated_data):
        papel_data = validated_data.pop("perfil", None)
        validated_data.pop("password", None)
        for atributo, valor in validated_data.items():
            setattr(instance, atributo, valor)
        if validated_data:
            instance.save(update_fields=list(validated_data.keys()))
        if papel_data:
            perfil = instance.perfil
            if "papel" in papel_data:
                perfil.papel = papel_data["papel"]
                perfil.save(update_fields=["papel"])
            if "modulos" in papel_data:
                perfil.modulos.set(papel_data["modulos"])
                if perfil.acesso_legado:
                    perfil.acesso_legado = False
                    perfil.save(update_fields=["acesso_legado"])
        return instance
