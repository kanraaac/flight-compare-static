# 항공권 비교 & 판단 (static)

Korean flight compare/judge — deep links + cash/mileage judgment. No API keys.

## Live
- **Hostinger VPS:** https://flight.srv1821288.hstgr.cloud/
- Mirror (GitHub Pages): https://kanraaac.github.io/flight-compare-static/

## Local
Open `index.html` or serve the folder with any static server.

## VPS path
`/docker/flight-compare/` — nginx:alpine on host network port **18080**, Traefik labels (same pattern as korean-air).

Redeploy:
```bash
ssh -i ~/.ssh/hostinger_id root@76.13.223.98 'curl -fsSL https://raw.githubusercontent.com/kanraaac/flight-compare-static/main/vps-bootstrap.sh | bash'
```
(or use the box key `hostinger_deploy` if already attached)

Defaults: PUS → KIX.
