#!/bin/bash
# ============================================================
# setup-vps.sh — Installation initiale Vigilance 22 sur VPS Ubuntu
# À exécuter UNE SEULE FOIS en root ou sudo sur le VPS
# Usage : bash setup-vps.sh
# ============================================================

set -e

VPS_USER=${1:-"user"}          # Remplacer par ton user VPS
APP_DIR="/var/www/vigilance22"
MAINTENANCE_DIR="/home/${VPS_USER}/vigilance22-maintenance"
DOMAIN="vigilance22.fr"

echo "=== [1/6] Mise à jour système ==="
apt update && apt upgrade -y

echo "=== [2/6] Installation Nginx, Python3, Certbot ==="
apt install -y nginx python3 python3-pip python3-venv certbot python3-certbot-nginx curl

echo "=== [3/6] Création des répertoires ==="
mkdir -p ${APP_DIR}
mkdir -p ${MAINTENANCE_DIR}
chown -R ${VPS_USER}:${VPS_USER} ${APP_DIR}
chown -R ${VPS_USER}:${VPS_USER} ${MAINTENANCE_DIR}

echo "=== [4/6] Configuration Nginx ==="
cat > /etc/nginx/sites-available/vigilance22 << 'NGINX'
server {
    listen 80;
    server_name vigilance22.fr www.vigilance22.fr;
    root /var/www/vigilance22;
    index index.html;

    # Compression gzip
    gzip on;
    gzip_types text/html text/css application/javascript application/json application/geo+json;
    gzip_min_length 1024;

    # Cache long pour assets
    location ~* \.(css|js|png|jpg|svg|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker : pas de cache (doit toujours être à jour)
    location = /sw.js {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Manifest PWA
    location = /manifest.json {
        expires 1d;
        add_header Content-Type "application/manifest+json";
    }

    # CORS pour les APIs (appelées depuis le navigateur, pas le serveur)
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    # Redirection HTTPS (Certbot complète cette section)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Webhook Hermes (endpoint de déclenchement maintenance)
    location /webhook/deploy {
        allow 127.0.0.1;  # Hermes local seulement
        deny all;
        proxy_pass http://127.0.0.1:9000;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/vigilance22 /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "=== [5/6] Certificat HTTPS Let's Encrypt ==="
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m ph.payet@gmail.com

echo "=== [6/6] Python venv pour les scripts de maintenance ==="
python3 -m venv ${MAINTENANCE_DIR}/venv
${MAINTENANCE_DIR}/venv/bin/pip install requests numpy scipy

echo ""
echo "✅ Setup terminé. Étapes suivantes :"
echo "  1. Déployer les fichiers : bash deploy.sh depuis ta machine locale"
echo "  2. Configurer les crons : crontab -u ${VPS_USER} vps/crontab-vigilance22"
echo "  3. (optionnel) Démarrer le webhook Hermes : voir vps/hermes-webhook.py"
