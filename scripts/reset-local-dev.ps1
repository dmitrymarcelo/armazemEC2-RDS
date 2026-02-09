param(
  [int[]]$Ports = @(3000, 3001),
  [switch]$KeepFrontend = $false
)

$ErrorActionPreference = "Continue"

function Get-ListeningConnections {
  param(
    [int[]]$TargetPorts
  )

  $allConnections = @()
  foreach ($port in $TargetPorts) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
      $allConnections += $connections
    }
  }

  return $allConnections
}

Write-Host "Limpando ambiente local..." -ForegroundColor Cyan

$connections = Get-ListeningConnections -TargetPorts $Ports
if (-not $connections -or $connections.Count -eq 0) {
  Write-Host "Nenhum processo ouvindo nas portas alvo." -ForegroundColor Green
} else {
  $portsByPid = @{}
  foreach ($conn in $connections) {
    if ($conn.OwningProcess -gt 0) {
      if (-not $portsByPid.ContainsKey($conn.OwningProcess)) {
        $portsByPid[$conn.OwningProcess] = @()
      }
      $portsByPid[$conn.OwningProcess] += $conn.LocalPort
    }
  }

  foreach ($procId in $portsByPid.Keys) {
    try {
      $process = Get-Process -Id $procId -ErrorAction Stop
      $portsText = (($portsByPid[$procId] | Sort-Object -Unique) -join ", ")

      if ($KeepFrontend -and $portsByPid[$procId] -contains 3000) {
        Write-Host ("Mantendo processo {0} ({1}) na porta {2}" -f $procId, $process.ProcessName, $portsText) -ForegroundColor Yellow
        continue
      }

      Write-Host ("Encerrando processo {0} ({1}) na(s) porta(s): {2}" -f $procId, $process.ProcessName, $portsText) -ForegroundColor Yellow
      Stop-Process -Id $procId -Force -ErrorAction Stop
    } catch {
      Write-Warning ("Falha ao encerrar PID {0}: {1}" -f $procId, $_.Exception.Message)
    }
  }
}

$root = Split-Path -Parent $PSScriptRoot
$backendOutLog = Join-Path $root "api-backend\dev-local.out.log"
$backendErrLog = Join-Path $root "api-backend\dev-local.err.log"

foreach ($logPath in @($backendOutLog, $backendErrLog)) {
  if (Test-Path $logPath) {
    try {
      Remove-Item $logPath -Force
      Write-Host ("Removido log: {0}" -f $logPath) -ForegroundColor DarkGray
    } catch {
      Write-Warning ("Nao foi possivel remover log {0}: {1}" -f $logPath, $_.Exception.Message)
    }
  }
}

Start-Sleep -Seconds 1
$remaining = Get-ListeningConnections -TargetPorts $Ports
if ($remaining -and $remaining.Count -gt 0) {
  Write-Warning "Ainda existem processos ativos nas portas alvo:"
  $remaining |
    Select-Object LocalAddress, LocalPort, State, OwningProcess |
    Format-Table -AutoSize |
    Out-Host
} else {
  Write-Host "Ambiente local limpo com sucesso." -ForegroundColor Green
}
