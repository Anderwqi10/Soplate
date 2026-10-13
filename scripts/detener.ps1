# Detiene Soplate y comprueba que el puerto 8000 quedó libre.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\detener.ps1
$ErrorActionPreference = "Stop"
$pidFile = Join-Path $PSScriptRoot ".soplate.pid"

# Pausa corta para que se alcance a leer el mensaje si la ventana se cierra sola.
function Terminar($codigo) {
    Start-Sleep -Seconds 3
    exit $codigo
}

. (Join-Path $PSScriptRoot "soplate-comun.ps1")
# Solo se detiene un proceso confirmado como Soplate; si no, se limpia el PID viejo.
$pidGuardado = Get-SoplatePid
if (-not $pidGuardado) {
    Write-Host "Soplate no está iniciado (no hay un proceso de Soplate en el puerto 8000)."
    Terminar 0
}

# Detener el proceso y, si lo lanzó un proceso de waitress, también ese proceso padre.
$proc = Get-CimInstance Win32_Process -Filter "ProcessId = $pidGuardado" -ErrorAction SilentlyContinue
$ids = @($pidGuardado)
if ($proc) {
    $padre = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.ParentProcessId)" -ErrorAction SilentlyContinue
    if ($padre -and $padre.CommandLine -match "waitress") { $ids += $padre.ProcessId }
}
foreach ($id in $ids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
Remove-Item $pidFile -ErrorAction SilentlyContinue

for ($i = 0; $i -lt 10; $i++) {
    if (-not (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)) {
        Write-Host "Soplate detenido. El puerto 8000 está libre."
        Terminar 0
    }
    Start-Sleep -Milliseconds 500
}
Write-Host "Se detuvo el proceso guardado, pero el puerto 8000 sigue ocupado por otro programa."
Terminar 1
