# Conventions du dépôt — à lire avant toute modification

> Vaut pour tout agent (Codex, Claude Code, autre) comme pour un contributeur humain.

## La règle qui compte

**Ne jamais modifier `public_html/index.html`.** C'est un fichier **généré**
(6 100 lignes, 529 Ko) assemblé par `build.py` à partir de `index.html` et de
`src/*.js`. Toute édition directe est **silencieusement écrasée** au prochain
build.

| Ce que vous voulez changer | Fichier à modifier |
|---|---|
| Logique, comportement, données | `src/*.js` (18 modules ES) |
| Structure HTML, CSS, textes | `index.html` (racine) |
| Fonctions serverless | `public_html/api/*.js` |
| Service worker, manifest, robots | `public_html/sw.js`, etc. |
| **Application assemblée** | **aucun — c'est une sortie de build** |

## Workflow

```bash
python3 build.py
```

Régénère `public_html/index.html` et lance 12 contrôles d'intégrité. Le build
est annulé si un contrôle échoue.

```bash
vercel --prod
```

Déploie. Un `git push` sur `main` déclenche aussi un déploiement automatique.

## Après chaque `git pull`

```bash
python3 tests/check.py
```

Lancé **seul** (et non via `build.py`, qui réécrit la prod avant de tester),
ce contrôle détecte une production désynchronisée des sources — c'est-à-dire
quelqu'un ayant édité le bundle à la main. Si le contrôle 9 échoue, ne
reconstruisez pas : les modifications seraient perdues. Rapatriez-les d'abord
dans `src/`.

## Contexte

Jusqu'au 2026-08-30, le dépôt ne contenait **que** le fichier généré : les
sources n'étaient pas versionnées. Un agent travaillant sur ce dépôt n'avait
donc pas d'autre choix que d'éditer le bundle. L'item 9.1 de `ROADMAP.md` a
corrigé cela — les sources sont désormais la référence.

Voir `ROADMAP.md` pour l'état du projet et le backlog.
