from datetime import timedelta
import hashlib

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import BaseThrottle

from .authentication import TokenAcessoAuthentication
from .models import Escola, Modulo, Municipio, Perfil, RegistroAuditoria, TokenAcesso, VinculoUsuario
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
        usuario = serializer.save()
        RegistroAuditoria.objects.create(
            user=self.request.user,
            acao="ATUALIZOU",
            recurso="usuario",
            objeto_id=str(usuario.pk),
            detalhes={"campos": sorted(self.request.data.keys())},
        )


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
