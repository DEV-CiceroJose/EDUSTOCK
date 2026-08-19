from django.db import models
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Escola, Modulo, Perfil, VinculoUsuario, escola_padrao_id


def garantir_vinculo_padrao(user):
    """Cria o vínculo legado somente quando o usuário ainda não possui escopo."""

    if not user or not getattr(user, "is_authenticated", False):
        return None
    existente = user.vinculos_rede.filter(ativo=True).select_related("municipio", "escola").first()
    if existente:
        return existente
    escola = Escola.objects.select_related("municipio").get(pk=escola_padrao_id())
    try:
        papel_legado = user.perfil.papel
    except Perfil.DoesNotExist:
        papel_legado = Perfil.OPERADOR
    papel = VinculoUsuario.GESTOR_REDE if papel_legado == Perfil.ADMIN else VinculoUsuario.OPERADOR
    return VinculoUsuario.objects.create(
        user=user,
        municipio=escola.municipio,
        escola=None if papel == VinculoUsuario.GESTOR_REDE else escola,
        papel=papel,
    )


def vinculos_ativos_do_usuario(user):
    if not user or not getattr(user, "is_authenticated", False):
        return VinculoUsuario.objects.none()
    garantir_vinculo_padrao(user)
    return user.vinculos_rede.filter(ativo=True).select_related("municipio", "escola")


def escolas_autorizadas_do_usuario(user):
    """Retorna apenas escolas alcançadas por vínculos ativos do usuário."""

    vinculos = list(vinculos_ativos_do_usuario(user))
    ids_escolas = {v.escola_id for v in vinculos if v.escola_id}
    municipios_rede = {
        v.municipio_id for v in vinculos if v.papel in VinculoUsuario.PAPEIS_COM_ESCOPO_DE_REDE
    }
    consulta = Escola.objects.filter(ativa=True)
    if municipios_rede:
        consulta = consulta.filter(
            models.Q(pk__in=ids_escolas) | models.Q(municipio_id__in=municipios_rede)
        )
    else:
        consulta = consulta.filter(pk__in=ids_escolas)
    return consulta.distinct()


def escola_do_request(request):
    """Resolve a escola por token autenticado; nunca aceita um ID arbitrário do cliente."""

    token = getattr(request, "auth", None)
    escola = getattr(token, "escola", None)
    if escola and escolas_autorizadas_do_usuario(request.user).filter(pk=escola.pk).exists():
        return escola
    return escolas_autorizadas_do_usuario(request.user).order_by("id").first()


def papel_rede_do_usuario(user):
    vinculo = vinculos_ativos_do_usuario(user).order_by(
        models.Case(
            models.When(papel=VinculoUsuario.GESTOR_REDE, then=0),
            models.When(papel=VinculoUsuario.NUTRICIONISTA, then=1),
            models.When(papel=VinculoUsuario.GESTOR_ESCOLA, then=2),
            default=3,
        ),
        "id",
    ).first()
    return vinculo.papel if vinculo else ""


def slugs_modulos_do_usuario(user):
    ativos = Modulo.objects.filter(ativo=True)
    if not user or not user.is_authenticated:
        return set(ativos.values_list("slug", flat=True))
    try:
        perfil = user.perfil
    except Perfil.DoesNotExist:
        return set()
    if perfil.papel == Perfil.ADMIN or not perfil.modulos.exists():
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
            return (
                request.user.perfil.papel == "ADMIN"
                or vinculos_ativos_do_usuario(request.user).filter(
                    papel=VinculoUsuario.GESTOR_REDE
                ).exists()
            )
        except AttributeError:
            return False


def usuario_admin_do_estoque(user):
    """Admin operacional: staff Django ou papel ADMIN da plataforma."""
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    try:
        return (
            user.perfil.papel == "ADMIN"
            or vinculos_ativos_do_usuario(user).filter(
                papel__in=[VinculoUsuario.GESTOR_REDE, VinculoUsuario.GESTOR_ESCOLA]
            ).exists()
        )
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


class EhGestorRede(BasePermission):
    message = "Apenas gestores da rede podem acessar este recurso."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(
            vinculos_ativos_do_usuario(request.user).filter(
                papel=VinculoUsuario.GESTOR_REDE
            ).exists()
        )


class PodeVerPainelRede(BasePermission):
    message = "Seu vínculo não permite visualizar indicadores da rede."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return vinculos_ativos_do_usuario(request.user).filter(
            papel__in=[VinculoUsuario.GESTOR_REDE, VinculoUsuario.NUTRICIONISTA]
        ).exists()
