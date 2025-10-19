param(
  [string]$Base = $env:API_URL
)

# fallback para localhost se não vier nada do .env
if (-not $Base -or $Base.Trim() -eq "") { $Base = "http://localhost:3000" }

# ==== CONFIG ====
$senha = "123456"
# gera sufixo aleatório para evitar duplicidade
$suf = Get-Random -Minimum 10000 -Maximum 99999
# usa e-mail simples (sem +) para não bater em regex restritivo
$email    = "testrpf$suf@example.com"
$nickname = "tstrpf$suf"
$nome     = "Teste RPF $suf"
# CPF sintético (11 dígitos). ajuste se tua validação exigir DV real
$cpf      = ("{0:D11}" -f (Get-Random -Minimum 10000000000 -Maximum 19999999999))

Write-Host "Base: $Base"
Write-Host "Tentando com e-mail: $email | nickname: $nickname | cpf: $cpf"

# 1) Tenta LOGIN primeiro
$login = $null
try {
  $loginBody = @{ email = $email; senha = $senha } | ConvertTo-Json -Compress
  $login = Invoke-RestMethod -Uri "$Base/api/login" -Method Post -ContentType 'application/json' -Body $loginBody
  Write-Host "Login OK (usuário já existia)."
} catch {
  Write-Host "Login direto falhou, tentando registrar..."
}

# 2) Se login falhou, REGISTRA e loga
if (-not $login) {
  try {
    $regBody = @{
      nome     = $nome
      nickname = $nickname
      email    = $email
      senha    = $senha
      cpf      = $cpf
    } | ConvertTo-Json -Compress

    $reg = Invoke-RestMethod -Uri "$Base/api/register" -Method Post -ContentType 'application/json' -Body $regBody
    Write-Host "Registro OK."

    $loginBody = @{ email = $email; senha = $senha } | ConvertTo-Json -Compress
    $login = Invoke-RestMethod -Uri "$Base/api/login" -Method Post -ContentType 'application/json' -Body $loginBody
    Write-Host "Login após registro OK."
  } catch {
    $msg = $_.ErrorDetails.Message
    if (-not $msg) { $msg = $_.Exception.Message }
    Write-Error "Falha ao registrar/logar. Detalhes: $msg"
    throw
  }
}

# 3) Extrai e salva token
$token = $login.token
if (-not $token) { $token = $login.accessToken }
if (-not $token) {
  Write-Error "Resposta de login não contém 'token' nem 'accessToken'. Conteúdo abaixo:"
  $login | ConvertTo-Json -Depth 6
  throw "Token não encontrado."
}

Set-Content -Path ".token" -Value $token -Encoding ascii
Write-Host "TOKEN salvo em .token"

# 4) Gera um script de uso para evitar problemas de aspas no terminal
$lines = @()
$lines += '$BASE = "' + $Base + '"'
$lines += '$TOKEN = Get-Content .token -Raw'
$lines += '$HEAD = @{ Authorization = "Bearer " + $TOKEN }'
$lines += 'Invoke-RestMethod -Headers $HEAD -Uri "$BASE/api/team/me" -Method Get'
Set-Content -Path ".\use-token.ps1" -Value $lines -Encoding ascii
Write-Host "Gerado .\use-token.ps1 para testar o token."
Write-Host "Execute: .\use-token.ps1"
