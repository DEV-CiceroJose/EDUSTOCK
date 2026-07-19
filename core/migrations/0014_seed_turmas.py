from django.db import migrations

TURMAS = [
    ("1º DS-A", "DS", 1), ("1º DS-B", "DS", 1),
    ("2º DS-A", "DS", 2), ("2º DS-B", "DS", 2),
    ("3º DS-A", "DS", 3), ("3º DS-B", "DS", 3),
    ("1º TET-A", "TET", 1), ("1º TET-B", "TET", 1),
    ("2º TET-A", "TET", 2), ("2º TET-B", "TET", 2),
    ("3º TET-A", "TET", 3), ("3º TET-B", "TET", 3),
]


def criar_turmas(apps, schema_editor):
    Turma = apps.get_model("core", "Turma")
    for nome, curso, ano in TURMAS:
        Turma.objects.get_or_create(
            nome=nome, defaults={"curso": curso, "ano": ano, "turno": "INTEGRAL"}
        )


def remover_turmas(apps, schema_editor):
    Turma = apps.get_model("core", "Turma")
    Turma.objects.filter(nome__in=[nome for nome, _, _ in TURMAS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0013_turma_pinacesso"),
    ]

    operations = [
        migrations.RunPython(criar_turmas, remover_turmas),
    ]
