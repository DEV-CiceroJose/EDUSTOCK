from datetime import timedelta
import hashlib

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import BaseThrottle

from .authentication import TokenAcessoAuthentication
from .models import (
    Escola,
    Modulo,
    Municipio,
    Perfil,
    RegistroAuditoria,
    TokenAcesso,
    VinculoUsuario,
    escola_padrao_id,
)
from .permissions import (
    EhAdmin,
    escolas_autorizadas_do_usuario,
    garantir_vinculo_padrao,
    slugs_modulos_do_usuario,
    vinculos_ativos_do_usuario,
    usuarios_administraveis,
)
from .serializers import (
    EscolaSerializer,
    ModuloSerializer,
    MunicipioSerializer,
    UsuarioSerializer,
    VinculoUsuarioSerializer,
)


class LoginView(APIView):
    permission_classes = [AllowAny]

    @staticmethod
    def _chave_tentativas(request, username):
        ip = BaseThrottle().get_ident(request)
        bruto = f"{ip}:{username.casefold()}"
        digest = hashlib.sha256(bruto.encode("utf-8")).hexdigest()
        return f"plataforma:login-falhas:{digest}"

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = str(request.data.get("password", ""))
        chave = self._chave_tentativas(request, username)
        max_tentativas = getattr(settings, "LOGIN_MAX_TENTATIVAS", 5)
        janela = getattr(settings, "LOGIN_JANELA_SEGUNDOS", 300)
        tentativas = int(cache.get(chave, 0) or 0)
        if tentativas >= max_tentativas:
            return Response(
                {"detail": "Muitas tentativas. Aguarde antes de tentar novamente."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(janela)},
            )
        user = authenticate(request, username=username, password=password)
        if not user:
            cache.set(chave, tentativas + 1, timeout=janela)
            RegistroAuditoria.objects.create(
                acao="LOGIN_FALHOU",
                recurso="sessao",
                detalhes={"username": username},
            )
            return Response(
                {"detail": "Credenciais inválidas."}, status=status.HTTP_401_UNAUTHORIZED
            )

        if user.vinculos_rede.exists() and not user.vinculos_rede.filter(ativo=True).exists():
            return Response({"detail": "Usuário sem vínculo ativo."}, status=status.HTTP_403_FORBIDDEN)
        ttl_horas = getattr(settings, "LOGIN_TOKEN_TTL_HORAS", 12)
        cache.delete(chave)
        TokenAcesso.objects.filter(expira_em__lte=timezone.now()).delete()
        garantir_vinculo_padrao(user)
        vinculo = vinculos_ativos_do_usuario(user).select_related("municipio", "escola").first()
        escolas = escolas_autorizadas_do_usuario(user).select_related("municipio")
        escola = vinculo.escola if vinculo and vinculo.escola_id else escolas.first()
        token_registro, token = TokenAcesso.emitir(
            user=user,
            expira_em=timezone.now() + timedelta(hours=ttl_horas),
            municipio=vinculo.municipio if vinculo else None,
            escola=escola,
            papel_rede=vinculo.papel if vinculo else "",
        )
        perfil, _ = Perfil.objects.get_or_create(user=user)
        modulos_ativos = sorted(slugs_modulos_do_usuario(user))
        RegistroAuditoria.objects.create(
            user=user,
            escola=escola,
            acao="LOGIN",
            recurso="sessao",
            objeto_id=str(token_registro.pk),
        )
        return Response({
            "token": token,
            "papel": perfil.papel,
            "is_staff": user.is_staff,
            "username": user.username,
            "nome": user.first_name or user.username,
            "modulos_ativos": modulos_ativos,
            "papel_rede": vinculo.papel if vinculo else "",
            "municipio": MunicipioSerializer(vinculo.municipio).data if vinculo else None,
            "escola": EscolaSerializer(escola).data if escola else None,
            "escolas": EscolaSerializer(escolas, many=True).data,
        })


class LogoutView(APIView):
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if isinstance(request.auth, TokenAcesso):
            RegistroAuditoria.objects.create(
                user=request.user,
                escola=request.auth.escola,
                acao="LOGOUT",
                recurso="sessao",
                objeto_id=str(request.auth.pk),
            )
            request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeuPerfilView(APIView):
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        nome = str(request.data.get("nome", "")).strip()
        if not nome:
            return Response({"detail": "Nome não pode ser vazio."}, status=status.HTTP_400_BAD_REQUEST)
        request.user.first_name = nome
        request.user.save(update_fields=["first_name"])
        RegistroAuditoria.objects.create(
            user=request.user,
            acao="ATUALIZOU",
            recurso="perfil",
            objeto_id=str(request.user.pk),
            detalhes={"campos": ["nome"]},
        )
        return Response({"nome": nome})


class TrocarEscolaView(APIView):
    """Troca o escopo do token somente para uma escola realmente autorizada."""

    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            escola_id = int(request.data.get("escola_id"))
        except (TypeError, ValueError):
            return Response({"detail": "Escola inválida."}, status=status.HTTP_400_BAD_REQUEST)
        escola = escolas_autorizadas_do_usuario(request.user).filter(pk=escola_id).first()
        if not escola:
            return Response({"detail": "Escola não autorizada."}, status=status.HTTP_403_FORBIDDEN)
        request.auth.escola = escola
        request.auth.municipio = escola.municipio
        request.auth.save(update_fields=["escola", "municipio"])
        RegistroAuditoria.objects.create(
            user=request.user,
            escola=escola,
            acao="TROCOU_ESCOPO",
            recurso="escola",
            objeto_id=str(escola.pk),
        )
        return Response({"escola": EscolaSerializer(escola).data})


class ModuloViewSet(viewsets.ModelViewSet):
    queryset = Modulo.objects.all()
    serializer_class = ModuloSerializer
    lookup_field = "slug"
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [EhAdmin]
    http_method_names = ["get", "patch", "head", "options"]

    def partial_update(self, request, *args, **kwargs):
        modulo = self.get_object()
        if request.data.get("ativo") is False:
            dependentes_ativos = modulo.dependentes.filter(ativo=True)
            if dependentes_ativos.exists():
                nomes = ", ".join(dependentes_ativos.values_list("nome", flat=True))
                return Response(
                    {
                        "detail": (
                            f"Não é possível desativar '{modulo.nome}': "
                            f"módulo(s) '{nomes}' dependem dele."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        resposta = super().partial_update(request, *args, **kwargs)
        RegistroAuditoria.objects.create(
            user=request.user,
            acao="ATUALIZOU",
            recurso="modulo",
            objeto_id=modulo.slug,
            detalhes={"campos": sorted(request.data.keys())},
        )
        return resposta


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("perfil").all().order_by("username")
    serializer_class = UsuarioSerializer
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [EhAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return usuarios_administraveis(self.request.user).select_related("perfil").order_by("username")

    def perform_create(self, serializer):
        usuario = serializer.save()
        municipio = getattr(self.request.auth, "municipio", None)
        escola = getattr(self.request.auth, "escola", None)
        if municipio:
            VinculoUsuario.objects.get_or_create(
                user=usuario,
                municipio=municipio,
                escola=escola,
                papel=VinculoUsuario.OPERADOR,
            )
        RegistroAuditoria.objects.create(
            user=self.request.user,
            acao="CRIOU",
            recurso="usuario",
            objeto_id=str(usuario.pk),
        )

    def perform_update(self, serializer):
        estava_ativo = serializer.instance.is_active
        usuario = serializer.save()
        if estava_ativo and not usuario.is_active:
            TokenAcesso.objects.filter(user=usuario).delete()
        RegistroAuditoria.objects.create(
            user=self.request.user,
            acao="ATUALIZOU",
            recurso="usuario",
            objeto_id=str(usuario.pk),
            detalhes={"campos": sorted(self.request.data.keys())},
        )

    @staticmethod
    def _usuarios_com_bloqueio(usuario_atual, municipio=None):
        if municipio is None:
            ids_autorizados = User.objects.values("pk")
        else:
            filtro = Q(vinculos_rede__municipio_id=municipio.pk)
            if Escola.objects.filter(
                pk=escola_padrao_id(), municipio_id=municipio.pk
            ).exists():
                filtro |= Q(vinculos_rede__isnull=True)
            externos = VinculoUsuario.objects.exclude(
                municipio_id=municipio.pk
            ).values("user_id")
            ids_autorizados = (
                User.objects.filter(filtro)
                .exclude(pk__in=externos)
                .distinct()
                .values("pk")
            )
        return (
            User.objects.filter(pk__in=ids_autorizados)
            .select_related("perfil")
            .filter(perfil__isnull=False)
            .select_for_update(of=("self", "perfil"))
        )

    def partial_update(self, request, *args, **kwargs):
        with transaction.atomic():
            municipio = getattr(request.auth, "municipio", None)
            admins_ativos = list(
                self._usuarios_com_bloqueio(request.user, municipio)
                .filter(is_active=True, perfil__papel=Perfil.ADMIN)
                .order_by("pk")
            )
            usuario = get_object_or_404(
                self._usuarios_com_bloqueio(request.user, municipio),
                pk=kwargs["pk"],
            )
            serializer = self.get_serializer(usuario, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)

            perfil_data = serializer.validated_data.get("perfil", {})
            papel_final = perfil_data.get("papel", usuario.perfil.papel)
            ativo_final = serializer.validated_data.get("is_active", usuario.is_active)
            era_admin_ativo = any(admin.pk == usuario.pk for admin in admins_ativos)
            sera_admin_ativo = ativo_final and papel_final == Perfil.ADMIN
            if era_admin_ativo and not sera_admin_ativo and len(admins_ativos) == 1:
                return Response(
                    {"detail": "Não é possível remover o último administrador ativo."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            self.perform_update(serializer)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="senha")
    def senha(self, request, pk=None):
        usuario = self.get_object()
        password = request.data.get("password")
        if not password:
            return Response(
                {"password": ["Este campo é obrigatório."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(password, user=usuario)
        except ValidationError as erro:
            return Response(
                {"password": list(erro.messages)}, status=status.HTTP_400_BAD_REQUEST
            )
        usuario.set_password(password)
        usuario.save(update_fields=["password"])
        TokenAcesso.objects.filter(user=usuario).delete()
        RegistroAuditoria.objects.create(
            user=request.user,
            acao="REDEFINIU_SENHA",
            recurso="usuario",
            objeto_id=str(usuario.pk),
            detalhes={"campos": ["password"]},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="revogar-sessoes")
    def revogar_sessoes(self, request, pk=None):
        usuario = self.get_object()
        TokenAcesso.objects.filter(user=usuario).delete()
        RegistroAuditoria.objects.create(
            user=request.user,
            acao="REVOGOU_SESSOES",
            recurso="usuario",
            objeto_id=str(usuario.pk),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

class MunicipioViewSet(viewsets.ModelViewSet):
    serializer_class = MunicipioSerializer
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [EhAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        ids = vinculos_ativos_do_usuario(self.request.user).values_list("municipio_id", flat=True)
        return Municipio.objects.filter(pk__in=ids).distinct()

    def perform_create(self, serializer):
        municipio = serializer.save()
        VinculoUsuario.objects.create(
            user=self.request.user, municipio=municipio, papel=VinculoUsuario.GESTOR_REDE
        )


class EscolaViewSet(viewsets.ModelViewSet):
    serializer_class = EscolaSerializer
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [EhAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return escolas_autorizadas_do_usuario(self.request.user).select_related("municipio")

    def perform_create(self, serializer):
        municipio = getattr(self.request.auth, "municipio", None)
        escola = serializer.save(municipio=municipio)
        RegistroAuditoria.objects.create(
            user=self.request.user, escola=escola, acao="CRIOU", recurso="escola",
            objeto_id=str(escola.pk),
        )


class VinculoUsuarioViewSet(viewsets.ModelViewSet):
    serializer_class = VinculoUsuarioSerializer
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [EhAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        ids = vinculos_ativos_do_usuario(self.request.user).values_list("municipio_id", flat=True)
        return VinculoUsuario.objects.filter(municipio_id__in=ids).select_related(
            "user", "municipio", "escola"
        )

    def perform_create(self, serializer):
        municipio = getattr(self.request.auth, "municipio", None)
        vinculo = serializer.save(municipio=municipio)
        RegistroAuditoria.objects.create(
            user=self.request.user, escola=vinculo.escola, acao="CRIOU",
            recurso="vinculo_usuario", objeto_id=str(vinculo.pk),
        )
