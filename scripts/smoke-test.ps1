# smoke-test.ps1 — Smoke de /api (register/login) e /api/team

# Base URL
$base = $env:API_URL
if (-not [string]::IsNullOrWhiteSpace($base)) { $base = $base.TrimEnd("/") } else { $base = "http://localhost:3000" }

$API  = "$base/api"
$TEAM = "$API/team"

function J($o){ $o | ConvertTo-Json -Depth 5 }
function Try-Post($url,$body,$headers=$null){
  if($headers){ Invoke-RestMethod -Uri $url -Method POST -Headers $headers -ContentType "application/json" -Body (J $body) }
  else        { Invoke-RestMethod -Uri $url -Method POST                      -ContentType "application/json" -Body (J $body) }
}
function Try-Get($url,$headers=$null){
  if($headers){ Invoke-RestMethod -Uri $url -Method GET -Headers $headers } else { Invoke-RestMethod -Uri $url -Method GET }
}

# ---------- IDs únicos por execução ----------
$stamp = Get-Date -Format "yyyyMMddHHmmss"
# CPF de 11 dígitos: 2 dígitos aleatórios + últimos 9 do timestamp
$cpf1  = ("{0:d2}{1}" -f (Get-Random -Minimum 10 -Maximum 99), $stamp.Substring($stamp.Length-9))
$cpf2  = ("{0:d2}{1}" -f (Get-Random -Minimum 10 -Maximum 99), $stamp.Substring($stamp.Length-9))

$user1 = @{
  nome      = "User One"
  nickname  = "user1_$stamp"
  email     = "user1+$stamp@example.com"
  senha     = "password123"
  cpf       = $cpf1
}
$user2 = @{
  nome      = "User Two"
  nickname  = "user2_$stamp"
  email     = "user2+$stamp@example.com"
  senha     = "password123"
  cpf       = $cpf2
}

function Read-Body($ex){
  try { (New-Object IO.StreamReader $ex.Response.GetResponseStream()).ReadToEnd() } catch { "" }
}

function Register($u){
  try {
    $r = Try-Post "$API/register" $u
    Write-Host ("Registered {0}: {1}" -f $u.nickname, $r.mensagem)
  } catch {
    $status = $_.Exception.Response.StatusCode.Value__ 2>$null
    $body   = Read-Body $_.Exception
    Write-Host ("Register FAIL {0}: {1} {2}" -f $u.nickname, $status, $body) -ForegroundColor Red
    throw
  }
}

function Login($u){
  try {
    ($resp = Try-Post "$API/login" @{ email=$u.email; senha=$u.senha }).token
  } catch {
    $status = $_.Exception.Response.StatusCode.Value__ 2>$null
    $body   = Read-Body $_.Exception
    Write-Host ("Login FAIL {0}: {1} {2}" -f $u.nickname, $status, $body) -ForegroundColor Red
    throw
  }
}

Write-Host ("API base: {0}" -f $API)

# 1) Register (fatal se 409/erro)
Register $user1
Register $user2

# 2) Logins
$tok1 = Login $user1
$tok2 = Login $user2
Write-Host ("u1 token: {0}..." -f $tok1.Substring(0,16))
Write-Host ("u2 token: {0}..." -f $tok2.Substring(0,16))
$H1 = @{ Authorization = "Bearer $tok1" }
$H2 = @{ Authorization = "Bearer $tok2" }

# 3) Criar time (u1)
$teamReq = @{ nome = "Test Team"; valorAposta = 25 }
$create  = Try-Post "$TEAM/create" $teamReq $H1
$teamId  = $create.time._id
Write-Host ("Created: Team={0} id={1}" -f $create.time.nome, $teamId) -ForegroundColor Green

# 4) /team/me (populate)
$me  = Try-Get "$TEAM/me" $H1
$cap = $me.time.capitaoId.nickname
$cnt = $me.time.jogadores.Count
Write-Host ("Me ok: Team={0} Captain={1} Members={2}" -f $me.time.nome, $cap, $cnt) -ForegroundColor Green

# 5) user2 entra
$join = Try-Post "$TEAM/join" @{ teamId = $teamId } $H2
$cnt  = $join.time.jogadores.Count
Write-Host ("Join ok: members={0}" -f $cnt) -ForegroundColor Green

# 6) user2 sai
$leave = Try-Post "$TEAM/leave" @{} $H2
Write-Host ("Leave ok: {0}" -f $leave.mensagem)

# 7) Resumo
Write-Host "== RESUMO ==" -ForegroundColor Cyan
Write-Host ("u1={0} | u2={1}" -f $user1.email, $user2.email)
Write-Host "Smoke test finalizado." -ForegroundColor Green
