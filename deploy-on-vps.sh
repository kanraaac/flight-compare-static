#!/bin/bash
set -euo pipefail
# Run as root on Hostinger VPS 76.13.223.98
DEST=/docker/flight-compare
mkdir -p "$DEST/html" "$DEST/nginx"
# Expect files already copied beside this script, or html/ populated
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$SCRIPT_DIR/html" ]; then
  cp -a "$SCRIPT_DIR/html/." "$DEST/html/"
  cp -a "$SCRIPT_DIR/nginx/." "$DEST/nginx/"
  cp -a "$SCRIPT_DIR/docker-compose.yml" "$DEST/"
fi
# Attach to same docker network as traefik if needed
cd "$DEST"
# Detect traefik network
TRNET=$(docker network ls --format '{{.Name}}' | grep -E 'traefik' | head -1 || true)
if [ -n "${TRNET:-}" ]; then
  echo "Using traefik network: $TRNET"
  # ensure compose joins that network
  if ! grep -q 'networks:' docker-compose.yml; then
    cat >> docker-compose.yml << NET

networks:
  default:
    external: true
    name: ${TRNET}
NET
  fi
fi
docker compose up -d --force-recreate
sleep 3
docker compose ps
curl -sS -o /tmp/fc.html -w "local:%{http_code}\n" -H 'Host: flight.srv1821288.hstgr.cloud' http://127.0.0.1/ || true
# hit via container
CID=$(docker compose ps -q web)
docker exec "$CID" wget -qO- http://127.0.0.1/ | head -c 200 || true
echo
curl -sS -o /dev/null -w "https:%{http_code}\n" https://flight.srv1821288.hstgr.cloud/ || true
grep -o '항공권 비교' /tmp/fc.html && echo CONTENT_OK || echo CONTENT_CHECK_VIA_HTTPS
