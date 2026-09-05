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
| Serveur MCP (outil d'exploitation, hors bundle) | `mcp/vigilance_mcp.py` |

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

## Un seul agent à la fois

Trois agents différents ont travaillé sur ce dépôt le 2026-08-30, et deux
incidents en ont découlé : un agent modifiant le fichier généré faute de voir
les sources, puis un commit fait depuis une copie de travail périmée, dont le
message décrivait un travail qu'il ne contenait pas.

Avant de commencer une session :

```bash
git pull --ff-only && python3 tests/check.py
```

Si le contrôle 9 échoue, la production a été modifiée sans les sources :
**ne reconstruisez pas**, rapatriez d'abord les changements dans `src/`.

Avant de committer, relisez `git status` et `git diff --stat` : un commit dont
le contenu ne correspond pas à son message coûte plus cher qu'un commit absent.

## Contexte

Jusqu'au 2026-08-30, le dépôt ne contenait **que** le fichier généré : les
sources n'étaient pas versionnées. Un agent travaillant sur ce dépôt n'avait
donc pas d'autre choix que d'éditer le bundle. L'item 9.1 de `ROADMAP.md` a
corrigé cela — les sources sont désormais la référence.

## Le MCP n'est pas l'application

`mcp/` expose les mêmes sources qu'elle à un assistant (item 10.1). Il vit à
côté : `build.py` ne le lit pas, rien n'en entre dans le bundle, et il lit
`src/config.js` plutôt que de recopier les stations — ne jamais dupliquer
seuils ou codes de station dans `mcp/`. Après toute modification de la forme
de `config.js` :

```bash
python3 mcp/test_mcp.py
```

Voir `ROADMAP.md` pour l'état du projet et le backlog.
