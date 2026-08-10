from django.contrib import admin
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.client import RequestFactory

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

    def test_produto_tem_saldo_e_validade_somente_leitura(self):
        model_admin = admin.site._registry[Produto]
        self.assertIn("quantidade", model_admin.readonly_fields)
        self.assertIn("validade", model_admin.readonly_fields)

    def test_admin_rejeita_conversao_de_dimensoes_incompativeis(self):
        categoria = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=categoria)
        usuario = User.objects.create_superuser(username="admin-conversao")
        request = RequestFactory().get("/admin/core/produto/add/")
        request.user = usuario
        form_class = admin.site._registry[Produto].get_form(request)
        form = form_class(data={
            "nome": "Arroz líquido",
            "grupo": grupo.pk,
            "unidade": "KG",
            "unidade_consumo": "ML",
            "conteudo_por_unidade": "1000",
            "estoque_minimo": "0",
            "perecivel": False,
            "periodicidade": "EVENTUAL",
        })

        self.assertFalse(form.is_valid())
        self.assertIn("unidade_consumo", form.errors)
