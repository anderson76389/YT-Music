# Audit de la barre de menus — YT-Music

**12 octobre 2026 · Windows : lint, TypeScript, 12 tests et compilation Electron réussis.**

**Contrôle vérifiable :** [GitHub Actions #38194267434](https://github.com/anderson76389/YT-Music/actions/runs/38194267434)

> Une compilation et des tests simulés ne prouvent pas que les commandes interagissent correctement avec YouTube Music ou des services externes. Ce rapport distingue les corrections vérifiées automatiquement des essais encore nécessaires.

## Organisation de la barre supérieure

| Menu | Points de contrôle | Statut |
|---|---|---|
| **Plugins** | 31 entrées, activation/désactivation, sous-menus par plugin | Génération auditable, clic de case testé ; test GUI restant |
| **Options** | Mise à jour, reprise, page d'accueil, apparence, thème CSS, langue, démarrage, barre d'état, proxy et avancé | Callbacks vérifiés dans le code ; intégrations non toutes testées |
| **Affichage** | Recharger, recharger sans cache, zoom, réinitialisation, plein écran | Traitement des rôles corrigé ; tests unitaires de dispatch réussis |
| **Navigation** | Retour, avance, copie d’URL, redémarrage, fermeture | Actions câblées dans le code ; test GUI restant |

Après le nettoyage 3.12.1, les sous-menus des plugins conservés sont générés uniquement à partir de leurs sources présentes. Les huit anciens plugins ont été retirés intégralement.

## Défauts confirmés et corrections publiées

1. **[Menu intégré](../src/plugins/in-app-menu/main.ts) — clic cassé :** l'IPC transmettait `undefined` au lieu du vrai `MenuItem`. Les commandes lisant `item.checked` pouvaient échouer. Corrigé par [un répartiteur dédié](../src/plugins/in-app-menu/menu-dispatch.ts).
2. **[Menu intégré](../src/plugins/in-app-menu/menu-dispatch.ts) — rôles Electron :** rechargement, zoom, DevTools, plein écran et quitter ne s'exécutaient pas dans le menu HTML en l'absence de callback natif. Un traitement explicite existe désormais.
3. **[Éléments de menu](../src/plugins/in-app-menu/renderer/PanelItem.tsx) — entrées désactivées :** contrôle renforcé avant appel IPC. Cliquer un sous-menu ne tente plus d'exécuter une action inexistante.
4. **[Actualisation](../src/index.ts) — état périmé :** la barre est reconstruite lorsqu'une option ou une configuration de plugin change.
5. **[Chargement des sous-menus](../src/loader/menu.ts) — ancien contenu :** la carte des menus personnalisés est vidée avant reconstruction.
6. **[Options](../src/menu.ts) — thèmes CSS :** l'importation ajoute le thème au lieu de remplacer tous les thèmes déjà installés.
7. **[Options](../src/menu.ts) — DevTools macOS :** branche vide remplacée par `openDevTools()`.

## Tests automatisés réellement passés

Dans GitHub Actions Windows, la version de ces corrections a passé :
- L'installation des dépendances ;
- `pnpm lint` ;
- `pnpm typecheck` ;
- `pnpm test` : **12 tests réussis** (5 existants, 3 anti-inactivité simulée, 4 événements du menu) ;
- `pnpm build` : compilation réussie.

La vérification `pnpm format:check` échoue toujours sur **343 fichiers** provenant principalement du formatage général du dépôt. C'est pourquoi l'exécution GitHub Actions est marquée « failure », malgré les tests et la compilation réussis. Il serait incorrect de masquer cet échec.

## Publicités : où en est-on ?

Le plugin [Anti-Pause & Purge Totale](../src/plugins/anti-pause/index.ts) combine une tentative de blocage **réseau** par Ghostery AdsOnly avant le chargement et un **saut publicitaire DOM** de secours. Le module est incorporé à la compilation Windows. **Aucun test ne reproduit une publicité réellement diffusée par YouTube Music** ; une garantie « zéro flash » n'est donc pas établie. Les règles de filtrage peuvent également laisser passer certains formats publicitaires ou affecter des requêtes non publicitaires.

## Restant à tester dans la véritable application

1. Ouvrir le menu Plugins et vérifier l'apparition des entrées actuellement présentes.
2. Activer/désactiver des plugins avec et sans sous-menu ; contrôler que le coche et les réglages survivent au redémarrage.
4. Tester toutes les entrées des menus Options, Affichage et Navigation.
5. Écouter plusieurs titres avec annonces possibles et vérifier si le blocage réseau réduit ou élimine le flash ; désactiver puis réactiver Anti-Pause pour détecter les résidus.

**Conclusion :** la barre de menus dispose de corrections ciblées et de tests unitaires passés. Le fonctionnement de chaque option dans l'interface Electron réelle demeure à confirmer par des tests en situation.
