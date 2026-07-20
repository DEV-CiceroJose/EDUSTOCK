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
