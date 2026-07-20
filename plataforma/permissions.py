from rest_framework.permissions import BasePermission

from .models import Modulo, Perfil


def RequerModuloAtivo(slug):
    """
    Factory de permission class: bloqueia o acesso se o módulo `slug`
    estiver desativado. Se o módulo não existir na tabela (não deveria
    acontecer após a seed migration), permite por padrão — a ausência de
    registro não é tratada como desativação.
    """

    class _RequerModuloAtivo(BasePermission):
        def has_permission(self, request, view):
            try:
                modulo = Modulo.objects.get(slug=slug)
            except Modulo.DoesNotExist:
                return True
            if not modulo.ativo:
                self.message = f"Módulo '{modulo.nome}' está desativado."
                return False
            return True

    return _RequerModuloAtivo


class EhAdmin(BasePermission):
    message = "Apenas administradores podem acessar este recurso."

    def has_permission(self, request, view):
        perfil = getattr(request.user, "perfil", None)
        return bool(perfil and perfil.papel == Perfil.ADMIN)
