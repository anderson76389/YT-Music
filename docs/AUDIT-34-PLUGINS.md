# Audit des 34 plugins — YT Music

> Audit du **13 octobre 2026**. Dépôt personnel : [anderson76389/YT-Music](https://github.com/anderson76389/YT-Music).
> Ce rapport sépare **inventaire**, **contrôles automatiques**, **correctifs du code** et **essais réels**. Une compilation verte n'est pas une preuve que Google, OBS, Windows ou un fournisseur tiers répondent correctement.

## Méthode

1. Inventaire de **34 points d'entrée** et contrôle des **8 plugins définitivement supprimés** par `node tools/audit-plugin-sources.mjs`.
2. Compilation TypeScript et Electron, lint et tests Playwright dans GitHub Actions ; le build est bloqué en cas d'erreur.
3. Inspection du cycle de vie : activation, nettoyage des écouteurs et CSS, changements de piste, réglages, plateformes.
4. **Non testé ici** : écoute continue réelle de plusieurs heures, connexion au compte Google, téléchargement de formats réels, appel de l'API SponsorBlock, intégration OBS, périphériques audio Windows, Touch Bar macOS et compatibilité future avec les changements du site.

Le workflow `Verification du code` s'exécute à chaque commit et **chaque mardi**. Il ne teste pas YouTube Music en situation réelle et dépend de la disponibilité de GitHub Actions.

## Inventaire et état

Dans « État », **corrigé** signifie *code modifié et soumis aux tests* ; **testé par code** signifie *comportement simulé par un test automatisé* ; **à tester sur PC/service** signifie qu'aucune certification en situation réelle n'existe.

| Plugin (`id`) | Vérification / correction | Limite encore à vérifier |
|---|---|---|
| `album-actions` | Corrigé : page absente, attente sans fin et suppression des boutons | Listes/likes après changements du DOM YouTube |
| `album-color-theme` | Corrigé : retrait des écouteurs et restauration des variables CSS | Couleurs réelles, thèmes importés et OLED |
| `ambient-mode` | CSS et recherche du lecteur adaptés ; diagnostic disponible | Toujours signalé en panne sur le PC utilisateur ; diagnostic réel requis |
| `amuse` | Sources et dépendances Hono conservées ; compilation | Widget local et connexion effective |
| `anti-pause` | Tests de saut publicitaire et anti-inactivité ; retour utilisateur positif sur les pubs | Longue écoute et changements de publicité |
| `audio-compressor` | Entrée TypeScript compilable ; hooks Web Audio repérés | Routage et coexistence avec égaliseur |
| `blur-nav-bar` | Corrigé : chargeur CSS partagé et activation à nouveau possible | Rendu après changement de thème |
| `captions-selector` | Entrée, backend et renderer recensés | Disponibilité des pistes de sous-titres |
| `crossfade` | Entrée et configuration recensées | Transitions réelles et formats de l'API externe |
| `custom-output-device` | Corrigé : liste audio sans demande de microphone, changements d'appareil et nettoyage | Routage vers chaque périphérique Windows |
| `disable-autoplay` | Contrôles du lecteur recensés | Événements pendant changements de morceaux |
| `do-not-track` | Corrigé : redémarrage imposé pour retirer les hooks du preload | Filtres et effets sur le site Google |
| `downloader` | Imports et paramètres compilables | Téléchargements réels et outils/versions externes |
| `equalizer` | Corrigé : graphe audio, changements de preset/piste et nettoyage | Son mesuré et compatibilité avec compresseur |
| `exponential-volume` | Relecture du prototype HTMLMediaElement et redémarrage nécessaire | Comportement du volume selon plateformes |
| `in-app-menu` | Tests de menu et routage déjà présents | Menus du site après mises à jour Google |
| `navigation` | Corrigé : disposer proprement le composant SolidJS | Historique des pages réel |
| `notifications` | API Electron et réglages recensés | Notifications interactives Windows |
| `performance-improvement` | CPU-tamer et scripts de performance recensés | Consommation CPU/RAM mesurée et effets secondaires |
| `picture-in-picture` | Contrôles de fenêtre et préférences recensés | PiP Windows et basculements répétitifs |
| `playback-speed` | Contrôles du lecteur recensés | Vitesses réelles selon pistes et versions Google |
| `precise-volume` | HUD et raccourcis recensés | Raccourcis globaux, conflits logiciels |
| `quality-changer` | API de qualités et bouton recensés | Qualités réellement offertes par les vidéos |
| `skip-disliked-songs` | Corrigé et testé par code : boutons reconstruits, saut unique par morceau | Comportement sur playlists et boutons réels |
| `skip-silences` | Corrigé : arrêt de la boucle et de l'analyseur audio, fréquence bornée | Seuil, qualité sonore et silences de vraies pistes |
| `sponsorblock` | Tri des segments testé dans les tests existants | Disponibilité de sponsor.ajay.app et segments |
| `synced-lyrics` | Parsing LRC testé | Fournisseurs de paroles et synchronisation réelle |
| `taskbar-mediacontrol` | Plugin limité à Windows, API Electron recensée | Contrôles de miniatures/notifications Windows |
| `touchbar` | Plugin limité à macOS, import présent | Non testable sur un PC Windows |
| `transparent-player` | Fenêtre Electron et CSS adaptés ; diagnostic disponible | Toujours signalé en panne sur le PC utilisateur ; redémarrage + diagnostic |
| `tuna-obs` | API locale et émission HTTP recensées | OBS/Tuna doit répondre sur `127.0.0.1:1608` |
| `unobtrusive-player` | Écouteurs de clic et changement vidéo recensés | Sélecteurs du lecteur actuel |
| `video-toggle` | Menu et composant de bascule recensés | Changements de mode audio/vidéo en lecture |
| `visualizer` | Plugins Web Audio et trois moteurs recensés | GPU, capture vidéo et rendu en temps réel |

## Diagnostic sur l'application

Dans la version installée, utiliser **Plugins → Diagnostiquer les modes ambiant / transparent** avec une musique ouverte et les deux cases d'activation cochées. Le résultat permet d'identifier la présence du lecteur, du fond ambiant, des règles CSS et des classes transparentes.

Pour les autres plugins, noter **version exacte**, **nom du plugin**, **action tentée**, **résultat obtenu** et **erreur éventuellement affichée**. Une vérification peut ensuite être ajoutée pour reproduire le bug sans casser les 33 autres extensions.

## Limites et maintenance

- **Aucune promesse « pour toujours »** : YouTube Music peut modifier son DOM et ses API, les fournisseurs de sous-titres et paroles peuvent disparaître, et le système Windows ou Electron peut changer.
- **Dépôt autonome** : tout le code des plugins conservés reste dans ce dépôt. L'indépendance vis-à-vis de Pear Desktop n'élimine pas les dépendances npm, Google, SponsorBlock ou OBS.
- **Mises à jour** : les deux éditions Windows sont compilées depuis les mêmes sources. Seule la version **Setup** installe des mises à jour via `latest.yml` ; le portable conserve un téléchargement manuel.
- **Régression** : une vérification automatique hebdomadaire assure que les 34 plugins restent présents et que le projet peut toujours compiler. Les services externes et l'interface visible sur l'ordinateur restent à tester séparément.
