#!/usr/bin/env python3
"""
tests/check.py — Vigilance 22 — Tests d'intégrité
Usage : python3 tests/check.py
Retourne exit code 0 si tout est OK, 1 si des erreurs sont détectées.
Ces tests sont aussi lancés automatiquement par build.py.
"""

import json
import re
import sys
from pathlib import Path

ROOT  = Path(__file__).parent.parent
SRC   = ROOT / 'src'
PROD  = ROOT / 'public_html' / 'index.html'
PROP  = ROOT / 'maintenance' / 'propagation.json'

errors   = []
warnings = []

def err(msg):  errors.append(f'  ❌ {msg}')
def warn(msg): warnings.append(f'  ⚠  {msg}')
def ok(msg):   print(f'  ✅ {msg}')


# ── Extraire les codes ST depuis config.js ─────────────────────────────────
def extract_st_codes() -> set:
    cfg = (SRC / 'config.js').read_text(encoding='utf-8')
    return set(re.findall(r"'(J\d{9,12})'", cfg))

ST_CODES = extract_st_codes()


# ── 1. Codes ST — 27 stations attendues ────────────────────────────────────
def test_station_count():
    n = len(ST_CODES)
    if n == 27:
        ok(f'Stations : {n}/27 dans config.js')
    else:
        err(f'Stations : {n} trouvées dans config.js, attendu 27')

# ── 2. Arcs window.PROP_DATA (init.js) → tous les codes dans ST ───────────
def test_propagation_codes_in_data_js():
    src = (SRC / 'init.js').read_text(encoding='utf-8')
    froms = re.findall(r'"from"\s*:\s*"(J\d+)"', src)
    tos   = re.findall(r'"to"\s*:\s*"(J\d+)"',   src)
    bad = [c for c in set(froms + tos) if c not in ST_CODES]
    if bad:
        err(f'init.js PROP_DATA — codes inconnus dans ST : {bad}')
    else:
        ok(f'init.js PROP_DATA — tous les codes ({len(froms)} from, {len(tos)} to) existent dans ST')

# ── 3. propagation.json → codes dans ST ───────────────────────────────────
def test_propagation_json():
    if not PROP.exists():
        warn('propagation.json introuvable — test ignoré')
        return
    data = json.loads(PROP.read_text(encoding='utf-8'))
    bad = []
    for arc in data.get('arcs', []):
        for key in ('from', 'to'):
            code = arc.get(key, '')
            if code not in ST_CODES:
                bad.append(f"{arc['id']}.{key}={code}")
    if bad:
        err(f'propagation.json — codes inconnus dans ST : {bad}')
    else:
        ok(f'propagation.json — {len(data["arcs"])} arcs, tous les codes valides')

# ── 4. Cohérence data.js ↔ propagation.json ───────────────────────────────
def test_propagation_consistency():
    if not PROP.exists():
        warn('propagation.json introuvable — cohérence non vérifiée')
        return
    prop = json.loads(PROP.read_text(encoding='utf-8'))
    prop_arcs = {(a['from'], a['to']): a for a in prop['arcs']}

    src = (SRC / 'init.js').read_text(encoding='utf-8')
    # Extraire les paires (from, to) avec confiance depuis window.PROP_DATA
    pairs = re.findall(r'"from"\s*:\s*"(J\d+)"[^}]*"to"\s*:\s*"(J\d+)"[^}]*"confiance"\s*:\s*([\d.]+)', src)
    mismatches = []
    for from_code, to_code, conf_str in pairs:
        conf_js = float(conf_str)
        arc = prop_arcs.get((from_code, to_code))
        if arc is None:
            warn(f'Arc ({from_code}→{to_code}) présent dans data.js mais absent de propagation.json')
            continue
        if abs(arc['confiance'] - conf_js) > 0.01:
            mismatches.append(f'{from_code}→{to_code} : data.js={conf_js} / propagation.json={arc["confiance"]}')
    if mismatches:
        err(f'Confiances désynchronisées entre data.js et propagation.json : {mismatches}')
    else:
        ok(f'data.js ↔ propagation.json — confiances synchronisées ({len(pairs)} arcs)')

# ── 5. Bassins config.js → codes dans ST ──────────────────────────────────
def test_bassins_codes():
    cfg = (SRC / 'config.js').read_text(encoding='utf-8')
    # Extraire les codes dans BASSINS
    bassin_codes = re.findall(r'code:"(J\d+)"', cfg)
    bad = [c for c in bassin_codes if c not in ST_CODES]
    if bad:
        err(f'config.js BASSINS — codes inconnus dans ST : {bad}')
    else:
        ok(f'config.js BASSINS — {len(bassin_codes)} références, toutes valides')

# ── 6. Build output — pas de résidus import/export ────────────────────────
def test_build_output_clean():
    if not PROD.exists():
        warn('Fichier prod introuvable — lancer build.py d\'abord')
        return
    prod = PROD.read_text(encoding='utf-8')

    # Chercher dans le bloc <script> généré (pas dans le HTML)
    script_match = re.search(r'// Vigilance 22 — bundle généré par build\.py(.*)</script>', prod, re.DOTALL)
    if not script_match:
        warn('Bloc bundle introuvable dans le fichier prod — vérifier build.py')
        return
    bundle = script_match.group(1)

    import_lines = [l.strip() for l in bundle.split('\n') if re.match(r'^import\s', l.strip())]
    export_lines = [l.strip() for l in bundle.split('\n') if re.match(r'^export\s', l.strip())]

    if import_lines:
        err(f'Build : {len(import_lines)} ligne(s) import résiduelles (ex: {import_lines[0][:80]})')
    else:
        ok('Build : aucun import résiduel')

    if export_lines:
        err(f'Build : {len(export_lines)} ligne(s) export résiduelles (ex: {export_lines[0][:80]})')
    else:
        ok('Build : aucun export résiduel')

# ── 7. Build output — taille raisonnable ──────────────────────────────────
def test_build_size():
    if not PROD.exists():
        warn('Fichier prod introuvable — test ignoré')
        return
    size_kb = PROD.stat().st_size / 1024
    limit_kb = 400
    if size_kb > limit_kb:
        err(f'Build trop lourd : {size_kb:.0f} Ko > {limit_kb} Ko')
    else:
        ok(f'Build taille : {size_kb:.0f} Ko (limite {limit_kb} Ko)')

# ── 8. Build output — JSON établissements sensibles chargé à la demande ───
def test_build_em_sensitive_lazy():
    """Le JSON (~227 Ko) doit rester hors du bundle et être servi à part (8.5)."""
    if not PROD.exists():
        warn('Fichier prod introuvable — test ignoré')
        return
    prod = PROD.read_text(encoding='utf-8')
    asset = PROD.parent / 'em-sensitive.json'
    if '_EM_SENSITIVE_BLOB' in prod:
        err('Build : JSON établissements sensibles ré-inliné — il doit rester différé')
        return
    if not asset.exists():
        err('Build : em-sensitive.json absent de public_html/ — la couche ne chargera pas')
        return
    if "'./em-sensitive.json'" not in prod:
        err("Build : le bundle ne pointe pas vers ./em-sensitive.json")
        return
    if "'./src/em-sensitive-inline.json'" in prod:
        err('Build : le bundle pointe encore vers le chemin de développement')
        return
    ko = asset.stat().st_size / 1024
    ok(f'Build : établissements sensibles différés ({ko:.0f} Ko hors bundle)')

# ── 9. Build output — strictement synchronisé avec les sources ───────────
def test_build_is_current():
    """Détecte une source modifiée sans régénération du fichier servi."""
    if not PROD.exists():
        warn('Fichier prod introuvable — synchronisation build non vérifiée')
        return
    # tests/check.py est exécuté depuis son propre dossier : rendre la racine
    # importable pour réutiliser exactement la logique du bundler.
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    import build
    dev_html = build.DEV.read_text(encoding='utf-8')
    pattern = re.compile(
        r'<script\s+type=["\']module["\'][^>]*src=["\']src/init\.js[^"\']*["\'][^>]*>\s*</script>',
        re.IGNORECASE,
    )
    expected = pattern.sub(
        lambda _: f'<script>\n// Vigilance 22 — bundle généré par build.py\n{build.bundle_modules()}\n</script>',
        dev_html,
    )
    if expected == PROD.read_text(encoding='utf-8'):
        ok('Build : production synchronisée avec les sources')
    else:
        err('Build : production désynchronisée — lancer python3 build.py')

# ── 10. Résilience réseau ─────────────────────────────────────────────────
def test_network_hygiene():
    data = (SRC / 'data.js').read_text(encoding='utf-8')
    utils = (SRC / 'utils.js').read_text(encoding='utf-8')
    if 'export async function fetchJson' in utils and data.count('fetchJson(') >= 8:
        ok('Réseau : données critiques avec timeout, HTTP check et retry')
    else:
        err('Réseau : fetchJson non appliqué aux chargements de données critiques')
    # Aucun fetch brut hors utils.js : tous doivent passer par fetchJson (item 9.7)
    bruts = []
    for f in sorted(SRC.glob('*.js')):
        if f.name == 'utils.js':
            continue
        for i, ligne in enumerate(f.read_text(encoding='utf-8').split('\n'), 1):
            if re.search(r'(await|=|return)\s+fetch\(', ligne):
                bruts.append(f'{f.name}:{i}')
    if bruts:
        err(f'Réseau : {len(bruts)} appel(s) fetch brut(s) sans timeout ni contrôle HTTP — {bruts}')
    else:
        ok('Réseau : aucun fetch brut hors utils.js (timeout et relance garantis partout)')
    # Aucun proxy CORS public tiers, où que ce soit dans les sources
    sources = {f.name: f.read_text(encoding='utf-8') for f in SRC.glob('*.js')}
    sources['index.html'] = (ROOT / 'index.html').read_text(encoding='utf-8')
    public_proxies = ('api.allorigins.win', 'corsproxy.io', 'api.codetabs.com')
    fautifs = [f'{proxy} ({nom})' for nom, txt in sources.items()
               for proxy in public_proxies if proxy in txt]
    if fautifs:
        err(f'Proxy CORS public tiers référencé : {fautifs}')
    else:
        ok(f'Réseau : aucun proxy CORS public tiers ({len(sources)} fichiers vérifiés)')

# ── 10b. sw.js — CACHE_NAME présent ───────────────────────────────────────
def test_sw_cache_name():
    sw = ROOT / 'public_html' / 'sw.js'
    if not sw.exists():
        warn('sw.js introuvable')
        return
    content = sw.read_text(encoding='utf-8')
    m = re.search(r"const CACHE_NAME = '(vigicrues22-[^']+)';", content)
    if m:
        ok(f'sw.js : CACHE_NAME = {m.group(1)}')
    else:
        err('sw.js : CACHE_NAME introuvable ou format inattendu')

# ── 10. Arcs non calibrés exclus des alertes actives ─────────────────────
def test_uncalibrated_arcs_excluded():
    src = (SRC / 'data.js').read_text(encoding='utf-8')
    # Vérifier que la logique exclut confiance=0 de arcsActifs
    if 'arc.confiance > 0' in src and 'arcsPending' in src:
        ok('data.js : arcs confiance=0 exclus des alertes (dans arcsPending)')
    else:
        err('data.js : arcs confiance=0 non filtrés — risque de fausses alertes')


# ── Runner ─────────────────────────────────────────────────────────────────
TESTS = [
    test_station_count,
    test_propagation_codes_in_data_js,
    test_propagation_json,
    test_propagation_consistency,
    test_bassins_codes,
    test_build_output_clean,
    test_build_size,
    test_build_em_sensitive_lazy,
    test_build_is_current,
    test_sw_cache_name,
    test_network_hygiene,
    test_uncalibrated_arcs_excluded,
]

def run():
    print('▶ Vigilance 22 — Tests d\'intégrité\n')
    for t in TESTS:
        t()
    print()
    if warnings:
        for w in warnings: print(w)
    if errors:
        for e in errors: print(e)
        print(f'\n❌ {len(errors)} erreur(s) — corriger avant de déployer')
        sys.exit(1)
    else:
        print(f'✅ Tous les tests passent ({len(TESTS)} vérifications)')

if __name__ == '__main__':
    run()
