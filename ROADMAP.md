# Roadmap — Vigilance 22

> Outil de surveillance hydrométrique temps réel — Côtes-d'Armor (22)
> Production : https://vigilance-des-crues.vercel.app
> Dernière mise à jour : 2026-08-30 — phase 9 terminée, retrait 9.13

---

## Résumé exécutif

Application **en production et opérationnelle**. Phases 1 à 5 livrées : tableau de bord 27 stations, modale enrichie avec prévisions Vigicrues, propagation amont-aval, alertes navigateur, PWA hors-ligne, carte état-major.

Le backlog fonctionnel est **entièrement livré**. Les deux seuls items fonctionnels ouverts (3.3 recalibration, 7.5 test Journal) sont bloqués sur un épisode de vigilance ≥ Jaune.

**Le projet change de phase.** L'audit du 2026-08-30 montre que la croissance par ajout a produit un décalage net entre le poids du code et sa valeur opérationnelle : 54 % du HTML et 10 % du JS servent trois onglets qui n'affichent aucune donnée hydrométrique, et quatre onglets présentent des données déjà visibles sur la carte. La **phase 9 est une phase de retrait** : ramener l'application à ce qu'elle fait vraiment, sans rien perdre de sa capacité de surveillance.

**Phase 9 terminée le 2026-08-30.** Sources versionnées, code mort éliminé, revue de presse retirée, onglets 10 → 4, réseau fiabilisé et JSON des établissements sensibles différé. **Bundle 554 → 256 Ko** (−54 %), `src/` 5 134 → 4 045 lignes, 4 → 2 scripts CDN tiers. Les deux seuls items ouverts (3.3, 7.5) attendent un épisode de vigilance ≥ Jaune. Le dépôt git couvre désormais `src/`, `build.py`, `tests/`, `index.html` et ce document. Le dossier `vercel_deploy/` a disparu : son contenu est remonté à la racine, qui est aussi la racine du dépôt. Les chemins servis par Vercel sont inchangés, le Root Directory `public_html` n'a pas été touché. Le reste de la phase 9 peut être engagé.

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

| Mesure | Au constat (2026-08-30) | Après 9.1–9.3, 9.11 | Cible phase 9 |
|---|---|---|---|
| Onglets | 10 | **4 (+ 1 modale)** ✅ | atteint |
| Corps HTML | 780 lignes | **570** | ~450 — non atteint, mais plus rien d'inutile à retirer |
| `src/*.js` | 5 134 l. (19 modules) | **4 045 l. (17)** | ~3 400 — écart assumé, le reste est du code utile |
| Bundle production | 554 Ko | **256 Ko** ✅ | dépassé (~235 visé) |
| Scripts CDN tiers | 4 — dont 2 morts | **2** | 2 |
| Code strictement mort | ~540 lignes | **0** | 0 |

**Trois onglets sans données hydrométriques** — Presse (200 lignes HTML + 513 JS), Prévention (100 lignes, 11 liens), Webcams (118 lignes, 10 liens) — pèsent **54 % du corps HTML et 10 % du JS**.

**Quatre jeux de données affichés deux fois** — Météo, Sols, Nappes et Marées existent comme onglets pleins *et* comme couches de la carte état-major. Pas deux sources : les mêmes. `em-map.js` importe `METEO_DATA`/`SOL_DATA`/`NAPPES_DATA`/`MAREE_DATA` du même `state.js` et appelle les loaders des onglets.

**Deux vues tabulaires des mêmes stations** — « Historique » (12 h) et « Bassins & stations » lisent tous deux `OBS`/`HIST`. Deux tris d'un même tableau.

### Cible : 10 onglets → 4

| Onglet cible | Contenu | Origine |
|---|---|---|
| 🗺️ **Carte** | carte état-major, toutes ses couches (météo, sols, nappes, marée, radar, stations, établissements sensibles) — consultation seule depuis 9.13 | 9 |
| 🏞️ **Stations** | liste par bassin, dépliable, série 12 h intégrée à la ligne station | 5 + 3 |
| 🌧️ **Contexte** | météo / sols en deux blocs — conserve les graphiques de prévision 7 j | 6 + 7 |
| 📋 **Journal** | inchangé | 4 |
| ℹ️ Ressources | **modale** ouverte depuis l'en-tête, pas un onglet : numéros d'urgence, liens officiels, webcams, licence | 12 + 13 |

**Revue de presse : retirée.** Formulaire de saisie à 10 champs, géocodage Nominatim, sous-carte SIG, import/export JSON, validation de candidats RSS — un mini-CRM greffé sur un outil de vigilance. Suppression de `rp.js` (513 lignes), `panel10` (200 lignes) et `api/rss.js`.

**Contexte conservé comme onglet, pas supprimé.** Les couches carte montrent l'état instantané ; les graphiques Open-Meteo montrent la **prévision à 7 jours**, que la carte ne réplique pas. Or l'anticipation est la raison d'être de l'outil (voir Vision). Le gain est la fusion 3 → 1, pas la suppression.

### 9.13 — Annotation de la carte et chapitre nappes retirés (2026-08-30)

Deux retraits demandés après usage réel, dans la ligne du critère de tri de la [Vision](#vision).

**Carte : tout l'outillage d'annotation.** Post-it, tracés, polygones, cercles, palette de six couleurs, gomme, « tout effacer », horodatage, export/import GeoJSON et sauvegarde de session. Personne n'annote une carte de vigilance en salle de crise : on la lit, et on l'imprime. Le bouton **🖨 Imprimer** est conservé — c'est le seul export qui servait. Supprimé : 25 fonctions d'`em-map.js`, la barre d'outils de dessin, la palette, la barre flottante de tracé, 9 expositions `window`, les gestionnaires `click`/`mousemove`/`dblclick`/`contextmenu` de la carte, les raccourcis Entrée/Échap et le `featureGroup` d'annotations. La « sauvegarde » ne survivait de toute façon pas au rechargement : depuis un correctif antérieur elle écrivait dans une variable de module (`EM_MEMORY`), pas dans `localStorage`.

**Contexte : le chapitre Nappes phréatiques.** Un piézomètre haut est d'abord un indicateur de recharge — le signal opérationnel de sécheresse, pas d'inondation. La carte conserve sa couche 💧 pour qui veut le détail ponctuel ; `nappePctClass` reste dans `meteo.js` pour la colorer, et `loadNappes` n'alimente plus que cette couche. Supprimé : `renderNappes`, `nappeJauge`, `nappeFloodHint`, `nappeCardClass`, le bloc CSS `.nappe-*` (15 règles), la synthèse départementale et la grille de 30 cartes.

`switchTab` ne charge plus les nappes à l'ouverture de Contexte : l'onglet gagne **30 requêtes Hub'Eau** au premier affichage. Bundle 256 → 227 Ko. 12/12 tests, vérifié en production.

### Gains attendus

| Mesure | Avant | Après |
|---|---|---|
| Onglets | 10 | 4 (+ 1 modale) |
| Corps HTML | 780 lignes | ~450 |
| `src/*.js` | 5 134 lignes | ~3 900 |
| Bundle | 554 Ko | ~505 Ko — puis **~275 Ko** avec 8.5 (529 Ko atteints) |
| Scripts CDN tiers | 4 | 2 (−215 Ko téléchargés à chaque visite) |

À 4 onglets la barre tient sans défilement sur un écran de téléphone : `.tabs-bar-wrap`, le dégradé `at-end` et l'un des deux gestionnaires clavier disparaissent **sans avoir à être corrigés**.

---

## Backlog

> Un seul tableau, items **ouverts uniquement**. Tout ce qui est livré part dans [Historique des versions](#historique-des-versions).

> **La phase 9 est terminée** (2026-08-30) : 9.1 → 9.8, 9.11 et 8.5 livrés.
> 9.9 abandonné et 9.10 déclassé — voir [Arbitrages](#arbitrages-et-décisions).
> Il ne reste que les deux items bloqués par la météo.


### 🟠 Priorité basse — non planifié

| # | Item | Statut |
|---|---|---|
| **9.10** | `state.js` : 18 setters → un objet muté | **Déclassé** — 324 références sur 15 fichiers pour un gain purement esthétique, sur un outil où la justesse prime. À ne reprendre que si `state.js` doit évoluer pour une autre raison |


### ⏳ Bloqués — en attente d'un épisode ≥ Jaune

| # | Item | Effort | Débloqué par | Critère de succès |
|---|---|---|---|---|
| **3.3** | Recalibration des arcs Trieux / Leff / Léguer (confiance 0.0) | ~1 h | Épisode ≥ Jaune, dans les 72 h | Confiance > 0.5 sur les 3 arcs |
| **7.5** | Test de l'onglet Journal en conditions réelles — jamais éprouvé depuis sa création | — | Épisode ≥ Jaune | `detectEvents`/`renderJournal` corrects, sans saut temporel |

### Séquencement recommandé

Livré dans l'ordre : **9.1** (versionner) → **9.2 + 9.3 + 9.11** (code mort, CDN, vps) →
**9.4** (revue de presse) → **9.5** (onglets 10 → 4) → **9.6 + 8.5 + 9.7 + 9.8**
(navigation, JSON différé, réseau).

Chaque étape a été vérifiée en production avant de passer à la suivante :
12/12 contrôles, syntaxe ES des modules, absence de référence résiduelle,
comparaison bit-à-bit du fichier servi avec le build local, et parcours
navigateur (onglets, console, requêtes réseau).

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
| **Modifier `public_html/index.html` à la main** au lieu des sources | Faible depuis 9.1 — c'est arrivé le 2026-08-30 (agent Codex, qui ne voyait que ce fichier : les sources n'étaient pas versionnées) | Élevé — le prochain `build.py` écrase silencieusement la modification | Toujours modifier `src/` puis rebuilder ; le contrôle 9 (`build_is_current`) détecte la désynchronisation mais **pas** une prod plus récente que les sources | `AGENTS.md` + `CLAUDE.md` énoncent la règle à tout agent ouvrant le dépôt. Après tout `git pull`, lancer `python3 tests/check.py` **seul** — via `build.py` le contrôle est tautologique, la prod étant réécrite avant le test |
| Coupure API Hub'Eau | Faible | Élevé — H/Q indisponibles | Dernière valeur connue + bandeau | Contrôle visuel à chaque consultation |
| Réponse 429/503 d'une API publique | Moyenne | Moyen — données incomplètes en épisode | Timeout + une relance sur Hub'Eau/Open-Meteo/SHOM ; les autres flux restent à couvrir (9.7) | Erreurs console et bandeaux pendant un épisode |
| Arcs propagation jamais recalibrés | Moyenne | Moyen — alertes peu fiables | Relancer systématiquement après tout épisode ≥ Jaune | Date de `propagation.json` après chaque crue |
| Endpoint SHOM non documenté (`api/coefficient.js`) | Moyenne | Faible — fallback sur l'heure PM/BM | API interne découverte par rétro-ingénierie, sans contrat ; erreur 502 gérée côté front | `curl .../api/coefficient?days=1` après toute modif |
| ~~Table Historique tronquée sous ~1100 px~~ — ✅ **corrigé le 2026-08-30** : `.t12{table-layout:auto;width:auto;min-width:100%}` + `overflow:visible` sur les cellules ; le tableau défile désormais dans `.t12-wrap` (970 px pour 508 de conteneur, valeurs complètes). Ancien libellé : — la règle globale `table{width:100%;table-layout:fixed}` (index.html:138) prime sur `.t12`, qui ne la surcharge pas : au lieu de défiler dans `.t12-wrap` (pourtant en `overflow-x:auto`), la table se comprime et `td{text-overflow:ellipsis}` tronque les valeurs en « 0… ». **Antérieur à la phase 9**, repéré en vérifiant 9.5 | Certaine sous ~1100 px | Moyen — relevés illisibles sur mobile, sur un outil de terrain | Correctif d'une ligne : `.t12{table-layout:auto;width:auto}`. Non appliqué — hors périmètre de 9.5, à arbitrer | Ouvrir l'onglet Stations en 375 px |
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
| **9.9 — remplacer le bundler** | **Abandonné** | La ROADMAP annonçait « ~100 lignes de regex » : il y en a 44 sur 198, avec des motifs ancrés (`^import`, `^export`), aucun cas piégeux dans ce code, et **deux contrôles dédiés** (aucun résidu import/export + synchronisation bit-à-bit sources/build). Passer à esbuild ajouterait npm, package.json et une dépendance réseau au build d'un projet qui n'a **aucune dépendance JS** — l'inverse de « le plus simple possible » | 2026-08-30 | Si le bundler casse réellement, ou si le projet acquiert un toolchain Node pour une autre raison |
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
| 2026-08-30 | v7.0 | **9.1 — Sources versionnées, `vercel_deploy/` supprimé** : le dépôt git ne suivait que le fichier généré ; `src/` (5 134 l.), `build.py`, `tests/`, `index.html` de dev et ROADMAP.md n'existaient que sur un disque. Plutôt que de remonter le `.git` d'un niveau — ce qui aurait renommé tous les chemins suivis et imposé de changer le Root Directory Vercel (impossible via la CLI) — c'est le **contenu** de `vercel_deploy/` qui est remonté à la racine, `.git` compris. Les chemins suivis restent identiques (`public_html/index.html`), le Root Directory `public_html` n'est pas touché, et le commit est une pure addition sans un seul renommage. Chemins mis à jour dans `build.py`, `tests/check.py`, `serve.py`, `.claude/launch.json`, `README_DEPLOIEMENT.md`. `public_html/index.html` régénéré **bit pour bit identique** à la version déployée. 12/12 tests. **Incident révélateur au moment du push** : deux commits distants (`9228cd1`, `8085eda`, poussés le matin même) modifiaient `public_html/index.html` sans que les sources correspondantes existent dans le dépôt — reconstruire depuis `src/` les aurait purement et simplement écrasés. Changements rapatriés à la main dans `index.html` (CSS nappes + barre d'outils carte), `src/meteo.js` (`renderNappes` réécrite, `nappeFloodHint`, `nappeCardClass`), `src/globals.js`, `src/em-map.js` et `src/synth.js` (fond CARTO → OSM). Vérifié par reproduction **bit pour bit** de la prod distante depuis les sources. Déploiement automatique confirmé Ready en 7 s, production HTTP 200. | 556 Ko |
| 2026-08-30 | v7.1 | **9.2 + 9.3 + 9.11 — 1 610 lignes supprimées** : `synth.js` entier (module orphelin, `renderSynthese` jamais appelée) ; `generatePdfReport` et `exportSituationGeoJSON` (exposées sur `window`, aucun bouton ne les appelait) ; `makePopup`, `rainBarClass`, `renderTable`, `safeErrorMessage`, `refBadge`, `emRemoveLayer` ; 12 expositions `window` sans appelant sur 67 ; 42 imports inutilisés nettoyés jusqu'à point fixe ; CDN `html2canvas` (~200 Ko) et `leaflet.heat`, absents des sources, retirés d'`index.html` et du préchargement `sw.js` ; dossier `vps/` (5 fichiers, VPS jamais déployé). **Découverte** : `toggleFav`/`toggleFavorite` étaient injoignables — la fonctionnalité favoris était déjà morte, `FAVORITES` et `DEFAULT_FAVORITES` retirées avec elles. Conservées `toggleBV` et `rpDeleteArticle` (appelées depuis des `onclick` générés) et `loadMaree` (`window.loadMaree?.()`) — le piège étant qu'un `onclick` généré s'exécute en portée globale même quand la chaîne vit dans le module qui définit la fonction. 18/18 modules de syntaxe ES valide, 12/12 tests, zéro référence résiduelle. 554 → 529 Ko | 529 Ko |
| 2026-08-30 | v7.2 | **9.4 — Revue de presse retirée** : `rp.js` (513 l.), `panel10` et son bloc CSS (292 l. d'`index.html`), fonction serverless `api/rss.js`, `RP_BASSINS`/`RP_NIV`, `rpInit`, 11 expositions `window`, entrée CSP `news.google.com`. Le contrôle « aucun proxy CORS public tiers » de `tests/check.py` lisait `rp.js` : réécrit pour balayer toutes les sources, il est désormais plus strict qu'avant. `restoreTab` gérait déjà le repli d'un onglet mémorisé disparu. Onglets 10 → 9, bundle 529 → 484 Ko | 484 Ko |
| 2026-08-30 | v7.3 | **9.5 — Onglets 9 → 4** : Carte (inchangé) · Stations (bassins + historique 12 h) · Contexte (météo + sols + nappes) · Journal (inchangé) · Ressources (prévention + webcams) sortis en modale depuis l'en-tête. Contenu déplacé sans réécriture, sous des titres de section `.sect-sep`. Vérifié par mesure avant/après dans le navigateur : Stations 5 381 → 5 476 car., Contexte 10 228 → 10 346, Ressources 3 848 → 3 930 — les écarts sont exactement les nouveaux titres ; 15 et 21 liens, 10 canvas conservés. `switchTab` : l'onglet 5 déclenche `renderBassins` + `renderHist`, l'onglet 6 charge météo/sols/nappes ; branches 3, 7 et 11 retirées. Deux textes rendus faux par la fusion corrigés (« Cet onglet ne remplace pas les consignes officielles », renvoi « onglet Météo » d'un popup carte). **Barre d'onglets à 375 px : `scrollWidth` = `clientWidth` = 375, plus aucun défilement horizontal sur mobile.** | 484 Ko |
| 2026-08-30 | — | **Commit parasite `a165e48`** — intitulé « Carte : jauges de saturation des sols à la place des cercles », il ne contient **pas** cette modification : son unique changement fait *reculer* le `CACHE_NAME` de `sw.js` (1814 → 1613), signature d'un commit fait depuis une copie de travail périmée. Origine : une session d'agent (Grok) interrompue en cours de route. Vérifié avant fusion — aucune source manquante, rien dans son bundle d'absent du nôtre ; état conservé et `CACHE_NAME` ré-horodaté par un rebuild. **Ne pas se fier à son message.** Si le travail sur les jauges a existé, il n'a jamais été commité. | — |
| 2026-08-30 | — | **Nettoyage** : `public_html/.vercel/` (doublon exact de `.vercel/` racine), `public_html/.gitignore` (redondant depuis 9.1) et `__pycache__/` supprimés | — |
| 2026-08-30 | v7.4 | **9.6 + 8.5 + 9.7 + 9.8 — fin de la phase 9.** *9.6* : `data-tab` remplace les 3 regex lisant l'attribut `onclick`, un seul gestionnaire (clic délégué + clavier) au lieu de deux sur le même `role="tablist"`. *8.5* : les sources chargeaient déjà le JSON des établissements sensibles à la demande — c'est `build.py` qui cassait la paresse en l'inlinant ; l'item revenait donc à **retirer** du code. Le fichier (227 Ko) est servi à part et mis en cache par le service worker au premier accès. **Bundle 483 → 256 Ko.** *9.7* : les 7 derniers `fetch` bruts passent par `fetchJson` (dont 4 réimplémentaient l'AbortController sans contrôle HTTP ni relance) ; le test échoue désormais si un `fetch` brut réapparaît. *9.8* : `/api/vigicrues` était appelé deux fois par cycle — mémoïsation de la **promesse en vol** (la première tentative, qui ne mémoïsait que le résultat, laissait les deux appels concurrents rater le cache vide ; corrigé après vérification en production). Au passage, la table Historique ne tronque plus ses valeurs sous 1100 px. 12/12 tests | 256 Ko |
| 2026-08-30 | v7.5 | **9.13 — Annotation de la carte et chapitre nappes retirés** : 25 fonctions d'`em-map.js` (dessin, post-it, cercles, gomme, horodatage, export/import GeoJSON, sauvegarde), la barre d'outils de dessin, la palette, la barre flottante de tracé, 9 expositions `window` et les 4 gestionnaires de souris de la carte ; côté Contexte, `renderNappes` et ses trois auxiliaires, le CSS `.nappe-*` et le chapitre HTML. **🖨 Imprimer conservé** — le seul export qui servait. *Constat au passage* : la « sauvegarde » d'annotations écrivait dans une variable de module (`EM_MEMORY`), pas dans `localStorage` — elle ne survivait pas au rechargement, donc rien à migrer. `loadNappes` et `nappePctClass` restent : la couche 💧 de la carte en dépend. L'onglet Contexte économise 30 requêtes Hub'Eau à l'ouverture. 12/12 tests, syntaxe du bundle validée, comportement vérifié sur la production déployée. 256 → 227 Ko | 227 Ko |
| 2026-08-30 | — | **Audit complet code + contenu** → ouverture de la [phase 9](#phase-9--simplification-2026-08-30). Constats : sources non versionnées (9.1), ~540 lignes mortes en production, 2 CDN inutilisés, 54 % du HTML sans donnée hydrométrique, 4 jeux de données affichés deux fois. ROADMAP consolidée : 445 → 271 lignes, 8 sections de backlog fusionnées en une, 28 items livrés déplacés dans cet historique | 554 Ko |
