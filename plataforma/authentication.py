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
            token = TokenAcesso.objects.select_related("user").get(token=token_str)
        except (TokenAcesso.DoesNotExist, ValueError, ValidationError):
            raise AuthenticationFailed("Token inválido.")

        if token.expirado:
            raise AuthenticationFailed("Token expirado.")

        return (token.user, token)

    def authenticate_header(self, request):
        return self.keyword
