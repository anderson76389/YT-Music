# Audit des 34 plugins — YT Music (mise à jour 3.12.1)

**Date :** 12 octobre 2026  
**Code audité :** [dépôt YT-Music](https://github.com/anderson76389/YT-Music)  
**Journal des tests automatiques :** [GitHub Actions #38192084563](https://github.com/anderson76389/YT-Music/actions/runs/38192084563)

## Périmètre et résultats vérifiés

- **34 points d’entrée de plugins** conservés après la suppression de huit plugins et de leurs ressources. Les libellés « Beta » ont été retirés en français et en anglais.
- Sur **Windows** : installation des dépendances, lint, vérification TypeScript, seize tests Playwright (dont sept pour Anti-Pause : trois anti-inactivité et quatre saut publicitaire) et compilation Electron **réussis**.
- **Formatage non conforme** : `pnpm format:check` signale 339 fichiers ; le workflow échoue donc au total. Le lint est toutefois passé.
- Les **seize tests unitaires** couvrent notamment le tri de segments SponsorBlock, l'analyse des paroles LRC, les menus intégrés, une **simulation accélérée de 30 minutes** d'Anti-Pause ainsi que quatre scénarios de saut et restauration audio après une publicité fictive. Ils ne valident pas le fonctionnement réel du service YouTube Music.
- **Aucun test fonctionnel de bout en bout** n’a été réalisé dans une application Windows ouverte et connectée au service YouTube Music. Ni les intégrations tierces, ni la stabilité des sélecteurs DOM, ni les flux de téléchargement ne peuvent être déclarés validés.

## Inventaire complet et contrôle fonctionnel restant

| Plugin | Fonction à vérifier dans l’application | Validation réelle |
|---|---|---|
| [`album-actions`](../src/plugins/album-actions/index.tsx) | Boutons d’action de masse sur les albums et listes | À tester en application |
| [`album-color-theme`](../src/plugins/album-color-theme/index.ts) | Thème dérivé des couleurs de la pochette | À tester en application |
| [`ambient-mode`](../src/plugins/ambient-mode/index.ts) | Éclairage ambiant et animations | À tester en application |
| [`amuse`](../src/plugins/amuse/index.ts) | Intégration Amuse | À tester en application |
| [`anti-pause`](../src/plugins/anti-pause/index.ts) | Anti-inactivité, suppression des menus et annonces — **nettoyage corrigé, à tester en conditions réelles** | À tester en application |
| [`audio-compressor`](../src/plugins/audio-compressor.ts) | Compression dynamique du son | À tester en application |
| [`blur-nav-bar`](../src/plugins/blur-nav-bar/index.ts) | Effet de flou de la barre de navigation | À tester en application |
| [`captions-selector`](../src/plugins/captions-selector/index.ts) | Sélection et chargement de sous-titres | À tester en application |
| [`crossfade`](../src/plugins/crossfade/index.ts) | Fondu entre titres — **répétition d’un titre non prise en charge** | À tester en application |
| [`custom-output-device`](../src/plugins/custom-output-device/index.ts) | Choix de la sortie audio | À tester en application |
| [`disable-autoplay`](../src/plugins/disable-autoplay/index.ts) | Désactivation de la lecture automatique | À tester en application |
| [`do-not-track`](../src/plugins/do-not-track/index.ts) | Blocage des requêtes de suivi selon le plugin | À tester en application |
| [`downloader`](../src/plugins/downloader/index.ts) | Téléchargement de pistes/playlists et conversion audio | À tester en application |
| [`equalizer`](../src/plugins/equalizer/index.ts) | Égaliseur et préréglages | À tester en application |
| [`exponential-volume`](../src/plugins/exponential-volume/index.ts) | Courbe de volume | À tester en application |
| [`in-app-menu`](../src/plugins/in-app-menu/index.ts) | Barre de titre et menu intégré | À tester en application |
| [`navigation`](../src/plugins/navigation/index.tsx) | Boutons précédent/suivant | À tester en application |
| [`notifications`](../src/plugins/notifications/index.ts) | Notifications système | À tester en application |
| [`performance-improvement`](../src/plugins/performance-improvement/index.ts) | Scripts CPU et optimisations d’affichage | À tester en application |
| [`picture-in-picture`](../src/plugins/picture-in-picture/index.ts) | Image dans l’image | À tester en application |
| [`playback-speed`](../src/plugins/playback-speed/index.ts) | Réglage de vitesse de lecture | À tester en application |
| [`precise-volume`](../src/plugins/precise-volume/index.ts) | Réglage numérique précis du volume | À tester en application |
| [`quality-changer`](../src/plugins/quality-changer/index.tsx) | Sélecteur de qualité vidéo/audio — **arrêt potentiellement fragile** | À tester en application |
| [`skip-disliked-songs`](../src/plugins/skip-disliked-songs/index.ts) | Passage automatique des titres non aimés | À tester en application |
| [`skip-silences`](../src/plugins/skip-silences/index.ts) | Détection et saut des silences | À tester en application |
| [`sponsorblock`](../src/plugins/sponsorblock/index.ts) | Segments SponsorBlock — test unitaire du tri uniquement | À tester en application |
| [`synced-lyrics`](../src/plugins/synced-lyrics/index.ts) | Recherche, analyse LRC et synchronisation des paroles — parser LRC testé | À tester en application |
| [`taskbar-mediacontrol`](../src/plugins/taskbar-mediacontrol/index.ts) | Commandes de lecture dans la barre des tâches Windows | À tester en application |
| [`touchbar`](../src/plugins/touchbar/index.ts) | Commandes Touch Bar macOS | À tester en application |
| [`transparent-player`](../src/plugins/transparent-player/index.ts) | Fenêtre transparente | À tester en application |
| [`tuna-obs`](../src/plugins/tuna-obs/index.ts) | Intégration Tuna/OBS | À tester en application |
| [`unobtrusive-player`](../src/plugins/unobtrusive-player/index.ts) | Lecture/affichage discret | À tester en application |
| [`video-toggle`](../src/plugins/video-toggle/index.tsx) | Affichage et masquage de la vidéo | À tester en application |
| [`visualizer`](../src/plugins/visualizer/index.ts) | Visualiseurs et graphiques réactifs à l’audio | À tester en application |

## Défauts et risques effectivement identifiés dans le code

### 1. Anti-Pause & Purge Totale — modifications réalisées, validation réelle encore requise

[`src/plugins/anti-pause/index.ts`](../src/plugins/anti-pause/index.ts) a été modifié. Le plugin installe désormais un bloqueur réseau Ghostery **AdsOnly** (filtrage avant chargement, avec cache et repli si réseau indisponible), ainsi qu'un saut publicitaire DOM conservé en secours. Le son muet et la vitesse de lecture antérieurs sont restaurés après une annonce ; quatre tests automatisés couvrent les transitions ad / non-ad, le son volontairement muet et les changements de vidéo. Le code ne retire plus les boutons de paramètres ni les menus normaux de YouTube Music.

Le plugin rafraîchit la valeur `_lact` toutes les 15 secondes et tente de fermer `ytmusic-you-there-renderer` si la fenêtre d'inactivité apparaît. Les minuteries, observateurs et écouteurs sont désormais libérés à la désactivation.

**Test automatisé :** un scénario de 30 minutes **simulées** a vérifié la régularité du rafraîchissement, l'arrêt du heartbeat et la tentative de fermeture d'une modale fictive. Cela **ne prouve pas** que le lecteur YouTube Music ne suspendra pas la lecture après 30 minutes réelles.

**Risques résiduels :** listes publicitaires parfois incomplètes, filtres susceptibles d'affecter des requêtes légitimes, changements d'interface côté YouTube Music ; efficacité et absence totale de flash non confirmées dans un lecteur réel.

Ce plugin est **activé par défaut** dans `src/config/defaults.ts`.

### 2. Crossfade — limitation déclarée dans le code

[`src/plugins/crossfade/index.ts`](../src/plugins/crossfade/index.ts) comporte explicitement le commentaire `does not support "repeat 1" mode`. Cette option n’est donc **pas prise en charge** par la logique de transition actuelle. Le comportement sur les autres modes reste à tester sur le lecteur réel.

### 3. Quality Changer et Album Actions — points fragiles

- Le nettoyage de [Quality Changer](../src/plugins/quality-changer/index.tsx) retire un élément du DOM en supposant qu’il se trouve encore dans le conteneur d’origine.
- [Album Actions](../src/plugins/album-actions/index.tsx) utilise une assertion non nulle sur `#browse-page`, dont l’existence dépend du chargement réel de la page.

Ce sont des **risques de compatibilité ou de cycle de vie**, pas des dysfonctionnements observés et reproduits.

### 4. Mises à jour — référence conservée au projet d’origine

[`src/index.ts`](../src/index.ts) ouvre encore l’adresse des Releases `pear-devs/pear-desktop` lorsqu'une mise à jour est proposée. Le réglage `autoUpdates` est activé par défaut. Une édition indépendante devrait définir sa propre politique de mise à jour avant distribution ; aucune modification automatique du mécanisme n’a été faite dans cet audit.

## Nettoyage effectué sans supprimer de fonctionnalités

- Quatre fichiers JSON **strictement vides** supprimés : `be-Latn`, `ckb`, `km` et `kmr`.
- Création d’un `.gitignore` pour exclure `node_modules/`, `dist/`, `pack/` et les artefacts locaux.
- Conservation des sources, scripts, tests existants, traductions non vides, images et icônes utilisés pour la compilation multiplateforme.

## Conditions pour déclarer un plugin « fonctionne réellement »

1. **Compilation** correcte (déjà passée).
2. **Activation** dans les paramètres sans erreur console.
3. **Exécution effective** de toutes ses commandes et réglages.
4. **Changement de piste/page** sans dysfonctionnement.
5. **Désactivation puis réactivation** sans timer, gestionnaire d’événement ou style résiduel.
6. **Tests de services externes** avec leurs applications ou comptes correspondants, sur la plateforme pertinente.
7. **Tests de non-régression** après rechargement du client et redémarrage.

**Conclusion de l'audit précédent :** la base compilait et seize tests passaient (la vérification de formatage reste non conforme). **La fiabilité individuelle des 34 plugins n’est pas encore certifiée.** Il serait factuellement incorrect de la déclarer acquise.
