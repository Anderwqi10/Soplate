import os
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand

from core.backups import BackupError, pg_dump_to, run_backup


class Command(BaseCommand):
    help = "Copia la base a BACKUP_DIR y, si existe, a BACKUP_USB_DIR. Nunca impide que la app arranque."

    def handle(self, *args, **options):
        local = os.environ.get("BACKUP_DIR")
        usb = os.environ.get("BACKUP_USB_DIR")
        if not local:
            self.stderr.write("Copia no hecha: falta BACKUP_DIR en backend/app/.env.")
            return
        try:
            result = run_backup(local_dir=Path(local), usb_dir=Path(usb) if usb else None,
                                now=datetime.now(), dump=pg_dump_to)
        except (BackupError, OSError) as exc:
            self.stderr.write(f"Copia no hecha: {exc}")
            return
        self.stdout.write(f"Copia local: {result.local_path}")
        if result.usb_path:
            self.stdout.write(f"Copia en USB: {result.usb_path}")
        elif usb:
            self.stdout.write("USB no disponible: solo se hizo la copia local.")
