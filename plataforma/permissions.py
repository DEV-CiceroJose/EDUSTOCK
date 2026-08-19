from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Modulo, Perfil


def slugs_modulos_do_usuario(user):
    ativos = Modulo.objects.filter(ativo=True)
    if not user or not user.is_authenticated:
        return set(ativos.values_list("slug", flat=True))
    try:
        perfil = user.perfil
    except Perfil.DoesNotExist:
        return set()
    if perfil.papel == Perfil.ADMIN or (
        perfil.acesso_legado and not perfil.modulos.exists()
    ):
        return set(ativos.values_list("slug", flat=True))
    return set(
        ativos.filter(perfis_autorizados=perfil).values_list("slug", flat=True)
    )


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
                self.message = f"Módulo obrigatório '{slug}' não está configurado."
                return False
            if not modulo.ativo:
                self.message = f"Módulo '{modulo.nome}' está desativado."
                return False
            user = getattr(request, "user", None)
            if user and user.is_authenticated:
                if slug not in slugs_modulos_do_usuario(user):
                    self.message = "Seu usuário não possui acesso a este módulo."
                    return False
            return True

    return _RequerModuloAtivo


class EhAdmin(BasePermission):
    message = "Apenas administradores podem acessar este recurso."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        try:
            return request.user.perfil.papel == "ADMIN"
        except AttributeError:
            return False


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
