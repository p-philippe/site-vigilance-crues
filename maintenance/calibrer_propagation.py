#!/usr/bin/env python3
"""
calibrer_propagation.py — Calibration du modèle de propagation de crue
═══════════════════════════════════════════════════════════════════════════
Pour chaque paire de stations (amont → aval) sur un même cours d'eau,
ce script :
  1. Télécharge l'historique des hauteurs d'eau depuis HubEau (2 ans)
  2. Calcule le temps de transit par corrélation croisée des séries
  3. Estime le facteur d'amortissement sur les épisodes de crue
  4. Génère maintenance/propagation.json (lu par le site)

Usage :
    python3 maintenance/calibrer_propagation.py

Dépendances :
    pip install requests numpy scipy
"""

import json
import sys
import math
import datetime
from pathlib import Path
from collections import defaultdict

try:
    import requests
except ImportError:
    print("❌  Module 'requests' manquant :  pip3 install requests")
    sys.exit(1)

try:
    import numpy as np
except ImportError:
    print("❌  Module 'numpy' manquant  :  pip3 install numpy")
    sys.exit(1)

try:
    from scipy.signal import correlate
    from scipy.ndimage import uniform_filter1d
    HAS_SCIPY = True
except ImportError:
    print("⚠️   Module 'scipy' manquant — corrélation simplifiée (pip3 install scipy pour de meilleurs résultats)")
    HAS_SCIPY = False

# ══════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_FILE = BASE_DIR / "maintenance" / "propagation.json"

HUBEAU_BASE = "https://hubeau.eaufrance.fr/api/v2/hydrometrie"
HUBEAU_RT   = f"{HUBEAU_BASE}/observations_tr"   # temps réel (max 1 mois)
HUBEAU_ELAB = f"{HUBEAU_BASE}/obs_elab"           # élaboré (historique long, mensuel)

# observations_tr : HubEau n'autorise pas plus de 1 mois en arrière
DATE_FIN    = datetime.date.today()
DATE_DEBUT  = DATE_FIN - datetime.timedelta(days=29)   # < 1 mois (limite API)

# Vitesses de propagation empiriques pour estimer si pas assez de crues observées
# Source : DREAL Bretagne + littérature hydrologie de petits bassins armoricains
# En m/s pendant un épisode de crue (étiage bien plus lent)
VITESSE_CRUE_DEFAULT = 1.2   # m/s — petits bassins côtiers bretons (bassins < 500 km²)
VITESSE_CRUE_GRAND   = 1.5   # m/s — bassins plus grands (Blavet, Oust)

# Pas de temps cible pour le rééchantillonnage
PAS_MINUTES = 15   # 15 min — même fréquence que les capteurs HubEau

TIMEOUT = 30

# ── Noms des stations (issus de STATIONS dans index.html) ──────────
STATION_NAMES = {
    "J061161001": "St-Jouan-de-l'Isle",
    "J100452001": "Pleslin-Trigavou",
    "J110301001": "Jugon-les-Lacs",
    "J110581001": "Plénée-Jugon",
    "J111401001": "Mégrit",
    "J131301001": "Andel",
    "J132401001": "Coëtmieux",
    "J140531001": "Plédran",
    "J151301001": "St-Julien",
    "J161401002": "Binic",
    "J171171001": "St-Péver",
    "J172172001": "St-Clet",
    "J180301001": "Boqueho",
    "J181301001": "Quemper-Guézennec",
    "J202301001": "Mantallot",
    "J203401001": "Plouguiel",
    "J223301001": "Belle-Isle-en-Terre",
    "J223302001": "Pluzunet",
    "J371301001": "Trébrivan",
    "J520211001": "Kerien [Kerlouët]",
    "J520521001": "Kerien [Moulin Camel]",
    "J521212001": "Lanrivain",
    "J522401002": "Ste-Tréphine",
    "J540212001": "Plélauff [Bon-Repos]",
    "J800231002": "St-Martin-des-Prés",
    "J802231003": "Hémonstoir",
    "J813301001": "Plémet",
}

# ── Paires à calibrer (amont → aval, même cours d'eau) ────────────
# Distances approx. en km (pour info, pas utilisées dans le calcul)
PAIRES = [
    {
        "id":       "trieux_1",
        "riviere":  "Trieux",
        "bassin":   "trieux",
        "from":     "J171171001",   # St-Péver (amont)
        "to":       "J172172001",   # St-Clet (aval)
        "dist_km":  22,
        "lag_max_h": 12,            # borne max de recherche du transit
        "seuil_crue_pct": 0.70,     # centile hauteur pour "période de crue"
    },
    {
        "id":       "leff_1",
        "riviere":  "Leff",
        "bassin":   "trieux",
        "from":     "J180301001",   # Boqueho (amont)
        "to":       "J181301001",   # Quemper-Guézennec (aval)
        "dist_km":  27,
        "lag_max_h": 12,
        "seuil_crue_pct": 0.70,
    },
    {
        "id":       "blavet_1",
        "riviere":  "Blavet",
        "bassin":   "blavet",
        "from":     "J520211001",   # Kerien Kerlouët (amont)
        "to":       "J521212001",   # Lanrivain (milieu)
        "dist_km":  15,
        "lag_max_h": 10,
        "seuil_crue_pct": 0.70,
    },
    {
        "id":       "blavet_2",
        "riviere":  "Blavet",
        "bassin":   "blavet",
        "from":     "J521212001",   # Lanrivain (milieu)
        "to":       "J540212001",   # Plélauff Bon-Repos (aval)
        "dist_km":  28,
        "lag_max_h": 14,
        "seuil_crue_pct": 0.65,
    },
    {
        "id":       "oust_1",
        "riviere":  "Oust",
        "bassin":   "oust",
        "from":     "J800231002",   # St-Martin-des-Prés (amont)
        "to":       "J802231003",   # Hémonstoir (aval)
        "dist_km":  35,
        "lag_max_h": 18,
        "seuil_crue_pct": 0.70,
    },
    {
        "id":       "legueur_1",
        "riviere":  "Léguer",
        "bassin":   "jaudy",
        "from":     "J223301001",   # Belle-Isle-en-Terre (amont)
        "to":       "J223302001",   # Pluzunet (milieu-aval)
        "dist_km":  14,
        "lag_max_h": 8,
        "seuil_crue_pct": 0.70,
    },
    {
        "id":       "gouessant_1",
        "riviere":  "Urne / Gouessant",
        "bassin":   "gouessant",
        "from":     "J140531001",   # Plédran Magenta (amont)
        "to":       "J131301001",   # Andel (aval)
        "dist_km":  20,
        "lag_max_h": 12,
        "seuil_crue_pct": 0.70,
    },
    {
        "id":       "arguenon_1",
        "riviere":  "Quiloury / Arguenon",
        "bassin":   "fremur",
        "from":     "J110581001",   # Plénée-Jugon (amont)
        "to":       "J110301001",   # Jugon-les-Lacs (aval)
        "dist_km":  12,
        "lag_max_h": 8,
        "seuil_crue_pct": 0.65,
    },
]


# ══════════════════════════════════════════════════════════════════
# TÉLÉCHARGEMENT HUBEAU
# ══════════════════════════════════════════════════════════════════

def _hubeau_paginate(url: str, params: dict, limit: int = 50000) -> list[dict]:
    """Télécharge toutes les pages d'un endpoint HubEau avec curseur."""
    records = []
    cursor  = None
    page    = 1

    while len(records) < limit:
        p = dict(params)
        if cursor:
            p["cursor"] = cursor

        try:
            r = requests.get(url, params=p, timeout=TIMEOUT)
            if r.status_code == 400:
                # Souvent "date trop ancienne" pour observations_tr
                err = r.json().get("message", r.text)
                print(f"\n    ⚠  400 Bad Request : {err}")
                break
            r.raise_for_status()
            data = r.json()
        except requests.exceptions.Timeout:
            print(f"\n    ⏱  Timeout (page {page})")
            break
        except requests.exceptions.HTTPError as e:
            print(f"\n    ⚠  HTTP {e.response.status_code}")
            break
        except Exception as e:
            print(f"\n    ❌  {e}")
            break

        batch = data.get("data", [])
        records.extend(batch)

        if len(batch) < p.get("size", 10000):
            break

        cursor = data.get("next_cursor") or data.get("next", "")
        # Extraire curseur depuis l'URL next si besoin
        if cursor and "cursor=" in cursor:
            import urllib.parse
            qs = urllib.parse.urlparse(cursor).query
            cursor = urllib.parse.parse_qs(qs).get("cursor", [None])[0]
        if not cursor:
            break
        page += 1

    return records


def fetch_observations(code: str) -> list[dict]:
    """
    Télécharge les observations H depuis HubEau (dernier mois).
    L'API observations_tr ne permet pas plus de 1 mois en arrière.
    """
    params = {
        "code_entite":    code,
        "grandeur_hydro": "H",
        "date_debut_obs": DATE_DEBUT.isoformat() + "T00:00:00Z",
        "date_fin_obs":   DATE_FIN.isoformat()   + "T23:59:59Z",
        "size":           10000,
        "sort":           "asc",
        "fields":         "code_station,date_obs,resultat_obs",
    }
    return _hubeau_paginate(HUBEAU_RT, params)


# ══════════════════════════════════════════════════════════════════
# PRÉ-TRAITEMENT : série temporelle régulière
# ══════════════════════════════════════════════════════════════════

def parse_ts(iso: str) -> datetime.datetime:
    """Parse ISO 8601 avec ou sans timezone."""
    if not iso:
        raise ValueError("empty timestamp")
    iso = iso.replace("Z", "+00:00")
    try:
        return datetime.datetime.fromisoformat(iso)
    except ValueError:
        return datetime.datetime.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S").replace(
            tzinfo=datetime.timezone.utc
        )


def to_regular_series(records: list[dict], pas_min: int = PAS_MINUTES) -> tuple[list, list]:
    """
    Rééchantillonne les observations brutes sur une grille régulière (pas_min).
    Retourne (timestamps_utc, hauteurs_mm) — NaN pour les trous.
    """
    if not records:
        return [], []

    # Trier et dédupliquer
    pts = {}
    for r in records:
        raw_t = r.get("date_obs") or r.get("date_obs_elab")
        if not raw_t:
            continue
        t = parse_ts(raw_t)
        t = t.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        h = r.get("resultat_obs")
        if h is not None:
            try:
                pts[t] = float(h)
            except (ValueError, TypeError):
                pass

    if not pts:
        return [], []

    sorted_times = sorted(pts)
    t0 = sorted_times[0]
    t1 = sorted_times[-1]

    pas = datetime.timedelta(minutes=pas_min)
    n   = int((t1 - t0) / pas) + 1
    grid_t = [t0 + i * pas for i in range(n)]
    grid_h = [float("nan")] * n

    # Affectation simple : observation la plus proche de chaque créneau
    j = 0
    for i, gt in enumerate(grid_t):
        # Fenêtre ±pas/2 autour de gt
        lo = gt - pas / 2
        hi = gt + pas / 2
        vals = [v for t, v in pts.items() if lo <= t < hi]
        if vals:
            grid_h[i] = float(np.nanmean(vals))

    return grid_t, grid_h


# ══════════════════════════════════════════════════════════════════
# CALIBRATION D'UNE PAIRE
# ══════════════════════════════════════════════════════════════════

def empirique_transit(paire: dict) -> float:
    """
    Estimation du transit par dist / vitesse de crue.
    Pour les rivières bretonnes (petits bassins côtiers armoricains) :
      - vitesse de propagation de l'onde de crue ≈ 1.0–1.5 m/s
      - plus lente que la vitesse de l'eau (onde cinématique)
    Référence : Lavabre & Cernesson (1994), Fouchier (2010).
    On arrondit à 0.5h pour ne pas sur-préciser.
    """
    dist_m  = paire["dist_km"] * 1000
    # Choisir la vitesse selon la taille du bassin (grand = Blavet/Oust)
    grand   = paire["bassin"] in ("blavet", "oust")
    vitesse = VITESSE_CRUE_GRAND if grand else VITESSE_CRUE_DEFAULT
    transit_s = dist_m / vitesse
    transit_h = transit_s / 3600
    # Arrondir à 0.5h
    return round(transit_h * 2) / 2

def calibrer_paire(paire: dict, cache: dict) -> dict:
    """
    Calcule le transit_h et l'attenuation pour une paire amont/aval.
    Retourne un dict résultat (confiance, transit_h, attenuation, etc.)
    """
    code_am = paire["from"]
    code_av = paire["to"]
    lag_max = paire["lag_max_h"]

    ts_am, h_am = cache[code_am]
    ts_av, h_av = cache[code_av]

    if not ts_am or not ts_av:
        return {"statut": "no_data"}

    # ── Aligner les deux séries sur la même grille ────────────────
    # Trouver l'intersection temporelle
    set_am = {t: h for t, h in zip(ts_am, h_am) if not math.isnan(h)}
    set_av = {t: h for t, h in zip(ts_av, h_av) if not math.isnan(h)}

    common = sorted(set(set_am) & set(set_av))
    if len(common) < 200:
        return {"statut": "trop_peu_de_points", "n": len(common)}

    arr_am = np.array([set_am[t] for t in common])
    arr_av = np.array([set_av[t] for t in common])

    # ── Normaliser (centrer-réduire) ──────────────────────────────
    def normalize(x):
        mu, sigma = np.nanmean(x), np.nanstd(x)
        return (x - mu) / (sigma if sigma > 0 else 1)

    n_am = normalize(arr_am)
    n_av = normalize(arr_av)

    # ── Corrélation croisée ───────────────────────────────────────
    lag_max_pts = lag_max   # 1 point = 1h (PAS_MINUTES=60)

    if HAS_SCIPY:
        corr = correlate(n_av, n_am, mode="full")
        mid  = len(n_am) - 1
        # On ne cherche que des lags positifs (amont → aval, aval est en retard)
        lag_range = corr[mid: mid + lag_max_pts + 1]
        best_lag  = int(np.argmax(lag_range))
        peak_corr = float(lag_range[best_lag] / len(n_am))
    else:
        # Corrélation manuelle simplifiée
        best_lag, best_val = 0, -999
        for lag in range(0, lag_max_pts + 1):
            am = n_am[:len(n_am) - lag]
            av = n_av[lag:]
            val = float(np.dot(am, av)) / len(am)
            if val > best_val:
                best_val, best_lag = val, lag
        peak_corr = best_val / len(n_am)

    transit_h = float(best_lag)   # lag en heures

    # ── Facteur d'amortissement sur les pics de crue ──────────────
    seuil_am = float(np.nanpercentile(arr_am, paire["seuil_crue_pct"] * 100))
    seuil_av = float(np.nanpercentile(arr_av, paire["seuil_crue_pct"] * 100))

    # Détecter les pics locaux en période de crue
    window = 24  # fenêtre de détection de pic (24h)
    attenuation_samples = []

    i = window
    while i < len(arr_am) - window - best_lag:
        # Pic amont ?
        seg_am = arr_am[i - window: i + window]
        if arr_am[i] == np.nanmax(seg_am) and arr_am[i] > seuil_am:
            # Chercher pic aval dans la fenêtre [lag-4h, lag+4h]
            j0 = i + max(0, best_lag - 4)
            j1 = min(len(arr_av), i + best_lag + 4 + 1)
            if j1 > j0:
                peak_av = float(np.nanmax(arr_av[j0:j1]))
                peak_am = float(arr_am[i])
                if peak_am > 0 and peak_av > 0:
                    attenuation_samples.append(peak_av / peak_am)
            i += window  # sauter la fenêtre
        else:
            i += 1

    if attenuation_samples:
        attenuation = float(np.median(attenuation_samples))
        att_std     = float(np.std(attenuation_samples))
        n_pics      = len(attenuation_samples)
    else:
        attenuation = 1.0
        att_std     = 0.0
        n_pics      = 0

    # ── Score de confiance (0–1) ──────────────────────────────────
    # Basé sur : corrélation du pic, nombre de pics analysés, % de données valides
    pct_valide = len(common) / max(len(ts_am), len(ts_av))
    confiance  = min(1.0, abs(peak_corr) * 5 * min(1, n_pics / 5) * pct_valide)

    # ── Qualité : transit=0 → probablement réponse simultanée à la pluie
    transit_fiable = transit_h > 0.0

    # ── Type de relation détecté
    if not transit_fiable:
        relation = "simultanee"   # stations réagissent en même temps (même bassin pluviométrique)
    elif attenuation > 1.05:
        relation = "amplification"  # confluence ou affluents entre les deux stations
    elif attenuation < 0.95:
        relation = "amortissement"  # zone d'expansion / stockage entre stations
    else:
        relation = "propagation"

    return {
        "statut":        "ok",
        "transit_h":     round(transit_h, 1),
        "transit_fiable": transit_fiable,
        "relation":      relation,
        "attenuation":   round(max(0.3, min(3.0, attenuation)), 3),
        "att_ecart":     round(att_std, 3),
        "confiance":     round(confiance if transit_fiable else confiance * 0.3, 3),
        "corr_peak":     round(peak_corr, 4),
        "n_pics":        n_pics,
        "n_obs":         len(common),
        "pct_valide":    round(pct_valide, 3),
        "periode":       [DATE_DEBUT.isoformat(), DATE_FIN.isoformat()],
    }


# ══════════════════════════════════════════════════════════════════
# POINT D'ENTRÉE
# ══════════════════════════════════════════════════════════════════

def main():
    print("=" * 62)
    print("  Vigilance 22 — Calibration modèle propagation de crue")
    print(f"  Période : {DATE_DEBUT} → {DATE_FIN}  ({(DATE_FIN-DATE_DEBUT).days} jours)")
    print("=" * 62)

    # ── Collecter tous les codes uniques à télécharger ────────────
    codes = set()
    for p in PAIRES:
        codes.add(p["from"])
        codes.add(p["to"])
    codes = sorted(codes)

    # ── Téléchargement (avec cache pour éviter les doublons) ──────
    print(f"\n📡  Téléchargement HubEau ({len(codes)} stations)…\n")
    cache = {}
    for code in codes:
        nom = STATION_NAMES.get(code, code)
        print(f"  {code}  {nom:<35}", end=" ", flush=True)
        records = fetch_observations(code)
        if not records:
            print("❌  aucune donnée")
            cache[code] = ([], [])
            continue
        ts, h = to_regular_series(records)
        n_val = sum(1 for v in h if not math.isnan(v))
        print(f"✅  {len(records):>6} obs brutes → {n_val}/{len(h)} créneaux valides")
        cache[code] = (ts, h)

    # ── Calibration paire par paire ───────────────────────────────
    print(f"\n🔬  Calibration des {len(PAIRES)} paires…\n")
    arcs = []
    for paire in PAIRES:
        nom_am = STATION_NAMES.get(paire["from"], paire["from"])
        nom_av = STATION_NAMES.get(paire["to"],   paire["to"])
        print(f"  [{paire['riviere']}]  {nom_am} → {nom_av}")

        res = calibrer_paire(paire, cache)

        if res["statut"] != "ok":
            print(f"    ⚠  Impossible : {res['statut']}\n")
            transit_empirique = empirique_transit(paire)
            arcs.append({
                **{k: paire[k] for k in ("id","riviere","bassin","from","to","dist_km")},
                "from_nom":  nom_am,
                "to_nom":    nom_av,
                "calibre":   False,
                "statut":    res["statut"],
                "transit_h":   transit_empirique,
                "attenuation": 1.0,
                "confiance":   0.0,
                "note": "Estimation empirique (dist/vitesse) — relancer après un épisode de crue",
            })
            continue

        # ── Affichage résultat ────────────────────────────────────
        etoiles  = "★" * round(res["confiance"] * 5)
        relation = res.get("relation", "?")
        transit_empirique = empirique_transit(paire)

        if not res.get("transit_fiable"):
            print(f"    ⚠  Transit=0 détecté → réponse simultanée probable ({relation})")
            print(f"    Transit   : empirique {transit_empirique:.1f} h (corrélation non conclusive)")
        else:
            print(f"    Transit   : {res['transit_h']:.1f} h  [{relation}]")

        print(f"    Amortiss. : ×{res['attenuation']:.3f}  (±{res['att_ecart']:.3f}, {res['n_pics']} pics)")
        print(f"    Corrél.   : {res['corr_peak']:.4f}   Confiance : {res['confiance']:.2f} {etoiles}")
        print(f"    Obs valid : {res['n_obs']} pts ({res['pct_valide']*100:.0f}% de couverture)\n")

        # Transit final : si la corrélation ne donne pas de lag fiable, utiliser l'empirique
        transit_final = res["transit_h"] if res.get("transit_fiable") else transit_empirique

        arc = {
            **{k: paire[k] for k in ("id","riviere","bassin","from","to","dist_km")},
            "from_nom":    nom_am,
            "to_nom":      nom_av,
            "calibre":     True,
            "transit_h":          transit_final,
            "transit_source":     "correlation" if res.get("transit_fiable") else "empirique",
            "relation":           relation,
            **{k: res[k] for k in (
                "attenuation","att_ecart",
                "confiance","corr_peak","n_pics","n_obs","pct_valide","periode"
            )},
        }
        arcs.append(arc)

    # ── Écriture propagation.json ─────────────────────────────────
    output = {
        "version":    "1.0",
        "calibre_le": datetime.date.today().isoformat(),
        "methode":    "cross-correlation HubEau 2 ans, pas 1h",
        "arcs":       arcs,
    }

    OUT_FILE.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    n_ok = sum(1 for a in arcs if a.get("calibre"))
    print("=" * 62)
    print(f"✅  {n_ok}/{len(arcs)} paires calibrées avec succès")
    print(f"📄  Résultats : {OUT_FILE.relative_to(BASE_DIR)}")
    print()

    # ── Résumé tableau ────────────────────────────────────────────
    print(f"  {'Paire':<38} {'Transit':>8}  {'Amorti':>7}  {'Conf':>6}")
    print(f"  {'-'*38} {'-'*8}  {'-'*7}  {'-'*6}")
    for a in arcs:
        label = f"{a['from_nom']} → {a['to_nom']}"
        if len(label) > 38:
            label = label[:35] + "…"
        if a.get("calibre"):
            print(f"  {label:<38} {a['transit_h']:>6.1f} h  ×{a['attenuation']:>5.3f}  {a['confiance']:>5.2f}")
        else:
            print(f"  {label:<38} {'N/A':>8}  {'N/A':>7}  {'N/A':>6}")

    print()
    print("  Prochaine étape : intégrer propagation.json dans index.html")
    print("  (voir maintenance/PROPAGATION_INTEGRATION.md)")
    print("=" * 62)


if __name__ == "__main__":
    main()
