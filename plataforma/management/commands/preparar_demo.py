import os
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from core.models import Categoria, Entrada, Fornecedor, Grupo, PinAcesso, Produto, Turma
from core.services import registrar_entrada
from plataforma.models import Perfil, TokenAcesso


REQUIRED_ENV = (
    "DEMO_ADMIN_USERNAME",
    "DEMO_ADMIN_PASSWORD",
    "DEMO_OPERATOR_USERNAME",
    "DEMO_OPERATOR_PASSWORD",
    "DEMO_ALUNOS_PIN",
    "DEMO_COZINHA_PIN",
    "DEMO_EXPIRES_AT",
)
DEMO_ENTRY_NUMBER = "DEMO-FICTICIA-001"
DEMO_ADMIN_MATRICULA = "EDUSTOCK_DEMO_ADMIN_V1"
DEMO_OPERATOR_MATRICULA = "EDUSTOCK_DEMO_OPERATOR_V1"


class Command(BaseCommand):
    help = "Prepara dados exclusivamente fictícios para a demonstração descartável."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEMO_MODE:
            raise CommandError("DEMO_MODE precisa estar habilitado para preparar a demo.")

        values = self._read_environment()
        self._validate_expiration(values["DEMO_EXPIRES_AT"])
        self._validate_distinct_credentials(values)

        admin = self._ensure_user(
            username=values["DEMO_ADMIN_USERNAME"],
            password=values["DEMO_ADMIN_PASSWORD"],
            matricula=DEMO_ADMIN_MATRICULA,
            role=Perfil.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self._ensure_user(
            username=values["DEMO_OPERATOR_USERNAME"],
            password=values["DEMO_OPERATOR_PASSWORD"],
            matricula=DEMO_OPERATOR_MATRICULA,
            role=Perfil.OPERADOR,
            is_staff=False,
            is_superuser=False,
        )
        self._ensure_operational_access(values)
        self._ensure_inventory(admin)

        self.stdout.write(self.style.SUCCESS("Demonstração fictícia preparada com sucesso."))

    def _read_environment(self):
        values = {name: os.environ.get(name, "").strip() for name in REQUIRED_ENV}
        missing = [name for name, value in values.items() if not value]
        if missing:
            raise CommandError(
                "Variáveis obrigatórias ausentes: " + ", ".join(missing)
            )
        return values

    def _validate_expiration(self, raw_value):
        expires_at = parse_datetime(raw_value)
        if expires_at is None or timezone.is_naive(expires_at):
            raise CommandError("DEMO_EXPIRES_AT deve ser uma data/hora ISO 8601 com fuso.")
        if expires_at <= timezone.now():
            raise CommandError("A demonstração está expirada; nenhuma alteração foi aplicada.")

    def _validate_distinct_credentials(self, values):
        if values["DEMO_ADMIN_USERNAME"] == values["DEMO_OPERATOR_USERNAME"]:
            raise CommandError("Os usuários fictícios da demo precisam ser distintos.")
        if values["DEMO_ALUNOS_PIN"] == values["DEMO_COZINHA_PIN"]:
            raise CommandError("Os PINs fictícios da demo precisam ser distintos.")

    def _ensure_user(self, *, username, password, matricula, role, is_staff, is_superuser):
        profile = (
            Perfil.objects.select_related("user")
            .filter(matricula=matricula)
            .first()
        )
        conflicting_user = User.objects.filter(username=username)
        if profile:
            conflicting_user = conflicting_user.exclude(pk=profile.user_id)
        if conflicting_user.exists():
            raise CommandError("O username da demo já pertence a outra conta.")

        if profile is None:
            user = User.objects.create_user(
                username=username,
                password=password,
                is_active=True,
                is_staff=is_staff,
                is_superuser=is_superuser,
            )
            Perfil.objects.create(user=user, matricula=matricula, papel=role)
            return user

        user = profile.user
        changed_fields = []
        credentials_changed = False
        if user.username != username:
            user.username = username
            changed_fields.append("username")
            credentials_changed = True
        desired = {
            "is_active": True,
            "is_staff": is_staff,
            "is_superuser": is_superuser,
        }
        for field, value in desired.items():
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed_fields.append(field)
        if not user.check_password(password):
            user.set_password(password)
            changed_fields.append("password")
            credentials_changed = True
        if changed_fields:
            user.save(update_fields=changed_fields)
        if profile.papel != role:
            profile.papel = role
            profile.save(update_fields=["papel"])
        if credentials_changed:
            TokenAcesso.objects.filter(user=user).delete()
        return user

    def _ensure_operational_access(self, values):
        turma, _ = Turma.objects.get_or_create(
            nome="Turma Única - Demonstração",
            defaults={
                "curso": Turma.DS,
                "ano": 1,
                "turno": Turma.INTEGRAL,
                "ativo": True,
            },
        )
        self._ensure_pin(
            papel=PinAcesso.ALUNO_REP,
            turma=turma,
            raw_pin=values["DEMO_ALUNOS_PIN"],
            titular="Representante fictício",
        )
        self._ensure_pin(
            papel=PinAcesso.COZINHA,
            turma=None,
            raw_pin=values["DEMO_COZINHA_PIN"],
            titular="Equipe fictícia da cozinha",
        )

    def _ensure_pin(self, *, papel, turma, raw_pin, titular):
        pin, created = PinAcesso.objects.get_or_create(
            papel=papel,
            turma=turma,
            defaults={"pin": raw_pin, "titular": titular, "ativo": True},
        )
        if created:
            return pin
        changed_fields = []
        if not pin.confere_pin(raw_pin):
            pin.definir_pin(raw_pin)
            changed_fields.extend(["pin", "pin_fingerprint"])
        if pin.titular != titular:
            pin.titular = titular
            changed_fields.append("titular")
        if not pin.ativo:
            pin.ativo = True
            changed_fields.append("ativo")
        if changed_fields:
            pin.save(update_fields=changed_fields)
        return pin

    def _ensure_inventory(self, admin):
        categoria, _ = Categoria.objects.get_or_create(name="Alimentos fictícios")
        grupo, _ = Grupo.objects.get_or_create(
            categoria=categoria, nome="Itens básicos de demonstração"
        )
        fornecedor, _ = Fornecedor.objects.get_or_create(
            nome="Fornecedor Fictício da Escola",
            defaults={
                "documento": "00.000.000/0000-00",
                "email": "fornecedor.demo@example.invalid",
                "observacao": "Cadastro exclusivamente fictício e descartável.",
                "criado_por": admin,
                "atualizado_por": admin,
            },
        )
        product_specs = (
            ("Arroz parboilizado (fictício)", "KG", "G", "1000", "80", "6.50", 120),
            ("Feijão carioca (fictício)", "KG", "G", "1000", "40", "8.20", 90),
            ("Óleo vegetal (fictício)", "L", "ML", "1000", "12", "7.80", 180),
            ("Leite integral (fictício)", "L", "ML", "1000", "30", "5.40", 20),
        )
        quantities = ("100", "65", "24", "48")
        items = []
        for index, spec in enumerate(product_specs, start=1):
            name, unit, consumption_unit, content, minimum, price, shelf_life = spec
            product, _ = Produto.objects.get_or_create(
                nome=name,
                grupo=grupo,
                defaults={
                    "fornecedor": fornecedor,
                    "unidade": unit,
                    "unidade_consumo": consumption_unit,
                    "conteudo_por_unidade": Decimal(content),
                    "estoque_minimo": Decimal(minimum),
                    "perecivel": shelf_life < 60,
                    "periodicidade": "MENSAL",
                    "criado_por": admin,
                    "atualizado_por": admin,
                },
            )
            items.append(
                {
                    "produto": product,
                    "quantidade": Decimal(quantities[index - 1]),
                    "preco_unitario": Decimal(price),
                    "codigo_lote": f"DEMO-FICTICIO-{index:02d}",
                    "validade": timezone.localdate() + timedelta(days=shelf_life),
                }
            )

        if not Entrada.objects.filter(numero_nota_fiscal=DEMO_ENTRY_NUMBER).exists():
            registrar_entrada(
                fornecedor=fornecedor,
                numero_nota_fiscal=DEMO_ENTRY_NUMBER,
                observacao="Entrada exclusivamente fictícia criada para demonstração.",
                itens=items,
                user=admin,
            )
