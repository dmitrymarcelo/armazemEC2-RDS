param(
  [Parameter(Mandatory = $true)]
  [string]$InstanceId,

  [Parameter(Mandatory = $true)]
  [string]$ApiUpstream,

  [string]$Profile = "389364614518",
  [string]$Region = "us-east-1",
  [string]$Branch = "main",
  [string]$ProjectDir = "/home/ec2-user/logiwms-pro",
  [string]$RepoUrl = "https://github.com/dmitrymarcelo/armazemEC2-RDS.git",
  [int]$PollSeconds = 8,
  [int]$MaxPolls = 120
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI nao encontrado no PATH."
}

$normalizedUpstream = $ApiUpstream.Trim().TrimEnd("/")
if ($normalizedUpstream -notmatch "^https?://") {
  throw "ApiUpstream invalido. Use URL completa, ex: http://SEU_BACKEND_PUBLICO:3001"
}

if ($normalizedUpstream -match "127\.0\.0\.1|localhost") {
  throw "ApiUpstream nao pode ser localhost/127.0.0.1 (EC2 nao acessa seu localhost). Use URL publica/tunel."
}

$remoteCommands = @(
  "set -euo pipefail",
  "if [ ! -d '$ProjectDir/.git' ]; then git clone '$RepoUrl' '$ProjectDir'; fi",
  "cd '$ProjectDir'",
  "git fetch --all --prune",
  "git checkout '$Branch'",
  "git pull origin '$Branch'",
  "chmod +x deploy-ec2-frontend-only.sh",
  "API_UPSTREAM='$normalizedUpstream' BRANCH='$Branch' PROJECT_DIR='$ProjectDir' DISABLE_EC2_BACKEND=true ./deploy-ec2-frontend-only.sh"
)

$payload = @{
  DocumentName = "AWS-RunShellScript"
  InstanceIds = @($InstanceId)
  Comment = "Deploy frontend-only EC2 with hybrid API upstream"
  Parameters = @{
    commands = $remoteCommands
  }
}

$tempJson = Join-Path $env:TEMP ("logiwms-ssm-hybrid-" + [Guid]::NewGuid().ToString() + ".json")
$payload | ConvertTo-Json -Depth 8 | Set-Content -Path $tempJson -Encoding UTF8

try {
  $sendArgs = @(
    "ssm", "send-command",
    "--region", $Region,
    "--cli-input-json", "file://$tempJson",
    "--query", "Command.CommandId",
    "--output", "text"
  )
  if ($Profile) {
    $sendArgs += @("--profile", $Profile)
  }

  $commandId = (& aws @sendArgs).Trim()
  if (-not $commandId) {
    throw "Falha ao obter CommandId do SSM."
  }

  Write-Host ("SSM command enviado: {0}" -f $commandId) -ForegroundColor Cyan
  Write-Host ("InstanceId: {0} | Region: {1} | Branch: {2}" -f $InstanceId, $Region, $Branch)
  Write-Host ("API_UPSTREAM: {0}" -f $normalizedUpstream)

  $finalStatuses = @("Success", "Failed", "Cancelled", "TimedOut", "Cancelling")
  $lastStatus = "Pending"
  $details = $null

  for ($attempt = 1; $attempt -le $MaxPolls; $attempt += 1) {
    Start-Sleep -Seconds $PollSeconds

    $listArgs = @(
      "ssm", "list-command-invocations",
      "--region", $Region,
      "--command-id", $commandId,
      "--details",
      "--query", "CommandInvocations[0]",
      "--output", "json"
    )
    if ($Profile) {
      $listArgs += @("--profile", $Profile)
    }

    $raw = & aws @listArgs
    if (-not $raw -or $raw -eq "null") {
      Write-Host ("[{0}/{1}] aguardando invocacao..." -f $attempt, $MaxPolls)
      continue
    }

    $details = $raw | ConvertFrom-Json
    $lastStatus = [string]$details.Status
    Write-Host ("[{0}/{1}] status: {2}" -f $attempt, $MaxPolls, $lastStatus)

    if ($finalStatuses -contains $lastStatus) {
      break
    }
  }

  if (-not $details) {
    throw "Nao foi possivel consultar resultado do SSM command."
  }

  $plugin = $details.CommandPlugins | Select-Object -First 1
  $stdout = [string]$plugin.Output
  $stderr = [string]$plugin.StandardErrorContent

  Write-Host ""
  Write-Host "=== OUTPUT REMOTO ===" -ForegroundColor Green
  if ($stdout) {
    Write-Host $stdout
  } else {
    Write-Host "(sem output)"
  }

  if ($stderr) {
    Write-Host ""
    Write-Host "=== STDERR REMOTO ===" -ForegroundColor Yellow
    Write-Host $stderr
  }

  if ($lastStatus -ne "Success") {
    throw ("Deploy remoto terminou com status '{0}'." -f $lastStatus)
  }

  Write-Host ""
  Write-Host "Deploy hibrido concluido com sucesso." -ForegroundColor Green
  Write-Host "Frontend EC2 esta publicado e /api aponta para: $normalizedUpstream"
}
finally {
  if (Test-Path $tempJson) {
    Remove-Item $tempJson -Force
  }
}

