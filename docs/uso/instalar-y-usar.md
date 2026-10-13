# Instalar y usar Soplate

Soplate corre en tu computador. Tú lo inicias cuando lo necesitas y lo detienes cuando terminas. Desde el celular entras por Tailscale, que es una conexión privada y segura entre tu celular y tu computador.

Las partes 1 a 6 se hacen **una sola vez**. La parte 7 es el uso de todos los días.

## 1. Crear la base de datos real (una sola vez)

La base `soplate` guarda tus datos reales. La base `soplate_dev` es solo para pruebas.

1. Abre PowerShell en la carpeta del proyecto.
2. Ejecuta (cambia `LA_CLAVE` por la contraseña que quieras para el usuario `soplate`):

   ```powershell
   psql -U postgres -v clave='LA_CLAVE' -f scripts\crear-base-datos.sql
   ```

3. Escribe esa misma contraseña en `backend\app\.env` (línea `DATABASE_PASSWORD`).

## 2. Cambiar la contraseña de `postgres`

Cambia la contraseña del usuario administrador de PostgreSQL por una segura que solo tú conozcas:

```powershell
psql -U postgres -c "ALTER USER postgres PASSWORD 'UNA_CLAVE_NUEVA_Y_LARGA';"
```

Guárdala en un lugar seguro (por ejemplo, un administrador de contraseñas).

## 3. Preparar la app y crear tu usuario

1. Compila y prepara la app:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\publicar.ps1
   ```

2. Crea tu usuario para entrar a Soplate (en la base real). Desde la carpeta `backend\app`:

   ```powershell
   $env:DATABASE_NAME="soplate"
   ..\venv\Scripts\python.exe manage.py createsuperuser
   Remove-Item Env:DATABASE_NAME
   ```

   Te pedirá un nombre de usuario y una contraseña. Esos son los datos con los que entrarás a la app.

## 4. Instalar Tailscale

1. Instala Tailscale en el computador (https://tailscale.com/download) e inicia sesión.
2. Instala Tailscale en el iPhone (App Store) e inicia sesión **con la misma cuenta**.
3. En el navegador entra a https://login.tailscale.com/admin/dns y:
   - Activa **MagicDNS** si no lo está.
   - Activa **HTTPS Certificates** (Habilitar HTTPS).
4. Anota el nombre de tu computador en la red, que se ve como `mi-pc.tu-red.ts.net`. En esta guía lo llamamos `<tu-pc>.<tailnet>.ts.net`.

## 5. Publicar Soplate con Tailscale

En PowerShell (se hace una vez; Tailscale lo recuerda):

```powershell
tailscale serve --bg 8000
```

Esto crea la dirección `https://<tu-pc>.<tailnet>.ts.net` que lleva a Soplate. Solo se puede abrir desde tus dispositivos con Tailscale.

## 6. Decirle a Soplate cuál es su dirección

Abre `backend\app\.env` con el Bloc de notas y agrega estas dos líneas (usa tu dirección real):

```
DJANGO_ALLOWED_HOSTS=mi-pc.tu-red.ts.net,127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=https://mi-pc.tu-red.ts.net
```

Guarda el archivo. Si Soplate estaba iniciado, deténlo e inícialo otra vez.

### Accesos directos en el escritorio (opcional, recomendado)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\crear-accesos-directos.ps1
```

Aparecen **Iniciar Soplate** y **Detener Soplate** en tu escritorio.

## 7. Uso diario

1. Doble clic en **Iniciar Soplate** (o `scripts\iniciar.ps1`). Se guarda una copia de seguridad y la app queda lista.
2. Usa la app:
   - En el computador: http://127.0.0.1:8000
   - En el celular: la dirección de Tailscale (`https://<tu-pc>.<tailnet>.ts.net`). Tailscale debe estar activo en el celular.
3. Cuando termines, doble clic en **Detener Soplate**.

Soplate **no** se inicia solo: si el computador está apagado o Soplate está detenido, el celular no podrá conectarse.

### Después de cada actualización de la app

Cuando se cambie el código de Soplate, ejecuta de nuevo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\publicar.ps1
```

Si Soplate estaba iniciado, el script lo detiene y te avisa: vuelve a iniciarlo con **Iniciar Soplate**.

## 8. Instalar la app

**En el iPhone:**
1. Abre Safari y entra a `https://<tu-pc>.<tailnet>.ts.net`.
2. Toca **Compartir** y luego **Agregar a pantalla de inicio**.
3. Toca **Agregar**. Ya tienes el ícono de Soplate como una app.

**En el escritorio (Windows):**
1. Abre Chrome o Edge en `http://127.0.0.1:8000` (con Soplate iniciado).
2. Haz clic en el botón **Instalar** de la barra de direcciones (o menú, "Instalar Soplate").

## 9. Si el celular muestra "No se pudo conectar con tu computador"

Revisa en este orden:
1. ¿El computador está encendido y despierto (no suspendido)?
2. ¿Iniciaste Soplate (**Iniciar Soplate**)?
3. ¿Tailscale está activo en el celular y en el computador?
4. Prueba abrir en el computador http://127.0.0.1:8000. Si no abre, mira `scripts\soplate.err.log`.
5. Si el computador tiene `tailscale serve` desactivado, vuelve a ejecutar `tailscale serve --bg 8000`.

## 10. Evitar que el computador se suspenda (opcional)

Si quieres entrar desde el celular con el computador "dormido", desactiva la suspensión mientras está conectado a la corriente:

1. Configuración, Sistema, Inicio/apagado y batería (Energía).
2. En **Pantalla y suspensión**, pon **Nunca** en "Con corriente, suspender después de".

Puedes dejar que la pantalla se apague; lo importante es que el equipo no se suspenda.

## 11. Copias de seguridad y restaurar una copia

Cada vez que inicias Soplate se guarda una copia (`soplate-AAAAMMDD-HHMMSS.dump`) en la carpeta de copias y, si el USB está conectado, también en el USB. Si la última copia del USB tiene más de 7 días, la app te lo recuerda: conecta el USB e inicia Soplate otra vez.

Para restaurar una copia **de prueba** (en una base aparte, sin tocar tus datos):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restaurar.ps1 -Archivo "D:\ruta\soplate-AAAAMMDD-HHMMSS.dump"
```

Para restaurar sobre tus datos reales (reemplaza todo; detén Soplate antes):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restaurar.ps1 -Archivo "D:\ruta\soplate-AAAAMMDD-HHMMSS.dump" -Base soplate -Confirmar
```
