from django.core.exceptions import ValidationError

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import TokenAcesso


class TokenAcessoAuthentication(BaseAuthentication):
    keyword = "Token"

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith(f"{self.keyword} "):
            return None

        token_str = header[len(self.keyword) + 1:].strip()
        try:
            token = TokenAcesso.objects.select_related("user", "municipio", "escola").get(
                token_hash=TokenAcesso.calcular_hash(token_str)
            )
        except (TokenAcesso.DoesNotExist, ValueError, ValidationError):
            raise AuthenticationFailed("Token inválido.")

        if token.expirado:
            raise AuthenticationFailed("Token expirado.")

        if not token.user.is_active:
            raise AuthenticationFailed("Usuário desativado.")
        if token.user.vinculos_rede.exists() and not token.user.vinculos_rede.filter(ativo=True).exists():
            raise AuthenticationFailed("Usuário sem vínculo ativo.")

        return (token.user, token)

    def authenticate_header(self, request):
        return self.keyword
