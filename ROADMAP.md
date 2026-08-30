# Roadmap — Vigilance 22

> Outil de surveillance hydrométrique temps réel — Côtes-d'Armor (22)
> Production : https://vigilance-des-crues.vercel.app
> Dernière mise à jour : 2026-08-30

---

## Résumé exécutif

Application **en production et opérationnelle**. Phases 1 à 5 livrées : tableau de bord 27 stations, modale enrichie avec prévisions Vigicrues, propagation amont-aval, alertes navigateur, PWA hors-ligne, carte état-major.

Le backlog fonctionnel est **entièrement livré**. Les deux seuls items fonctionnels ouverts (3.3 recalibration, 7.5 test Journal) sont bloqués sur un épisode de vigilance ≥ Jaune.

**Le projet change de phase.** L'audit du 2026-08-30 montre que la croissance par ajout a produit un décalage net entre le poids du code et sa valeur opérationnelle : 54 % du HTML et 10 % du JS servent trois onglets qui n'affichent aucune donnée hydrométrique, et quatre onglets présentent des données déjà visibles sur la carte. La **phase 9 est une phase de retrait** : ramener l'application à ce qu'elle fait vraiment, sans rien perdre de sa capacité de surveillance.

**9.1 livré le 2026-08-30 — les sources sont versionnées.** Le dépôt git couvre désormais `src/`, `build.py`, `tests/`, `index.html` et ce document. Le dossier `vercel_deploy/` a disparu : son contenu est remonté à la racine, qui est aussi la racine du dépôt. Les chemins servis par Vercel sont inchangés, le Root Directory `public_html` n'a pas été touché. Le reste de la phase 9 peut être engagé.

---

## Vision

Fournir aux acteurs de la gestion de crise des **Côtes-d'Armor** un tableau de bord opérationnel unique, sans backend, donnant en un coup d'œil l'état hydro-météorologique des cours d'eau — des premières pluies amont jusqu'à l'impact côtier — avec **anticipation des fronts de crue par propagation inter-stations**.

**Périmètre** : 27 stations hydrométriques du département 22 — bassins Oust, Blavet, Trieux, Leff, Léguer, Gouessant, Arguenon.
**Horizon** : outil opérationnel à 2–5 ans, sans backend, sur hébergement statique gratuit.

**Critère de tri pour tout ajout futur** : est-ce que cela aide à anticiper ou à décider pendant une crue ? Si non, cela n'entre pas dans l'application — au mieux dans la modale Ressources.

| Profil utilisateur | Besoin | Canal | Fréquence |
|---|---|---|---|
| Gestionnaire de crise (DDT, mairie) | Anticiper la montée des eaux | Desktop, salle de crise | Épisodes ≥ Jaune |
| Riverain averti | Suivre la rivière proche de chez lui | Mobile (PWA) | Hebdomadaire en saison |
| Responsable route / infrastructure | Évaluer le risque sur les axes vulnérables | Desktop ou tablette | Alertes météo |

---

## Architecture technique

- **Statique + 4 fonctions serverless Vercel** — aucun backend, aucune base de données ; les fonctions `api/` sont des proxys contrôlés (Vigicrues, RSS, SHOM).
- **Persistance locale** : `localStorage` (journal, favoris) + IndexedDB (cache hors-ligne).
- **Hébergement** : Vercel exclusivement (CDN + serverless). Root Directory du projet : `public_html`. Déploiement depuis la racine.
- **Contrainte clé** : rester sans backend lourd — tout dépassement doit être justifié dans [Arbitrages](#arbitrages-et-décisions).

| API | Usage | Fallback si indisponible |
|---|---|---|
| Hub'Eau | Hauteur H, débit Q, piézomètres | Dernière valeur connue + bandeau |
| Vigicrues (GeoJSON) | Vigilance officielle par tronçon | Marqueurs gris + message |
| Open-Meteo | Météo, pluie, saturation des sols | Section masquée |
| Open-Meteo Marine | Marée (`sea_level_height_msl`) | Couche indisponible |
| SHOM (`api/coefficient.js`) | Coefficient de marée officiel | Retombe sur l'heure PM/BM |
| Rainviewer | Radar précipitations 2 h | Message "Radar indisponible" |
| Nominatim | Géocodage adresses (carte EM) | Recherche désactivée |

### Fichiers de référence

| Fichier | Rôle |
|---|---|
| `index.html` + `src/*.js` | **Source de vérité** — 19 modules ES |
| `public_html/index.html` | **Production** — généré par `build.py`, ne jamais éditer à la main |
| `maintenance/propagation.json` | Calibration propagation (8 arcs) — à régénérer après chaque crue |
| `maintenance/calibrer_propagation.py` | Script de calibration (Hub'Eau + cross-corrélation) |
| `tests/check.py` | 12 contrôles d'intégrité, lancés automatiquement par `build.py` |
| `ROADMAP.md` | Ce document — pilotage du projet |

### Workflow de déploiement

```bash
python3 build.py
```
```bash
python3 -m http.server 8080 --directory public_html
```
```bash
vercel --prod
```

Un push sur `main` déclenche également un déploiement Vercel automatique (item 8.2).

---

## Phase 9 — Simplification (2026-08-30)

> Décidée après l'audit complet code + contenu du 2026-08-30. Objectif : **retirer**, pas ajouter.

### Constat chiffré

| Mesure | Aujourd'hui |
|---|---|
| Onglets | 10 |
| Corps HTML | 780 lignes |
| `src/*.js` | 5 134 lignes (19 modules) |
| Bundle production | 554 Ko (dont 227 Ko de JSON établissements sensibles) |
| Scripts CDN tiers | 4 — dont 2 jamais utilisés |
| Code strictement mort | ~540 lignes, livrées en production |

**Trois onglets sans données hydrométriques** — Presse (200 lignes HTML + 513 JS), Prévention (100 lignes, 11 liens), Webcams (118 lignes, 10 liens) — pèsent **54 % du corps HTML et 10 % du JS**.

**Quatre jeux de données affichés deux fois** — Météo, Sols, Nappes et Marées existent comme onglets pleins *et* comme couches de la carte état-major. Pas deux sources : les mêmes. `em-map.js` importe `METEO_DATA`/`SOL_DATA`/`NAPPES_DATA`/`MAREE_DATA` du même `state.js` et appelle les loaders des onglets.

**Deux vues tabulaires des mêmes stations** — « Historique » (12 h) et « Bassins & stations » lisent tous deux `OBS`/`HIST`. Deux tris d'un même tableau.

### Cible : 10 onglets → 4

| Onglet cible | Contenu | Origine |
|---|---|---|
| 🗺️ **Carte** | carte état-major, toutes ses couches (météo, sols, nappes, marée, radar, stations, établissements sensibles) | 9 — inchangé |
| 🏞️ **Stations** | liste par bassin, dépliable, série 12 h intégrée à la ligne station | 5 + 3 |
| 🌧️ **Contexte** | météo / sols / nappes empilés en trois blocs — conserve les graphiques de prévision 7 j | 6 + 7 + 11 |
| 📋 **Journal** | inchangé | 4 |
| ℹ️ Ressources | **modale** ouverte depuis l'en-tête, pas un onglet : numéros d'urgence, liens officiels, webcams, licence | 12 + 13 |

**Revue de presse : retirée.** Formulaire de saisie à 10 champs, géocodage Nominatim, sous-carte SIG, import/export JSON, validation de candidats RSS — un mini-CRM greffé sur un outil de vigilance. Suppression de `rp.js` (513 lignes), `panel10` (200 lignes) et `api/rss.js`.

**Contexte conservé comme onglet, pas supprimé.** Les couches carte montrent l'état instantané ; les graphiques Open-Meteo montrent la **prévision à 7 jours**, que la carte ne réplique pas. Or l'anticipation est la raison d'être de l'outil (voir Vision). Le gain est la fusion 3 → 1, pas la suppression.

### Gains attendus

| Mesure | Avant | Après |
|---|---|---|
| Onglets | 10 | 4 (+ 1 modale) |
| Corps HTML | 780 lignes | ~450 |
| `src/*.js` | 5 134 lignes | ~3 900 |
| Bundle | 554 Ko | ~505 Ko — puis **~275 Ko** avec 8.5 |
| Scripts CDN tiers | 4 | 2 (−215 Ko téléchargés à chaque visite) |

À 4 onglets la barre tient sans défilement sur un écran de téléphone : `.tabs-bar-wrap`, le dégradé `at-end` et l'un des deux gestionnaires clavier disparaissent **sans avoir à être corrigés**.

---

## Backlog

> Un seul tableau, items **ouverts uniquement**. Tout ce qui est livré part dans [Historique des versions](#historique-des-versions).

### 🔴 Priorité haute

> **9.1 est livré** (2026-08-30) — plus rien ne bloque les suppressions.

| # | Item | Effort | Dépend de | Critère de succès |
|---|---|---|---|---|
| **9.2** | **Supprimer le code mort** — `synth.js` (351 l., orphelin), `generatePdfReport` + `exportSituationGeoJSON` (151 l., `pdf.js:9-159`, aucun appelant), `makePopup`/`rainBarClass`/`renderTable`/`safeErrorMessage` (35 l.), 30+ imports inutilisés, 13 expositions `window` inutiles | ~1 h | ✅ 9.1 | 12/12 tests ; aucune régression visuelle sur les 10 onglets actuels |
| **9.3** | **Retirer les 2 CDN morts** — `html2canvas` (~200 Ko) et `leaflet.heat` : aucune occurrence dans `src/`. Nettoyer CSP et `sw.js` en conséquence | ~20 min | 9.2 | Chargement sans erreur console ; CSP et cache PWA alignés |

### 🟡 Priorité moyenne

| # | Item | Effort | Dépend de | Critère de succès |
|---|---|---|---|---|
| **9.4** | **Retirer la revue de presse** — `rp.js`, `panel10`, `api/rss.js`, entrées CSP `news.google.com` | ~1 h | ✅ 9.1 | Aucune référence résiduelle ; bundle allégé ; 12/12 tests |
| **9.5** | **Fusionner les onglets 10 → 4** — Stations (5+3), Contexte (6+7+11), Ressources en modale (12+13) | ~4 h | 9.4 | Aucune donnée perdue ; barre d'onglets sans défilement en 375 px ; `restoreTab` migre les numéros d'onglet enregistrés |
| **9.6** | **Simplifier la navigation par onglets** — `data-tab` à la place des 3 regex sur l'attribut `onclick` ; retirer le gestionnaire clavier dupliqué (`initTabKeyboard` en attache deux sur le même `role="tablist"`) | ~30 min | 9.5 | Navigation flèches/Home/End identique ; une seule attache d'événement |
| **9.7** | **Généraliser `fetchJson`** — 11 appels `fetch` bruts hors `utils.js` (dont Vigicrues, Rainviewer, Nominatim, établissements sensibles) sans timeout ni contrôle HTTP ; `modal.js:232` et `rp.js:167` réimplémentent l'AbortController à la main. Étendre `test_network_hygiene` au-delà de `data.js` | ~2 h | — | Aucun `await fetch(` hors `utils.js` ; le test échoue si un `fetch` brut réapparaît. **Absorbe et clôt 8.3.** |
| **9.8** | **Mutualiser l'appel `/api/vigicrues`** — appelé deux fois par chargement (`vigi.js:31` et `em-map.js:115`), sans cache partagé | ~30 min | 9.7 | Un seul appel réseau par cycle de rafraîchissement |
| **8.5** | **Chargement différé des établissements sensibles** — 227 Ko de JSON inlinés, soit 41 % du bundle, chargés même sans ouvrir la couche | ~2–4 h | ✅ 9.1 | Données chargées à l'ouverture de la couche seulement ; bundle < 300 Ko ; mesure de perf mobile documentée |

### 🟠 Priorité basse — qualité du code

| # | Item | Effort | Dépend de | Critère de succès |
|---|---|---|---|---|
| **9.9** | **Remplacer le bundler maison** — `build.py` contient ~100 lignes de regex (`strip_imports`/`strip_exports`) pour désassembler les modules ES, plus 2 tests dédiés à vérifier ce désassemblage. **Décision en attente** : esbuild (garde les modules ES, ajoute une dépendance Node) ou concaténation de scripts plats (zéro Node, perte de l'analyse statique) | ~2 h | ✅ 9.1 | `build.py` < 60 lignes ; tests 6 et 9 supprimés ou triviaux ; bundle identique fonctionnellement |
| **9.10** | **`state.js` : 19 setters → un objet muté** — les setters n'existent que parce que les bindings ES sont en lecture seule ; `export const S = {}` les supprime tous et allège les imports de 8 modules | ~1 h | 9.9 | `state.js` < 30 lignes ; aucun `set*(` résiduel |
| **9.11** | **Supprimer `vps/`** — 5 fichiers pour un VPS jamais déployé : `deploy.sh` référence `update_shom.py` qui n'existe plus, avec `VPS_IP="TON_IP_VPS"`. Vercel est l'hébergement exclusif depuis le 2026-06-30 | ~10 min | ✅ 9.1 | Dossier supprimé, aucune référence résiduelle |

### ⏳ Bloqués — en attente d'un épisode ≥ Jaune

| # | Item | Effort | Débloqué par | Critère de succès |
|---|---|---|---|---|
| **3.3** | Recalibration des arcs Trieux / Leff / Léguer (confiance 0.0) | ~1 h | Épisode ≥ Jaune, dans les 72 h | Confiance > 0.5 sur les 3 arcs |
| **7.5** | Test de l'onglet Journal en conditions réelles — jamais éprouvé depuis sa création | — | Épisode ≥ Jaune | `detectEvents`/`renderJournal` corrects, sans saut temporel |

### Séquencement recommandé

~~9.1~~ ✅ → **9.2 + 9.3 + 9.11** (suppressions prouvées, sans arbitrage) → **9.4** → **9.5 + 9.6** → **9.7 + 9.8** → **8.5** → **9.9 → 9.10**.

> ✅ **9.1 est terminé** (2026-08-30) : les sources sont sous git, toute suppression est désormais réversible. Les suppressions 9.2, 9.4 et 9.5 peuvent être engagées.

---

## Calibration propagation amont-aval

Script `calibrer_propagation.py` — cross-corrélation sur données Hub'Eau. Dernière calibration : 2026-06-14.

| Arc | Cours d'eau | Trajet | Transit | Confiance | Statut |
|---|---|---|---|---|---|
| `oust_1` | Oust | St-Martin → Hémonstoir | 6 h | **1.0 ★★★★★** | Corrélation confirmée — exploitable |
| `blavet_1` | Blavet | Kerien → Lanrivain | 3 h | 0.3 ⚠ | Relation simultanée (étiage) |
| `blavet_2` | Blavet | Lanrivain → Bon-Repos | 5 h | 0.3 ⚠ | Relation simultanée (étiage) |
| `gouessant_1` | Gouessant | Plédran → Andel | 4.5 h | 0.3 ⚠ | Relation simultanée (étiage) |
| `arguenon_1` | Arguenon | Plénée-Jugon → Jugon | 3 h | 0.3 ⚠ | Relation simultanée (étiage) |
| `trieux_1` | Trieux | St-Péver → St-Clet | 5 h (emp.) | 0.0 ❌ | Non calibré — item 3.3 |
| `leff_1` | Leff | Boqueho → Quemper | 6 h (emp.) | 0.0 ❌ | Non calibré — item 3.3 |
| `legueur_1` | Léguer | Belle-Isle → Pluzunet | 3 h (emp.) | 0.0 ❌ | Non calibré — item 3.3 |

> Les arcs à confiance 0 sont **exclus des alertes actives** (`arcsPending` dans `data.js`) pour éviter les fausses alertes — vérifié par `tests/check.py`.

---

## Risques identifiés

| Risque | Probabilité | Impact | Mitigation | Monitoring |
|---|---|---|---|---|
| ~~Sources non versionnées~~ | ✅ **Résorbé le 2026-08-30** | — | Item 9.1 livré : dépôt git à la racine, sources suivies | `git ls-files` doit lister `src/*.js` |
| Coupure API Hub'Eau | Faible | Élevé — H/Q indisponibles | Dernière valeur connue + bandeau | Contrôle visuel à chaque consultation |
| Réponse 429/503 d'une API publique | Moyenne | Moyen — données incomplètes en épisode | Timeout + une relance sur Hub'Eau/Open-Meteo/SHOM ; les autres flux restent à couvrir (9.7) | Erreurs console et bandeaux pendant un épisode |
| Arcs propagation jamais recalibrés | Moyenne | Moyen — alertes peu fiables | Relancer systématiquement après tout épisode ≥ Jaune | Date de `propagation.json` après chaque crue |
| Endpoint SHOM non documenté (`api/coefficient.js`) | Moyenne | Faible — fallback sur l'heure PM/BM | API interne découverte par rétro-ingénierie, sans contrat ; erreur 502 gérée côté front | `curl .../api/coefficient?days=1` après toute modif |
| Webcams et liens tiers morts | Élevée | Très faible | Portails officiels privilégiés aux flux YouTube (leçon v6.18) | Contrôle annuel des liens de la modale Ressources |
| Bundle > 800 Ko | Faible | Moyen — chargement lent en crise | 41 % du poids est le JSON établissements sensibles → item 8.5 | `ls -lh` avant chaque déploiement |
| Indisponibilité Vercel | Très faible | Élevé — outil inaccessible en crise | Copie locale servie par `python3 -m http.server` | Ping mensuel de l'URL |

---

## Maintenance récurrente

| Tâche | Fréquence | Action | Vérification |
|---|---|---|---|
| Recalibration propagation | < 72 h après chaque crue ≥ Jaune | `python3 maintenance/calibrer_propagation.py` | Confiances mises à jour dans `propagation.json` |
| Déploiement | Après chaque version | `vercel --prod` depuis la racine | URL de prod testée, taille vérifiée |
| Audit de taille | Avant chaque déploiement | `ls -lh public_html/index.html` | Alerter si > 800 Ko |
| Contrôle des liens Ressources | Annuel | Ouvrir les 21 liens de la modale | Aucun 404 ; remplacer les flux morts par des portails officiels |

---

## Protocole de validation avant déploiement

1. **Build + tests** : `python3 build.py` — les 12 contrôles doivent passer (le build s'annule sinon).
2. **Test local** : servir depuis `public_html/` (évite les blocages CORS).
3. **Contrôle visuel** : ouvrir chaque onglet, vérifier l'absence d'exception console et de section vide.
4. **Succès** : toutes les données chargent (hydro, météo, sols, nappes, propagation) ; aucune exception JS ; bundle < 800 Ko.
5. **Échec → rollback immédiat** : exception bloquante au chargement, test en échec, ou dégradation du temps de chargement > 2 s.
6. **Déploiement** : `vercel --prod` depuis la racine, puis vérification en production.

---

## Arbitrages et décisions

| Décision | Choix retenu | Justification | Date | À réviser si |
|---|---|---|---|---|
| Architecture backend | Aucun backend | Zéro coût, zéro maintenance serveur, déploiement immédiat | 2026-05 | Besoin de Web Push persistant ou multi-utilisateurs |
| Web Push persistant | Non planifié | Requiert serveur VAPID + base d'abonnés — hors contrainte "sans backend" | 2026-05 | Changement d'architecture |
| Propagation : embed vs fetch | Embed inline (`window.PROP_DATA`) | Zéro CORS ; calibration peu fréquente (< 1/mois) | 2026-06-27 | Calibration mensuelle ou plus |
| Hébergement | **Vercel exclusivement** | CDN global, déploiement en une commande, serverless sans surcoût | 2026-06-30 | Besoin d'un vrai backend (WebSocket, DB) |
| Vigilance affichée | **Flux officiel Vigicrues uniquement** | L'estimation locale par seuils donnait des couleurs divergentes de la source officielle — inacceptable pour un outil de crise | 2026-07-02 | Jamais |
| Marée | Open-Meteo Marine, m/MSL brut | Sans clé, sans snapshot ; pas de conversion CM ni de surcote chiffrée (les 3 points faibles du module v1 retiré) | 2026-07-02 | — |
| **Revue de presse** | **Retirée (item 9.4)** | Mini-CRM (saisie 10 champs, géocodage, SIG, import/export) pour 10 % du code, sans donnée hydrométrique. Annule de fait le correctif 7.2 | 2026-08-30 | Si un besoin de veille presse réapparaît, le rebâtir hors de cet outil |
| **Prévention + Webcams** | **Fusionnés en modale Ressources (9.5)** | Contenu conservé intégralement (21 liens), mais 218 lignes et 2 onglets pour du statique ne se justifient pas. Ne remet pas en cause 7.6/7.7, seulement leur emplacement | 2026-08-30 | — |
| **Météo / Sols / Nappes** | **Fusionnés en un onglet Contexte, pas supprimés** | Les couches carte montrent l'instantané, les graphiques la prévision 7 j — l'anticipation est la raison d'être de l'outil | 2026-08-30 | Si les couches carte absorbent la prévision |
| **Critère d'entrée fonctionnel** | Tout ajout doit aider à **anticiper ou décider pendant une crue** | La phase 9 corrige dix mois de croissance par ajout ; le critère existe pour éviter la récidive | 2026-08-30 | Jamais |

---

## Convention de versions

| Incrément | Signification |
|---|---|
| `vX.0` | Fonctionnalité majeure ou refonte |
| `vX.Y` | Amélioration ou correction notable |
| `vX.Y.Z` | Correctif ou mise à jour de données |

---

## Boucle de feedback post-crue

Après chaque épisode ≥ Jaune, **dans les 72 h suivant le pic** :

| Étape | Délai | Action | Vérification |
|---|---|---|---|
| 1. Recalibrer | J+1 | `python3 maintenance/calibrer_propagation.py` | Confiances mises à jour (débloque 3.3) |
| 2. Auditer le journal | J+2 | Vérifier détection et horodatage des franchissements | Journal complet, sans saut temporel (débloque 7.5) |
| 3. Comparer les prévisions | J+2 | KPI +3h/+6h Vigicrues vs observé | Écart < 20 % sur les horizons courts |
| 4. Mettre à jour la roadmap | J+3 | Reporter les confiances dans la table de calibration | Entrée à jour dans ce fichier |
| 5. Documenter | J+3 | Consigner toute leçon ayant modifié le comportement | Ligne ajoutée à l'historique |

---

## Historique des versions

> Descriptions condensées le 2026-08-30 : la leçon de chaque version est conservée, le détail d'implémentation est dans l'historique git.

### Phases 1 à 5 — construction (2026-05 → 2026-06-27)

| Date | Version | Description | Taille |
|---|---|---|---|
| 2026-05-10 | v0.1 | Premier prototype dashboard | ~120 Ko |
| 2026-05-30 | v1.0 | **Phase 1** — 27 stations, carte Leaflet, vigilance Vigicrues, météo, sols, radar, journal, carte de crise, nappes, vue bassins. Première mise en production | ~530 Ko |
| 2026-06-14 | v1.1 | **Phase 3.1** — calibration propagation amont-aval, 8 arcs | ~530 Ko |
| 2026-06-14 | v2.0 | **Phase 2** — modale station enrichie : graphique débit Q, prévisions Vigicrues +3h/+24h | ~536 Ko |
| 2026-06-27 | v3.0 | **Phase 3.2** — propagation intégrée à l'UI : bannière modale, badge carte, journal automatique | ~540 Ko |
| 2026-06-27 | v4.0 | **Phase 4** — alertes navigateur (Notification API) + seuils configurables | ~553 Ko |
| 2026-06-27 | v5.0 | **Phase 5.2/5.4** — export GeoJSON horodaté + vue mobile | ~557 Ko |
| 2026-06-27 | v6.0 | **Phase 5.1/5.3** — PWA hors-ligne (sw.js, manifest) + prévisions SCHAPI 48 h | ~562 Ko |

### Migration et fiabilisation (2026-06-29 → 2026-08-30)

| Date | Version | Description | Taille |
|---|---|---|---|
| 2026-06-29 | — | **Migration Hostinger → Vercel**, hébergement unique | 558 Ko |
| 2026-06-29 | v6.1 | Proxy RSS serverless (`api/rss.js`) — supprime la dépendance aux proxys CORS tiers | 558 Ko |
| 2026-06-29 | v6.3 | `PROP_DATA` consolidé en source unique (`window.PROP_DATA`) | 546 Ko |
| 2026-07-01 | v6.5 | **Suppression complète du module marée v1** — cotes CM, surcote barométrique et vent jugées non fiables. *Leçon : ne pas publier de valeur chiffrée qu'on ne sait pas valider.* | 508 Ko |
| 2026-07-02 | v6.6 | **Vigilance : retrait de l'estimation locale** — seul le flux officiel Vigicrues fait foi (N/A sinon). Popups carte enrichis | 522 Ko |
| 2026-07-02 | v6.7 | **Marée v2** — reconçue en couche carte, Open-Meteo Marine, m/MSL brut, sans coefficient ni surcote | 528 Ko |
| 2026-07-03 | v6.8 | **Nappes v2** — niveau exprimé en percentile de la chronique du même mois (approche BRGM) au lieu de la profondeur absolue. Quantiles en cache 30 j | 533 Ko |
| 2026-08-04 | v6.9 | Nettoyage code mort + rattrapage de l'historique git (dépôt figé depuis 8 versions) | 532 Ko |
| 2026-08-15 | v6.10 | `hostinger_deploy/` → `vercel_deploy/` | 532 Ko |
| 2026-08-19 | v6.11 | Fix double-clic carte de crise ; fix géocodage presse (`addresstype` Nominatim) | 532 Ko |
| 2026-08-19 | v6.12–13 | **Retrait du jargon S1/S2/S3** — modale puis popups carte. *Leçon : la seconde passe a été nécessaire parce que la première n'avait pas cherché toutes les occurrences.* | 531 Ko |
| 2026-08-19 | v6.14 | Trait vertical "moment présent" sur le graphique de précipitations | 532 Ko |
| 2026-08-19 | v6.15–16 | **Onglet Prévention** (7.6) — ressources officielles, APIC | 538 Ko |
| 2026-08-19 | v6.17–18 | **Onglet Webcams** (7.7) — 9 webcams littoral. *Leçon : les flux YouTube live meurent vite, préférer les portails officiels.* | 543 Ko |
| 2026-08-20 | v6.19–20 | **Fuseau Europe/Paris** — `TZ_LOCAL` fixé, 6 points forçant UTC corrigés. *Leçon : v6.19 avait corrigé le fuseau utilisé mais pas son état initial — un correctif doit couvrir l'état par défaut.* | 543 Ko |
| 2026-08-20 | v6.21 | **Fix trait "maintenant"** — `nowStrParis()` : les séries Open-Meteo arrivent déjà en heure Paris sans suffixe, les comparer à un ISO UTC décalait de 2 h. Même bug corrigé dans `em-map.js` et `synth.js` | 543 Ko |
| 2026-08-20 | v6.22 | **Licence GNU GPL v3** — `LICENSE`, notice HTML, section dans l'onglet Prévention | 545 Ko |
| 2026-08-20 | v6.23 | Détection du radar RainViewer indisponible (`tileerror`, debounce 1,5 s). *Leçon : un service tiers muet en échec est pire qu'une erreur affichée.* | 546 Ko |
| 2026-08-20 | v6.24 | **Coefficients de marée SHOM officiels** — `api/coefficient.js`, proxy de l'API interne `maree.shom.fr` | 550 Ko |
| 2026-08-20 | v6.25–26 | **Indicateur dépression / surcote** — signal qualitatif seulement (leçon v6.5), puis bandeau proactif d'anticipation à 3 jours sur l'onglet Carte | 553 Ko |
| 2026-08-29 | — | Hygiène du dépôt local : orphelins `.fuse_hidden*`, `_to_delete/`, `.DS_Store` ; dernière mention `hPanel` retirée (8.4) | 553 Ko |
| 2026-08-29 | — | **Sécurité** (8.1, 8.2) : jeton GitHub exposé révoqué, `origin` passé en SSH ; déploiement Vercel automatique depuis `main` | — |
| 2026-08-30 | v6.27 | **Fiabilisation API** (8.3 partiel) — `fetchJson()` sur Hub'Eau/Open-Meteo/SHOM : timeout 10 s, contrôle HTTP, une relance sur 429/5xx. Proxys CORS publics retirés | 554 Ko |
| 2026-08-30 | v7.0 | **9.1 — Sources versionnées, `vercel_deploy/` supprimé** : le dépôt git ne suivait que le fichier généré ; `src/` (5 134 l.), `build.py`, `tests/`, `index.html` de dev et ROADMAP.md n'existaient que sur un disque. Plutôt que de remonter le `.git` d'un niveau — ce qui aurait renommé tous les chemins suivis et imposé de changer le Root Directory Vercel (impossible via la CLI) — c'est le **contenu** de `vercel_deploy/` qui est remonté à la racine, `.git` compris. Les chemins suivis restent identiques (`public_html/index.html`), le Root Directory `public_html` n'est pas touché, et le commit est une pure addition sans un seul renommage. Chemins mis à jour dans `build.py`, `tests/check.py`, `serve.py`, `.claude/launch.json`, `README_DEPLOIEMENT.md`. `public_html/index.html` régénéré **bit pour bit identique** à la version déployée. 12/12 tests, 554 Ko | 554 Ko |
| 2026-08-30 | — | **Audit complet code + contenu** → ouverture de la [phase 9](#phase-9--simplification-2026-08-30). Constats : sources non versionnées (9.1), ~540 lignes mortes en production, 2 CDN inutilisés, 54 % du HTML sans donnée hydrométrique, 4 jeux de données affichés deux fois. ROADMAP consolidée : 445 → 271 lignes, 8 sections de backlog fusionnées en une, 28 items livrés déplacés dans cet historique | 554 Ko |
