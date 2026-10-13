# Funciones compartidas por iniciar.ps1, detener.ps1 y publicar.ps1.

# Devuelve el PID del proceso que escucha en 127.0.0.1:8000 si el PID guardado
# corresponde a Soplate; si no, borra el archivo de PID viejo y devuelve $null.
function Get-SoplatePid {
    $pidFile = Join-Path $PSScriptRoot ".soplate.pid"
    if (-not (Test-Path $pidFile)) { return $null }
    $guardado = 0
    $texto = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    $valido = [int]::TryParse([string]$texto, [ref]$guardado)
    $escucha = $null
    if ($valido) {
        $escucha = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
            Where-Object { $_.LocalAddress -eq "127.0.0.1" } | Select-Object -First 1
    }
    if ($valido -and $escucha) {
        $dueno = [int]$escucha.OwningProcess
        $esSoplate = $false
        if ($guardado -eq $dueno) { $esSoplate = $true }
        else {
            # El guardado puede ser el lanzador (padre) o el hijo del que escucha.
            $pGuardado = Get-CimInstance Win32_Process -Filter "ProcessId = $guardado" -ErrorAction SilentlyContinue
            $pDueno = Get-CimInstance Win32_Process -Filter "ProcessId = $dueno" -ErrorAction SilentlyContinue
            if ($pGuardado -and $pDueno -and $pGuardado.Name -match "python|waitress" -and
                ($pDueno.ParentProcessId -eq $guardado -or $pGuardado.ParentProcessId -eq $dueno)) { $esSoplate = $true }
        }
        if ($esSoplate -and (Get-Process -Id $dueno -ErrorAction SilentlyContinue)) { return $dueno }
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    return $null
}
