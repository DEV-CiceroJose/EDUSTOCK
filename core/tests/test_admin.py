from django.contrib import admin
from django.test import TestCase

from core.models import (
    BemPermanente,
    Categoria,
    ConfiguracaoAlertas,
    Entrada,
    FatorConsumo,
    Fornecedor,
    FrequenciaDiaria,
    Grupo,
    Movimentacao,
    PinAcesso,
    Produto,
    Turma,
)


class CoreAdminRegistrationTest(TestCase):
    def test_todos_os_modelos_operacionais_estao_registrados(self):
        modelos = (
            Categoria,
            Grupo,
            Produto,
            Fornecedor,
            BemPermanente,
            Entrada,
            Movimentacao,
            FrequenciaDiaria,
            FatorConsumo,
            Turma,
            PinAcesso,
            ConfiguracaoAlertas,
        )
        for modelo in modelos:
            with self.subTest(modelo=modelo.__name__):
                self.assertTrue(admin.site.is_registered(modelo))

    def test_ledger_e_somente_leitura_no_admin(self):
        request = type("Request", (), {})()
        for modelo in (Entrada, Movimentacao):
            model_admin = admin.site._registry[modelo]
            with self.subTest(modelo=modelo.__name__):
                self.assertFalse(model_admin.has_add_permission(request))
                self.assertFalse(model_admin.has_change_permission(request))
                self.assertFalse(model_admin.has_delete_permission(request))
