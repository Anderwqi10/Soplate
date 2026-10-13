"""Copias de seguridad de la base: pg_dump a una carpeta local y, si está conectado, a un USB."""
import os
import shutil
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from django.conf import settings

from .models import BackupRecord

KEEP_LOCAL = 30
KEEP_USB = 60


class BackupError(Exception):
    """No se pudo hacer la copia; el mensaje está en español para mostrarlo tal cual."""


@dataclass
class BackupResult:
    local_path: Path
    usb_path: Path | None


def backup_filename(now: datetime) -> str:
    return f"soplate-{now:%Y%m%d-%H%M%S}.dump"


def prune(folder: Path, keep: int) -> list[Path]:
    """Borra los soplate-*.dump más viejos, dejando los `keep` más recientes (por nombre)."""
    dumps = sorted(folder.glob("soplate-*.dump"), key=lambda p: p.name)
    old = dumps[:-keep] if keep > 0 else dumps
    for p in old:
        p.unlink()
    return old


def run_backup(*, local_dir: Path, usb_dir: Path | None, now: datetime, dump: Callable[[Path], None]) -> BackupResult:
    local_dir.mkdir(parents=True, exist_ok=True)
    name = backup_filename(now)
    local_path = local_dir / name
    try:
        dump(local_path)
    except BaseException:
        local_path.unlink(missing_ok=True)  # solo el archivo a medias; las copias anteriores quedan
        raise
    BackupRecord.objects.create(destination=BackupRecord.Destination.LOCAL, path=str(local_path))
    prune(local_dir, KEEP_LOCAL)

    usb_path = None
    if usb_dir is not None and usb_dir.is_dir():
        try:
            candidate = usb_dir / name
            shutil.copy2(local_path, candidate)
            usb_path = candidate
        except OSError:
            usb_path = None  # el USB falló (desconectado a medias, lleno): la copia local ya existe
        if usb_path is not None:
            BackupRecord.objects.create(destination=BackupRecord.Destination.USB, path=str(usb_path))
            prune(usb_dir, KEEP_USB)
    return BackupResult(local_path=local_path, usb_path=usb_path)


def pg_dump_to(path: Path) -> None:
    db = settings.DATABASES["default"]
    bin_dir = os.environ.get("PG_BIN_DIR")
    exe = str(Path(bin_dir) / "pg_dump") if bin_dir else "pg_dump"
    cmd = [exe, "--format=custom", f"--file={path}", "--host", str(db.get("HOST") or "localhost"),
           "--port", str(db.get("PORT") or "5432"), "--username", str(db.get("USER", "")), str(db["NAME"])]
    env = {**os.environ, "PGPASSWORD": str(db.get("PASSWORD", ""))}
    try:
        proc = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=600)
    except FileNotFoundError:
        raise BackupError("No se encontró el programa pg_dump. Revisa PG_BIN_DIR en backend/app/.env.") from None
    except subprocess.TimeoutExpired:
        raise BackupError("pg_dump tardó demasiado y se canceló.") from None
    if proc.returncode != 0:
        detail = (proc.stderr or "").strip().splitlines()[-1:] or [""]
        raise BackupError(f"pg_dump terminó con error: {detail[0]}")
