# Vigilance 22 — Guide de déploiement

Outil de surveillance hydrométrique temps réel des Côtes-d'Armor.  
Projet personnel basé sur données publiques (Hub'Eau, Vigicrues, Open-Meteo).

---

## Structure du projet

```
.                         ← racine du dépôt git
├── index.html            ← Source de développement (structure + CSS)
├── src/                  ← 19 modules ES — source de vérité du code
├── build.py              ← Assemble index.html + src/ → public_html/index.html
├── tests/check.py        ← 12 contrôles d'intégrité (lancés par build.py)
├── ROADMAP.md            ← Pilotage du projet
├── public_html/          ← Servi par Vercel (Root Directory du projet)
│   ├── index.html        ← Application complète générée — NE PAS ÉDITER À LA MAIN
│   ├── api/              ← 4 fonctions serverless (proxys Vigicrues, RSS, SHOM)
│   ├── sw.js             ← Service Worker PWA
│   └── robots.txt        ← Autorisation indexation moteurs de recherche
└── maintenance/
    └── calibrer_propagation.py  ← Calibration propagation amont-aval
```

> Le dossier `vercel_deploy/` a été supprimé le 2026-08-30 (item 9.1) : son contenu
> est remonté à la racine, qui est désormais aussi la racine du dépôt git — les
> sources sont enfin versionnées. Les chemins servis par Vercel sont inchangés.

---

## URL de production

| Hébergement | URL | Déploiement |
|---|---|---|
| Vercel (exclusif) | https://vigilance-des-crues.vercel.app | CLI `vercel --prod` |

> Hostinger n'est plus utilisé depuis le 2026-06-30 (voir ROADMAP.md, section Arbitrages). Vercel est l'hébergement unique.

---

## Déploiement (Vercel)

```bash
# Depuis la racine du projet
python3 build.py
vercel --prod
```

C'est tout. Vercel détecte automatiquement les fichiers modifiés.

---

## Vérification après déploiement

Ouvrez https://vigilance-des-crues.vercel.app et vérifiez :

| Fonctionnalité | État attendu en local | État attendu en ligne |
|---|---|---|
| Données Hub'Eau | ✅ | ✅ |
| Vigicrues officiel | ✅ | ✅ |
| Météo Open-Meteo | ✅ | ✅ |
| **Radar Rainviewer** | ⚠ Peut échouer (CORS) | ✅ **Opérationnel** |
| **Revue de presse** | ⚠ Proxy CORS bloqué | ✅ **Opérationnel** |
| **Prévisions station** | ⚠ Peut échouer (CORS) | ✅ **Opérationnel** |

---

## Mise à jour de l'application

Workflow complet après modification du code source :

```bash
python3 build.py                              # génère public_html/index.html
vercel --prod                                 # déploie sur Vercel
```

---

## APIs utilisées (toutes publiques et gratuites)

| API | Usage | Clé |
|-----|-------|-----|
| [Hub'Eau](https://hubeau.eaufrance.fr) | Données hydrométriques | Non requise |
| [Vigicrues](https://www.vigicrues.gouv.fr) | Niveaux de vigilance officiels | Non requise |
| [Open-Meteo](https://open-meteo.com) | Météo et saturation des sols | Non requise |
| [Rainviewer](https://www.rainviewer.com/api.html) | Radar précipitations | Non requise |
| [Nominatim](https://nominatim.org) | Géocodage (État-major) | Non requise |

---

## Notes techniques

- **localStorage** : le journal des événements et la revue de presse sont
  stockés dans le navigateur de l'utilisateur (persistants entre sessions,
  spécifiques à chaque appareil).
- **Pas de backend persistant** : aucune base de données ni cookie. Quatre fonctions serverless Vercel (`api/`) font uniquement office de proxys contrôlés pour les sources qui ne permettent pas les appels directs.
- **CSP** : politique de sécurité définie en meta-tag, liste blanche des
  domaines autorisés.
