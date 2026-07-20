# Autenticação com Token + Painel de Módulos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a API totalmente aberta do EduStock por autenticação real (token persistido em banco) com dois papéis (`ADMIN`/`OPERADOR`), e introduzir um painel administrativo que ativa/desativa módulos (Inventário, Movimentações, Fornecedores, Alertas, Relatórios, Merenda) em tempo real.

**Architecture:** Novo app Django `plataforma` (autenticação, papéis, registro de módulos), separado do `core` (domínio de estoque/merenda). Um model `TokenAcesso` persistido em banco substitui qualquer necessidade de sessão em memória. Uma permission class parametrizável `RequerModuloAtivo(slug)` é aplicada a cada ViewSet já existente em `core/api_views.py`. `app-alunos`/`app-cozinha` continuam com login por PIN, sem mudança — apenas ganham uma checagem adicional de módulo ativo.

**Tech Stack:** Django 6.0 + Django REST Framework (backend), React 19 + Vite + React Router (frontend em `frontend/`), Vitest + Testing Library (testes frontend), `APITestCase`/`TestCase` do Django (testes backend).

## Global Constraints

- `app-alunos` e `app-cozinha` não sofrem nenhuma mudança de autenticação — continuam usando PIN via `core/operacao_auth.py`. As views em `core/operacao_views.py` devem manter acesso anônimo (`AllowAny`), ganhando apenas a checagem de módulo `merenda` ativo.
- Nenhuma permissão granular por ação dentro de um módulo (ex. "operador só lê") — papéis controlam acesso a módulos inteiros e ao painel admin, nada mais.
- Sessão do frontend usa `sessionStorage`, nunca `localStorage` (mesmo padrão já usado em `app-cozinha`/`app-alunos`).
- TTL padrão do token: 12 horas (`LOGIN_TOKEN_TTL_HORAS`, mesmo valor de `OPERACAO_TOKEN_TTL_HORAS` já usado no módulo de PIN).
- Toda tarefa que altera comportamento de autenticação/autorização deve manter a suíte de testes existente verde ao final da tarefa (falhas transitórias documentadas explicitamente quando esperadas).
- Seguir a convenção de nomes em português já usada no projeto (`core/models.py`, `core/services.py`) para todo código novo em `plataforma/`.

---

### Task 1: App `plataforma` — models `Modulo`, `Perfil`, `TokenAcesso`

**Files:**
- Create: `plataforma/__init__.py`
- Create: `plataforma/apps.py`
- Create: `plataforma/models.py`
- Create: `plataforma/migrations/__init__.py`
- Create: `plataforma/migrations/0001_initial.py`
- Create: `plataforma/tests/__init__.py`
- Test: `plataforma/tests/test_models.py`
- Modify: `easystock/settings.py:35-46` (adicionar `"plataforma"` a `INSTALLED_APPS`)

**Interfaces:**
- Produces: `plataforma.models.Modulo` (campos `slug`, `nome`, `descricao`, `ativo`, `depende_de`), `plataforma.models.Perfil` (`user`, `matricula`, `papel`, constantes `Perfil.ADMIN`/`Perfil.OPERADOR`), `plataforma.models.TokenAcesso` (`token`, `user`, `criado_em`, `expira_em`, propriedade `expirado`)

- [ ] **Step 1: Criar a estrutura do app**

```bash
mkdir -p plataforma/migrations plataforma/tests
touch plataforma/__init__.py plataforma/migrations/__init__.py plataforma/tests/__init__.py
```

- [ ] **Step 2: Escrever `plataforma/apps.py`**

```python
from django.apps import AppConfig


class PlataformaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "plataforma"
    verbose_name = "Plataforma"
```

- [ ] **Step 3: Escrever `plataforma/models.py`**

```python
import uuid

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Modulo(models.Model):
    slug = models.SlugField(unique=True)
    nome = models.CharField(max_length=100)
    descricao = models.CharField(max_length=255, blank=True)
    ativo = models.BooleanField(default=True)
    depende_de = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="dependentes"
    )

    class Meta:
        ordering = ["nome"]
        verbose_name = "Módulo"
        verbose_name_plural = "Módulos"

    def __str__(self):
        return self.nome


class Perfil(models.Model):
    ADMIN = "ADMIN"
    OPERADOR = "OPERADOR"
    PAPEL_CHOICES = [(ADMIN, "Administrador"), (OPERADOR, "Operador")]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="perfil")
    matricula = models.CharField(max_length=50, unique=True, null=True, blank=True)
    papel = models.CharField(max_length=10, choices=PAPEL_CHOICES, default=OPERADOR)

    class Meta:
        verbose_name = "Perfil"
        verbose_name_plural = "Perfis"

    def __str__(self):
        return f"{self.user.username} ({self.papel})"


class TokenAcesso(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens_acesso")
    criado_em = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()

    class Meta:
        verbose_name = "Token de acesso"
        verbose_name_plural = "Tokens de acesso"

    def __str__(self):
        return f"{self.user.username} · {self.token}"

    @property
    def expirado(self):
        return timezone.now() > self.expira_em
```

- [ ] **Step 4: Adicionar `"plataforma"` a `INSTALLED_APPS` em `easystock/settings.py`**

Localizar (linha ~35-46):
```python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # APIs / frontend React
    "rest_framework",
    "corsheaders",
    "core",
]
```

Substituir por:
```python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # APIs / frontend React
    "rest_framework",
    "corsheaders",
    "core",
    "plataforma",
]
```

- [ ] **Step 5: Gerar a migration inicial**

Run: `python manage.py makemigrations plataforma`
Expected: cria `plataforma/migrations/0001_initial.py` com os 3 models acima.

- [ ] **Step 6: Escrever o teste `plataforma/tests/test_models.py`**

```python
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from plataforma.models import Modulo, Perfil, TokenAcesso


class ModuloModelTest(TestCase):
    def test_str_retorna_nome(self):
        m = Modulo.objects.create(slug="inventario", nome="Inventário")
        self.assertEqual(str(m), "Inventário")

    def test_depende_de_permite_autorreferencia(self):
        base = Modulo.objects.create(slug="inventario", nome="Inventário")
        dependente = Modulo.objects.create(slug="merenda", nome="Merenda", depende_de=base)
        self.assertEqual(dependente.depende_de, base)
        self.assertIn(dependente, base.dependentes.all())


class PerfilModelTest(TestCase):
    def test_default_papel_e_operador(self):
        user = User.objects.create_user(username="joao", password="senha123")
        perfil = Perfil.objects.create(user=user)
        self.assertEqual(perfil.papel, Perfil.OPERADOR)

    def test_permite_dois_perfis_sem_matricula(self):
        u1 = User.objects.create_user(username="joao", password="senha123")
        u2 = User.objects.create_user(username="maria", password="senha123")
        Perfil.objects.create(user=u1)
        Perfil.objects.create(user=u2)  # não deve levantar IntegrityError


class TokenAcessoModelTest(TestCase):
    def test_expirado_property(self):
        user = User.objects.create_user(username="joao", password="senha123")
        token_valido = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        token_vencido = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() - timedelta(hours=1)
        )
        self.assertFalse(token_valido.expirado)
        self.assertTrue(token_vencido.expirado)
```

- [ ] **Step 7: Rodar os testes**

Run: `python manage.py test plataforma.tests.test_models -v 2`
Expected: `OK` — 4 testes passando.

- [ ] **Step 8: Commit**

```bash
git add plataforma easystock/settings.py
git commit -m "feat(plataforma): cria app com models Modulo, Perfil e TokenAcesso"
```

---

### Task 2: Seed migration dos 6 módulos iniciais

**Files:**
- Create: `plataforma/migrations/0002_seed_modulos.py`
- Test: `plataforma/tests/test_migrations.py`

**Interfaces:**
- Consumes: `plataforma.models.Modulo` (Task 1)
- Produces: 6 registros `Modulo` com slugs `inventario`, `movimentacoes`, `fornecedores`, `alertas`, `relatorios`, `merenda` (todos `ativo=True`, `merenda.depende_de = inventario`)

- [ ] **Step 1: Escrever a data migration**

```python
from django.db import migrations


def seed_modulos(apps, schema_editor):
    Modulo = apps.get_model("plataforma", "Modulo")
    inventario = Modulo.objects.create(
        slug="inventario", nome="Inventário",
        descricao="Produtos, categorias, grupos e bens permanentes.", ativo=True,
    )
    Modulo.objects.create(
        slug="movimentacoes", nome="Movimentações",
        descricao="Entradas e saídas de estoque.", ativo=True,
    )
    Modulo.objects.create(
        slug="fornecedores", nome="Fornecedores",
        descricao="Cadastro de fornecedores.", ativo=True,
    )
    Modulo.objects.create(
        slug="alertas", nome="Alertas",
        descricao="Alertas de validade e estoque crítico.", ativo=True,
    )
    Modulo.objects.create(
        slug="relatorios", nome="Relatórios",
        descricao="Prestação de contas e relatórios.", ativo=True,
    )
    Modulo.objects.create(
        slug="merenda", nome="Merenda",
        descricao="Contagem de frequência e produção da cozinha.",
        ativo=True, depende_de=inventario,
    )


def remover_modulos(apps, schema_editor):
    Modulo = apps.get_model("plataforma", "Modulo")
    # merenda primeiro: depende_de=inventario é PROTECT, então o dependente
    # precisa ser removido antes do módulo do qual ele depende.
    Modulo.objects.filter(slug="merenda").delete()
    Modulo.objects.filter(
        slug__in=["inventario", "movimentacoes", "fornecedores", "alertas", "relatorios"]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("plataforma", "0001_initial")]
    operations = [migrations.RunPython(seed_modulos, remover_modulos)]
```

- [ ] **Step 2: Escrever o teste de migration**

```python
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase


class SeedModulosMigrationTest(TestCase):
    def test_seed_cria_seis_modulos_ativos_com_dependencia(self):
        executor = MigrationExecutor(connection)
        executor.migrate([("plataforma", "0002_seed_modulos")])
        state = executor.loader.project_state(("plataforma", "0002_seed_modulos"))
        Modulo = state.apps.get_model("plataforma", "Modulo")

        self.assertEqual(Modulo.objects.filter(ativo=True).count(), 6)
        merenda = Modulo.objects.get(slug="merenda")
        inventario = Modulo.objects.get(slug="inventario")
        self.assertEqual(merenda.depende_de_id, inventario.id)

        # reverte e confirma que a migration reversa funciona
        executor = MigrationExecutor(connection)
        executor.migrate([("plataforma", "0001_initial")])
        state = executor.loader.project_state(("plataforma", "0001_initial"))
        Modulo = state.apps.get_model("plataforma", "Modulo")
        self.assertEqual(Modulo.objects.count(), 0)
```

- [ ] **Step 3: Rodar o teste**

Run: `python manage.py test plataforma.tests.test_migrations -v 2`
Expected: `OK` — 1 teste passando.

- [ ] **Step 4: Commit**

```bash
git add plataforma/migrations/0002_seed_modulos.py plataforma/tests/test_migrations.py
git commit -m "feat(plataforma): seed dos 6 módulos iniciais via data migration"
```

---

### Task 3: Remover o model `Perfil` morto de `core`

**Files:**
- Modify: `core/models.py:1-11`
- Create: `core/migrations/0012_remove_perfil.py`

**Interfaces:**
- Nenhuma — remoção de código morto confirmada sem referências em `core/admin.py`, `core/views.py`, `core/api_views.py`, `core/serializers.py` ou `core/tests/` (verificado na auditoria).

- [ ] **Step 1: Remover a classe `Perfil` de `core/models.py`**

Remover (linhas 1-11 atuais):
```python
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    matricula = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"{self.user.username} - {self.matricula}"
```

Substituir por:
```python
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
```

- [ ] **Step 2: Gerar a migration de remoção**

Run: `python manage.py makemigrations core`
Expected: cria `core/migrations/0012_remove_perfil.py` contendo `migrations.DeleteModel(name="Perfil")`.

- [ ] **Step 3: Rodar a suíte completa do `core` para confirmar que nada dependia do model**

Run: `python manage.py test core -v 2`
Expected: `OK` — nenhuma falha (o model não era referenciado em nenhum teste).

- [ ] **Step 4: Commit**

```bash
git add core/models.py core/migrations/0012_remove_perfil.py
git commit -m "chore(core): remove model Perfil morto (substituído por plataforma.Perfil)"
```

---

### Task 4: `TokenAcessoAuthentication` (autenticação DRF customizada)

**Files:**
- Create: `plataforma/authentication.py`
- Test: `plataforma/tests/test_authentication.py`

**Interfaces:**
- Consumes: `plataforma.models.TokenAcesso` (Task 1)
- Produces: `plataforma.authentication.TokenAcessoAuthentication` (classe DRF `BaseAuthentication`, método `authenticate(request)` retorna `(user, token)` ou `None`, levanta `rest_framework.exceptions.AuthenticationFailed`)

- [ ] **Step 1: Escrever o teste**

```python
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed

from plataforma.authentication import TokenAcessoAuthentication
from plataforma.models import TokenAcesso


class TokenAcessoAuthenticationTest(TestCase):
    def setUp(self):
        self.auth = TokenAcessoAuthentication()
        self.user = User.objects.create_user(username="joao", password="x")
        self.factory = RequestFactory()

    def test_sem_header_retorna_none(self):
        request = self.factory.get("/api/produtos/")
        self.assertIsNone(self.auth.authenticate(request))

    def test_token_valido_autentica(self):
        token = TokenAcesso.objects.create(
            user=self.user, expira_em=timezone.now() + timedelta(hours=1)
        )
        request = self.factory.get(
            "/api/produtos/", HTTP_AUTHORIZATION=f"Token {token.token}"
        )
        user, auth_token = self.auth.authenticate(request)
        self.assertEqual(user, self.user)
        self.assertEqual(auth_token, token)

    def test_token_expirado_levanta_erro(self):
        token = TokenAcesso.objects.create(
            user=self.user, expira_em=timezone.now() - timedelta(hours=1)
        )
        request = self.factory.get(
            "/api/produtos/", HTTP_AUTHORIZATION=f"Token {token.token}"
        )
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_token_invalido_levanta_erro(self):
        request = self.factory.get(
            "/api/produtos/", HTTP_AUTHORIZATION="Token nao-existe-e-nao-e-uuid"
        )
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `python manage.py test plataforma.tests.test_authentication -v 2`
Expected: `FAIL` com `ModuleNotFoundError: No module named 'plataforma.authentication'`

- [ ] **Step 3: Escrever `plataforma/authentication.py`**

```python
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
        except (TokenAcesso.DoesNotExist, ValueError):
            raise AuthenticationFailed("Token inválido.")

        if token.expirado:
            raise AuthenticationFailed("Token expirado.")

        return (token.user, token)
```

- [ ] **Step 4: Rodar o teste novamente**

Run: `python manage.py test plataforma.tests.test_authentication -v 2`
Expected: `OK` — 4 testes passando.

- [ ] **Step 5: Commit**

```bash
git add plataforma/authentication.py plataforma/tests/test_authentication.py
git commit -m "feat(plataforma): autenticação por TokenAcesso persistido em banco"
```

---

### Task 5: Permissions `RequerModuloAtivo` e `EhAdmin`

**Files:**
- Create: `plataforma/permissions.py`
- Test: `plataforma/tests/test_permissions.py`

**Interfaces:**
- Consumes: `plataforma.models.Modulo`, `plataforma.models.Perfil` (Task 1)
- Produces: `plataforma.permissions.RequerModuloAtivo(slug)` (factory que retorna uma classe de permissão DRF), `plataforma.permissions.EhAdmin` (classe de permissão DRF)

- [ ] **Step 1: Escrever o teste**

```python
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from plataforma.models import Modulo, Perfil
from plataforma.permissions import EhAdmin, RequerModuloAtivo


class RequerModuloAtivoTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        Modulo.objects.create(slug="inventario", nome="Inventário", ativo=True)

    def test_permite_quando_modulo_ativo(self):
        permission = RequerModuloAtivo("inventario")()
        request = self.factory.get("/api/produtos/")
        self.assertTrue(permission.has_permission(request, None))

    def test_bloqueia_quando_modulo_inativo(self):
        Modulo.objects.filter(slug="inventario").update(ativo=False)
        permission = RequerModuloAtivo("inventario")()
        request = self.factory.get("/api/produtos/")
        self.assertFalse(permission.has_permission(request, None))

    def test_permite_quando_modulo_nao_existe(self):
        permission = RequerModuloAtivo("modulo-inexistente")()
        request = self.factory.get("/api/produtos/")
        self.assertTrue(permission.has_permission(request, None))


class EhAdminTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_permite_para_papel_admin(self):
        user = User.objects.create_user(username="admin1", password="x")
        Perfil.objects.create(user=user, papel=Perfil.ADMIN)
        request = self.factory.get("/")
        request.user = user
        self.assertTrue(EhAdmin().has_permission(request, None))

    def test_bloqueia_para_papel_operador(self):
        user = User.objects.create_user(username="op1", password="x")
        Perfil.objects.create(user=user, papel=Perfil.OPERADOR)
        request = self.factory.get("/")
        request.user = user
        self.assertFalse(EhAdmin().has_permission(request, None))

    def test_bloqueia_sem_perfil(self):
        user = User.objects.create_user(username="semperfil", password="x")
        request = self.factory.get("/")
        request.user = user
        self.assertFalse(EhAdmin().has_permission(request, None))
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `python manage.py test plataforma.tests.test_permissions -v 2`
Expected: `FAIL` com `ModuleNotFoundError: No module named 'plataforma.permissions'`

- [ ] **Step 3: Escrever `plataforma/permissions.py`**

```python
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
```

- [ ] **Step 4: Rodar o teste novamente**

Run: `python manage.py test plataforma.tests.test_permissions -v 2`
Expected: `OK` — 6 testes passando.

- [ ] **Step 5: Commit**

```bash
git add plataforma/permissions.py plataforma/tests/test_permissions.py
git commit -m "feat(plataforma): permissions RequerModuloAtivo e EhAdmin"
```

---

### Task 6: Endpoints de login e logout

**Files:**
- Create: `plataforma/serializers.py`
- Create: `plataforma/views.py`
- Create: `plataforma/urls.py`
- Modify: `easystock/urls.py:23-38`
- Modify: `easystock/settings.py` (adicionar `LOGIN_TOKEN_TTL_HORAS`)
- Test: `plataforma/tests/test_views.py`

**Interfaces:**
- Consumes: `plataforma.models.{Modulo,Perfil,TokenAcesso}` (Task 1), `plataforma.authentication.TokenAcessoAuthentication` (Task 4)
- Produces: `POST /api/auth/login/` → `{"token", "papel", "modulos_ativos"}`; `POST /api/auth/logout/`; `plataforma.views.LoginView`, `plataforma.views.LogoutView`

- [ ] **Step 1: Escrever o teste**

```python
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from plataforma.models import Modulo, Perfil, TokenAcesso


class LoginViewTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="joao", password="senha-boa-123")
        Modulo.objects.create(slug="inventario", nome="Inventário", ativo=True)
        Modulo.objects.create(slug="merenda", nome="Merenda", ativo=False)

    def test_login_com_credenciais_corretas_retorna_token_e_modulos(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "joao", "password": "senha-boa-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["papel"], Perfil.OPERADOR)
        self.assertEqual(resp.data["modulos_ativos"], ["inventario"])

    def test_login_com_senha_errada_retorna_401(self):
        resp = self.client.post(
            "/api/auth/login/", {"username": "joao", "password": "errada"}, format="json"
        )
        self.assertEqual(resp.status_code, 401)


class LogoutViewTest(APITestCase):
    def test_logout_invalida_token(self):
        user = User.objects.create_user(username="joao", password="senha-boa-123")
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        resp = self.client.post(
            "/api/auth/logout/", HTTP_AUTHORIZATION=f"Token {token.token}"
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(TokenAcesso.objects.filter(pk=token.pk).exists())
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `python manage.py test plataforma.tests.test_views.LoginViewTest plataforma.tests.test_views.LogoutViewTest -v 2`
Expected: `FAIL` — rota `/api/auth/login/` ainda não existe (404).

- [ ] **Step 3: Escrever `plataforma/serializers.py`**

```python
from rest_framework import serializers

from .models import Modulo


class ModuloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modulo
        fields = ["slug", "nome", "descricao", "ativo", "depende_de"]
        extra_kwargs = {"depende_de": {"read_only": True}}
```

- [ ] **Step 4: Escrever `plataforma/views.py`**

```python
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import TokenAcessoAuthentication
from .models import Modulo, Perfil, TokenAcesso


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
```

- [ ] **Step 5: Escrever `plataforma/urls.py`**

```python
from django.urls import path

from .views import LoginView, LogoutView

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
]
```

- [ ] **Step 6: Incluir as rotas em `easystock/urls.py`**

Localizar (linhas 23-27):
```python
urlpatterns = [
    path("admin/", admin.site.urls),

    # 🔌 API REST (consumida pelo frontend React)
    path("api/", include("core.api_urls")),
```

Substituir por:
```python
urlpatterns = [
    path("admin/", admin.site.urls),

    # 🔐 Autenticação e módulos da plataforma
    path("api/", include("plataforma.urls")),

    # 🔌 API REST (consumida pelo frontend React)
    path("api/", include("core.api_urls")),
```

- [ ] **Step 7: Adicionar `LOGIN_TOKEN_TTL_HORAS` em `easystock/settings.py`**

Localizar a seção do módulo de operação (perto de `OPERACAO_TOKEN_TTL_HORAS`):
```python
# Tempo de vida dos tokens de sessão em horas (padrão 12h)
OPERACAO_TOKEN_TTL_HORAS = 12
```

Adicionar logo abaixo:
```python

# ------------------------------------------------------------------
# Autenticação da plataforma (dashboard admin)
# ------------------------------------------------------------------
LOGIN_TOKEN_TTL_HORAS = int(os.environ.get('LOGIN_TOKEN_TTL_HORAS', 12))
```

- [ ] **Step 8: Rodar o teste novamente**

Run: `python manage.py test plataforma.tests.test_views -v 2`
Expected: `OK` — 3 testes passando.

- [ ] **Step 9: Commit**

```bash
git add plataforma/serializers.py plataforma/views.py plataforma/urls.py \
        plataforma/tests/test_views.py easystock/urls.py easystock/settings.py
git commit -m "feat(plataforma): endpoints de login e logout com TokenAcesso"
```

---

### Task 7: `ModuloViewSet` — painel de toggle de módulos

**Files:**
- Modify: `plataforma/views.py`
- Modify: `plataforma/urls.py`
- Modify: `plataforma/tests/test_views.py`

**Interfaces:**
- Consumes: `plataforma.permissions.EhAdmin` (Task 5), `plataforma.serializers.ModuloSerializer` (Task 6)
- Produces: `GET /api/modulos/`, `PATCH /api/modulos/{slug}/` (só `ADMIN`)

- [ ] **Step 1: Adicionar os testes em `plataforma/tests/test_views.py`**

```python
class ModuloViewSetTest(APITestCase):
    def setUp(self):
        self.inventario = Modulo.objects.create(slug="inventario", nome="Inventário", ativo=True)
        self.merenda = Modulo.objects.create(
            slug="merenda", nome="Merenda", ativo=True, depende_de=self.inventario
        )

    def _autenticar(self, papel):
        user = User.objects.create_user(username=f"user-{papel.lower()}", password="x")
        Perfil.objects.create(user=user, papel=papel)
        token = TokenAcesso.objects.create(
            user=user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

    def test_admin_lista_modulos(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.get("/api/modulos/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_admin_desativa_modulo_sem_dependentes(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.patch(f"/api/modulos/{self.merenda.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.merenda.refresh_from_db()
        self.assertFalse(self.merenda.ativo)

    def test_nao_desativa_modulo_com_dependente_ativo(self):
        self._autenticar(Perfil.ADMIN)
        resp = self.client.patch(f"/api/modulos/{self.inventario.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.inventario.refresh_from_db()
        self.assertTrue(self.inventario.ativo)

    def test_operador_nao_pode_togglear(self):
        self._autenticar(Perfil.OPERADOR)
        resp = self.client.patch(f"/api/modulos/{self.merenda.slug}/", {"ativo": False}, format="json")
        self.assertEqual(resp.status_code, 403)
```

Adicionar no topo do arquivo (junto aos imports já existentes de Task 6):
```python
from plataforma.models import Modulo
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `python manage.py test plataforma.tests.test_views.ModuloViewSetTest -v 2`
Expected: `FAIL` — rota `/api/modulos/` ainda não existe (404).

- [ ] **Step 3: Adicionar `ModuloViewSet` em `plataforma/views.py`**

Adicionar ao final do arquivo:
```python
from rest_framework import viewsets

from .permissions import EhAdmin
from .serializers import ModuloSerializer


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
```

- [ ] **Step 4: Registrar a rota em `plataforma/urls.py`**

Substituir o conteúdo completo por:
```python
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LoginView, LogoutView, ModuloViewSet

router = DefaultRouter()
router.register(r"modulos", ModuloViewSet, basename="modulo")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
] + router.urls
```

- [ ] **Step 5: Rodar o teste novamente**

Run: `python manage.py test plataforma.tests.test_views -v 2`
Expected: `OK` — 7 testes passando (3 da Task 6 + 4 novos).

- [ ] **Step 6: Commit**

```bash
git add plataforma/views.py plataforma/urls.py plataforma/tests/test_views.py
git commit -m "feat(plataforma): ModuloViewSet com toggle e checagem de dependência"
```

---

### Task 8: `UsuarioViewSet` — gestão de usuários

**Files:**
- Modify: `plataforma/serializers.py`
- Modify: `plataforma/views.py`
- Modify: `plataforma/urls.py`
- Modify: `plataforma/tests/test_views.py`

**Interfaces:**
- Consumes: `plataforma.permissions.EhAdmin` (Task 5)
- Produces: `GET/POST /api/usuarios/`, `PATCH /api/usuarios/{id}/` (só `ADMIN`)

- [ ] **Step 1: Adicionar o teste**

```python
class UsuarioViewSetTest(APITestCase):
    def _autenticar_admin(self):
        admin = User.objects.create_user(username="admin1", password="x")
        Perfil.objects.create(user=admin, papel=Perfil.ADMIN)
        token = TokenAcesso.objects.create(
            user=admin, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")

    def test_admin_cria_operador(self):
        self._autenticar_admin()
        resp = self.client.post("/api/usuarios/", {
            "username": "maria", "password": "senha-boa-123", "papel": "OPERADOR",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        maria = User.objects.get(username="maria")
        self.assertEqual(maria.perfil.papel, "OPERADOR")

    def test_admin_altera_papel_de_usuario(self):
        self._autenticar_admin()
        u = User.objects.create_user(username="maria", password="x")
        Perfil.objects.create(user=u, papel=Perfil.OPERADOR)
        resp = self.client.patch(f"/api/usuarios/{u.id}/", {"papel": "ADMIN"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        u.refresh_from_db()
        self.assertEqual(u.perfil.papel, "ADMIN")

    def test_operador_nao_pode_criar_usuario(self):
        operador = User.objects.create_user(username="op1", password="x")
        Perfil.objects.create(user=operador, papel=Perfil.OPERADOR)
        token = TokenAcesso.objects.create(
            user=operador, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")
        resp = self.client.post("/api/usuarios/", {
            "username": "outro", "password": "senha-boa-123", "papel": "OPERADOR",
        }, format="json")
        self.assertEqual(resp.status_code, 403)
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `python manage.py test plataforma.tests.test_views.UsuarioViewSetTest -v 2`
Expected: `FAIL` — rota `/api/usuarios/` ainda não existe (404).

- [ ] **Step 3: Adicionar `UsuarioSerializer` em `plataforma/serializers.py`**

Adicionar ao final do arquivo:
```python
from django.contrib.auth.models import User

from .models import Perfil


class UsuarioSerializer(serializers.ModelSerializer):
    papel = serializers.ChoiceField(choices=Perfil.PAPEL_CHOICES, source="perfil.papel")
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ["id", "username", "password", "papel"]

    def create(self, validated_data):
        papel = validated_data.pop("perfil")["papel"]
        password = validated_data.pop("password")
        user = User.objects.create_user(username=validated_data["username"], password=password)
        Perfil.objects.create(user=user, papel=papel)
        return user

    def update(self, instance, validated_data):
        papel_data = validated_data.pop("perfil", None)
        if papel_data:
            instance.perfil.papel = papel_data["papel"]
            instance.perfil.save(update_fields=["papel"])
        return instance
```

- [ ] **Step 4: Adicionar `UsuarioViewSet` em `plataforma/views.py`**

Adicionar ao final do arquivo:
```python
from django.contrib.auth.models import User

from .serializers import UsuarioSerializer


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("perfil").all().order_by("username")
    serializer_class = UsuarioSerializer
    authentication_classes = [TokenAcessoAuthentication]
    permission_classes = [EhAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]
```

- [ ] **Step 5: Registrar a rota em `plataforma/urls.py`**

Substituir:
```python
from .views import LoginView, LogoutView, ModuloViewSet

router = DefaultRouter()
router.register(r"modulos", ModuloViewSet, basename="modulo")
```

Por:
```python
from .views import LoginView, LogoutView, ModuloViewSet, UsuarioViewSet

router = DefaultRouter()
router.register(r"modulos", ModuloViewSet, basename="modulo")
router.register(r"usuarios", UsuarioViewSet, basename="usuario")
```

- [ ] **Step 6: Rodar o teste novamente**

Run: `python manage.py test plataforma -v 2`
Expected: `OK` — todos os testes do app `plataforma` passando (Tasks 1, 2, 4, 5, 6, 7 e 8 somados).

- [ ] **Step 7: Commit**

```bash
git add plataforma/serializers.py plataforma/views.py plataforma/urls.py plataforma/tests/test_views.py
git commit -m "feat(plataforma): UsuarioViewSet para criação e gestão de papéis"
```

---

### Task 9: Management command `criar_admin`

**Files:**
- Create: `plataforma/management/__init__.py`
- Create: `plataforma/management/commands/__init__.py`
- Create: `plataforma/management/commands/criar_admin.py`
- Test: `plataforma/tests/test_management_command.py`

**Interfaces:**
- Consumes: `plataforma.models.Perfil` (Task 1)
- Produces: comando `python manage.py criar_admin <username> <password>`

- [ ] **Step 1: Criar a estrutura de pacotes**

```bash
mkdir -p plataforma/management/commands
touch plataforma/management/__init__.py plataforma/management/commands/__init__.py
```

- [ ] **Step 2: Escrever o teste**

```python
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from plataforma.models import Perfil


class CriarAdminCommandTest(TestCase):
    def test_cria_usuario_com_papel_admin(self):
        out = StringIO()
        call_command("criar_admin", "admin", "senha-boa-123", stdout=out)
        user = User.objects.get(username="admin")
        self.assertEqual(user.perfil.papel, Perfil.ADMIN)
        self.assertIn("criado com sucesso", out.getvalue())

    def test_erro_se_usuario_ja_existe(self):
        User.objects.create_user(username="admin", password="x")
        with self.assertRaises(CommandError):
            call_command("criar_admin", "admin", "outrasenha")
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `python manage.py test plataforma.tests.test_management_command -v 2`
Expected: `FAIL` — comando `criar_admin` não existe.

- [ ] **Step 4: Escrever `plataforma/management/commands/criar_admin.py`**

```python
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from plataforma.models import Perfil


class Command(BaseCommand):
    help = "Cria o primeiro usuário administrador da plataforma."

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("password")

    def handle(self, *args, **options):
        username = options["username"]
        password = options["password"]
        if User.objects.filter(username=username).exists():
            raise CommandError(f"Usuário '{username}' já existe.")
        user = User.objects.create_user(username=username, password=password)
        Perfil.objects.create(user=user, papel=Perfil.ADMIN)
        self.stdout.write(self.style.SUCCESS(f"Administrador '{username}' criado com sucesso."))
```

- [ ] **Step 5: Rodar o teste novamente**

Run: `python manage.py test plataforma.tests.test_management_command -v 2`
Expected: `OK` — 2 testes passando.

- [ ] **Step 6: Commit**

```bash
git add plataforma/management plataforma/tests/test_management_command.py
git commit -m "feat(plataforma): comando criar_admin para o primeiro acesso"
```

---

### Task 10: Proteger a API existente (settings.py + api_views.py + operacao_views.py)

**Files:**
- Modify: `easystock/settings.py:149-155`
- Modify: `core/api_views.py`
- Modify: `core/operacao_views.py`

**Interfaces:**
- Consumes: `plataforma.authentication.TokenAcessoAuthentication` (Task 4), `plataforma.permissions.RequerModuloAtivo` (Task 5)

> **Atenção:** esta tarefa deixa `core/tests/test_api.py` **temporariamente vermelho** (testes assumem acesso anônimo). Isso é esperado e corrigido na Task 11, na sequência imediata. `core/tests/test_operacao_spec.py` deve continuar **verde** — se não continuar, revise o Step 3 antes de prosseguir.

- [ ] **Step 1: Atualizar `REST_FRAMEWORK` em `easystock/settings.py`**

Localizar (linhas 149-155):
```python
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": None,
    # Em produção troque para IsAuthenticated e configure auth de sessão/token
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}
```

Substituir por:
```python
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": None,
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "plataforma.authentication.TokenAcessoAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
```

- [ ] **Step 2: Aplicar `permission_classes` em cada ViewSet de `core/api_views.py`**

Adicionar o import no topo do arquivo (junto aos imports já existentes):
```python
from rest_framework.permissions import IsAuthenticated
from plataforma.permissions import RequerModuloAtivo
```

Para cada classe abaixo, adicionar a linha `permission_classes = [...]` logo após a declaração da classe (antes do primeiro atributo/método já existente):

```python
class AlertasView(APIView):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("alertas")]
    def get(self, request):
        ...


class PrestacaoContasView(APIView):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("relatorios")]
    def get(self, request):
        ...


class CategoriaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario")]
    queryset = Categoria.objects.all().order_by("name")
    serializer_class = CategoriaSerializer


class ProdutoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario")]
    serializer_class = ProdutoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome"]
    ...


class GrupoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario")]
    queryset = Grupo.objects.select_related("categoria").all()
    serializer_class = GrupoSerializer


class BemPermanenteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("inventario")]
    queryset = BemPermanente.objects.all()
    serializer_class = BemPermanenteSerializer
    ...


class FornecedorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("fornecedores")]
    serializer_class = FornecedorSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["nome", "documento"]
    ...


class MovimentacaoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("movimentacoes")]
    serializer_class = MovimentacaoSerializer
    http_method_names = ["get", "post", "head", "options"]
    ...


class EntradaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RequerModuloAtivo("movimentacoes")]
    serializer_class = EntradaSerializer
    http_method_names = ["get", "post", "head", "options"]
    ...
```

(Mantenha todo o restante do corpo de cada classe exatamente como está hoje — a única mudança é a linha `permission_classes` adicionada.)

- [ ] **Step 3: Preservar acesso anônimo em `core/operacao_views.py`**

Adicionar o import no topo do arquivo:
```python
from rest_framework.permissions import AllowAny
from plataforma.permissions import RequerModuloAtivo
```

Para cada classe abaixo, adicionar `permission_classes = [AllowAny, RequerModuloAtivo("merenda")]` logo após a declaração:

```python
class OperacaoLoginView(APIView):
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]
    """
    POST /api/operacao/auth/
    ...
    """
    def post(self, request):
        ...


class OperacaoLogoutView(APIView):
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]
    """DELETE /api/operacao/auth/ — invalida o token."""
    def delete(self, request):
        ...


class ContagemView(APIView):
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]
    """
    POST — registra frequência de uma turma (app-alunos, perfil ALUNO_REP).
    ...
    """
    @requer_perfil_operacao(PERFIL_ALUNO)
    def post(self, request):
        ...

    @requer_perfil_operacao(PERFIL_COZINHA, PERFIL_ALUNO)
    def get(self, request):
        ...


class ResumoFrequenciaView(APIView):
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]
    def get(self, request):
        ...


class PlanoDoDiaView(APIView):
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]

    @requer_perfil_operacao(PERFIL_COZINHA)
    def get(self, request):
        ...


class BaixaProducaoView(APIView):
    permission_classes = [AllowAny, RequerModuloAtivo("merenda")]

    @requer_perfil_operacao(PERFIL_COZINHA)
    def post(self, request):
        ...
```

(Mantenha o restante do corpo de cada classe exatamente como está hoje.)

- [ ] **Step 4: Rodar a suíte de operação — deve continuar verde**

Run: `python manage.py test core.tests.test_operacao_spec core.tests.test_operacao -v 2`
Expected: `OK` — nenhuma falha (as views de operação continuam anônimas, só ganharam a checagem de módulo).

- [ ] **Step 5: Rodar a suíte de API — falha esperada nesta etapa**

Run: `python manage.py test core.tests.test_api -v 2`
Expected: `FAIL` em todos os testes com `401 Unauthorized` (comportamento esperado — corrigido na Task 11).

- [ ] **Step 6: Commit**

```bash
git add easystock/settings.py core/api_views.py core/operacao_views.py
git commit -m "feat(core): protege API existente com autenticação e módulos ativos"
```

---

### Task 11: Atualizar `core/tests/test_api.py` para autenticar

**Files:**
- Create: `core/tests/utils.py`
- Modify: `core/tests/test_api.py`

**Interfaces:**
- Consumes: `plataforma.models.{Modulo,Perfil,TokenAcesso}` (Task 1)
- Produces: `core.tests.utils.AutenticadoAPITestCase` (base class reutilizável)

- [ ] **Step 1: Escrever `core/tests/utils.py`**

```python
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from plataforma.models import Modulo, Perfil, TokenAcesso

MODULOS_PADRAO = ["inventario", "movimentacoes", "fornecedores", "alertas", "relatorios", "merenda"]


class AutenticadoAPITestCase(APITestCase):
    """
    Base para testes de API que precisam de um usuário autenticado com
    todos os módulos ativos. Popula um usuário ADMIN e autentica o
    `self.client` via header Authorization antes de cada teste.
    """

    def setUp(self):
        inventario = None
        for slug in MODULOS_PADRAO:
            modulo, _ = Modulo.objects.get_or_create(
                slug=slug, defaults={"nome": slug.capitalize(), "ativo": True}
            )
            if slug == "inventario":
                inventario = modulo
        Modulo.objects.filter(slug="merenda").update(depende_de=inventario)

        self.user = User.objects.create_user(username="teste-admin", password="senha-boa-123")
        Perfil.objects.create(user=self.user, papel=Perfil.ADMIN)
        self.token = TokenAcesso.objects.create(
            user=self.user, expira_em=timezone.now() + timedelta(hours=1)
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.token}")
```

- [ ] **Step 2: Atualizar os imports e declarações de classe em `core/tests/test_api.py`**

Localizar a primeira linha do arquivo:
```python
from rest_framework.test import APITestCase
from core.models import Categoria, Grupo, Produto
```

Substituir por:
```python
from core.models import Categoria, Grupo, Produto
from core.tests.utils import AutenticadoAPITestCase
```

Trocar `(APITestCase)` por `(AutenticadoAPITestCase)` nas 8 classes do arquivo:
```python
class GrupoApiTest(AutenticadoAPITestCase):
class ProdutoApiTest(AutenticadoAPITestCase):
class BemPermanenteApiTest(AutenticadoAPITestCase):
class FornecedorApiTest(AutenticadoAPITestCase):
class ProdutoFornecedorApiTest(AutenticadoAPITestCase):
class MovimentacaoApiTest(AutenticadoAPITestCase):
class EntradaApiTest(AutenticadoAPITestCase):
class ProdutoQuantidadeReadOnlyTest(AutenticadoAPITestCase):
```

Para as 6 classes que já têm um método `setUp` próprio (`ProdutoApiTest`, `ProdutoFornecedorApiTest`, `MovimentacaoApiTest`, `EntradaApiTest`, `ProdutoQuantidadeReadOnlyTest`), adicionar `super().setUp()` como primeira linha do método. Exemplo para `ProdutoApiTest`:

```python
class ProdutoApiTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Carboidratos", categoria=self.cat)
```

Fazer a mesma alteração (adicionar `super().setUp()` como primeira linha) nas 4 classes restantes que têm `setUp` próprio:

```python
class ProdutoFornecedorApiTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        self.cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=self.cat)
```

```python
class MovimentacaoApiTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=10, unidade="KG")
```

```python
class EntradaApiTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.p1 = Produto.objects.create(nome="Arroz", grupo=self.grupo, quantidade=0, unidade="KG")
        self.p2 = Produto.objects.create(nome="Feijão", grupo=self.grupo, quantidade=0, unidade="KG")
```

```python
class ProdutoQuantidadeReadOnlyTest(AutenticadoAPITestCase):
    def setUp(self):
        super().setUp()
        cat = Categoria.objects.create(name="Alimentos")
        self.grupo = Grupo.objects.create(nome="Geral", categoria=cat)
```

`GrupoApiTest` e `FornecedorApiTest` não têm `setUp` próprio — herdam o `setUp` de `AutenticadoAPITestCase` automaticamente, sem necessidade de edição além da troca da classe base já feita no início deste Step.

- [ ] **Step 3: Rodar a suíte completa do backend**

Run: `python manage.py test -v 2`
Expected: `OK` — todos os testes de `core` e `plataforma` passando, incluindo `test_api.py` (agora autenticado) e `test_operacao_spec.py` (continua anônimo e verde).

- [ ] **Step 4: Commit**

```bash
git add core/tests/utils.py core/tests/test_api.py
git commit -m "test(core): autentica os testes de API existentes com AutenticadoAPITestCase"
```

---

### Task 12: Frontend — helper de autenticação + header `Authorization`

**Files:**
- Create: `frontend/src/lib/auth.js`
- Modify: `frontend/src/api/http.js:15-29`
- Test: `frontend/src/lib/auth.test.js`

**Interfaces:**
- Produces: `salvarSessao({token, papel, modulos_ativos})`, `limparSessao()`, `getToken()`, `getPapel()`, `getModulosAtivos()`, `estaAutenticado()`, `ehAdmin()` — todos em `frontend/src/lib/auth.js`

- [ ] **Step 1: Escrever o teste**

```javascript
import { describe, it, expect, beforeEach } from "vitest"
import {
  salvarSessao, limparSessao, getToken, getPapel,
  getModulosAtivos, estaAutenticado, ehAdmin,
} from "./auth"

describe("auth", () => {
  beforeEach(() => sessionStorage.clear())

  it("salva e recupera a sessão", () => {
    salvarSessao({ token: "abc-123", papel: "ADMIN", modulos_ativos: ["inventario", "merenda"] })
    expect(getToken()).toBe("abc-123")
    expect(getPapel()).toBe("ADMIN")
    expect(getModulosAtivos()).toEqual(["inventario", "merenda"])
    expect(estaAutenticado()).toBe(true)
    expect(ehAdmin()).toBe(true)
  })

  it("limparSessao remove tudo", () => {
    salvarSessao({ token: "abc-123", papel: "OPERADOR", modulos_ativos: [] })
    limparSessao()
    expect(getToken()).toBeNull()
    expect(estaAutenticado()).toBe(false)
    expect(ehAdmin()).toBe(false)
  })

  it("getModulosAtivos retorna array vazio sem sessão", () => {
    expect(getModulosAtivos()).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/lib/auth.test.js`
Expected: `FAIL` — `src/lib/auth.js` não existe.

- [ ] **Step 3: Escrever `frontend/src/lib/auth.js`**

```javascript
const TOKEN_KEY = "edustock:auth:token"
const PAPEL_KEY = "edustock:auth:papel"
const MODULOS_KEY = "edustock:auth:modulos"

export function salvarSessao({ token, papel, modulos_ativos }) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(PAPEL_KEY, papel)
  sessionStorage.setItem(MODULOS_KEY, JSON.stringify(modulos_ativos))
}

export function limparSessao() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PAPEL_KEY)
  sessionStorage.removeItem(MODULOS_KEY)
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getPapel() {
  return sessionStorage.getItem(PAPEL_KEY)
}

export function getModulosAtivos() {
  const raw = sessionStorage.getItem(MODULOS_KEY)
  return raw ? JSON.parse(raw) : []
}

export function estaAutenticado() {
  return Boolean(getToken())
}

export function ehAdmin() {
  return getPapel() === "ADMIN"
}
```

- [ ] **Step 4: Rodar o teste novamente**

Run: `cd frontend && npx vitest run src/lib/auth.test.js`
Expected: `PASS` — 3 testes passando.

- [ ] **Step 5: Adicionar o header `Authorization` em `frontend/src/api/http.js`**

Localizar (linhas 13-21):
```javascript
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  })
```

Substituir por:
```javascript
import { getToken } from "../lib/auth"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

async function req(path, { method = "GET", body } = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  })
```

- [ ] **Step 6: Rodar a suíte completa do frontend**

Run: `cd frontend && npm test`
Expected: `PASS` — nenhuma regressão nos testes já existentes.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/lib/auth.js src/lib/auth.test.js src/api/http.js
git commit -m "feat(frontend): helper de sessão + header Authorization no cliente HTTP"
```

---

### Task 13: Frontend — `LoginPage` + guarda de rota

**Files:**
- Create: `frontend/src/pages/LoginPage.jsx`
- Create: `frontend/src/components/RequireAuth.jsx`
- Create: `frontend/src/components/RequireAuth.test.jsx`
- Modify: `frontend/src/main.jsx`

**Interfaces:**
- Consumes: `salvarSessao`, `estaAutenticado` de `frontend/src/lib/auth.js` (Task 12)
- Produces: rota `/login`, componente `RequireAuth` (guard de rota)

- [ ] **Step 1: Escrever o teste de `RequireAuth`**

```jsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import RequireAuth from "./RequireAuth"
import { salvarSessao } from "../lib/auth"

function renderComGuarda(rota) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/login" element={<div>Tela de login</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/inventario" element={<div>Página protegida</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("RequireAuth", () => {
  beforeEach(() => sessionStorage.clear())

  it("redireciona para /login sem sessão", () => {
    renderComGuarda("/inventario")
    expect(screen.getByText("Tela de login")).toBeInTheDocument()
  })

  it("renderiza a rota protegida com sessão válida", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: [] })
    renderComGuarda("/inventario")
    expect(screen.getByText("Página protegida")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/components/RequireAuth.test.jsx`
Expected: `FAIL` — `RequireAuth.jsx` não existe.

- [ ] **Step 3: Escrever `frontend/src/components/RequireAuth.jsx`**

```jsx
import { Navigate, Outlet } from "react-router-dom"
import { estaAutenticado } from "../lib/auth"

export default function RequireAuth() {
  if (!estaAutenticado()) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
```

- [ ] **Step 4: Rodar o teste novamente**

Run: `cd frontend && npx vitest run src/components/RequireAuth.test.jsx`
Expected: `PASS` — 2 testes passando.

- [ ] **Step 5: Escrever `frontend/src/pages/LoginPage.jsx`**

```jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { salvarSessao } from "../lib/auth"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
      const resp = await fetch(`${base}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (!resp.ok) {
        setErro("Usuário ou senha inválidos.")
        return
      }
      const data = await resp.json()
      salvarSessao(data)
      navigate("/inventario")
    } catch {
      setErro("Falha na conexão.")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8">
        <h1 className="mb-6 font-display text-2xl font-bold">Entrar no EduStock</h1>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">Usuário</span>
          <input
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">Senha</span>
          <input
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {erro && <p className="mb-4 text-sm text-out">{erro}</p>}
        <button type="submit" disabled={carregando} className="btn w-full">
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Atualizar `frontend/src/main.jsx`**

Substituir o arquivo inteiro por:
```jsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import "./index.css"
import MainLayout from "./layouts/MainLayout"
import RequireAuth from "./components/RequireAuth"
import LoginPage from "./pages/LoginPage"
import InventarioPage from "./pages/InventarioPage"
import MovimentacoesPage from "./pages/MovimentacoesPage"
import AlertasPage from "./pages/AlertasPage"
import FornecedoresPage from "./pages/FornecedoresPage"
import RelatoriosPage from "./pages/RelatoriosPage"
import MerendaPage from "./pages/MerendaPage"
import PerfilPage from "./pages/PerfilPage"
import ConfiguracoesPage from "./pages/ConfiguracoesPage"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route index element={<Navigate to="/inventario" replace />} />
            <Route path="inventario" element={<InventarioPage />} />
            <Route path="movimentacoes" element={<MovimentacoesPage />} />
            <Route path="alertas" element={<AlertasPage />} />
            <Route path="fornecedores" element={<FornecedoresPage />} />
            <Route path="relatorios" element={<RelatoriosPage />} />
            <Route path="merenda" element={<MerendaPage />} />
            <Route path="perfil" element={<PerfilPage />} />
            <Route path="configuracoes" element={<ConfiguracoesPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
```

(Os componentes `AdminModulosPage` e `RequireModule` das Tasks 14 e 15 serão adicionados a este arquivo nas próprias tarefas.)

- [ ] **Step 7: Rodar a suíte completa do frontend**

Run: `cd frontend && npm test`
Expected: `PASS` — nenhuma regressão.

- [ ] **Step 8: Commit**

```bash
cd frontend
git add src/pages/LoginPage.jsx src/components/RequireAuth.jsx \
        src/components/RequireAuth.test.jsx src/main.jsx
git commit -m "feat(frontend): tela de login e guarda de rota"
```

---

### Task 14: Frontend — `RequireModule` + Sidebar filtrada por módulos ativos

**Files:**
- Create: `frontend/src/components/RequireModule.jsx`
- Create: `frontend/src/pages/ModuloIndisponivelPage.jsx`
- Modify: `frontend/src/layouts/Sidebar.jsx`
- Modify: `frontend/src/main.jsx`
- Test: `frontend/src/layouts/Sidebar.test.jsx`

**Interfaces:**
- Consumes: `getModulosAtivos()` de `frontend/src/lib/auth.js` (Task 12)
- Produces: componente `RequireModule({ slug })`, página `ModuloIndisponivelPage`

- [ ] **Step 1: Escrever o teste da Sidebar**

```jsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import Sidebar from "./Sidebar"
import { salvarSessao } from "../lib/auth"

describe("Sidebar", () => {
  beforeEach(() => sessionStorage.clear())

  it("esconde itens de módulos desativados", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: ["inventario"] })
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText("Inventário")).toBeInTheDocument()
    expect(screen.queryByText("Fornecedores")).not.toBeInTheDocument()
  })

  it("sempre mostra Perfil e Configurações mesmo sem módulos ativos", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: [] })
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText("Perfil")).toBeInTheDocument()
    expect(screen.getByText("Configurações")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/layouts/Sidebar.test.jsx`
Expected: `FAIL` — `Fornecedores` ainda aparece incondicionalmente.

- [ ] **Step 3: Atualizar `frontend/src/layouts/Sidebar.jsx`**

Substituir o arquivo inteiro por:
```jsx
import { useState } from "react"
import { NavLink } from "react-router-dom"
import { Icon } from "../lib/icons.jsx"
import { getModulosAtivos } from "../lib/auth"

const navItems = [
  { to: "/inventario", label: "Inventário", icon: "grid", section: "Operacional", modulo: "inventario" },
  { to: "/movimentacoes", label: "Movimentações", icon: "refresh", section: "Operacional", modulo: "movimentacoes" },
  { to: "/alertas", label: "Alertas", icon: "alert", section: "Operacional", modulo: "alertas" },
  { to: "/fornecedores", label: "Fornecedores", icon: "users", section: "Gestão", modulo: "fornecedores" },
  { to: "/relatorios", label: "Relatórios", icon: "report", section: "Gestão", modulo: "relatorios" },
  { to: "/merenda", label: "Merenda", icon: "food", section: "Gestão", modulo: "merenda" },
  { to: "/perfil", label: "Perfil", icon: "home", section: "Sistema", modulo: null },
  { to: "/configuracoes", label: "Configurações", icon: "gear", section: "Sistema", modulo: null },
]

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const modulosAtivos = getModulosAtivos()
  const itensVisiveis = navItems.filter((item) => !item.modulo || modulosAtivos.includes(item.modulo))
  const sections = ["Operacional", "Gestão", "Sistema"]

  return (
    <aside
      className={`sticky top-0 hidden h-screen ${isExpanded ? 'lg:w-56' : 'lg:w-16'} shrink-0 flex-col gap-4 border-r border-line bg-surface/60 py-4 px-2 lg:flex transition-all duration-300 ease-in-out`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {sections.map((section) => {
        const items = itensVisiveis.filter(item => item.section === section)
        if (items.length === 0) return null
        return (
          <div key={section} className="flex flex-col gap-1">
            <h3 className={`${isExpanded ? 'lg:inline' : 'lg:hidden'} px-3 py-1 text-xs font-medium text-neutral-400 uppercase tracking-wider`}>
              {section}
            </h3>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isActive
                      ? "bg-brand text-[#f4f1e7]"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`
                }
              >
                <span className="shrink-0">
                  {Icon[item.icon](21)}
                </span>
                <span className={`${isExpanded ? 'lg:inline' : 'lg:hidden'} text-sm font-medium`}>
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 4: Rodar o teste novamente**

Run: `cd frontend && npx vitest run src/layouts/Sidebar.test.jsx`
Expected: `PASS` — 2 testes passando.

- [ ] **Step 5: Escrever `frontend/src/components/RequireModule.jsx`**

```jsx
import { Navigate, Outlet } from "react-router-dom"
import { getModulosAtivos } from "../lib/auth"

export default function RequireModule({ slug }) {
  const modulos = getModulosAtivos()
  if (!modulos.includes(slug)) {
    return <Navigate to="/modulo-indisponivel" replace />
  }
  return <Outlet />
}
```

- [ ] **Step 6: Escrever `frontend/src/pages/ModuloIndisponivelPage.jsx`**

```jsx
export default function ModuloIndisponivelPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-display text-xl font-bold">Módulo indisponível</h1>
      <p className="text-ink-soft">
        Este módulo foi desativado pelo administrador do sistema.
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Envolver as rotas de módulo em `frontend/src/main.jsx`**

Localizar o bloco de rotas dentro de `<Route element={<MainLayout />}>` (escrito na Task 13) e substituir por:
```jsx
<Route element={<MainLayout />}>
  <Route index element={<Navigate to="/inventario" replace />} />

  <Route element={<RequireModule slug="inventario" />}>
    <Route path="inventario" element={<InventarioPage />} />
  </Route>
  <Route element={<RequireModule slug="movimentacoes" />}>
    <Route path="movimentacoes" element={<MovimentacoesPage />} />
  </Route>
  <Route element={<RequireModule slug="alertas" />}>
    <Route path="alertas" element={<AlertasPage />} />
  </Route>
  <Route element={<RequireModule slug="fornecedores" />}>
    <Route path="fornecedores" element={<FornecedoresPage />} />
  </Route>
  <Route element={<RequireModule slug="relatorios" />}>
    <Route path="relatorios" element={<RelatoriosPage />} />
  </Route>
  <Route element={<RequireModule slug="merenda" />}>
    <Route path="merenda" element={<MerendaPage />} />
  </Route>

  <Route path="perfil" element={<PerfilPage />} />
  <Route path="configuracoes" element={<ConfiguracoesPage />} />
  <Route path="modulo-indisponivel" element={<ModuloIndisponivelPage />} />
</Route>
```

E adicionar os imports correspondentes no topo do arquivo:
```jsx
import RequireModule from "./components/RequireModule"
import ModuloIndisponivelPage from "./pages/ModuloIndisponivelPage"
```

- [ ] **Step 8: Rodar a suíte completa do frontend**

Run: `cd frontend && npm test`
Expected: `PASS` — nenhuma regressão.

- [ ] **Step 9: Commit**

```bash
cd frontend
git add src/components/RequireModule.jsx src/pages/ModuloIndisponivelPage.jsx \
        src/layouts/Sidebar.jsx src/layouts/Sidebar.test.jsx src/main.jsx
git commit -m "feat(frontend): RequireModule e Sidebar filtrada pelos módulos ativos"
```

---

### Task 15: Frontend — `AdminModulosPage`

**Files:**
- Create: `frontend/src/pages/AdminModulosPage.jsx`
- Create: `frontend/src/pages/AdminModulosPage.test.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/layouts/Sidebar.jsx`

**Interfaces:**
- Consumes: `getToken()`, `ehAdmin()` de `frontend/src/lib/auth.js` (Task 12), `useToast` de `frontend/src/components/ui/Toast.jsx`

- [ ] **Step 1: Escrever o teste**

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import AdminModulosPage from "./AdminModulosPage"
import { salvarSessao } from "../lib/auth"
import { ToastProvider } from "../components/ui/Toast"

describe("AdminModulosPage", () => {
  beforeEach(() => {
    sessionStorage.clear()
    salvarSessao({ token: "abc", papel: "ADMIN", modulos_ativos: ["inventario"] })
  })
  afterEach(() => vi.restoreAllMocks())

  it("lista módulos e permite togglear", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ slug: "inventario", nome: "Inventário", descricao: "", ativo: true }]),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ slug: "inventario", nome: "Inventário", descricao: "", ativo: false }]),
      })

    render(<ToastProvider><AdminModulosPage /></ToastProvider>)
    await waitFor(() => expect(screen.getByText("Inventário")).toBeInTheDocument())
    fireEvent.click(screen.getByText("Ativo"))
    await waitFor(() => expect(screen.getByText("Inativo")).toBeInTheDocument())
  })

  it("mostra mensagem para quem não é admin", () => {
    salvarSessao({ token: "abc", papel: "OPERADOR", modulos_ativos: ["inventario"] })
    render(<ToastProvider><AdminModulosPage /></ToastProvider>)
    expect(screen.getByText(/apenas administradores/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/AdminModulosPage.test.jsx`
Expected: `FAIL` — `AdminModulosPage.jsx` não existe.

- [ ] **Step 3: Escrever `frontend/src/pages/AdminModulosPage.jsx`**

```jsx
import { useEffect, useState } from "react"
import { getToken, ehAdmin } from "../lib/auth"
import { useToast } from "../components/ui/Toast"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export default function AdminModulosPage() {
  const [modulos, setModulos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const toast = useToast()

  useEffect(() => {
    if (ehAdmin()) carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const resp = await fetch(`${BASE}/modulos/`, {
      headers: { Authorization: `Token ${getToken()}` },
    })
    const data = await resp.json()
    setModulos(data)
    setCarregando(false)
  }

  async function togglear(slug, ativo) {
    const resp = await fetch(`${BASE}/modulos/${slug}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
      body: JSON.stringify({ ativo: !ativo }),
    })
    if (!resp.ok) {
      const data = await resp.json()
      toast(data.detail || "Não foi possível alterar o módulo.", "danger")
      return
    }
    carregar()
  }

  if (!ehAdmin()) {
    return <p className="p-6 text-ink-soft">Apenas administradores acessam esta página.</p>
  }
  if (carregando) return <p className="p-6 text-ink-soft">Carregando módulos…</p>

  return (
    <div className="p-6">
      <h1 className="mb-4 font-display text-xl font-bold">Módulos do sistema</h1>
      <div className="flex flex-col gap-2">
        {modulos.map((m) => (
          <div key={m.slug} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">{m.nome}</p>
              <p className="text-sm text-ink-soft">{m.descricao}</p>
            </div>
            <button
              onClick={() => togglear(m.slug, m.ativo)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                m.ativo ? "bg-brand text-white" : "bg-surface-2 text-ink-soft"
              }`}
            >
              {m.ativo ? "Ativo" : "Inativo"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste novamente**

Run: `cd frontend && npx vitest run src/pages/AdminModulosPage.test.jsx`
Expected: `PASS` — 2 testes passando.

- [ ] **Step 5: Registrar a rota em `frontend/src/main.jsx`**

Adicionar o import:
```jsx
import AdminModulosPage from "./pages/AdminModulosPage"
```

Adicionar a rota dentro de `<Route element={<MainLayout />}>`, junto às demais (`perfil`/`configuracoes`):
```jsx
<Route path="admin/modulos" element={<AdminModulosPage />} />
```

- [ ] **Step 6: Adicionar o item no `Sidebar` só para `ADMIN`**

Em `frontend/src/layouts/Sidebar.jsx`, adicionar ao array `navItems` (seção Sistema):
```jsx
{ to: "/admin/modulos", label: "Módulos", icon: "gear", section: "Sistema", modulo: null, somenteAdmin: true },
```

Atualizar o filtro `itensVisiveis` para considerar o papel:
```jsx
import { getModulosAtivos, ehAdmin } from "../lib/auth"

// ...

const modulosAtivos = getModulosAtivos()
const itensVisiveis = navItems.filter((item) => {
  if (item.somenteAdmin && !ehAdmin()) return false
  return !item.modulo || modulosAtivos.includes(item.modulo)
})
```

- [ ] **Step 7: Rodar a suíte completa do frontend**

Run: `cd frontend && npm test`
Expected: `PASS` — nenhuma regressão.

- [ ] **Step 8: Commit**

```bash
cd frontend
git add src/pages/AdminModulosPage.jsx src/pages/AdminModulosPage.test.jsx \
        src/main.jsx src/layouts/Sidebar.jsx
git commit -m "feat(frontend): painel admin de módulos ativáveis"
```

---

## Validação final (depois da Task 15)

- [ ] Rodar `python manage.py test` na raiz do projeto — suíte completa (core + plataforma) deve passar 100%.
- [ ] Rodar `cd frontend && npm test` — suíte completa deve passar 100%.
- [ ] Rodar `cd frontend && npm run build` — build deve completar sem erros.
- [ ] Criar o primeiro admin manualmente: `python manage.py criar_admin admin <senha-forte>`.
- [ ] Testar manualmente no navegador: login com o admin criado, ver os 6 módulos ativos na Sidebar, desativar "Fornecedores" na tela `/admin/modulos`, confirmar que o item some da Sidebar e que `GET /api/fornecedores/` retorna 403.
- [ ] Confirmar que `app-alunos`/`app-cozinha` continuam logando por PIN normalmente sem nenhuma mudança visível.
