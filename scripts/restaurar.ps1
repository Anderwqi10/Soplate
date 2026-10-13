# Restaura una copia (.dump) en una base nueva.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\restaurar.ps1 -Archivo <ruta> [-Base soplate_restore_test] [-Confirmar]
# Restaurar sobre la base real ("soplate") exige -Confirmar.
param(
    [Parameter(Mandatory = $true)][string]$Archivo,
    [string]$Base = "soplate_restore_test",
    [switch]$Confirmar
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $raiz "backend\app\.env"

if (-not (Test-Path $Archivo)) { Write-Host "No existe el archivo: $Archivo"; exit 1 }
if ($Base -eq "soplate" -and -not $Confirmar) {
    Write-Host "Restaurar sobre 'soplate' reemplaza los datos reales. Si estas seguro, repite el comando con -Confirmar."
    exit 1
}
if (-not (Test-Path $envFile)) { Write-Host "Falta backend\app\.env"; exit 1 }

$cfg = @{}
foreach ($linea in Get-Content $envFile) {
    if ($linea -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $cfg[$Matches[1]] = $Matches[2].Trim('"').Trim("'") }
}
$bin = $cfg["PG_BIN_DIR"]
$pgRestore = if ($bin) { Join-Path $bin "pg_restore.exe" } else { "pg_restore" }
$psql = if ($bin) { Join-Path $bin "psql.exe" } else { "psql" }
$usuario = $cfg["DATABASE_USER"]
$servidor = if ($cfg["DATABASE_HOST"]) { $cfg["DATABASE_HOST"] } else { "localhost" }
$puerto = if ($cfg["DATABASE_PORT"]) { $cfg["DATABASE_PORT"] } else { "5432" }

$env:PGPASSWORD = $cfg["DATABASE_PASSWORD"]
try {
    $existe = & $psql -h $servidor -p $puerto -U $usuario -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$Base'"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar PostgreSQL." }
    if ($existe -eq "1") {
        & $psql -h $servidor -p $puerto -U $usuario -d postgres -c "DROP DATABASE `"$Base`""
        if ($LASTEXITCODE -ne 0) { throw "No se pudo reemplazar la base $Base (hay conexiones abiertas?)." }
    }
    & $psql -h $servidor -p $puerto -U $usuario -d postgres -c "CREATE DATABASE `"$Base`""
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear la base $Base." }
    & $pgRestore --no-owner -h $servidor -p $puerto -U $usuario --dbname $Base $Archivo
    if ($LASTEXITCODE -ne 0) { throw "pg_restore termino con error." }
    Write-Host "Listo: '$Archivo' restaurado en la base '$Base'."
}
catch {
    Write-Host $_.Exception.Message
    exit 1
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
