#!/usr/bin/env python3
"""
check_vigi.py — Surveillance Vigicrues département 22
Appelé toutes les 15 min par cron.
Si vigilance ≥ Orange détectée sur le 22 ET fin d'épisode dans les 72h :
  → Déclenche calibrer_propagation.py
  → Redéploie index.html avec le propagation.json mis à jour

Peut aussi être déclenché par l'agent Hermes via webhook.
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests

MAINT_DIR = Path(__file__).parent
APP_DIR = Path("/var/www/vigilance22")
STATE_FILE = MAINT_DIR / ".vigi_state.json"
LOG_PREFIX = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}]"

VIGICRUES_URL = "https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson"
DEPT_22_TRONCONS = ["BT13", "BT14", "BT15", "BT5"]  # Tronçons Côtes-d'Armor


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"last_orange": None, "calibration_done": False}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def get_max_vigi_22():
    """Retourne le niveau max de vigilance actif sur le 22 (0=vert, 1=jaune, 2=orange, 3=rouge)."""
    try:
        r = requests.get(VIGICRUES_URL, timeout=10)
        data = r.json()
        max_vigi = 0
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            troncon = props.get("CdEntVigiCru", "")
            niveau = props.get("NivSituVigiCruEnt", 1)  # 1=vert, 2=jaune, 3=orange, 4=rouge
            if any(troncon.startswith(t) for t in DEPT_22_TRONCONS):
                max_vigi = max(max_vigi, niveau)
        return max_vigi
    except Exception as e:
        print(f"{LOG_PREFIX} Erreur fetch Vigicrues: {e}")
        return 0


def run_calibration():
    print(f"{LOG_PREFIX} Lancement calibrer_propagation.py...")
    result = subprocess.run(
        [str(MAINT_DIR / "venv" / "bin" / "python3"), str(MAINT_DIR / "calibrer_propagation.py")],
        capture_output=True, text=True, cwd=str(MAINT_DIR)
    )
    if result.returncode == 0:
        print(f"{LOG_PREFIX} Calibration OK")
        # Redéployer index.html si généré
        new_index = MAINT_DIR / "index.html"
        if new_index.exists():
            import shutil
            shutil.copy(new_index, APP_DIR / "index.html")
            print(f"{LOG_PREFIX} index.html mis à jour en prod")
    else:
        print(f"{LOG_PREFIX} Erreur calibration: {result.stderr}")


def main():
    state = load_state()
    vigi = get_max_vigi_22()

    # Niveau 3 = orange, 4 = rouge
    if vigi >= 3:
        print(f"{LOG_PREFIX} Vigilance ≥ Orange détectée (niveau {vigi})")
        state["last_orange"] = datetime.now().isoformat()
        state["calibration_done"] = False
        save_state(state)
        return

    # Hors crue : vérifier si on est dans les 72h post-pic
    if state.get("last_orange") and not state.get("calibration_done"):
        last = datetime.fromisoformat(state["last_orange"])
        if datetime.now() - last <= timedelta(hours=72):
            print(f"{LOG_PREFIX} Post-crue dans les 72h → lancement calibration")
            run_calibration()
            state["calibration_done"] = True
            save_state(state)
        else:
            print(f"{LOG_PREFIX} Délai 72h dépassé — calibration manquée")
            state["calibration_done"] = True
            save_state(state)
    else:
        print(f"{LOG_PREFIX} Vigilance verte/jaune, aucune action")


if __name__ == "__main__":
    main()
