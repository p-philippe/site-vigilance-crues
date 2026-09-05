# MCP Vigilance 22

Serveur MCP (Model Context Protocol) exposant à un assistant les mêmes sources
que l'application web : Vigicrues, Hub'Eau, SHOM et la calibration de
propagation. **Il ne fait pas partie de l'application** : rien de ce dossier
n'entre dans le bundle, `build.py` ne le lit pas, `public_html/` est inchangé.

## Pourquoi

L'application répond à « quel est l'état du réseau ? » pour un humain devant un
écran. Le MCP répond à la même question pour un assistant, qui peut alors
croiser, surveiller et alerter sans qu'on ouvre le tableau de bord — la veille
entre deux épisodes, précisément le moment où personne ne le consulte.

## Outils

| Outil | Réponse |
|---|---|
| `vigilance_troncons` | Niveau officiel des 6 tronçons couvrant le 22 |
| `liste_stations` | Les 27 stations : codes, seuils, bassins, tronçons |
| `observations_station` | Série H sur N heures, débit, tendance cm/h, seuil atteint |
| `stations_en_alerte` | Balayage des 27 stations, tri par écart au premier seuil |
| `propagation_arcs` | Arcs calibrés, transit, confiance, arcs exclus des alertes |
| `coefficient_maree` | Coefficients SHOM (surcote aux exutoires) |
| `synthese_departement` | Les quatre précédents en un appel, avec verdict |

## Choix techniques

- **Zéro dépendance** — bibliothèque standard seule, JSON-RPC 2.0 écrit à la
  main (~120 lignes). Le SDK `mcp` aurait ajouté pip et un environnement
  virtuel à un projet qui n'a aucune dépendance.
- **Pas de duplication** — les 27 stations, leurs seuils et leurs tronçons sont
  lus dans `src/config.js` au démarrage. Modifier une station dans `config.js`
  la modifie ici, sans intervention.
- **Sans Vercel** — appels directs à Vigicrues, Hub'Eau et SHOM. Le MCP reste
  utilisable si l'hébergement est indisponible (risque listé en ROADMAP).
- **Timeout + une relance sur 429/5xx**, comme `utils.js` côté front.

## Exécution

```bash
python3 mcp/test_mcp.py          # test d'intégration : les 7 outils, données réelles
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | python3 mcp/vigilance_mcp.py
```

## Déclaration

**Claude Code** — rien à faire : `.mcp.json` à la racine du dépôt est détecté à
l'ouverture du projet.

**Claude Desktop** — ajouter dans `claude_desktop_config.json`
(`~/Library/Application Support/Claude/` sur macOS), avec le chemin absolu :

```json
{
  "mcpServers": {
    "vigilance-22": {
      "command": "python3",
      "args": ["/chemin/vers/Vigilance des crues/mcp/vigilance_mcp.py"]
    }
  }
}
```
