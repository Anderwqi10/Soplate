# Prepara la app para usarla: compila el frontend, junta los estáticos y aplica migraciones en la base real.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\publicar.ps1
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $PSScriptRoot ".soplate.pid"
$python = Join-Path $raiz "backend\venv\Scripts\python.exe"
$backend = Join-Path $raiz "backend\app"
$frontend = Join-Path $raiz "frontend\app"

# Si Soplate está iniciado, hay que detenerlo: solo ve la compilación nueva al arrancar.
$estabaIniciado = $false
. (Join-Path $PSScriptRoot "soplate-comun.ps1")
if (Get-SoplatePid) {
    $estabaIniciado = $true
    & (Join-Path $PSScriptRoot "detener.ps1")
    Write-Host "Soplate estaba iniciado: lo detuve. Vuelve a iniciarlo con 'Iniciar Soplate'."
    if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "El puerto 8000 sigue ocupado. Cierra el programa que lo usa y vuelve a ejecutar publicar.ps1."
        exit 1
    }
}

$envAnterior = @{ DJANGO_DEBUG = $env:DJANGO_DEBUG; DATABASE_NAME = $env:DATABASE_NAME }
try {
    Write-Host "1/3 Compilando la app (npm run build)..."
    Push-Location $frontend
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Falló la compilación del frontend." }
    }
    finally { Pop-Location }

    $env:DJANGO_DEBUG = "false"
    $env:DATABASE_NAME = "soplate"
    Push-Location $backend
    try {
        Write-Host "2/3 Juntando archivos estáticos (collectstatic)..."
        & $python manage.py collectstatic --noinput
        if ($LASTEXITCODE -ne 0) { throw "Falló collectstatic." }
        Write-Host "3/3 Aplicando migraciones en la base 'soplate'..."
        & $python manage.py migrate
        if ($LASTEXITCODE -ne 0) { throw "Falló migrate." }
    }
    finally { Pop-Location }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    exit 1
}
finally {
    foreach ($k in $envAnterior.Keys) {
        if ($null -eq $envAnterior[$k]) { Remove-Item "Env:\$k" -ErrorAction SilentlyContinue }
        else { Set-Item "Env:\$k" $envAnterior[$k] }
    }
}

Write-Host "Listo: la app está publicada."
