import getpass
import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from plataforma.models import Modulo, Perfil


class Command(BaseCommand):
    help = "Cria o primeiro usuário administrador da plataforma."

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("--password-env", metavar="VARIAVEL")

    def handle(self, *args, **options):
        username = options["username"]
        password_env = options.get("password_env")
        if password_env:
            password = os.environ.get(password_env)
            if not password:
                raise CommandError(f"A variável de ambiente '{password_env}' não está definida.")
        else:
            password = getpass.getpass("Senha: ")
        if not password:
            raise CommandError("A senha não pode ser vazia.")
        if User.objects.filter(username=username).exists():
            raise CommandError(f"Usuário '{username}' já existe.")
        user = User.objects.create_user(username=username, password=password, is_staff=True)
        perfil = Perfil.objects.create(user=user, papel=Perfil.ADMIN)
        perfil.modulos.set(Modulo.objects.filter(ativo=True))
        self.stdout.write(self.style.SUCCESS(f"Administrador '{username}' criado com sucesso."))
