# Vigilance 22 — Guide de déploiement

Outil de surveillance hydrométrique temps réel des Côtes-d'Armor.  
Projet personnel basé sur données publiques (Hub'Eau, Vigicrues, Open-Meteo).

---

## Structure du projet

```
hostinger_deploy/
├── public_html/          ← À uploader sur Hostinger (contenu du site)
│   ├── index.html        ← Application complète (~510 Ko, fichier unique)
│   ├── .htaccess         ← Configuration Apache (HTTPS, sécurité, compression)
│   └── robots.txt        ← Autorisation indexation moteurs de recherche
└── maintenance/
    └── calibrer_propagation.py  ← Script local de calibration propagation amont-aval
```

---

## URLs de production

| Hébergement | URL | Déploiement |
|---|---|---|
| Vercel (recommandé) | https://vigilance-des-crues.vercel.app | CLI `vercel --prod` |
| Hostinger | https://vigilance22.fr | Upload manuel hPanel |

---

## Déploiement standard (Vercel — recommandé)

```bash
# Depuis la racine du projet
python3 build.py
vercel --prod hostinger_deploy/public_html
```

C'est tout. Vercel détecte automatiquement les fichiers modifiés.

---

## Déploiement Hostinger (manuel)

### Via hPanel File Manager

1. Connectez-vous sur [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. **Websites** → votre domaine → **File Manager**
3. Naviguez dans `public_html/`
4. Uploadez `index.html` et `sw.js` (les deux sont modifiés à chaque build)

> ⚠️ Le fichier `.htaccess` commence par un point — visible sur macOS avec `Cmd+Shift+.`.
> À n'uploader qu'une seule fois (lors du déploiement initial).

### Via FTP (FileZilla)

| Paramètre | Où trouver |
|-----------|-----------|
| Hôte | hPanel → FTP Accounts → hôte |
| Identifiant | hPanel → FTP Accounts |
| Mot de passe | Celui défini à la création du compte FTP |
| Port | 21 |

Copiez `index.html` et `sw.js` dans `/public_html/`.

---

## Vérification après déploiement

Ouvrez `https://votre-domaine.fr` et vérifiez :

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
vercel --prod hostinger_deploy/public_html    # déploie sur Vercel
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
- **Pas de serveur** : aucun backend, aucune base de données, aucun cookie.
- **CSP** : politique de sécurité définie en meta-tag, liste blanche des
  domaines autorisés.
