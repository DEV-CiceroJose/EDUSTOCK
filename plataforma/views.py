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
from .models import Modulo, Perfil, RegistroAuditoria, TokenAcesso
from .permissions import EhAdmin, slugs_modulos_do_usuario
from .serializers import ModuloSerializer, UsuarioSerializer


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

        ttl_horas = getattr(settings, "LOGIN_TOKEN_TTL_HORAS", 12)
        cache.delete(chave)
        TokenAcesso.objects.filter(expira_em__lte=timezone.now()).delete()
        token_registro, token = TokenAcesso.emitir(
            user=user, expira_em=timezone.now() + timedelta(hours=ttl_horas)
        )
        perfil, _ = Perfil.objects.get_or_create(user=user)
        modulos_ativos = sorted(slugs_modulos_do_usuario(user))
        RegistroAuditoria.objects.create(
            user=user,
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
        })


class LogoutView(APIView):
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if isinstance(request.auth, TokenAcesso):
            RegistroAuditoria.objects.create(
                user=request.user,
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

    def perform_create(self, serializer):
        usuario = serializer.save()
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
