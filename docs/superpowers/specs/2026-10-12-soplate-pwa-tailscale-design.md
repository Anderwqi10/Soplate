# Soplate como PWA servida desde tu computador (Tailscale) — Documento de diseño

**Fecha:** 2026-10-12
**Base:** `docs/superpowers/specs/2026-10-03-soplate-design.md` (la app) — este documento cubre cómo se usa en el día a día.

## 1. Objetivo

Usar Soplate como **app instalada** en el **iPhone** y en el **escritorio de Windows**, en casa y en la calle, con **tu computador como servidor** y sin publicar nada en servicios de internet.

**Criterios de éxito**
1. Desde el iPhone, con datos móviles y Tailscale activo, se abre Soplate desde su ícono en pantalla completa y se puede registrar un pago.
2. En el computador, Soplate está instalada como app (Chrome o Edge) y abre en su propia ventana.
3. Nadie fuera de tus dispositivos de Tailscale puede llegar a la app, ni siquiera alguien en tu misma WiFi.
4. Cada vez que se inicia Soplate queda una copia de la base de datos en el computador y, si está conectado, en el USB; y una copia se puede restaurar.
5. Ninguna contraseña ni clave secreta queda en el repositorio.

## 2. Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Dónde corre | En el computador del usuario (Windows), no en la nube |
| Acceso remoto y HTTPS | Tailscale (red privada entre tus dispositivos; da HTTPS válido) |
| Forma de servir | Un solo servidor: Django sirve la API y la app compilada |
| Servidor de producción | Waitress (Gunicorn no funciona en Windows) |
| Base de datos | PostgreSQL local (ya migrado por el usuario); se empieza con datos limpios |
| Copias | `pg_dump` al iniciar; carpeta local + disco externo/USB |
| Arranque | **Manual**: acceso directo "Iniciar Soplate" / "Detener Soplate". Sin tareas programadas |
| Sesión | Renovación de sesión de 30 días (antes 7) |
| Sin señal | La app abre, pero los datos de dinero nunca se guardan en el teléfono; se muestra un aviso |

## 3. Arquitectura

```
iPhone / escritorio (Tailscale) ──HTTPS──▶ https://<tu-pc>.<tailnet>.ts.net
                                                │  tailscale serve (configurado una vez)
                                                ▼
                                   Waitress en 127.0.0.1:8000  (solo dentro del PC)
                                     ├─ /api/...        → Django (backend actual)
                                     ├─ /admin/, /static/ → Django
                                     └─ cualquier otra ruta → index.html de la app compilada
                                                ▼
                                   PostgreSQL local: base `soplate` (datos reales)
                                                └─ al iniciar: pg_dump ──▶ carpeta local + USB
```

- **Waitress escucha solo en `127.0.0.1`.** La única entrada desde afuera es `tailscale serve`, que reenvía `https://<tu-pc>...ts.net` a `http://127.0.0.1:8000`.
- **Una sola dirección** para API y app: el frontend llama a la API en la misma dirección (`/api`), sin CORS.
- **Archivos de la app compilada:** `npm run build` genera `frontend/app/dist`; Django los sirve con **WhiteNoise** (los archivos con hash se guardan en caché por un año; `index.html` y el service worker nunca). Las rutas del frontend (`/loans/7`, `/borrowers`…) devuelven `index.html` para que el enrutador de React las resuelva.
- **Desarrollo sigue igual:** `runserver` + `npm run dev` contra la base `soplate_dev`.

## 4. Configuración y secretos

- Archivo **`backend/app/.env`** (en `.gitignore`), leído con `python-dotenv`. Variables:
  - `DJANGO_SECRET_KEY` — nueva (la actual es pública en GitHub y deja de usarse).
  - `DJANGO_DEBUG` — `false` en el modo de uso.
  - `DJANGO_ALLOWED_HOSTS` — `127.0.0.1,localhost,<tu-pc>.<tailnet>.ts.net`.
  - `DJANGO_CSRF_TRUSTED_ORIGINS` — `https://<tu-pc>.<tailnet>.ts.net` (para el admin de Django).
  - `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT`.
  - `BACKUP_DIR` (carpeta local) y `BACKUP_USB_DIR` (ruta en el USB, p. ej. `E:\SoplateCopias`).
- **`backend/app/.env.example`** en el repositorio, con los nombres y valores de ejemplo.
- Sin `.env`, el proyecto se niega a arrancar en modo de uso (`DEBUG=false`) si falta `DJANGO_SECRET_KEY`: falla con un mensaje claro en vez de usar una clave por defecto.
- **PostgreSQL:** usuario `soplate` (contraseña fuerte, sin superusuario, con permiso `CREATEDB` para que los tests creen su base temporal). Bases: `soplate` (real) y `soplate_dev` (desarrollo). Se entrega un script SQL; lo ejecuta el usuario.
- La contraseña `123` del usuario `postgres` se reemplaza (lo hace el usuario; se documenta cómo).
- `requirements.txt` se actualiza: `psycopg[binary]` (se elimina `psycopg2`, duplicado), `python-dotenv`, `waitress`, `whitenoise`.

## 5. PWA

- `vite-plugin-pwa` genera el **manifiesto** y el **service worker**.
  - Nombre "Soplate", `display: standalone`, `start_url: "/"`, colores azul noche `#0f2742`.
  - Íconos 192 y 512 px (también "maskable" para Android), `apple-touch-icon` de 180 px, favicon nuevo: cuadrado azul noche con cuadritos de la tarjeta de cobro, uno sellado en naranja.
  - Metas de iOS: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`.
- **Qué se guarda en el teléfono:** solo la app (HTML, JS, CSS, fuentes, íconos). **Las llamadas a `/api/` nunca se guardan** (`NetworkOnly`): los saldos siempre vienen del computador.
- **Sin conexión:** la app abre y el mensaje de error de conexión cambia a: *"No se pudo conectar con tu computador. Revisa que Tailscale esté activo en el celular y que Soplate esté iniciado en el computador."*
- **Actualizaciones:** `registerType: "autoUpdate"`; la versión nueva se aplica la próxima vez que se abre la app, nunca a mitad de un formulario.
- **Sesión:** `REFRESH_TOKEN_LIFETIME` pasa a 30 días.

## 6. Operación (scripts en `scripts/`)

| Script | Qué hace |
|---|---|
| `crear-base-datos.sql` | Crea el usuario `soplate` y las bases `soplate` y `soplate_dev` (lo ejecuta el usuario una vez) |
| `publicar.ps1` | `npm run build`, `collectstatic`, `migrate` sobre `soplate`. Se corre tras cada cambio |
| `iniciar.ps1` | Hace la copia de seguridad, luego arranca Waitress en `127.0.0.1:8000` con `DJANGO_DEBUG=false`; guarda el PID del proceso |
| `detener.ps1` | Detiene el Waitress de Soplate (por el PID guardado) |
| `crear-accesos-directos.ps1` | Crea en el escritorio "Iniciar Soplate" y "Detener Soplate" (lo ejecuta el usuario) |
| `restaurar.ps1` | Restaura una copia elegida sobre una base indicada (por defecto una base de prueba, nunca sobre `soplate` sin confirmación explícita) |

- **Tailscale (una sola vez, lo hace el usuario):** instalar Tailscale en el PC y el iPhone con la misma cuenta, activar HTTPS en la consola de Tailscale, y ejecutar `tailscale serve --bg 8000`. Se documenta paso a paso.
- **Sin tareas programadas ni arranque automático.** La suspensión de Windows se documenta como recomendación opcional mientras Soplate está iniciado.

## 7. Copias de seguridad

- Comando de Django **`python manage.py backup_db`**, que llama `iniciar.ps1` antes de arrancar:
  1. Ejecuta `pg_dump --format=custom` de la base configurada a `BACKUP_DIR\soplate-AAAAMMDD-HHMMSS.dump`.
  2. Si `BACKUP_USB_DIR` existe (USB conectado), copia el archivo allí.
  3. Conserva las **30** más recientes en local y las **60** más recientes en el USB; borra las más viejas solo dentro de esas carpetas y solo archivos `soplate-*.dump`.
  4. Registra la fecha de la última copia exitosa en el USB en un modelo `BackupRecord` (destino, ruta, fecha).
  5. Si `pg_dump` falla, informa el error y **no** borra copias anteriores. Un fallo de la copia no impide arrancar la app, pero se muestra en la consola.
- **Aviso en el Resumen:** el endpoint del resumen incluye `last_usb_backup_at`. Si no hay copia en el USB o la última tiene más de **7 días**, el Resumen muestra: *"Tu última copia en el USB fue hace N días. Conéctalo e inicia Soplate para guardar una copia."* (o *"Aún no hay copias en el USB."*).
- **Restauración:** `restaurar.ps1` usa `pg_restore`. El plan incluye restaurar una copia real en una base temporal y comprobar que los saldos coinciden.

## 8. Fuera de alcance

- Arranque automático o tareas programadas (decisión del usuario).
- Funcionar sin conexión con datos guardados en el teléfono.
- Notificaciones push.
- Publicar la app en internet o en tiendas.
- Varios usuarios o varios computadores.

## 9. Orden de implementación

1. Cerrar la rama `feat/close-loans`: revisión independiente y unión a `master`.
2. Secretos y base de datos: `.env`, `python-dotenv`, usuario `soplate`, bases `soplate` y `soplate_dev`, dependencias.
3. Servir la app compilada desde Django (WhiteNoise, ruta comodín a `index.html`, API en la misma dirección) con Waitress.
4. PWA: manifiesto, service worker, íconos, metas de iOS, mensaje sin conexión, sesión de 30 días.
5. Scripts: publicar, iniciar, detener, accesos directos; guía de Tailscale.
6. Copias: `backup_db`, `BackupRecord`, aviso en el Resumen, `restaurar.ps1` y prueba de restauración.
7. Prueba de punta a punta: instalar en el iPhone y en el escritorio, registrar un pago desde datos móviles.
