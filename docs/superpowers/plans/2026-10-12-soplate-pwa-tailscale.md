# Soplate PWA servida por Tailscale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usar Soplate como app instalada (iPhone y escritorio) servida desde el computador del usuario, con HTTPS de Tailscale, PostgreSQL local, copias de seguridad al iniciar y arranque manual.

**Architecture:** Django sirve la API y la app compilada en un solo puerto (`127.0.0.1:8000`) con Waitress y WhiteNoise; `tailscale serve` pone el HTTPS delante. Los secretos viven en `backend/app/.env`. Unos scripts de PowerShell publican, inician (con copia de seguridad previa) y detienen la app; el usuario los lanza desde accesos directos.

**Tech Stack:** Django 5.2, PostgreSQL + psycopg 3, python-dotenv, waitress, whitenoise, React 19 + Vite 8, vite-plugin-pwa, @vite-pwa/assets-generator, PowerShell 5.1, Tailscale.

**Spec:** `docs/superpowers/specs/2026-10-12-soplate-pwa-tailscale-design.md`

## Global Constraints

- Plataforma: Windows; scripts en PowerShell 5.1 (sin `&&`, sin `??`). Rutas de los scripts relativas a la raíz del repositorio (`$PSScriptRoot\..`).
- Ningún secreto en git: `backend/app/.env` está ignorado; solo `backend/app/.env.example` se versiona. Nunca commitear la contraseña `123` ni el usuario `postgres` que hoy están sin commitear en `settings.py`.
- Modo de uso: `DJANGO_DEBUG=false`, Waitress escuchando **solo** en `127.0.0.1:8000`.
- Bases: `soplate` (datos reales, modo de uso) y `soplate_dev` (desarrollo y valor por defecto en `.env.example`); usuario PostgreSQL `soplate`.
- Las respuestas de `/api/` nunca se guardan en el service worker.
- Textos exactos (español): sin conexión → `No se pudo conectar con tu computador. Revisa que Tailscale esté activo en el celular y que Soplate esté iniciado en el computador.`; aviso de copia → `Tu última copia en el USB fue hace {N} días. Conéctalo e inicia Soplate para guardar una copia.` y `Aún no hay copias en el USB.`; app sin compilar → `Falta compilar la app: ejecuta scripts\publicar.ps1`.
- Copias: nombre `soplate-AAAAMMDD-HHMMSS.dump`; conservar 30 locales y 60 en el USB; aviso si la última en USB tiene más de 7 días.
- `REFRESH_TOKEN_LIFETIME` = 30 días.
- Sin tareas programadas de Windows ni arranque automático.

## Review Focus

1. **USB desconectado o carpeta inexistente:** la copia local se hace igual y la app arranca (test en Task 5).
2. **`pg_dump` falla o no está instalado:** mensaje claro, no se borran copias anteriores y la app arranca igual (tests en Task 5).
3. **Recargar `/loans/7` dentro de la app instalada:** responde `index.html`, no un 404 (test en Task 3).
4. **Un 404 de la API sigue siendo JSON**, no `index.html` (si no, la app mostraría un error raro) (test en Task 3).
5. **Saldos viejos por caché:** el service worker no intercepta `/api/` ni `/admin/` (test en Task 4).

---

### Task 1: Cerrar la rama `feat/close-loans`

**Files:** ninguno nuevo (fixes según la revisión).

- [ ] **Step 1:** Guardar a un lado el `settings.py` sin commitear: `git stash push backend/app/app/settings.py -m "postgres local"`.
- [ ] **Step 2:** Revisión independiente de `master..feat/close-loans` (superpowers:requesting-code-review). Corregir Critical/Important con TDD (test que falla → fix → suite verde).
- [ ] **Step 3:** Verificar: backend `..\venv\Scripts\python.exe -m pytest -q` → todo pasa; frontend `npx vitest --run` y `npm run build` → OK.
- [ ] **Step 4:** `git checkout master`, `git merge --ff-only feat/close-loans`, borrar la rama. **Preguntar al usuario** antes de `git push origin master`.
- [ ] **Step 5:** `git checkout -b feat/pwa-tailscale` y `git stash pop` (el cambio de PostgreSQL vuelve al árbol de trabajo para la Task 2).

---

### Task 2: Secretos, PostgreSQL por variables de entorno y dependencias

**Files:**
- Create: `backend/app/app/env.py`, `backend/app/.env.example`, `scripts/crear-base-datos.sql`
- Modify: `backend/app/app/settings.py` (reemplaza el bloque `DATABASES` sin commitear y la `SECRET_KEY`), `backend/requirements.txt`, `.gitignore`
- Test: `backend/app/core/tests/test_env.py`

**Interfaces:**
- Produces:
  - `app.env.env_list(name: str, default: str = "") -> list[str]` — separa por coma, quita espacios y vacíos.
  - `app.env.secret_key(debug: bool, value: str | None) -> str` — devuelve `value`; si falta y `debug` es `True` devuelve `"django-insecure-solo-desarrollo"`; si falta y `debug` es `False` lanza `django.core.exceptions.ImproperlyConfigured("Falta DJANGO_SECRET_KEY en backend/app/.env")`.
  - Variables leídas por `settings.py` (cargadas con `load_dotenv(BASE_DIR / ".env")`): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG` (default `true`), `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DATABASE_NAME` (default `soplate_dev`), `DATABASE_USER` (default `soplate`), `DATABASE_PASSWORD`, `DATABASE_HOST` (default `localhost`), `DATABASE_PORT` (default `5432`), `BACKUP_DIR`, `BACKUP_USB_DIR`, `PG_BIN_DIR` (opcional, carpeta de `pg_dump`/`pg_restore`).

- [ ] **Step 1: Tests que fallan** (`core/tests/test_env.py`):

```python
def test_env_list_splits_and_trims(monkeypatch):
    monkeypatch.setenv("X", " a.ts.net, ,127.0.0.1 ")
    assert env_list("X") == ["a.ts.net", "127.0.0.1"]

def test_secret_key_required_outside_debug():
    with pytest.raises(ImproperlyConfigured, match="DJANGO_SECRET_KEY"):
        secret_key(debug=False, value=None)

def test_secret_key_dev_fallback():
    assert secret_key(debug=True, value="") == "django-insecure-solo-desarrollo"
    assert secret_key(debug=False, value="abc") == "abc"

def test_refresh_token_lasts_30_days():
    assert settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"] == timedelta(days=30)
```

- [ ] **Step 2:** `pytest core/tests/test_env.py -v` → FAIL (`ModuleNotFoundError: app.env`).
- [ ] **Step 3: Implementar.** `env.py`; en `settings.py`: `load_dotenv`, `SECRET_KEY = secret_key(DEBUG, os.environ.get("DJANGO_SECRET_KEY"))`, `ALLOWED_HOSTS` fuera de DEBUG = `env_list("DJANGO_ALLOWED_HOSTS")`, `CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")`, `DATABASES` desde las variables, `REFRESH_TOKEN_LIFETIME = timedelta(days=30)`. `.gitignore`: agregar `backups/` y `scripts/.soplate.pid`. `requirements.txt`: `psycopg[binary]`, `python-dotenv`, `waitress`, `whitenoise` (quitar `psycopg2`). `.env.example` con todas las variables (valores de ejemplo, `DATABASE_NAME=soplate_dev`, `DJANGO_DEBUG=true`). `crear-base-datos.sql`: `CREATE ROLE soplate LOGIN PASSWORD :'clave' CREATEDB;` + `CREATE DATABASE soplate OWNER soplate;` + `CREATE DATABASE soplate_dev OWNER soplate;` (se ejecuta con `psql -U postgres -v clave='...' -f`).
- [ ] **Step 4 (usuario):** ejecutar el SQL, crear `backend/app/.env` desde el ejemplo con una `DJANGO_SECRET_KEY` nueva (`python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"`), y migrar ambas bases (`migrate` con `DATABASE_NAME=soplate` y `soplate_dev`).
- [ ] **Step 5:** `pytest -q` → todo pasa contra PostgreSQL. `git grep -n "123\|django-insecure-rn"` → sin resultados en archivos versionados.
- [ ] **Step 6: Commit** `feat(backend): secrets and database from .env; 30-day sessions`.

---

### Task 3: Django sirve la app compilada (una sola dirección)

**Files:**
- Modify: `backend/app/app/settings.py` (WhiteNoise), `backend/app/app/urls.py`, `backend/app/core/views.py`, `frontend/app/src/config.ts`
- Test: `backend/app/core/tests/test_frontend.py`, `frontend/app/src/config.test.ts`

**Interfaces:**
- Produces:
  - Setting `FRONTEND_DIST` = `Path(os.environ.get("FRONTEND_DIST_DIR", BASE_DIR.parent.parent / "frontend" / "app" / "dist"))`.
  - WhiteNoise: middleware después de `SecurityMiddleware`; `WHITENOISE_ROOT = FRONTEND_DIST`; `WHITENOISE_MAX_AGE = 0`; `WHITENOISE_IMMUTABLE_FILE_TEST` = archivos bajo `/assets/` (con hash, caché de un año). `STATIC_ROOT = BASE_DIR / "staticfiles"` (para el admin).
  - `core.views.frontend_index(request) -> HttpResponse` — `index.html` de `FRONTEND_DIST` con `Cache-Control: no-cache`; si no existe, 503 con `Falta compilar la app: ejecuta scripts\publicar.ps1`.
  - URL comodín al final: `re_path(r"^(?!api/|admin/|static/).*$", frontend_index)`.
  - `config.apiUrlFor(location: Pick<Location, "protocol" | "hostname" | "port" | "origin">): string` — puerto `5173` (Vite en desarrollo) → `${protocol}//${hostname}:8000/api`; cualquier otro → `${origin}/api`.

- [ ] **Step 1: Tests que fallan.** Backend (`settings` sobrescrito con `tmp_path` que contiene `index.html` = `<div id="root"></div>`):
  - `test_spa_route_returns_index`: `GET /loans/7` → 200, contiene `id="root"`, `Cache-Control` = `no-cache`.
  - `test_api_404_stays_json`: `GET /api/no-existe/` → 404 y `Content-Type` JSON.
  - `test_missing_build_explains_what_to_do`: sin `index.html` → 503 y el texto exacto.
  Frontend (reemplaza el test actual de `config.test.ts`, que usa la firma anterior):
  - `apiUrlFor({protocol:"https:", hostname:"pc.tail.ts.net", port:"", origin:"https://pc.tail.ts.net"})` → `"https://pc.tail.ts.net/api"`.
  - `apiUrlFor({protocol:"http:", hostname:"localhost", port:"5173", origin:"http://localhost:5173"})` → `"http://localhost:8000/api"`.
- [ ] **Step 2:** correr ambos → FAIL.
- [ ] **Step 3:** implementar según las interfaces.
- [ ] **Step 4:** suites completas verdes; `npm run build`; `waitress-serve --listen=127.0.0.1:8000 app.wsgi:application` (con `DJANGO_DEBUG=false` y `.env`) → `curl http://127.0.0.1:8000/` 200 con la app, `curl http://127.0.0.1:8000/api/me/` 401, `curl http://127.0.0.1:8000/loans/7` 200; detener Waitress.
- [ ] **Step 5: Commit** `feat: serve the built app from Django on a single address`.

---

### Task 4: PWA instalable

**Files:**
- Create: `frontend/app/src/pwa-options.ts`, `frontend/app/public/soplate.svg` (ícono fuente: cuadrado azul noche `#0f2742` con 4 cuadritos, uno naranja `#f07b2b`), `frontend/app/pwa-assets.config.ts`, íconos generados en `public/`
- Modify: `frontend/app/vite.config.ts`, `frontend/app/index.html`, `frontend/app/src/components/ErrorMessage.tsx`, `frontend/app/package.json`
- Test: `frontend/app/src/pwa-options.test.ts`, `frontend/app/src/components/ErrorMessage.test.tsx`

**Interfaces:**
- Produces: `pwaOptions: Partial<VitePWAOptions>` exportado desde `src/pwa-options.ts` y usado en `vite.config.ts` (`VitePWA(pwaOptions)`).
  - `registerType: "autoUpdate"`; manifest: `name` y `short_name` `"Soplate"`, `lang: "es-CO"`, `display: "standalone"`, `start_url: "/"`, `theme_color` y `background_color` `"#0f2742"`, íconos 192 y 512 (`purpose: "any"`) y 512 `maskable`.
  - `workbox.navigateFallback: "/index.html"`, `workbox.navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/static\//]`, `workbox.globPatterns` solo `**/*.{js,css,html,svg,png,woff2}`; sin `runtimeCaching` (lo no listado nunca se guarda).
- Dependencias: `vite-plugin-pwa`, `@vite-pwa/assets-generator` (dev); script `"generar-iconos": "pwa-assets-generator"` con preset `minimal-2023`.
- `index.html`: `apple-touch-icon` 180, `apple-mobile-web-app-capable="yes"`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `apple-mobile-web-app-title="Soplate"`, favicon nuevo.

- [ ] **Step 1: Tests que fallan:**
  - `pwa-options.test.ts`: `pwaOptions.manifest` tiene `name` `"Soplate"`, `display` `"standalone"`, `theme_color` `"#0f2742"`; existe un ícono `"maskable"`; `navigateFallbackDenylist` coincide con `"/api/accounts/"` y `"/admin/"`; `runtimeCaching` es `undefined`.
  - `ErrorMessage.test.tsx`: el test de `TypeError` espera el texto sin conexión exacto (Global Constraints).
- [ ] **Step 2:** `npx vitest --run` → FAIL en esos tests.
- [ ] **Step 3:** implementar; `npm run generar-iconos`.
- [ ] **Step 4:** `npx vitest --run` verde; `npm run build` → `dist/` contiene `sw.js`, `manifest.webmanifest`, `apple-touch-icon-180x180.png`.
- [ ] **Step 5: Commit** `feat(frontend): installable PWA with icons and offline message`.

---

### Task 5: Copias de seguridad y aviso en el Resumen

**Files:**
- Create: `backend/app/core/models.py` (+ migración), `backend/app/core/backups.py`, `backend/app/core/management/commands/backup_db.py`, `scripts/restaurar.ps1`
- Modify: `backend/app/reports/services.py`, `frontend/app/src/api/types.ts`, `frontend/app/src/features/dashboard/DashboardPage.tsx`
- Test: `backend/app/core/tests/test_backups.py`, `backend/app/reports/tests/test_reports.py`, `frontend/app/src/features/dashboard/DashboardPage.test.tsx`

**Interfaces:**
- Produces:
  - `core.models.BackupRecord(destination: CharField choices "LOCAL"|"USB", path: CharField(500), created_at: DateTimeField)`, ordering `-created_at`.
  - `core.backups.backup_filename(now: datetime) -> str` → `"soplate-AAAAMMDD-HHMMSS.dump"`.
  - `core.backups.prune(folder: Path, keep: int) -> list[Path]` — borra solo `soplate-*.dump` más viejos que los `keep` más recientes (por nombre); devuelve los borrados.
  - `core.backups.run_backup(*, local_dir: Path, usb_dir: Path | None, now: datetime, dump: Callable[[Path], None]) -> BackupResult` — `@dataclass BackupResult(local_path: Path, usb_path: Path | None)`; si `dump` lanza, se propaga `BackupError` y no se borra nada; crea `BackupRecord` por destino; poda 30 local / 60 USB.
  - `core.backups.pg_dump_to(path: Path) -> None` — `pg_dump --format=custom --file=<path>` con la conexión de `settings.DATABASES["default"]` y `PGPASSWORD` en el entorno; usa `PG_BIN_DIR` si está; si el programa no existe o termina con error lanza `BackupError` con un mensaje en español.
  - Comando `backup_db`: lee `BACKUP_DIR`/`BACKUP_USB_DIR`; imprime dónde quedó cada copia o el error; **sale con código 0 aunque falle** (la app debe arrancar igual) pero escribe el error.
  - Dashboard: nueva clave `last_usb_backup_at: str | null` (ISO 8601).
  - Frontend: `Dashboard.last_usb_backup_at: string | null`; aviso en el Resumen (`role="status"`) con los textos exactos.

- [ ] **Step 1: Tests que fallan** (`test_backups.py`, `dump` falso que escribe un archivo):
  - `test_copies_to_local_and_usb`: con `usb_dir` existente → dos archivos con el mismo nombre y dos `BackupRecord`.
  - `test_usb_missing_still_makes_local_copy`: `usb_dir` que no existe → solo local, sin record USB, sin error.
  - `test_prune_keeps_newest_and_ignores_other_files`: 32 dumps + `notas.txt` → quedan 30 dumps y `notas.txt`.
  - `test_dump_failure_keeps_previous_copies`: `dump` lanza → `BackupError`, los dumps previos siguen ahí.
  - `test_pg_dump_missing_program_is_explained`: `PG_BIN_DIR` apuntando a carpeta vacía → `BackupError` cuyo mensaje contiene `pg_dump`.
  - `test_backup_command_never_blocks_start`: `call_command("backup_db")` con `pg_dump_to` parcheado para fallar → no lanza.
  - Reportes: sin records → `last_usb_backup_at is None`; con uno USB → su fecha ISO.
  - Frontend: `last_usb_backup_at: null` → `Aún no hay copias en el USB.`; fecha de hace 9 días → `Tu última copia en el USB fue hace 9 días. …`; hace 2 días → sin aviso.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3:** implementar. `restaurar.ps1 -Archivo <ruta> [-Base soplate_restore_test] [-Confirmar]`: crea la base destino vacía y ejecuta `pg_restore --no-owner --dbname`; si `-Base soplate` y no hay `-Confirmar`, se detiene con un mensaje.
- [ ] **Step 4:** suites verdes. **Prueba de restauración real:** `python manage.py backup_db` → `scripts\restaurar.ps1 -Archivo <dump>` → comparar `SELECT count(*)` de `ledger_transaction` y `loans_loan` entre `soplate` y `soplate_restore_test` → iguales.
- [ ] **Step 5: Commit** `feat: backups on start to local folder and USB, with a reminder on the summary`.

---

### Task 6: Scripts de uso, accesos directos y guía de Tailscale

**Files:**
- Create: `scripts/publicar.ps1`, `scripts/iniciar.ps1`, `scripts/detener.ps1`, `scripts/crear-accesos-directos.ps1`, `docs/uso/instalar-y-usar.md`

**Interfaces:**
- `publicar.ps1`: `npm run build` (en `frontend/app`), `collectstatic --noinput` y `migrate` con `DJANGO_DEBUG=false` (base `soplate`); se detiene en el primer error.
- `iniciar.ps1`: falla con mensaje si ya hay un PID vivo en `scripts\.soplate.pid` o si falta `frontend\app\dist\index.html`; corre `backup_db`; arranca `waitress-serve --listen=127.0.0.1:8000 app.wsgi:application` con `DJANGO_DEBUG=false` y `DATABASE_NAME=soplate`; guarda el PID; muestra la dirección local y recuerda la de Tailscale.
- `detener.ps1`: detiene el proceso del PID guardado y borra el archivo; si no hay PID, lo dice.
- `crear-accesos-directos.ps1`: crea en el escritorio "Iniciar Soplate.lnk" y "Detener Soplate.lnk" (`powershell.exe -ExecutionPolicy Bypass -File …`). Lo ejecuta el usuario.
- `instalar-y-usar.md`: crear la base (Task 2), cambiar la contraseña de `postgres`, instalar Tailscale en PC e iPhone, activar HTTPS en la consola, `tailscale serve --bg 8000`, poner la dirección `*.ts.net` en `DJANGO_ALLOWED_HOSTS` y `DJANGO_CSRF_TRUSTED_ORIGINS`, instalar en iPhone (Compartir → Agregar a pantalla de inicio) y en el escritorio (botón Instalar de Chrome/Edge), suspensión opcional, y restaurar una copia.

- [ ] **Step 1:** escribir los scripts y la guía.
- [ ] **Step 2: Verificar:** `publicar.ps1` termina sin errores; `iniciar.ps1` → `curl http://127.0.0.1:8000/api/me/` 401 y hay una copia nueva en `BACKUP_DIR`; `curl http://192.168.1.9:8000/` **no** responde (solo escucha en 127.0.0.1); segundo `iniciar.ps1` → mensaje "ya está iniciado"; `detener.ps1` → puerto 8000 libre.
- [ ] **Step 3: Commit** `feat: start, stop and publish scripts with desktop shortcuts and usage guide`.

---

### Task 7: Prueba de punta a punta con el usuario

- [ ] **Step 1 (usuario, con la guía):** Tailscale en PC e iPhone, `tailscale serve --bg 8000`, `.env` con la dirección `*.ts.net`, `publicar.ps1`, accesos directos.
- [ ] **Step 2:** "Iniciar Soplate" → desde el iPhone con **datos móviles** abrir `https://<pc>.<tailnet>.ts.net`, instalar, iniciar sesión, crear una cuenta y registrar un pago; verlo reflejado en el escritorio.
- [ ] **Step 3:** "Detener Soplate" → la app del iPhone abre y muestra el mensaje sin conexión exacto.
- [ ] **Step 4:** instalar en el escritorio (Chrome/Edge) y abrirla en su propia ventana.
- [ ] **Step 5:** revisión final de toda la rama, unir a `master` y, con permiso del usuario, subir a GitHub.
