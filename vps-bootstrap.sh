#!/bin/bash
set -euo pipefail
HOST=flight.srv1821288.hstgr.cloud
DEST=/docker/flight-compare
PORT=18080
mkdir -p "$DEST/html" "$DEST/nginx"
BASE=https://raw.githubusercontent.com/kanraaac/flight-compare-static/main/html
curl -fsSL "$BASE/index.html" -o "$DEST/html/index.html"
curl -fsSL "$BASE/app.js" -o "$DEST/html/app.js"
curl -fsSL "$BASE/styles.css" -o "$DEST/html/styles.css"
cat > "$DEST/nginx/default.conf" << NGINX
server {
  listen ${PORT};
  server_name ${HOST};
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files \$uri \$uri/ /index.html; }
}
NGINX
cat > "$DEST/docker-compose.yml" << YML
services:
  web:
    image: nginx:alpine
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./html:/usr/share/nginx/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    labels:
      - traefik.enable=true
      - traefik.http.routers.flight-compare.rule=Host(\`$HOST\`)
      - traefik.http.routers.flight-compare.entrypoints=websecure
      - traefik.http.routers.flight-compare.tls.certresolver=letsencrypt
      - traefik.http.services.flight-compare.loadbalancer.server.url=http://127.0.0.1:${PORT}
YML
cd "$DEST"
docker compose up -d --force-recreate
sleep 2
curl -sS -o /dev/null -w "local:%{http_code}\n" "http://127.0.0.1:${PORT}/"
curl -sS -o /dev/null -w "https:%{http_code}\n" "https://${HOST}/" || true
