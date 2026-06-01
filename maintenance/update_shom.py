#!/usr/bin/env python3
"""
update_shom.py — Mise à jour du snapshot SHOM dans index.html
═══════════════════════════════════════════════════════════════
Interroge l'API SHOM pour récupérer les données de marées
des 7 prochains jours et met à jour le bloc SHOM_SNAPSHOT
dans public_html/index.html.

Usage :
    python3 maintenance/update_shom.py

Dépendances :
    pip install requests   (ou : python3 -m pip install requests)

Fréquence recommandée : 1 fois par semaine (les coefficients
changent lentement, les horaires sont stables à ±2 min).
"""

import json
import re
import sys
import datetime
from pathlib import Path

# ── Dépendance optionnelle ──────────────────────────────────
try:
    import requests
except ImportError:
    print("❌  Module 'requests' manquant. Installez-le avec :")
    print("    pip3 install requests")
    sys.exit(1)

# ── Configuration ───────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent  # dossier hostinger_deploy/
HTML_FILE  = BASE_DIR / "public_html" / "index.html"
BACKUP_EXT = ".bak"

SHOM_BASE = "https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm"

# Offset UTC France (heure d'été = 2, heure d'hiver = 1)
def get_france_utc_offset():
    now = datetime.datetime.utcnow()
    year = now.year
    # Dernier dimanche de mars
    last_sun_march = datetime.datetime(year, 3, 31)
    last_sun_march -= datetime.timedelta(days=last_sun_march.weekday() + 1)
    # Dernier dimanche d'octobre
    last_sun_oct = datetime.datetime(year, 10, 31)
    last_sun_oct -= datetime.timedelta(days=last_sun_oct.weekday() + 1)
    return 2 if last_sun_march <= now < last_sun_oct else 1

UTC_OFFSET = get_france_utc_offset()
TODAY      = datetime.date.today().isoformat()

# Ports à récupérer
PORTS_HLT = [
    "SAINT-BRIEUC",
    "BINIC",
    "SAINT-QUAY-PORTRIEUX",
    "PAIMPOL",
    "TREGUIER",
    "PERROS-GUIREC_TRESTRAOU",
    "SAINT-MALO",   # référence coefficient
]
PORTS_WL  = ["SAINT-BRIEUC", "BINIC", "SAINT-QUAY-PORTRIEUX"]  # courbes 3 ports

TIMEOUT = 15  # secondes par requête

# ── Helpers ─────────────────────────────────────────────────
def shom_get(endpoint: str, params: dict) -> dict | None:
    """Appel API SHOM avec gestion d'erreur."""
    url = f"{SHOM_BASE}/{endpoint}"
    try:
        r = requests.get(url, params=params, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.Timeout:
        print(f"  ⏱  Timeout sur {endpoint} ({params})")
    except requests.exceptions.HTTPError as e:
        print(f"  ⚠  HTTP {e.response.status_code} sur {endpoint}")
    except requests.exceptions.ConnectionError:
        print(f"  ❌  Connexion impossible — vérifiez votre accès internet")
    except Exception as e:
        print(f"  ❌  Erreur inattendue : {e}")
    return None

# ── Récupération des données ─────────────────────────────────
def fetch_coefficients() -> list | None:
    """Coefficients sur 14 jours depuis BINIC."""
    print("  → Coefficients (14 jours)…", end=" ", flush=True)
    data = shom_get("spm/coeff", {
        "harborName": "BINIC",
        "duration":   14,
        "date":       TODAY,
        "utc":        UTC_OFFSET,
        "correlation": 1,
    })
    if data is not None:
        print("✅")
    return data


def fetch_hlt(port: str, duration: int = 7) -> dict | None:
    """Horaires de marées (hautes/basses) pour un port."""
    print(f"  → HLT {port:<30}", end=" ", flush=True)
    data = shom_get("spm/hlt", {
        "harborName":  port,
        "duration":    duration,
        "date":        TODAY,
        "utc":         UTC_OFFSET,
        "correlation": 1,
    })
    if data is not None:
        print("✅")
    else:
        print("❌  (ignoré)")
    return data


def fetch_wl(port: str) -> dict | None:
    """Courbe de niveau d'eau (144 points / jour) pour un port."""
    print(f"  → WL  {port:<30}", end=" ", flush=True)
    data = shom_get("spm/wl", {
        "harborName":    port,
        "duration":      2,          # aujourd'hui + demain
        "date":          TODAY,
        "utc":           UTC_OFFSET,
        "nbWaterLevels": 144,
        "correlation":   1,
    })
    if data is not None:
        print("✅")
    else:
        print("❌  (ignoré)")
    return data

# ── Mise à jour du snapshot ──────────────────────────────────
def update_snapshot(html_content: str, coeff, hlt_by_port: dict, wl_by_port: dict) -> str:
    """
    Remplace le bloc SHOM_SNAPSHOT dans le contenu HTML.
    Ne modifie rien si les données sont vides.
    """
    # Extraire le snapshot actuel
    m = re.search(r"(const SHOM_SNAPSHOT = )(\{.*?\});", html_content, re.DOTALL)
    if not m:
        raise ValueError("Bloc SHOM_SNAPSHOT introuvable dans index.html")

    current = json.loads(m.group(2))

    # Coefficients
    if coeff is not None:
        current["coeff"] = coeff
        print(f"  Coefficients mis à jour")

    # HLT par port
    for port, data in hlt_by_port.items():
        if data is None:
            continue
        current["hlt"][port] = data
        nb_dates = len(data) if isinstance(data, dict) else "?"
        print(f"  HLT {port} : {nb_dates} jours")

    # Alias Saint-Brieuc → Saint-Quay (même baie)
    if "SAINT-QUAY-PORTRIEUX" in current["hlt"]:
        current["hlt"]["SAINT-BRIEUC"] = current["hlt"]["SAINT-QUAY-PORTRIEUX"]

    # WL par port
    for port, data in wl_by_port.items():
        if data is None:
            continue
        current["wl"][port] = data
        nb_dates = len(data) if isinstance(data, dict) else "?"
        print(f"  WL  {port} : {nb_dates} jours")

    # Alias Saint-Brieuc → Saint-Quay pour WL aussi
    if "SAINT-QUAY-PORTRIEUX" in current["wl"]:
        current["wl"]["SAINT-BRIEUC"] = current["wl"]["SAINT-QUAY-PORTRIEUX"]

    # Mettre à jour la date
    current["date"] = TODAY
    print(f"  Date snapshot : {TODAY}")

    # Reconstruire le JSON compact
    new_json = json.dumps(current, separators=(",", ":"), ensure_ascii=False)
    return html_content[: m.start(2)] + new_json + html_content[m.end(2):]


# ── Point d'entrée ────────────────────────────────────────────
def main():
    print("=" * 58)
    print(f"  Vigilance 22 — Mise à jour snapshot SHOM")
    print(f"  Date : {TODAY}  |  UTC+{UTC_OFFSET} (France)")
    print("=" * 58)

    # Vérifier que index.html existe
    if not HTML_FILE.exists():
        print(f"❌  Fichier introuvable : {HTML_FILE}")
        print("    Lancez ce script depuis le dossier hostinger_deploy/")
        sys.exit(1)

    # ── Backup ────────────────────────────────────────────────
    backup = HTML_FILE.with_suffix(HTML_FILE.suffix + BACKUP_EXT)
    backup.write_bytes(HTML_FILE.read_bytes())
    print(f"\n📂  Backup : {backup.name}")

    # ── Fetch ─────────────────────────────────────────────────
    print("\n📡  Interrogation de l'API SHOM…")
    coeff = fetch_coefficients()

    hlt_by_port = {}
    for port in PORTS_HLT:
        hlt_by_port[port] = fetch_hlt(port)

    wl_by_port = {}
    for port in PORTS_WL:
        wl_by_port[port] = fetch_wl(port)

    # Vérifier qu'on a au moins les données HLT principales
    nb_hlt_ok = sum(1 for v in hlt_by_port.values() if v is not None)
    if nb_hlt_ok == 0:
        print("\n❌  Aucune donnée HLT récupérée — abandon.")
        print("    Causes possibles : API SHOM indisponible, clé expirée, pas de réseau.")
        print(f"    Backup conservé : {backup.name}")
        sys.exit(1)

    # ── Mise à jour ───────────────────────────────────────────
    print("\n📝  Mise à jour du snapshot…")
    html = HTML_FILE.read_text(encoding="utf-8")
    try:
        html_updated = update_snapshot(html, coeff, hlt_by_port, wl_by_port)
    except ValueError as e:
        print(f"❌  {e}")
        sys.exit(1)

    # ── Sauvegarde ────────────────────────────────────────────
    HTML_FILE.write_text(html_updated, encoding="utf-8")

    size_before = len(html)
    size_after  = len(html_updated)
    print(f"\n✅  index.html mis à jour")
    print(f"   Taille : {size_before//1024} Ko → {size_after//1024} Ko")
    print(f"   Ports HLT mis à jour : {nb_hlt_ok}/{len(PORTS_HLT)}")
    nb_wl_ok = sum(1 for v in wl_by_port.values() if v is not None)
    print(f"   Ports WL mis à jour  : {nb_wl_ok}/{len(PORTS_WL)}")
    print(f"\n🚀  Uploadez public_html/index.html sur Hostinger pour déployer.")

    # Supprimer le backup si tout s'est bien passé
    backup.unlink(missing_ok=True)
    print(f"   Backup supprimé (tout OK).")
    print("=" * 58)


if __name__ == "__main__":
    main()
