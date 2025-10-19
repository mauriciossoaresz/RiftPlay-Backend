# ================== FLUXO E2E COMPLETO (PowerShell) ==================
$ErrorActionPreference = "Stop"

# --- codificação p/ não quebrar a tabela/acentos ---
try {
  chcp 65001 | Out-Null
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
} catch {}

# --- config / ids ---
$BASE   = "http://localhost:3000"

$TEAM_A = "68e527b12b43501d9ba9da39"
$TEAM_B = "68eaceb4bb80172e1af46882"
$CAP_A  = "68e527b12b43501d9ba9da2b"
$CAP_B  = "68eaceb4bb80172e1af46875"

# --- helpers http com corpo de erro visível ---
function Get-Safe($url,$hdr){
  try { Invoke-RestMethod -Method Get $url -Headers $hdr }
  catch {
    $resp=$_.Exception.Response
    if($resp -and $resp.GetResponseStream){
      $sr=New-Object IO.StreamReader($resp.GetResponseStream());$t=$sr.ReadToEnd()
      Write-Host "`n--- HTTP ERROR BODY ---`n$t" -ForegroundColor Yellow
    }
    throw
  }
}
function Post-Safe($url,$hdr,$body){
  try { Invoke-RestMethod -Method Post $url -Headers $hdr -ContentType "application/json" -Body $body }
  catch {
    $resp=$_.Exception.Response
    if($resp -and $resp.GetResponseStream){
      $sr=New-Object IO.StreamReader($resp.GetResponseStream());$t=$sr.ReadToEnd()
      Write-Host "`n--- HTTP ERROR BODY ---`n$t" -ForegroundColor Yellow
    }
    throw
  }
}

# --- tokens (capitães) ---
$SECRET = (Select-String -Path .env -Pattern '^JWT_SECRET=(.+)$').Matches[0].Groups[1].Value.Trim()
$TK_A   = (node .\scripts\mintJwt.js "$CAP_A" "$TEAM_A" "$SECRET" | Select-Object -Last 1).Trim()
$TK_B   = (node .\scripts\mintJwt.js "$CAP_B" "$TEAM_B" "$SECRET" | Select-Object -Last 1).Trim()
$HDR_A  = @{ Authorization = "Bearer $TK_A" }
$HDR_B  = @{ Authorization = "Bearer $TK_B" }

# --- utilitários: limpar filas e resolver match pendente ---
function Clear-Queues {
  try { Post-Safe "$BASE/api/matchmaking/cancel" $HDR_A (@{teamId=$TEAM_A}|ConvertTo-Json) | Out-Null } catch {}
  try { Post-Safe "$BASE/api/matchmaking/cancel" $HDR_B (@{teamId=$TEAM_B}|ConvertTo-Json) | Out-Null } catch {}
}

function Ensure-CleanState {
  $stA=$null;$stB=$null
  try { $stA = Get-Safe "$BASE/api/matchmaking/status?teamId=$TEAM_A" $HDR_A } catch {}
  try { $stB = Get-Safe "$BASE/api/matchmaking/status?teamId=$TEAM_B" $HDR_B } catch {}
  $mid=$null;$status=$null
  if($stA -and $stA.matched){ $mid=$stA.matchId; $status=$stA.status }
  elseif($stB -and $stB.matched){ $mid=$stB.matchId; $status=$stB.status }

  if($mid){
    Write-Host "⚠️ Match ativo encontrado ($mid) status=$status — limpando..." -ForegroundColor Yellow
    if($status -eq 'pendente'){
      $accA=@{matchId=$mid;teamId=$TEAM_A}|ConvertTo-Json
      $accB=@{matchId=$mid;teamId=$TEAM_B}|ConvertTo-Json
      try { Post-Safe "$BASE/api/matchmaking/accept" $HDR_A $accA | Out-Null } catch {}
      try { Post-Safe "$BASE/api/matchmaking/accept" $HDR_B $accB | Out-Null } catch {}
      Start-Sleep -Milliseconds 200
    }
    $fin=@{matchId=$mid;winnerTeamId=$TEAM_A;teamId=$TEAM_A;placar="W-O"}|ConvertTo-Json
    try { Post-Safe "$BASE/api/matchmaking/finish" $HDR_A $fin | Out-Null } catch {}
  }
  Clear-Queues
}

# --- impressão de saldos (usa seu script se existir) ---
function Print-Balances {
  try {
    if (Test-Path .\scripts\printBalances.js) {
      node .\scripts\printBalances.js "$TEAM_A" "$TEAM_B" | Out-Host
    } elseif (Test-Path .\scripts\printBalancesAscii.js) {
      node .\scripts\printBalancesAscii.js "$TEAM_A" "$TEAM_B" | Out-Host
    }
  } catch {}
}

# ================== EXECUÇÃO ==================

# 0) deixa estado limpo
Ensure-CleanState

# 1) queue (aposta 1000)
$APOSTA = 1000
$qa = Post-Safe "$BASE/api/matchmaking/queue" $HDR_A (@{teamId=$TEAM_A;valorAposta=$APOSTA}|ConvertTo-Json)
$qb = Post-Safe "$BASE/api/matchmaking/queue" $HDR_B (@{teamId=$TEAM_B;valorAposta=$APOSTA}|ConvertTo-Json)

# 2) polling do matchId via /status autenticado
$MID=$null; $tries=0
while(-not $MID -and $tries -lt 15){
  $tries++
  try { $sA = Get-Safe "$BASE/api/matchmaking/status?teamId=$TEAM_A" $HDR_A; if($sA.matched -and $sA.matchId){ $MID=$sA.matchId; break } } catch {}
  try { $sB = Get-Safe "$BASE/api/matchmaking/status?teamId=$TEAM_B" $HDR_B; if($sB.matched -and $sB.matchId){ $MID=$sB.matchId; break } } catch {}
  Start-Sleep -Seconds 1
}
if(-not $MID){ throw "Ainda não casou. Tente rodar de novo." }
"matchId = $MID"

# 3) accept dos dois lados
$accA=@{matchId=$MID;teamId=$TEAM_A}|ConvertTo-Json
$accB=@{matchId=$MID;teamId=$TEAM_B}|ConvertTo-Json
$a1 = Post-Safe "$BASE/api/matchmaking/accept" $HDR_A $accA
$a2 = Post-Safe "$BASE/api/matchmaking/accept" $HDR_B $accB
$a1 | Format-List
$a2 | Format-List

# 4) finish (TEAM_A vencedor)
$fin=@{matchId=$MID;winnerTeamId=$TEAM_A;teamId=$TEAM_A;placar="13-9"}|ConvertTo-Json
$f = Post-Safe "$BASE/api/matchmaking/finish" $HDR_A $fin
$f | Format-List

# 5) saldos
Print-Balances

Write-Host "`n=== FIM DO FLUXO E2E ===" -ForegroundColor Cyan
# ============================================================================ 
