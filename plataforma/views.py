from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import TokenAcessoAuthentication
from .models import Modulo, Perfil, TokenAcesso
from .permissions import EhAdmin
from .serializers import ModuloSerializer


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = str(request.data.get("password", ""))
        user = authenticate(request, username=username, password=password)
        if not user:
            return Response(
                {"detail": "Credenciais inválidas."}, status=status.HTTP_401_UNAUTHORIZED
            )

        ttl_horas = getattr(settings, "LOGIN_TOKEN_TTL_HORAS", 12)
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=ttl_horas)
        )
        perfil, _ = Perfil.objects.get_or_create(user=user)
        modulos_ativos = list(
            Modulo.objects.filter(ativo=True).order_by("nome").values_list("slug", flat=True)
        )
        return Response({
            "token": str(token.token),
            "papel": perfil.papel,
            "modulos_ativos": modulos_ativos,
        })


class LogoutView(APIView):
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if isinstance(request.auth, TokenAcesso):
            request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        return super().partial_update(request, *args, **kwargs)
