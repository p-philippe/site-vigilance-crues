# Vigilance 22 — Guide de déploiement Hostinger

Outil de surveillance hydrométrique temps réel des Côtes-d'Armor.  
Projet personnel basé sur données publiques (Hub'Eau, Vigicrues, SHOM, Open-Meteo).

---

## Structure du projet

```
hostinger_deploy/
├── public_html/          ← À uploader sur Hostinger (contenu du site)
│   ├── index.html        ← Application complète (~530 Ko, fichier unique)
│   ├── .htaccess         ← Configuration Apache (HTTPS, sécurité, compression)
│   └── robots.txt        ← Autorisation indexation moteurs de recherche
└── maintenance/
    └── update_shom.py    ← Script local de mise à jour des marées
```

---

## Déploiement initial (une seule fois)

### Via hPanel File Manager (recommandé)

1. Connectez-vous sur [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. **Websites** → votre domaine → **File Manager**
3. Naviguez dans `public_html/`
4. Supprimez le fichier `index.html` existant (page par défaut Hostinger)
5. Uploadez les 3 fichiers du dossier `public_html/` :
   - `index.html`
   - `.htaccess`
   - `robots.txt`

> ⚠️ Le fichier `.htaccess` commence par un point — il peut être masqué
> par votre explorateur de fichiers. Sur macOS : `Cmd+Shift+.` pour l'afficher.

### Via FTP (FileZilla)

| Paramètre | Où trouver |
|-----------|-----------|
| Hôte | hPanel → FTP Accounts → hôte |
| Identifiant | hPanel → FTP Accounts |
| Mot de passe | Celui défini à la création du compte FTP |
| Port | 21 |

Copiez les 3 fichiers dans `/public_html/`.

---

## Vérification après déploiement

Ouvrez `https://votre-domaine.fr` et vérifiez :

| Fonctionnalité | État attendu en local | État attendu en ligne |
|---|---|---|
| Données Hub'Eau | ✅ | ✅ |
| Vigicrues officiel | ✅ | ✅ |
| Météo Open-Meteo | ✅ | ✅ |
| **Marées SHOM live** | ⚠ Snapshot embarqué | ✅ **Données temps réel** |
| **Radar Rainviewer** | ⚠ Peut échouer (CORS) | ✅ **Opérationnel** |
| **Revue de presse** | ⚠ Proxy CORS bloqué | ✅ **Opérationnel** |
| **Prévisions station** | ⚠ Peut échouer (CORS) | ✅ **Opérationnel** |

---

## Maintenance — Mise à jour du snapshot SHOM

Le fichier `index.html` embarque un snapshot des marées pour fonctionner
hors-ligne. Une fois en ligne, les données SHOM sont chargées en temps réel —
le snapshot sert de **fallback** si l'API SHOM est indisponible.

**Fréquence recommandée** : une fois par semaine.

### Prérequis (une seule fois)

```bash
pip3 install requests
```

### Lancer la mise à jour

Depuis le dossier `hostinger_deploy/` :

```bash
python3 maintenance/update_shom.py
```

Le script :
1. Interroge l'API SHOM (coefficients 14 j + horaires 7 j + courbes 2 j)
2. Met à jour `public_html/index.html`
3. Affiche un résumé

### Après la mise à jour

Re-uploadez uniquement `public_html/index.html` sur Hostinger
(le fichier est modifié en local, les deux autres n'ont pas changé).

---

## Mise à jour de l'application

Quand une nouvelle version du fichier HTML est générée avec Claude :

1. Copiez le nouveau fichier dans `public_html/index.html`
2. Lancez `python3 maintenance/update_shom.py` pour rafraîchir le snapshot
3. Uploadez `public_html/index.html` sur Hostinger

---

## APIs utilisées (toutes publiques et gratuites)

| API | Usage | Clé |
|-----|-------|-----|
| [Hub'Eau](https://hubeau.eaufrance.fr) | Données hydrométriques | Non requise |
| [Vigicrues](https://www.vigicrues.gouv.fr) | Niveaux de vigilance officiels | Non requise |
| [Open-Meteo](https://open-meteo.com) | Météo et saturation des sols | Non requise |
| [SHOM](https://services.data.shom.fr) | Marées (horaires + courbes) | Embarquée dans le code |
| [Rainviewer](https://www.rainviewer.com/api.html) | Radar précipitations | Non requise |
| [Nominatim](https://nominatim.org) | Géocodage (État-major) | Non requise |

> La clé SHOM (`b2q8lrcdl4s04cbabsj4nhcb`) est une clé de développement publique.
> En cas d'expiration, générez-en une nouvelle sur [data.shom.fr](https://data.shom.fr)
> et remplacez-la dans `index.html` (rechercher `SHOM_BASE`).

---

## Notes techniques

- **localStorage** : le journal des événements et la revue de presse sont
  stockés dans le navigateur de l'utilisateur (persistants entre sessions,
  spécifiques à chaque appareil).
- **Pas de serveur** : aucun backend, aucune base de données, aucun cookie.
- **CSP** : politique de sécurité définie en meta-tag, liste blanche des
  domaines autorisés.
