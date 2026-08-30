#!/usr/bin/env python3
"""
build.py — Vigilance 22
Assemble index.html (dev modulaire) + src/*.js → public_html/index.html

Usage : python3 build.py [--check]
  --check : affiche seulement les stats, n'écrit pas le fichier
"""

import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
SRC  = ROOT / 'src'
DEV  = ROOT / 'index.html'
PROD = ROOT / 'public_html' / 'index.html'

# Ordre topologique des modules (dépendances d'abord)
MODULE_ORDER = [
    'config.js',
    'state.js',
    'utils.js',
    'vigi.js',
    'cache.js',
    'notif.js',
    'journal.js',
    'map.js',
    'render.js',
    'modal.js',
    'meteo.js',
    'pdf.js',
    'rp.js',
    'tabs.js',
    'em-map.js',
    'data.js',
    'globals.js',
    'init.js',
]

# Patterns à supprimer / transformer
RE_IMPORT_SINGLE = re.compile(r"^import\s+.*?from\s+['\"]\.\/[^'\"]+['\"];?\s*$")
RE_IMPORT_BARE   = re.compile(r"^import\s+['\"]\.\/[^'\"]+['\"];?\s*$")  # import './mod.js'
RE_IMPORT_MULTI  = re.compile(r"^import\s*\{", re.MULTILINE)
RE_EXPORT_BARE   = re.compile(r"^export\s*\{[^}]*\};?\s*$", re.MULTILINE)
RE_EXPORT_KW     = re.compile(r"^export\s+((?:async\s+)?(?:function|class|const|let|var))", re.MULTILINE)
RE_EXPORT_DEFAULT= re.compile(r"^export\s+default\s+", re.MULTILINE)


def strip_imports(src: str) -> str:
    """Supprime toutes les lignes import (single et multi-lignes)."""
    lines = src.split('\n')
    result = []
    in_import = False
    for line in lines:
        if in_import:
            if line.strip().endswith(';') or (line.strip().endswith("'") or line.strip().endswith('"')):
                # Fin d'un import multi-lignes
                in_import = False
            # skip la ligne
            continue
        if RE_IMPORT_SINGLE.match(line) or RE_IMPORT_BARE.match(line):
            continue
        if RE_IMPORT_MULTI.match(line) and 'from' not in line:
            # Import multi-lignes sans 'from' encore sur cette ligne
            in_import = True
            continue
        if RE_IMPORT_MULTI.match(line) and 'from' in line:
            # Import multi-lignes mais complet sur une ligne
            continue
        result.append(line)
    return '\n'.join(result)


def strip_exports(src: str) -> str:
    """Supprime 'export { ... }' et retire le mot-clé 'export' des déclarations."""
    # Supprimer export { X, Y };  (sur une ou plusieurs lignes)
    src = re.sub(r'^export\s*\{[^}]*\};?\s*\n?', '', src, flags=re.MULTILINE)
    # Retirer le mot-clé export des déclarations
    src = RE_EXPORT_KW.sub(r'\1', src)
    src = RE_EXPORT_DEFAULT.sub('', src)
    return src


def inline_em_sensitive() -> str:
    """Retourne la déclaration JS du JSON établissements sensibles (232 Ko)."""
    json_path = SRC / 'em-sensitive-inline.json'
    if not json_path.exists():
        print('  ⚠ em-sensitive-inline.json introuvable — fetch conservé')
        return ''
    data = json_path.read_text(encoding='utf-8').strip()
    return f'// em-sensitive-inline.json inliné par build.py\nconst _EM_SENSITIVE_BLOB = {data};\n'


def patch_em_map(src: str) -> str:
    """Remplace le fetch dynamique par la constante inlinée."""
    return src.replace(
        "const r = await fetch('./src/em-sensitive-inline.json');\n  EM_SENSITIVE_INLINE = await r.json();",
        "EM_SENSITIVE_INLINE = _EM_SENSITIVE_BLOB;"
    )


def bundle_modules() -> str:
    em_blob = inline_em_sensitive()
    parts = []
    for name in MODULE_ORDER:
        path = SRC / name
        if not path.exists():
            print(f'  ⚠ {name} introuvable — ignoré')
            continue
        raw = path.read_text(encoding='utf-8')
        processed = strip_imports(raw)
        processed = strip_exports(processed)
        if name == 'em-map.js' and em_blob:
            parts.append(f'\n// ═══ em-sensitive-inline.json ═══\n{em_blob}')
            processed = patch_em_map(processed)
        parts.append(f'\n// ═══ {name} ═══\n{processed}')
    return '\n'.join(parts)


def build(check=False):
    print('▶ Vigilance 22 — Build')
    print(f'  Source  : {DEV}')
    print(f'  Modules : {SRC}/')
    print(f'  Cible   : {PROD}')
    print()

    dev_html = DEV.read_text(encoding='utf-8')

    # Trouver le tag <script type="module" src="src/init.js...">
    script_pattern = re.compile(
        r'<script\s+type=["\']module["\'][^>]*src=["\']src/init\.js[^"\']*["\'][^>]*>\s*</script>',
        re.IGNORECASE
    )
    if not script_pattern.search(dev_html):
        print('❌ Tag <script type="module" src="src/init.js"> introuvable dans index.html')
        sys.exit(1)

    bundle = bundle_modules()
    inline_script = f'<script>\n// Vigilance 22 — bundle généré par build.py\n{bundle}\n</script>'

    prod_html = script_pattern.sub(lambda _: inline_script, dev_html)

    lines_in  = dev_html.count('\n')
    lines_out = prod_html.count('\n')
    size_out  = len(prod_html.encode('utf-8'))

    print(f'  Modules  : {len(MODULE_ORDER)} fichiers')
    print(f'  Lignes   : {lines_in} → {lines_out}')
    print(f'  Taille   : {size_out / 1024:.0f} Ko')

    if size_out > 900 * 1024:
        print(f'  ⚠ Fichier > 900 Ko — envisager un lazy-load')

    if check:
        print('\n  Mode --check : fichier non écrit.')
        return

    PROD.write_text(prod_html, encoding='utf-8')

    # Bump CACHE_NAME dans sw.js pour invalider le cache PWA après chaque build
    import datetime as _dt
    cache_tag = _dt.datetime.now().strftime('%Y-%m-%d-%H%M')
    sw_path = ROOT / 'public_html' / 'sw.js'
    if sw_path.exists():
        sw = sw_path.read_text(encoding='utf-8')
        sw_bumped = re.sub(
            r"const CACHE_NAME = 'vigicrues22-[^']*';",
            f"const CACHE_NAME = 'vigicrues22-{cache_tag}';",
            sw
        )
        if sw_bumped != sw:
            sw_path.write_text(sw_bumped, encoding='utf-8')
            print(f'  sw.js   : CACHE_NAME mis à jour → vigicrues22-{cache_tag}')

    print(f'\n✅ {PROD} écrit ({lines_out} lignes, {size_out / 1024:.0f} Ko)')
    print('   → Vérifier en local : python3 -m http.server 8080 --directory public_html')
    print('   → Déployer : vercel --prod (ou push sur main — déploiement Vercel automatique)')


def run_tests():
    """Lance tests/check.py — arrête le build si des erreurs sont détectées."""
    import subprocess
    result = subprocess.run([sys.executable, str(ROOT / 'tests' / 'check.py')], capture_output=False)
    if result.returncode != 0:
        print('\n❌ Tests échoués — build annulé.')
        sys.exit(1)


if __name__ == '__main__':
    check_only = '--check' in sys.argv
    build(check=check_only)
    if not check_only:
        print('\n▶ Validation post-build...')
        run_tests()
