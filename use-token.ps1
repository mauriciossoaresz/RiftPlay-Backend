$BASE = "http://localhost:3000"
$TOKEN = Get-Content .token -Raw
$HEAD = @{ Authorization = "Bearer " + $TOKEN }
Invoke-RestMethod -Headers $HEAD -Uri "$BASE/api/team/me" -Method Get
