from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Modulo


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
        return bool(request.user and request.user.is_staff)


def usuario_admin_do_estoque(user):
    """Admin operacional: staff Django ou papel ADMIN da plataforma."""
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    try:
        return user.perfil.papel == "ADMIN"
    except AttributeError:
        return False


class LeituraOuAdmin(BasePermission):
    """
    Operadores autenticados consultam cadastros; alterações ficam restritas
    ao administrador operacional. Movimentações usam uma permissão separada.
    """

    message = "Apenas administradores podem alterar este cadastro."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return usuario_admin_do_estoque(request.user)
