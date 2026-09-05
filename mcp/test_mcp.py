#!/usr/bin/env python3
"""Test d'intégration du serveur MCP : poignée de main, catalogue, appel réel
de chaque outil. Sortie non nulle si un outil échoue."""
import json, os, subprocess, sys

SERVEUR = [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vigilance_mcp.py")]
APPELS = [
    ("vigilance_troncons", {}),
    ("liste_stations", {"bassin": "Blavet"}),
    ("observations_station", {"code": "J540212001", "heures": 6}),
    ("stations_en_alerte", {"marge_seuil1": 0.3}),
    ("propagation_arcs", {}),
    ("coefficient_maree", {"jours": 2}),
    ("synthese_departement", {}),
]

req = [{"jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2025-06-18", "capabilities": {},
                   "clientInfo": {"name": "test", "version": "1.0"}}},
       {"jsonrpc": "2.0", "method": "notifications/initialized"},
       {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}]
for i, (nom, args) in enumerate(APPELS):
    req.append({"jsonrpc": "2.0", "id": 10 + i, "method": "tools/call",
                "params": {"name": nom, "arguments": args}})

p = subprocess.run(SERVEUR, input="\n".join(json.dumps(r) for r in req),
                   capture_output=True, text=True, timeout=180)
rep = {json.loads(l)["id"]: json.loads(l) for l in p.stdout.splitlines() if l.strip()}
if p.stderr.strip():
    print("stderr :", p.stderr.strip()[:500])

echecs = 0
print("▶ MCP Vigilance 22 — test d'intégration\n")
init = rep[1]["result"]
print("  ✅ initialize      %s · protocole %s" % (init["serverInfo"]["name"], init["protocolVersion"]))
outils = rep[2]["result"]["tools"]
print("  ✅ tools/list      %d outils : %s" % (len(outils), ", ".join(o["name"] for o in outils)))
for i, (nom, args) in enumerate(APPELS):
    r = rep[10 + i]["result"]
    txt = r["content"][0]["text"]
    if r.get("isError"):
        print("  ❌ %-22s %s" % (nom, txt[:160])); echecs += 1
    else:
        print("  ✅ %-22s %5d o · %s" % (nom, len(txt), txt.replace("\n", " ")[:90] + "…"))
print()
if echecs:
    print("❌ %d outil(s) en échec" % echecs); sys.exit(1)
print("✅ Tous les outils répondent (%d)" % len(APPELS))
