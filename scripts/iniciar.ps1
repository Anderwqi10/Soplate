# Inicia Soplate en segundo plano, solo en 127.0.0.1:8000 (Tailscale lo publica al celular).
# Uso: powershell -ExecutionPolicy Bypass -File scripts\iniciar.ps1
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $PSScriptRoot ".soplate.pid"
$log = Join-Path $PSScriptRoot "soplate.log"
$logErr = Join-Path $PSScriptRoot "soplate.err.log"
$python = Join-Path $raiz "backend\venv\Scripts\python.exe"
$waitress = Join-Path $raiz "backend\venv\Scripts\waitress-serve.exe"
$backend = Join-Path $raiz "backend\app"
$envFile = Join-Path $backend ".env"

# Pausa corta para que se alcance a leer el mensaje si la ventana se cierra sola.
function Terminar($codigo) {
    Start-Sleep -Seconds 4
    exit $codigo
}

# Cualquier error inesperado: mostrarlo y esperar antes de cerrar la ventana.
trap { Write-Host "Error inesperado: $_"; Terminar 1 }

. (Join-Path $PSScriptRoot "soplate-comun.ps1")
$pidVivo = Get-SoplatePid
if ($pidVivo) {
    Write-Host "Soplate ya está iniciado (PID $pidVivo). Para reiniciarlo usa 'Detener Soplate' primero."
    Terminar 1
}
if (-not (Test-Path (Join-Path $raiz "frontend\app\dist\index.html"))) {
    Write-Host "Falta compilar la app: ejecuta scripts\publicar.ps1"
    Terminar 1
}
if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "El puerto 8000 está ocupado por otro programa. Ciérralo e inténtalo de nuevo."
    Terminar 1
}

# Leer .env solo para los hosts permitidos (no se muestran valores).
$cfg = @{}
if (Test-Path $envFile) {
    foreach ($linea in Get-Content $envFile) {
        if ($linea -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $cfg[$Matches[1]] = $Matches[2].Trim('"').Trim("'") }
    }
}
$hosts = @()
if ($env:DJANGO_ALLOWED_HOSTS) { $hosts = $env:DJANGO_ALLOWED_HOSTS.Split(",") }
elseif ($cfg["DJANGO_ALLOWED_HOSTS"]) { $hosts = $cfg["DJANGO_ALLOWED_HOSTS"].Split(",") }
$hosts = @($hosts | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($h in @("127.0.0.1", "localhost")) { if ($hosts -notcontains $h) { $hosts += $h } }

$env:DJANGO_DEBUG = "false"
$env:DATABASE_NAME = "soplate"
$env:DJANGO_ALLOWED_HOSTS = ($hosts -join ",")

Push-Location $backend
try {
    Write-Host "Guardando copia de seguridad..."
    & $python manage.py backup_db

    Write-Host "Iniciando Soplate..."
    $proc = Start-Process -FilePath $waitress -ArgumentList "--listen=127.0.0.1:8000", "app.wsgi:application" `
        -WorkingDirectory $backend -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $log -RedirectStandardError $logErr
}
finally { Pop-Location }

# Esperar a que el puerto escuche y guardar el PID del proceso que realmente escucha.
$escucha = $null
for ($i = 0; $i -lt 30 -and -not $escucha; $i++) {
    Start-Sleep -Milliseconds 500
    $escucha = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $escucha -and $proc.HasExited) { break }
}
if (-not $escucha) {
    Write-Host "No se pudo iniciar Soplate. Revisa scripts\soplate.err.log"
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
    Terminar 1
}
Set-Content -Path $pidFile -Value $escucha.OwningProcess -Encoding ASCII

Write-Host ""
Write-Host "Soplate está iniciado."
Write-Host "Dirección local: http://127.0.0.1:8000"
Write-Host "Desde el celular: abre la dirección de Tailscale (https://<tu-pc>.<tailnet>.ts.net)"
Terminar 0
