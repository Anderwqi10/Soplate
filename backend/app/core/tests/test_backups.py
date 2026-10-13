from datetime import datetime
from io import StringIO
from unittest import mock

import pytest
from django.core.management import call_command

from core.backups import BackupError, backup_filename, pg_dump_to, prune, run_backup
from core.models import BackupRecord

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 10, 12, 9, 30, 15)


def fake_dump(path):
    path.write_bytes(b"dump")


def test_filename():
    assert backup_filename(NOW) == "soplate-20261012-093015.dump"


def test_copies_to_local_and_usb(tmp_path):
    local, usb = tmp_path / "local", tmp_path / "usb"
    usb.mkdir()
    result = run_backup(local_dir=local, usb_dir=usb, now=NOW, dump=fake_dump)
    assert result.local_path == local / "soplate-20261012-093015.dump"
    assert result.usb_path == usb / "soplate-20261012-093015.dump"
    assert result.local_path.exists() and result.usb_path.exists()
    assert set(BackupRecord.objects.values_list("destination", flat=True)) == {"LOCAL", "USB"}


def test_usb_missing_still_makes_local_copy(tmp_path):
    result = run_backup(local_dir=tmp_path / "local", usb_dir=tmp_path / "nope", now=NOW, dump=fake_dump)
    assert result.usb_path is None
    assert result.local_path.exists()
    assert list(BackupRecord.objects.values_list("destination", flat=True)) == ["LOCAL"]


def test_prune_keeps_newest_and_ignores_other_files(tmp_path):
    for i in range(32):
        (tmp_path / f"soplate-202610{i + 1:02d}-000000.dump").write_bytes(b"x")
    (tmp_path / "notas.txt").write_text("hola")
    deleted = prune(tmp_path, 30)
    assert len(deleted) == 2
    assert len(list(tmp_path.glob("soplate-*.dump"))) == 30
    assert not (tmp_path / "soplate-20261001-000000.dump").exists()
    assert (tmp_path / "notas.txt").exists()


def test_dump_failure_keeps_previous_copies(tmp_path):
    run_backup(local_dir=tmp_path, usb_dir=None, now=NOW, dump=fake_dump)

    def boom(path):
        raise BackupError("falló")

    with pytest.raises(BackupError):
        run_backup(local_dir=tmp_path, usb_dir=None, now=datetime(2026, 10, 13, 9, 0, 0), dump=boom)
    assert [p.name for p in tmp_path.glob("soplate-*.dump")] == ["soplate-20261012-093015.dump"]


def test_pg_dump_missing_program_is_explained(tmp_path, monkeypatch):
    monkeypatch.setenv("PG_BIN_DIR", str(tmp_path))
    with pytest.raises(BackupError, match="pg_dump"):
        pg_dump_to(tmp_path / "x.dump")


def test_backup_command_never_blocks_start(tmp_path, monkeypatch):
    monkeypatch.setenv("BACKUP_DIR", str(tmp_path))
    monkeypatch.delenv("BACKUP_USB_DIR", raising=False)
    out, err = StringIO(), StringIO()
    with mock.patch("core.management.commands.backup_db.pg_dump_to", side_effect=BackupError("sin pg_dump")):
        call_command("backup_db", stdout=out, stderr=err)
    assert "sin pg_dump" in err.getvalue()


def test_backup_command_survives_database_error(tmp_path, monkeypatch):
    from django.db import DatabaseError

    monkeypatch.setenv("BACKUP_DIR", str(tmp_path))
    monkeypatch.delenv("BACKUP_USB_DIR", raising=False)
    err = StringIO()
    with mock.patch("core.management.commands.backup_db.pg_dump_to", side_effect=lambda p: p.write_bytes(b"x")),             mock.patch.object(BackupRecord.objects, "create", side_effect=DatabaseError("sin tabla")):
        call_command("backup_db", stdout=StringIO(), stderr=err)
    assert "Copia no hecha" in err.getvalue()
