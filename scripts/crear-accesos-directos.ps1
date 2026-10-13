# Crea en el escritorio los accesos "Iniciar Soplate" y "Detener Soplate".
# Uso: powershell -ExecutionPolicy Bypass -File scripts\crear-accesos-directos.ps1
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$escritorio = [Environment]::GetFolderPath("Desktop")
$icono = Join-Path $raiz "frontend\app\public\favicon.ico"
$shell = New-Object -ComObject WScript.Shell

function Crear-Acceso($nombre, $script) {
    $lnk = $shell.CreateShortcut((Join-Path $escritorio "$nombre.lnk"))
    $lnk.TargetPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $raiz "scripts\$script")`""
    $lnk.WorkingDirectory = $raiz
    if (Test-Path $icono) { $lnk.IconLocation = $icono }
    $lnk.Save()
    Write-Host "Creado: $nombre (en el escritorio)"
}

Crear-Acceso "Iniciar Soplate" "iniciar.ps1"
Crear-Acceso "Detener Soplate" "detener.ps1"
