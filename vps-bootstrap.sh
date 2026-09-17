#!/bin/bash
# Idempotent bootstrap for Hostinger VPS — run as root
set -euo pipefail
HOST=flight.srv1821288.hstgr.cloud
DEST=/docker/flight-compare
REPO_RAW=https://raw.githubusercontent.com/kanraaac/flight-compare-static/main

mkdir -p "$DEST/html" "$DEST/nginx"
curl -fsSL "$REPO_RAW/html/index.html" -o "$DEST/html/index.html"
curl -fsSL "$REPO_RAW/html/app.js" -o "$DEST/html/app.js"
curl -fsSL "$REPO_RAW/html/styles.css" -o "$DEST/html/styles.css"
curl -fsSL "$REPO_RAW/nginx/default.conf" -o "$DEST/nginx/default.conf"

# Discover network used by korean-air / traefik
NET=""
for c in $(docker ps --format '{{.Names}}'); do
  case "$c" in
    *korean*|*traefik*)
      n=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$c" | head -1)
      if [ -n "$n" ]; then NET="$n"; break; fi
      ;;
  esac
done
if [ -z "$NET" ]; then
  NET=$(docker network ls --format '{{.Name}}' | grep -Ei 'traefik|proxy' | head -1 || true)
fi
echo "Using docker network: ${NET:-default}"

cat > "$DEST/docker-compose.yml" << YML
services:
  web:
    image: nginx:alpine
    restart: unless-stopped
    volumes:
      - ./html:/usr/share/nginx/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    labels:
      - traefik.enable=true
      - traefik.http.routers.flight-compare.rule=Host(\`$HOST\`)
      - traefik.http.routers.flight-compare.entrypoints=websecure
      - traefik.http.routers.flight-compare.tls.certresolver=letsencrypt
      - traefik.http.services.flight-compare.loadbalancer.server.port=80
YML

if [ -n "$NET" ]; then
  cat >> "$DEST/docker-compose.yml" << YML

networks:
  default:
    external: true
    name: $NET
YML
fi

cd "$DEST"
docker compose up -d --force-recreate
sleep 2
docker compose ps
CID=$(docker compose ps -q web)
echo "=== container local ==="
docker exec "$CID" wget -qO- http://127.0.0.1/ | head -c 250; echo
echo "=== https ==="
curl -sS -o /tmp/fc.html -w "https:%{http_code}\n" "https://$HOST/" || true
grep -o '항공권 비교' /tmp/fc.html && echo CONTENT_OK || (head -c 200 /tmp/fc.html; echo)
