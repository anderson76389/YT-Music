# Audit des plugins YT Music — 14 octobre 2026

**Périmètre :** les 33 extensions hors **Anti-Pause & Purge Totale**. Le plugin Anti-Pause et ses fichiers n'ont pas été modifiés dans cet audit.

**Niveaux de preuve :** le script `tools/audit-plugin-sources.mjs` contrôle la présence des **34 points d'entrée** (Anti-Pause compris) et des 8 suppressions précédentes. Le workflow Windows exécute aussi lint, TypeScript, tests unitaires et compilation Electron ; il démarre le vrai portable sur une page de contrôle locale, sans connexion au site de musique. Ces contrôles ne certifient pas chaque fonction ou service externe.

## Problèmes corrigés par cet audit

| Composant | Défaut confirmé dans le code | Correction |
|---|---|---|
| Chargement des plugins | Des commandes d'activation pouvaient arriver avant l'inscription des écouteurs renderer | Écouteurs enregistrés avant l'attente des plugins lents |
| Extensions nécessitant un redémarrage | Activation à chaud de modules dont les hooks ne sont pas démontables proprement, avec des doublons ou un état trompeur | Changement enregistré, puis boîte de dialogue demandant de redémarrer avant application |
| Anciennes configurations | Un identifiant de plugin supprimé pouvait provoquer une erreur dans l'observateur de configuration | Ignorer les identifiants inconnus et comparer à leurs valeurs par défaut |
| Égaliseur | Activer pendant une musique déjà en cours n'émettait pas l'événement audio initial | Reprise de la session WebAudio existante |
| Visualiseur | Même problème de session audio lors de l'activation tardive | Reprise de la session WebAudio existante |
| Compresseur audio | Pouvait recharger la chanson pour tenter d'initialiser son contexte audio | Connexion à la source courante sans relancer le titre |
| Passer les silences | Même absence de signal audio sur activation tardive | Reprise de la session WebAudio existante |
| Paroles synchronisées | Attente illimitée de l'onglet, timer/observer/écouteurs restant après désactivation | Recherche bornée de l'onglet et nettoyage à l'arrêt |
| Vitesse de lecture | Observateur et racine Solid conservés après la désactivation ; vitesse personnalisée conservée | Destruction des observateurs/éléments et retour à la vitesse normale |
| Sélecteur de sous-titres | Retrait d'un bouton potentiellement détaché, éléments de rendu conservés ; options appliquées au changement de vidéo seulement | Destruction sûre du bouton et application des paramètres sans changer de piste |

Ces modifications ciblent les erreurs identifiées dans le code. **Leur effet exact dans une session YouTube Music reste à confirmer sur un PC utilisant le service réel.**

## État de revue de chaque plugin conservé

Les points d'entrée sont présents et intégrés au build ; la colonne « test réel » ne prétend pas que l'extension a été exécutée avec des morceaux, un compte ou un service externe.

| Plugin | Contrôle effectué ou contrainte | Test réel |
|---|---|---|
| Album Actions | Cycle DOM, rendu des boutons ; sensible à la structure de la page | Non vérifié |
| Couleur de l'album | Activation en cours de lecture corrigée lors de l'audit visuel précédent | Non vérifié |
| Mode ambiant | Moteur de Pear Desktop adapté lors de l'audit précédent | Non vérifié |
| Amuse | Nécessite son intégration externe | Non vérifié |
| Compresseur audio | Reprise WebAudio corrigée ici | Non vérifié |
| Flou de navigation | Feuille CSS et injection Electron revues | Non vérifié |
| Sélecteur de sous-titres | Nettoyage du bouton et actualisation des options corrigés ici | Non vérifié |
| Crossfade | Nécessite redémarrage ; répétition d'une piste non entièrement prise en charge par son code | Non vérifié |
| Sortie audio personnalisée | Dépend de `enumerateDevices` et `AudioContext.setSinkId` disponibles | Non vérifié |
| Désactiver la lecture automatique | Contrôle des événements du lecteur et des options | Non vérifié |
| Do Not Track | Blocage réseau et preload nécessitent redémarrage | Non vérifié |
| Télécharger | Dépend des flux distants et du support de conversion sur PC | Non vérifié |
| Égaliseur | Reprise WebAudio corrigée ici | Non vérifié |
| Volume exponentiel | Redémarrage nécessaire pour ses hooks | Non vérifié |
| Menu intégré | Dispatch, sous-menus et réglages corrigés dans les versions précédentes | Non vérifié |
| Navigation | Rendu des boutons avec destruction de la racine Solid | Non vérifié |
| Notifications | Dépend des notifications Windows et de leurs autorisations | Non vérifié |
| Amélioration des performances | Redémarrage nécessaire ; optimisations nouvelles précédemment annulées à la demande | Non vérifié |
| Picture-in-Picture | Dépend de l'API PiP et de la fenêtre native ; redémarrage nécessaire | Non vérifié |
| Vitesse de lecture | Nettoyage et remise à 1× corrigés ici | Non vérifié |
| Volume précis | Hooks audio et raccourcis, redémarrage nécessaire | Non vérifié |
| Qualité | API de qualité du lecteur et boîte de dialogue Electron | Non vérifié |
| Passer les chansons non aimées | DOM du bouton J'aime et de la file d'attente | Non vérifié |
| Passer les silences | Reprise WebAudio corrigée ici | Non vérifié |
| SponsorBlock | Dépend du service SponsorBlock et de la disponibilité des segments | Non vérifié |
| Paroles synchronisées | Nettoyage et attente bornée corrigés ici ; dépend des fournisseurs de paroles | Non vérifié |
| Commandes multimédias barre des tâches | Fonction native **Windows** | Non vérifié |
| Touch Bar | Fonction réservée aux machines **macOS** disposant d'une Touch Bar ; non applicable à Windows | Non applicable |
| Lecteur transparent | Rendu restauré dans les versions précédentes ; redémarrage requis | Non vérifié |
| Tuna OBS | Dépend de l'outil externe OBS/Tuna | Non vérifié |
| Lecteur discret | Comportement lié au DOM de la page YouTube Music | Non vérifié |
| Basculer la vidéo | Sélecteurs du lecteur, redémarrage nécessaire | Non vérifié |
| Visualiseur | Reprise WebAudio corrigée ici ; dépend des capacités de capture vidéo | Non vérifié |

**Anti-Pause & Purge Totale : hors périmètre sur demande.** Aucun de ses fichiers n'a été modifié.

## Test de réception recommandé sur Windows

Dans la version Setup puis Portable, tester l'activation, le réglage, le changement de piste, la désactivation et le redémarrage pour chaque plugin applicable. Les plugins qui déclarent nécessiter un redémarrage doivent être activés, **puis l'application complètement fermée et relancée**, avant de juger leur effet. Mesurer les erreurs réelles dans les journaux Electron et garder une capture d'écran ou une vidéo pour les effets visuels. Les intégrations externes doivent être testées avec leurs services.

**Ne pas déclarer « 33/33 fonctionnels » sur la base d'un succès GitHub Actions.**
