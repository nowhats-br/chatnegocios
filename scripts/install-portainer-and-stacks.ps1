#requires -Version 5.1
<#
Instala Portainer e publica as stacks Evolution e ChatNegocios com API key automática.

Pré-requisitos:
- Docker Desktop ativo
- Este repositório clonado localmente
- .env com VITE_EVOLUTION_API_KEY definido (ou será gerado)

Acessos:
- Portainer: http://localhost:9000
- Evolution API: http://localhost:8080
- ChatNegocios (frontend): http://localhost:8081
- ChatNegocios (backend): http://localhost:3001
#>

param(
  [string]$PortainerAdminPassword = "Admin123!",
  [string]$PortainerUrl = "http://localhost:9000"
)

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Ensure-Docker {
  Write-Info "Verificando Docker..."
  try {
    docker version | Out-Null
  } catch {
    Write-Err "Docker não está disponível. Abra o Docker Desktop e tente novamente."
    exit 1
  }
}

function Get-EvolutionApiKeyFromEnv {
  $envPath = Join-Path (Get-Location) ".env"
  if (Test-Path $envPath) {
    $line = (Get-Content $envPath) | Where-Object { $_ -match '^\s*VITE_EVOLUTION_API_KEY\s*=\s*(.+)\s*$' } | Select-Object -First 1
    if ($line) {
      $key = ($line -split '=')[1].Trim()
      if ($key) { return $key }
    }
  }
  Write-Warn "VITE_EVOLUTION_API_KEY não encontrado em .env; gerando um novo automaticamente."
  # Gera uma chave hex aleatória de 32 bytes
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ''
}

function Build-ChatNegociosImages([string]$BackendUrl, [string]$EvolutionUrl, [string]$EvolutionKey) {
  Write-Info "Construindo imagem do backend..."
  docker build -t chatnegocios-backend:latest -f Dockerfile.backend .
  if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao construir backend"; exit 1 }

  Write-Info "Construindo imagem do frontend..."
  docker build `
    --build-arg VITE_BACKEND_URL=$BackendUrl `
    --build-arg VITE_EVOLUTION_API_URL=$EvolutionUrl `
    --build-arg VITE_EVOLUTION_API_KEY=$EvolutionKey `
    -t chatnegocios-frontend:latest `
    -f Dockerfile.frontend .
  if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao construir frontend"; exit 1 }
}

function Start-Portainer($Url) {
  Write-Info "Subindo Portainer em $Url..."
  docker volume create portainer_data | Out-Null
  # Para Windows com Docker Desktop (named pipe)
  $exists = docker ps -a --format '{{.Names}}' | Where-Object { $_ -eq 'portainer' }
  if (-not $exists) {
    docker run -d -p 9000:9000 --name portainer --restart=always `
      -v \\.:\\pipe\\docker_engine:\\.\\pipe\\docker_engine `
      -v portainer_data:C:\\data `
      portainer/portainer-ce:latest | Out-Null
  } else {
    docker start portainer | Out-Null
  }

  # Aguarda porta subir
  $max = 30
  for ($i=0; $i -lt $max; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "$Url/api/status" -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { Write-Info "Portainer pronto"; return }
    } catch { Start-Sleep -Seconds 2 }
  }
  Write-Err "Portainer não respondeu em tempo hábil"; exit 1
}

function Ensure-ProxyNetwork {
  Write-Info "Verificando rede 'proxy'..."
  try {
    docker network inspect proxy | Out-Null
    Write-Info "Rede 'proxy' já existe"
  } catch {
    Write-Info "Criando rede 'proxy' compartilhada..."
    docker network create proxy | Out-Null
  }
}

function Ensure-AppNetwork {
  Write-Info "Verificando rede 'app_net'..."
  try {
    docker network inspect app_net | Out-Null
    Write-Info "Rede 'app_net' já existe"
  } catch {
    Write-Info "Criando rede 'app_net' compartilhada..."
    docker network create app_net | Out-Null
  }
}

function Get-DbVarsFromEnv {
  $envPath = Join-Path (Get-Location) ".env"
  $defaults = @{ POSTGRES_USER = 'postgres'; POSTGRES_PASSWORD = 'postgres'; POSTGRES_DB = 'chatnegocios' }
  if (Test-Path $envPath) {
    $content = Get-Content $envPath
    foreach ($k in $defaults.Keys) {
      $line = $content | Where-Object { $_ -match "^\s*$k\s*=\s*(.+)\s*$" } | Select-Object -First 1
      if ($line) { $defaults[$k] = ($line -split '=')[1].Trim() }
    }
  }
  return $defaults
}

function Init-PortainerAdmin($Url, $Password) {
  Write-Info "Inicializando usuário admin no Portainer..."
  try {
    Invoke-RestMethod -Method POST -Uri "$Url/api/users/admin/init" -ContentType 'application/json' -Body (ConvertTo-Json @{ Password = $Password }) | Out-Null
  } catch {
    Write-Warn "Admin já inicializado ou erro não crítico: $($_.Exception.Message)"
  }
}

function Get-PortainerToken($Url, $Password) {
  Write-Info "Obtendo token de autenticação do Portainer..."
  $res = Invoke-RestMethod -Method POST -Uri "$Url/api/auth" -ContentType 'application/json' -Body (ConvertTo-Json @{ Username = 'admin'; Password = $Password })
  return $res.jwt
}

function Create-Stack($Url, $Token, $Name, $Compose, $Env = @()) {
  Write-Info "Criando stack '$Name'..."
  $headers = @{ Authorization = "Bearer $Token" }
  $body = @{ name = $Name; stackFileContent = $Compose; env = $Env }
  $json = $body | ConvertTo-Json -Depth 6
  # endpointId=1 corresponde ao Docker local
  $uri = "$Url/api/stacks/create/standalone?endpointId=1"
  try {
    $res = Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -ContentType 'application/json' -Body $json
    Write-Info "Stack '$Name' criada (ID: $($res.Id))"
  } catch {
    Write-Warn "Falha ao criar stack '$Name': $($_.Exception.Message). Tentando atualizar..."
    # Tenta atualizar se já existir
    try {
      $stacks = Invoke-RestMethod -Method GET -Uri "$Url/api/stacks" -Headers $headers
      $existing = $stacks | Where-Object { $_.Name -eq $Name }
      if ($existing) {
        $updateUri = "$Url/api/stacks/$($existing.Id)?endpointId=1"
        Invoke-RestMethod -Method PUT -Uri $updateUri -Headers $headers -ContentType 'application/json' -Body $json | Out-Null
        Write-Info "Stack '$Name' atualizada"
      } else { throw }
    } catch {
      Write-Err "Não foi possível criar/atualizar a stack '$Name'"
      throw
    }
  }
}

# Execução
Ensure-Docker
$evoKey = Get-EvolutionApiKeyFromEnv
Write-Info "Evolution API Key: $evoKey"

# Constantes de URLs para o build e acesso pelo browser
$backendUrl = 'http://localhost:3001'
$evolutionUrl = 'http://localhost:8080'

Build-ChatNegociosImages -BackendUrl $backendUrl -EvolutionUrl $evolutionUrl -EvolutionKey $evoKey

Start-Portainer -Url $PortainerUrl
Init-PortainerAdmin -Url $PortainerUrl -Password $PortainerAdminPassword
$token = Get-PortainerToken -Url $PortainerUrl -Password $PortainerAdminPassword

# Garante rede compartilhada para Traefik
Ensure-ProxyNetwork
Ensure-AppNetwork

# Lê Compose files
$traefikCompose = Get-Content (Join-Path (Get-Location) 'scripts/traefik-compose.yml') -Raw
$evolutionCompose = Get-Content (Join-Path (Get-Location) 'scripts/evolution-compose.yml') -Raw
$chatCompose = Get-Content (Join-Path (Get-Location) 'scripts/chatnegocios-compose.yml') -Raw
$postgresCompose = Get-Content (Join-Path (Get-Location) 'scripts/postgres-compose.yml') -Raw

# Cria/atualiza stacks (Traefik primeiro)
Create-Stack -Url $PortainerUrl -Token $token -Name 'traefik' -Compose $traefikCompose
Create-Stack -Url $PortainerUrl -Token $token -Name 'evolution' -Compose $evolutionCompose -Env @(@{ name='VITE_EVOLUTION_API_KEY'; value=$evoKey })

# Publica Postgres antes do ChatNegocios para resolver dependência de rede
$dbVars = Get-DbVarsFromEnv
Create-Stack -Url $PortainerUrl -Token $token -Name 'chatnegocios-db' -Compose $postgresCompose -Env @(
  @{ name='POSTGRES_USER'; value=$dbVars.POSTGRES_USER },
  @{ name='POSTGRES_PASSWORD'; value=$dbVars.POSTGRES_PASSWORD },
  @{ name='POSTGRES_DB'; value=$dbVars.POSTGRES_DB }
)

# Injetar DATABASE_URL no backend do ChatNegocios
$databaseUrl = "postgresql://$($dbVars.POSTGRES_USER):$($dbVars.POSTGRES_PASSWORD)@postgres:5432/$($dbVars.POSTGRES_DB)"
Create-Stack -Url $PortainerUrl -Token $token -Name 'chatnegocios' -Compose $chatCompose -Env @(
  @{ name='DATABASE_URL'; value=$databaseUrl }
)

Write-Host ""; Write-Info "Concluído. Acesse:"
Write-Host "- Portainer: $PortainerUrl" -ForegroundColor Green
Write-Host "- Evolution API: $evolutionUrl (ou http://evolution.localtest.me)" -ForegroundColor Green
Write-Host "- ChatNegocios (frontend): http://localhost:8081 (ou http://chatnegocios.localtest.me)" -ForegroundColor Green
Write-Host "- ChatNegocios (backend): $backendUrl (ou http://api.localtest.me)" -ForegroundColor Green
Write-Host "- Postgres: postgresql://$($dbVars.POSTGRES_USER):$($dbVars.POSTGRES_PASSWORD)@localhost:5432/$($dbVars.POSTGRES_DB)" -ForegroundColor Green