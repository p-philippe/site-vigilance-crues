# MCP Vigilance 22 — Grok Bot

Serveur MCP HTTP branché sur le site [vigilance-des-crues.vercel.app](https://vigilance-des-crues.vercel.app).

## URL à coller dans Grok Bot

```
https://vigilance-des-crues.vercel.app/api/mcp
```

Dans Grok Bot : **Plugins / Connecteurs → Custom → HTTP**  
Nom : `vigilance22`  
URL : celle ci-dessus  
Auth : aucune (sauf si `MCP_TOKEN` est défini sur Vercel).

## Outils exposés

| Outil | Rôle |
|---|---|
| `get_summary` | Synthèse : max vigilance + 5 stations clés |
| `get_vigilance` | Niveaux officiels Vigicrues des tronçons 22 |
| `list_stations` | Catalogue des 27 stations |
| `get_station` | Fiche d’une station |
| `get_observations` | Dernière hauteur Hub\'Eau |

## Test rapide

```bash
curl -s https://vigilance-des-crues.vercel.app/api/mcp

curl -s https://vigilance-des-crues.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Auth optionnelle

Sur Vercel, variable d’environnement `MCP_TOKEN`.  
Le client envoie alors `Authorization: Bearer <token>`.
