#!/bin/bash
# ============================================================
# deploy.sh — Déploiement Vigilance 22 vers VPS Ubuntu
# À exécuter depuis ta machine locale (Mac)
# Usage : bash hostinger_deploy/vps/deploy.sh
# ============================================================

set -e

# ── CONFIGURATION ─────────────────────────────────────────
VPS_IP="TON_IP_VPS"              # Ex: 31.220.xx.xx
VPS_USER="root"                   # ou ton user sudo
VPS_DIR="/var/www/vigilance22"
LOCAL_DIR="$(dirname "$0")/.."   # hostinger_deploy/
# ──────────────────────────────────────────────────────────

echo "🚀 Déploiement Vigilance 22 → ${VPS_USER}@${VPS_IP}:${VPS_DIR}"

# Fichiers statiques
echo "→ Transfert index.html, sw.js, manifest.json..."
scp "${LOCAL_DIR}/public_html/index.html" \
    "${LOCAL_DIR}/public_html/sw.js" \
    "${LOCAL_DIR}/public_html/manifest.json" \
    "${VPS_USER}@${VPS_IP}:${VPS_DIR}/"

# Robots.txt si présent
[ -f "${LOCAL_DIR}/public_html/robots.txt" ] && \
    scp "${LOCAL_DIR}/public_html/robots.txt" "${VPS_USER}@${VPS_IP}:${VPS_DIR}/"

# Scripts de maintenance (premier déploiement ou mise à jour)
echo "→ Transfert scripts de maintenance..."
ssh "${VPS_USER}@${VPS_IP}" "mkdir -p /home/${VPS_USER}/vigilance22-maintenance"
scp "${LOCAL_DIR}/maintenance/calibrer_propagation.py" \
    "${LOCAL_DIR}/maintenance/update_shom.py" \
    "${LOCAL_DIR}/maintenance/propagation.json" \
    "${VPS_USER}@${VPS_IP}:/home/${VPS_USER}/vigilance22-maintenance/"

# Rechargement Nginx (pas nécessaire pour les fichiers statiques, mais bonne pratique)
ssh "${VPS_USER}@${VPS_IP}" "nginx -t && systemctl reload nginx"

echo ""
echo "✅ Déploiement terminé."
echo "   → https://vigilance22.fr"
ssh "${VPS_USER}@${VPS_IP}" "ls -lh ${VPS_DIR}/"
