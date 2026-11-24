"""Separa full_name en first_name y last_name.

La primera palabra pasa a ser el nombre y el resto, el apellido. Un nombre de una sola palabra queda
sin apellido: la migración no lo inventa (el dominio lo admite solo al restaurar, PersonName.restore).
"""

from django.db import migrations, models


def split_full_name(apps, schema_editor):
    users = apps.get_model("identity", "UserModel")
    for user in users.objects.all().only("id", "full_name"):
        first, _, last = " ".join(user.full_name.split()).partition(" ")
        users.objects.filter(pk=user.pk).update(first_name=first[:75], last_name=last[:75])


def join_names(apps, schema_editor):
    users = apps.get_model("identity", "UserModel")
    for user in users.objects.all().only("id", "first_name", "last_name"):
        full_name = f"{user.first_name} {user.last_name}".strip()
        users.objects.filter(pk=user.pk).update(full_name=full_name[:150])


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0003_outbox"),
    ]

    operations = [
        migrations.AddField(
            model_name="usermodel",
            name="first_name",
            field=models.CharField(default="", max_length=75),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="usermodel",
            name="last_name",
            field=models.CharField(blank=True, default="", max_length=75),
            preserve_default=False,
        ),
        # Al revertir, full_name vuelve a existir antes de unir los nombres.
        migrations.AlterField(
            model_name="usermodel",
            name="full_name",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.RunPython(split_full_name, join_names),
        migrations.RemoveField(
            model_name="usermodel",
            name="full_name",
        ),
    ]
