#!/usr/bin/env python3
"""
hermes-webhook.py — Webhook HTTP pour l'agent Hermes
Écoute sur 127.0.0.1:9000 (localhost uniquement, proxié par Nginx)
Permet à Hermes de déclencher des actions de maintenance à distance.

Démarrage : python3 hermes-webhook.py &
Ou via systemd : voir vps/vigilance22-webhook.service

Endpoints :
  POST /deploy        → redéploie depuis le repo local (si git configuré)
  POST /calibrate     → lance calibrer_propagation.py
  GET  /status        → état courant (vigilance, dernière mise à jour)
"""

import json
import os
import subprocess
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import requests

MAINT_DIR = Path(__file__).parent.parent / "maintenance"
APP_DIR = Path("/var/www/vigilance22")
SECRET = os.environ.get("HERMES_WEBHOOK_SECRET", "change-me-hermes-secret")
PORT = 9000


def run_script(script_name):
    venv_python = Path(__file__).parent / "venv" / "bin" / "python3"
    script = MAINT_DIR / script_name
    result = subprocess.run(
        [str(venv_python), str(script)],
        capture_output=True, text=True, cwd=str(MAINT_DIR)
    )
    return result.returncode == 0, result.stdout + result.stderr


def get_status():
    try:
        r = requests.get(
            "https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson",
            timeout=5
        )
        data = r.json()
        max_vigi = 1
        for feat in data.get("features", []):
            p = feat.get("properties", {})
            if any(p.get("CdEntVigiCru", "").startswith(t) for t in ["BT13", "BT14", "BT15", "BT5"]):
                max_vigi = max(max_vigi, p.get("NivSituVigiCruEnt", 1))
        vigimap = {1: "vert", 2: "jaune", 3: "orange", 4: "rouge"}
        return {"vigilance_22": vigimap.get(max_vigi, "inconnu"), "ts": datetime.now().isoformat()}
    except Exception as e:
        return {"error": str(e)}


class WebhookHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {self.address_string()} {format % args}")

    def send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def check_auth(self):
        auth = self.headers.get("X-Hermes-Secret", "")
        return auth == SECRET

    def do_GET(self):
        if self.path == "/status":
            self.send_json(200, get_status())
        else:
            self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if not self.check_auth():
            self.send_json(401, {"error": "Unauthorized — fournir X-Hermes-Secret"})
            return

        if self.path == "/calibrate":
            ok, out = run_script("calibrer_propagation.py")
            self.send_json(200 if ok else 500, {"ok": ok, "output": out[:500]})

        elif self.path == "/deploy":
            # Hermes peut pousser un nouveau index.html via SCP puis appeler /deploy
            # pour le copier en prod sans redémarrer Nginx
            try:
                import shutil
                src = MAINT_DIR.parent / "public_html" / "index.html"
                if src.exists():
                    shutil.copy(src, APP_DIR / "index.html")
                    self.send_json(200, {"ok": True, "msg": "index.html déployé"})
                else:
                    self.send_json(404, {"ok": False, "msg": "Fichier source introuvable"})
            except Exception as e:
                self.send_json(500, {"ok": False, "error": str(e)})

        else:
            self.send_json(404, {"error": "Endpoint inconnu"})


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), WebhookHandler)
    print(f"Webhook Hermes démarré sur 127.0.0.1:{PORT}")
    print(f"Secret : {SECRET}")
    server.serve_forever()
