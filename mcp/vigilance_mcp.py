#!/usr/bin/env python3
"""Serveur MCP — Vigilance 22 (Côtes-d'Armor).

Expose par MCP les sources déjà exploitées par l'application web : Vigicrues
(niveaux officiels par tronçon), Hub'Eau (hauteurs et débits temps réel), SHOM
(coefficients de marée) et la calibration de propagation amont-aval.

Contraintes reprises du dépôt (AGENTS.md, ROADMAP.md) :
  - bibliothèque standard uniquement, aucune dépendance à installer ;
  - les 27 stations et leurs seuils ne sont pas recopiés ici : ils sont lus
    dans src/config.js, qui reste la source de vérité unique ;
  - appels directs aux API amont, sans passer par Vercel : le MCP reste
    utilisable si l'hébergement est indisponible (risque listé en ROADMAP) ;
  - timeout et une relance sur 429/5xx, comme utils.js côté front.

Transport : stdio, JSON-RPC 2.0 délimité par des sauts de ligne.
Usage manuel : echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | python3 mcp/vigilance_mcp.py
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_JS = os.path.join(RACINE, "src", "config.js")
PROPAGATION = os.path.join(RACINE, "maintenance", "propagation.json")
ENV_LOCAL = os.path.join(RACINE, ".env.local")


def _cle_shom():
    """Clé de service SHOM — jamais dans le code, le dépôt étant public.

    Cherchée dans l'environnement, puis dans `.env.local` (non versionné).
    Absente, seul l'outil coefficient_maree est indisponible : les six autres
    n'en dépendent pas et doivent continuer de répondre.
    """
    cle = os.environ.get("SHOM_KEY")
    if cle:
        return cle.strip()
    try:
        with open(ENV_LOCAL, encoding="utf-8") as f:
            for ligne in f:
                if ligne.startswith("SHOM_KEY="):
                    return ligne.split("=", 1)[1].strip().strip("\"'")
    except OSError:
        pass
    return None


HUBEAU = "https://hubeau.eaufrance.fr/api/v2/hydrometrie"
VIGICRUES_GEOJSON = "https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson/"
SHOM_PORT = "PERROS-GUIREC_TRESTRAOU"
UA = "Mozilla/5.0 (compatible; Vigicrues22-MCP/1.0)"

NIVEAUX = {-1: "N/A", 0: "Vert — normal", 1: "Jaune — vigilance",
           2: "Orange — important", 3: "Rouge — majeur"}

PROTOCOLES_CONNUS = ["2025-06-18", "2025-03-26", "2024-11-05"]
SERVEUR = {"name": "vigilance-22", "version": "1.0.0"}


# ── Configuration : lue dans src/config.js, jamais recopiée ────────────────

def _charger_config():
    """Extrait stations, seuils, tronçons et bassins de src/config.js."""
    src = open(CONFIG_JS, encoding="utf-8").read()

    stations = {}
    motif = re.compile(
        r"'(?P<code>J\w+)':\{n:\"(?P<nom>[^\"]*)\",c:\"(?P<cours>[^\"]*)\","
        r"p:(?P<pivot>true|false),s:\{s1:(?P<s1>[\d.]+),s2:(?P<s2>[\d.]+),"
        r"s3:(?P<s3>[\d.]+)\},lat:(?P<lat>[-\d.]+),lon:(?P<lon>[-\d.]+)")
    for m in motif.finditer(src):
        stations[m.group("code")] = {
            "code": m.group("code"), "nom": m.group("nom"),
            "cours_eau": m.group("cours"), "pivot": m.group("pivot") == "true",
            "seuils_m": {"s1": float(m.group("s1")), "s2": float(m.group("s2")),
                         "s3": float(m.group("s3"))},
            "lat": float(m.group("lat")), "lon": float(m.group("lon")),
        }

    bloc = re.search(r"VIGICRUES_TRONCON_BY_STATION = \{(.*?)\};", src, re.S)
    troncons = dict(re.findall(r"(J\w+)\s*:\s*'(\w+)'", bloc.group(1))) if bloc else {}

    bassins = {}
    bloc_b = re.search(r"export const BASSINS = \[(.*?)\n\];", src, re.S)
    if bloc_b:
        for part in bloc_b.group(1).split('{ id:"')[1:]:
            ident = part.split('"')[0]
            nom = re.search(r'nom:"([^"]*)"', part)
            for code in re.findall(r'code:"(J\w+)"', part):
                bassins[code] = {"id": ident, "nom": nom.group(1) if nom else ident}

    for code, st in stations.items():
        st["troncon_vigicrues"] = troncons.get(code)
        st["bassin"] = bassins.get(code, {}).get("nom")
    return stations


ST = _charger_config()
TRONCONS_22 = sorted({s["troncon_vigicrues"] for s in ST.values() if s["troncon_vigicrues"]})


# ── Réseau : timeout + une relance sur 429/5xx (politique de utils.js) ─────

def _http(url, entetes=None, timeout=15, essais=2):
    dernier = None
    for tentative in range(essais):
        req = urllib.request.Request(url, headers={"User-Agent": UA, **(entetes or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            dernier = "HTTP %s" % e.code
            if e.code not in (429, 500, 502, 503, 504):
                raise RuntimeError("%s sur %s" % (dernier, url))
        except Exception as e:  # timeout, DNS, JSON illisible
            dernier = str(e)
        if tentative + 1 < essais:
            time.sleep(1.5)
    raise RuntimeError("%s injoignable (%s)" % (urllib.parse.urlparse(url).netloc, dernier))


def _hubeau_obs(codes, grandeur, taille=300, depuis=None, tri="desc"):
    params = {"code_entite": ",".join(codes), "grandeur_hydro": grandeur,
              "size": taille, "sort": tri,
              "fields": "code_station,date_obs,resultat_obs"}
    if depuis:
        params["date_debut_obs"] = depuis
    d = _http("%s/observations_tr?%s" % (HUBEAU, urllib.parse.urlencode(params)))
    return d.get("data", [])


def _niveau_officiel(brut):
    """Vigicrues code 1..4 ; l'application ramène en 0..3 (officialVigiLevel)."""
    try:
        n = int(brut)
    except (TypeError, ValueError):
        return None
    if 1 <= n <= 4:
        return n - 1
    return n if 0 <= n <= 3 else None


# ── Outils ────────────────────────────────────────────────────────────────

def outil_vigilance_troncons(_=None):
    geo = _http(VIGICRUES_GEOJSON, timeout=20)
    trouve = {}
    for f in geo.get("features", []):
        p = f.get("properties", {})
        code = p.get("CdEntCru") or p.get("acroentcru")
        niv = _niveau_officiel(p.get("NivInfViCr"))
        if code in TRONCONS_22 and niv is not None:
            trouve[code] = {
                "troncon": code, "libelle": p.get("lbentcru") or code,
                "niveau": niv, "libelle_niveau": NIVEAUX[niv],
                "brut_vigicrues": p.get("NivInfViCr"),
                "maj_referentiel": p.get("dhmentcru") or p.get("dhcentcru") or "",
            }
    manquants = [t for t in TRONCONS_22 if t not in trouve]
    niveaux = [t["niveau"] for t in trouve.values()]
    return {
        "consulte_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": VIGICRUES_GEOJSON,
        "niveau_max_departement": max(niveaux) if niveaux else None,
        "libelle_max": NIVEAUX[max(niveaux)] if niveaux else None,
        "troncons": [trouve[t] for t in TRONCONS_22 if t in trouve],
        "troncons_absents_du_flux": manquants,
    }


def outil_liste_stations(args):
    bassin = (args or {}).get("bassin")
    out = [s for s in ST.values()
           if not bassin or (s["bassin"] or "").lower().find(bassin.lower()) >= 0]
    return {"nombre": len(out), "stations": sorted(out, key=lambda s: s["nom"])}


def outil_observations_station(args):
    code = args["code"]
    heures = int(args.get("heures", 12))
    if code not in ST:
        raise ValueError("Station inconnue : %s (voir liste_stations)" % code)
    st = ST[code]
    depuis = (datetime.now(timezone.utc) - timedelta(hours=heures)).strftime("%Y-%m-%dT%H:%M:%SZ")
    serie_h = [{"date": o["date_obs"], "h_m": round(o["resultat_obs"] / 1000, 3)}
               for o in _hubeau_obs([code], "H", taille=2000, depuis=depuis, tri="asc")]
    debits = _hubeau_obs([code], "Q", taille=1, tri="desc")
    dernier = serie_h[-1]["h_m"] if serie_h else None
    tendance = None
    if len(serie_h) >= 2:
        dt_h = max(0.25, (_dt(serie_h[-1]["date"]) - _dt(serie_h[0]["date"])).total_seconds() / 3600)
        tendance = round((serie_h[-1]["h_m"] - serie_h[0]["h_m"]) * 100 / dt_h, 1)
    return {
        "station": {k: st[k] for k in ("code", "nom", "cours_eau", "bassin",
                                       "troncon_vigicrues", "seuils_m")},
        "fenetre_heures": heures, "points": len(serie_h),
        "hauteur_m": dernier, "date_derniere_obs": serie_h[-1]["date"] if serie_h else None,
        "debit_m3s": round(debits[0]["resultat_obs"] / 1000, 3) if debits else None,
        "tendance_cm_par_h": tendance,
        "seuil_atteint": _seuil(dernier, st["seuils_m"]),
        "serie_h": serie_h,
    }


def outil_stations_en_alerte(args):
    marge = float((args or {}).get("marge_seuil1", 0.0))
    codes = list(ST)
    derniers = {}
    for o in _hubeau_obs(codes, "H", taille=300, tri="desc"):
        derniers.setdefault(o["code_station"], o)
    depuis = (datetime.now(timezone.utc) - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    series = {}
    for o in _hubeau_obs(codes, "H", taille=2000, depuis=depuis, tri="asc"):
        series.setdefault(o["code_station"], []).append(o)

    lignes = []
    for code, st in ST.items():
        obs = derniers.get(code)
        if not obs:
            lignes.append({"code": code, "nom": st["nom"], "hauteur_m": None,
                           "statut": "sans donnée"})
            continue
        h = round(obs["resultat_obs"] / 1000, 3)
        serie = series.get(code, [])
        tendance = None
        if len(serie) >= 2:
            dt_h = max(0.25, (_dt(serie[-1]["date_obs"]) - _dt(serie[0]["date_obs"])).total_seconds() / 3600)
            tendance = round((serie[-1]["resultat_obs"] - serie[0]["resultat_obs"]) / 1000 * 100 / dt_h, 1)
        lignes.append({
            "code": code, "nom": st["nom"], "cours_eau": st["cours_eau"],
            "bassin": st["bassin"], "hauteur_m": h, "date": obs["date_obs"],
            "seuils_m": st["seuils_m"], "seuil_atteint": _seuil(h, st["seuils_m"]),
            "ecart_seuil1_m": round(h - st["seuils_m"]["s1"], 3),
            "tendance_cm_par_h": tendance,
        })
    alerte = [l for l in lignes if l.get("hauteur_m") is not None
              and l["hauteur_m"] >= l["seuils_m"]["s1"] - marge]
    alerte.sort(key=lambda l: -l["ecart_seuil1_m"])
    return {
        "consulte_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "stations_interrogees": len(ST),
        "sans_donnee": [l["code"] for l in lignes if l.get("hauteur_m") is None],
        "nombre_en_alerte": len(alerte),
        "marge_appliquee_m": marge,
        "en_alerte": alerte,
        "plus_hautes": sorted(
            [l for l in lignes if l.get("hauteur_m") is not None],
            key=lambda l: -l["ecart_seuil1_m"])[:5],
    }


def outil_propagation_arcs(_=None):
    d = json.load(open(PROPAGATION, encoding="utf-8"))
    arcs = []
    for a in d.get("arcs", []):
        conf = a.get("confiance", 0)
        arcs.append({
            "id": a.get("id"), "riviere": a.get("riviere"),
            "de": a.get("from_nom"), "vers": a.get("to_nom"),
            "code_amont": a.get("from"), "code_aval": a.get("to"),
            "distance_km": a.get("dist_km"),
            "transit_h": a.get("transit_h") or a.get("lag_h"),
            "confiance": conf, "calibre": a.get("calibre"),
            "statut": a.get("statut"),
            "exclu_des_alertes": not conf or conf == 0,
        })
    return {"calibre_le": d.get("calibre_le"), "methode": d.get("methode"),
            "nombre_arcs": len(arcs),
            "arcs_exploitables": [a["id"] for a in arcs if (a["confiance"] or 0) >= 0.5],
            "arcs_exclus": [a["id"] for a in arcs if a["exclu_des_alertes"]],
            "arcs": arcs}


def outil_coefficient_maree(args):
    jours = max(1, min(30, int((args or {}).get("jours", 3))))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cle = _cle_shom()
    if not cle:
        raise RuntimeError(
            "Clé SHOM absente : définir SHOM_KEY dans l'environnement ou dans .env.local "
            "à la racine du dépôt. Les six autres outils restent disponibles.")
    url = "https://services.data.shom.fr/%s/hdm/spm/coeff?%s" % (cle, urllib.parse.urlencode({
        "harborName": SHOM_PORT, "duration": jours, "date": today,
        "utc": 1, "correlation": 1}))
    mois = _http(url, entetes={"Referer": "https://maree.shom.fr/"})
    debut = datetime.strptime(today, "%Y-%m-%d")
    out, decalage = [], 0
    for bucket in mois:
        for entree in bucket:
            vals = [int(float(v)) for v in entree if str(v).replace(".", "").isdigit()]
            out.append({"date": (debut + timedelta(days=decalage)).strftime("%Y-%m-%d"),
                        "am": vals[0] if vals else None,
                        "pm": vals[1] if len(vals) > 1 else None,
                        "max": max(vals) if vals else None})
            decalage += 1
    return {"source": "SHOM", "port": SHOM_PORT, "jours": out[:jours],
            "note": "Coefficient > 90 : surcote côtière à surveiller sur les exutoires."}


def outil_synthese_departement(_=None):
    synthese = {"genere_le": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    for cle, fonction, arg in (("vigilance", outil_vigilance_troncons, None),
                               ("stations", outil_stations_en_alerte, {"marge_seuil1": 0.2}),
                               ("maree", outil_coefficient_maree, {"jours": 2}),
                               ("propagation", outil_propagation_arcs, None)):
        try:
            synthese[cle] = fonction(arg)
        except Exception as e:
            synthese[cle] = {"erreur": str(e)}
    niv = synthese.get("vigilance", {}).get("niveau_max_departement")
    nb = synthese.get("stations", {}).get("nombre_en_alerte")
    synthese["verdict"] = (
        "Vigilance %s ; %s station(s) à moins de 20 cm du premier seuil."
        % (NIVEAUX.get(niv, "inconnue"), nb if nb is not None else "?"))
    if niv is not None and niv >= 1:
        synthese["rappel_maintenance"] = (
            "Épisode >= Jaune : relancer maintenance/calibrer_propagation.py "
            "dans les 72 h (items 3.3 et 7.5 de la ROADMAP).")
    return synthese


def _dt(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _seuil(h, seuils):
    if h is None:
        return None
    if h >= seuils["s3"]:
        return "s3 — seuil de crue majeure dépassé"
    if h >= seuils["s2"]:
        return "s2 — seuil intermédiaire dépassé"
    if h >= seuils["s1"]:
        return "s1 — premier seuil dépassé"
    return "sous le premier seuil"


# ── Registre des outils ───────────────────────────────────────────────────

OUTILS = [
    {"name": "vigilance_troncons",
     "description": "Niveau de vigilance crue officiel Vigicrues des 6 tronçons couvrant "
                    "les Côtes-d'Armor (0 vert, 1 jaune, 2 orange, 3 rouge). Source amont "
                    "directe, sans passer par l'hébergement de l'application.",
     "inputSchema": {"type": "object", "properties": {}},
     "fn": outil_vigilance_troncons},
    {"name": "liste_stations",
     "description": "Les 27 stations hydrométriques suivies : code Hub'Eau, nom, cours d'eau, "
                    "bassin, tronçon Vigicrues, seuils s1/s2/s3 en mètres, coordonnées.",
     "inputSchema": {"type": "object", "properties": {
         "bassin": {"type": "string", "description": "Filtre optionnel sur le nom de bassin."}}},
     "fn": outil_liste_stations},
    {"name": "observations_station",
     "description": "Série de hauteurs d'eau d'une station sur les N dernières heures, "
                    "avec débit courant, tendance en cm/h et seuil atteint.",
     "inputSchema": {"type": "object", "properties": {
         "code": {"type": "string", "description": "Code Hub'Eau, ex. J540212001."},
         "heures": {"type": "integer", "description": "Fenêtre en heures (défaut 12)."}},
         "required": ["code"]},
     "fn": outil_observations_station},
    {"name": "stations_en_alerte",
     "description": "Balaye les 27 stations et retourne celles qui atteignent ou approchent "
                    "leur premier seuil, triées par écart au seuil, avec tendance sur 3 h.",
     "inputSchema": {"type": "object", "properties": {
         "marge_seuil1": {"type": "number",
                          "description": "Inclure aussi les stations à moins de N mètres du seuil 1."}}},
     "fn": outil_stations_en_alerte},
    {"name": "propagation_arcs",
     "description": "Arcs de propagation amont-aval calibrés : temps de transit, indice de "
                    "confiance, et arcs exclus des alertes faute de calibration.",
     "inputSchema": {"type": "object", "properties": {}},
     "fn": outil_propagation_arcs},
    {"name": "coefficient_maree",
     "description": "Coefficients de marée SHOM (Perros-Guirec, référence pour la façade 22) "
                    "sur les prochains jours — surcote côtière aux exutoires.",
     "inputSchema": {"type": "object", "properties": {
         "jours": {"type": "integer", "description": "Nombre de jours, 1 à 30 (défaut 3)."}}},
     "fn": outil_coefficient_maree},
    {"name": "synthese_departement",
     "description": "Point de situation complet en un appel : vigilance officielle, stations "
                    "proches des seuils, coefficients de marée, état de la calibration.",
     "inputSchema": {"type": "object", "properties": {}},
     "fn": outil_synthese_departement},
]
PAR_NOM = {o["name"]: o for o in OUTILS}


# ── Boucle JSON-RPC 2.0 sur stdio ─────────────────────────────────────────

def _reponse(rid, resultat=None, erreur=None):
    msg = {"jsonrpc": "2.0", "id": rid}
    msg["error" if erreur else "result"] = erreur or resultat
    return msg


def traiter(msg):
    methode, rid, params = msg.get("method"), msg.get("id"), msg.get("params") or {}

    if methode == "initialize":
        demande = params.get("protocolVersion")
        return _reponse(rid, {
            "protocolVersion": demande if demande in PROTOCOLES_CONNUS else PROTOCOLES_CONNUS[0],
            "capabilities": {"tools": {}},
            "serverInfo": SERVEUR,
            "instructions": "Surveillance hydrométrique des Côtes-d'Armor (22). "
                            "Commencer par synthese_departement pour un point de situation.",
        })
    if methode in ("notifications/initialized", "notifications/cancelled"):
        return None
    if methode == "ping":
        return _reponse(rid, {})
    if methode == "tools/list":
        return _reponse(rid, {"tools": [{k: o[k] for k in ("name", "description", "inputSchema")}
                                        for o in OUTILS]})
    if methode == "tools/call":
        nom = params.get("name")
        if nom not in PAR_NOM:
            return _reponse(rid, erreur={"code": -32602, "message": "Outil inconnu : %s" % nom})
        try:
            res = PAR_NOM[nom]["fn"](params.get("arguments") or {})
            texte = json.dumps(res, ensure_ascii=False, indent=2)
            return _reponse(rid, {"content": [{"type": "text", "text": texte}],
                                  "isError": False})
        except Exception as e:
            # Erreur d'outil : remontée dans le résultat, pas en erreur de protocole,
            # pour que le modèle puisse la lire et réessayer autrement.
            return _reponse(rid, {"content": [{"type": "text",
                                               "text": "Échec de %s : %s" % (nom, e)}],
                                  "isError": True})
    if rid is None:
        return None
    return _reponse(rid, erreur={"code": -32601, "message": "Méthode inconnue : %s" % methode})


def main():
    for ligne in sys.stdin:
        ligne = ligne.strip()
        if not ligne:
            continue
        try:
            msg = json.loads(ligne)
        except json.JSONDecodeError as e:
            sortie = _reponse(None, erreur={"code": -32700, "message": "JSON illisible : %s" % e})
        else:
            sortie = traiter(msg)
        if sortie is not None:
            sys.stdout.write(json.dumps(sortie, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
