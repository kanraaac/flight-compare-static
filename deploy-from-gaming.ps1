$ErrorActionPreference = 'Stop'
$key = "$env:USERPROFILE\.ssh\hostinger_id"
if (-not (Test-Path $key)) { $key = 'C:\Users\Administrator\.ssh\hostinger_id' }
if (-not (Test-Path $key)) { throw "hostinger_id not found" }
$local = Join-Path $PSScriptRoot 'flight-compare-deploy.tgz'
if (-not (Test-Path $local)) {
  # if script lives next to tarball in _box_sync
  $local = Join-Path (Split-Path $PSScriptRoot -Parent) 'flight-compare-deploy.tgz'
}
if (-not (Test-Path $local)) { throw "tarball not found: $local" }
$ssh = @('-i', $key, '-o', 'StrictHostKeyChecking=accept-new', 'root@76.13.223.98')
scp @('-i', $key, '-o', 'StrictHostKeyChecking=accept-new', $local, 'root@76.13.223.98:/tmp/flight-compare-deploy.tgz')
$remote = @'
set -euo pipefail
mkdir -p /docker/flight-compare
tar xzf /tmp/flight-compare-deploy.tgz -C /docker/flight-compare
# ensure html at top
if [ -d /docker/flight-compare/html ]; then :; else mkdir -p /docker/flight-compare/html; fi
# join traefik network
TRNET=$(docker network ls --format '{{.Name}}' | grep -E 'traefik' | head -1 || true)
cd /docker/flight-compare
# rewrite compose networks if traefik found
python3 - <<'PY'
from pathlib import Path
import subprocess
p = Path('docker-compose.yml')
text = p.read_text()
nets = subprocess.check_output(["docker","network","ls","--format","{{.Name}}"], text=True).split()
tr = next((n for n in nets if "traefik" in n.lower()), None)
# Also try common Hostinger network names
if not tr:
  for n in nets:
    if n in ("proxy","web","traefik_default") or "proxy" in n:
      tr = n; break
print("traefik_or_proxy_net", tr)
# Check how korean-air gateway is networked
import json
try:
  out = subprocess.check_output(["docker","ps","--format","{{.Names}}\t{{.Label \"com.docker.compose.project.working_dir\"}}"], text=True)
  print(out[:800])
except Exception as e:
  print(e)
# Inspect korean-air container networks
ps = subprocess.check_output(["docker","ps","--format","{{.Names}}"], text=True).split()
ka = [n for n in ps if "korean" in n.lower()]
print("korean containers", ka)
for name in ka[:2]:
  nets = subprocess.check_output(["docker","inspect","-f","{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}", name], text=True)
  print(name, "nets", nets)
PY
bash /docker/flight-compare/deploy-on-vps.sh
'@
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))
ssh @ssh "echo $b64 | base64 -d | bash"
Write-Output "DONE"
