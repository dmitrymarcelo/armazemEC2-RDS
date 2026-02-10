#!/usr/bin/env bash
set -euo pipefail

# Deploy script for EC2 host.
# This script must run inside the EC2 instance.

PROJECT_DIR="${PROJECT_DIR:-$HOME/logiwms-pro}"
BRANCH="${BRANCH:-main}"
API_DIR="$PROJECT_DIR/api-backend"
API_PORT="${API_PORT:-3001}"
PUBLIC_DIR="${PUBLIC_DIR:-/var/www/logiwms}"
NGINX_SITE="${NGINX_SITE:-logiwms}"

if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  echo "Repositorio nao encontrado em $PROJECT_DIR"
  echo "Defina PROJECT_DIR ou clone o projeto antes do deploy."
  exit 1
fi

if [[ ! -f "$API_DIR/.env" ]]; then
  echo "Arquivo $API_DIR/.env nao encontrado."
  echo "Copie api-backend/.env.production.rds.example para $API_DIR/.env e ajuste os valores."
  exit 1
fi

echo "[1/7] Atualizando codigo"
cd "$PROJECT_DIR"

# Preserva configuracao local de ambiente do backend durante o pull.
ENV_BACKUP="/tmp/logiwms-api-env.backup"
if [[ -f "$API_DIR/.env" ]]; then
  cp "$API_DIR/.env" "$ENV_BACKUP"
fi

git fetch --all --prune
git checkout "$BRANCH"
git pull origin "$BRANCH"

if [[ -f "$ENV_BACKUP" ]]; then
  cp "$ENV_BACKUP" "$API_DIR/.env"
fi

echo "[2/7] Instalando dependencias"
npm ci
npm --prefix api-backend ci

echo "[3/7] Verificando conexao com banco"
npm --prefix api-backend run db:health

echo "[4/7] Aplicando migracao"
npm --prefix api-backend run db:migrate

echo "[5/7] Build do frontend"
npm run build

echo "[6/7] Publicando frontend em $PUBLIC_DIR"
sudo mkdir -p "$PUBLIC_DIR"
sudo rsync -a --delete "$PROJECT_DIR/dist/" "$PUBLIC_DIR/"

echo "[7/7] Reiniciando backend e nginx"
cd "$API_DIR"
if pm2 describe logiwms-api >/dev/null 2>&1; then
  pm2 restart logiwms-api --update-env
else
  pm2 start index.js --name logiwms-api
fi
pm2 save

sudo tee "/etc/nginx/conf.d/${NGINX_SITE}.conf" >/dev/null <<EOF
server {
  listen 80;
  server_name _;
  root $PUBLIC_DIR;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:${API_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo
echo "Deploy concluido."
echo "- PM2: pm2 status"
echo "- Backend logs: pm2 logs logiwms-api"
echo "- Nginx logs: sudo journalctl -u nginx -f"
