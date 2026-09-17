# Run on Gaming-v5 (as Administrator optional). Deploys flight compare to Hostinger VPS.
$ErrorActionPreference = 'Stop'
$key = Join-Path $env:USERPROFILE '.ssh\hostinger_id'
if (-not (Test-Path $key)) { $key = 'C:\Users\Administrator\.ssh\hostinger_id' }
if (-not (Test-Path $key)) { throw "Missing $key" }
$sshArgs = @('-i', $key, '-o', 'StrictHostKeyChecking=accept-new', 'root@76.13.223.98')
$cmd = 'curl -fsSL https://raw.githubusercontent.com/kanraaac/flight-compare-static/main/vps-bootstrap.sh | bash'
ssh @sshArgs $cmd
Write-Host "Open https://flight.srv1821288.hstgr.cloud/"
