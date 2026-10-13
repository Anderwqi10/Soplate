from django.db import models


class BackupRecord(models.Model):
    """Una copia de seguridad hecha: dónde quedó y cuándo."""

    class Destination(models.TextChoices):
        LOCAL = "LOCAL", "Carpeta local"
        USB = "USB", "USB"

    destination = models.CharField(max_length=5, choices=Destination.choices)
    path = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
