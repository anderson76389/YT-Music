# Validation finale YT Music (Windows)

## Vérifications automatisées
- Analyse statique, TypeScript, tests Playwright, audit des 31 plugins et compilation.
- Tests synthétiques : 43 200 insertions dans le cache, limites de mémoire estimées, annulation de requêtes, validation des URLs de couvertures.
- Au build Windows, test du vrai portable sur une page locale : menus, paramètres, ouverture et fermeture du mini-lecteur et présence du curseur. Pas de connexion Google dans ce test.
- Audit des dépendances de production à chaque contrôle hebdomadaire existant ou déclenchement manuel. Consulter le rapport et distinguer les vulnérabilités confirmées des erreurs réseau ; l'absence de résultat n'est pas une preuve d'absence de vulnérabilité.

## Mesures locales (sans collecte de données personnelles)
Ouvrir PowerShell dans la racine du dépôt, avec YT Music installé :
```powershell
.\tools\measure-windows-performance.ps1 -Minutes 10 -IntervalSeconds 5
.\tools\measure-windows-performance.ps1 -Minutes 720 -IntervalSeconds 30
```
Le CSV agrège les processus portant le nom de YT Music. Le premier échantillon CPU et les nouveaux PID ne sont pas entièrement mesurés. Le working set peut compter plusieurs fois des pages partagées ; comparer aussi la mémoire privée. Aucune mesure GPU/VRAM ou des images perdues de Firefox n'est faite par ce script.

## Matrice à réaliser sur le PC
1. Fermer YT Music, ouvrir une vidéo YouTube dans Firefox, démarrer Setup et noter le temps avant que l'interface réponde ; vérifier les images perdues dans les statistiques de la vidéo. Répéter cinq fois à chaud et après redémarrage.
2. Refaire avec Portable ; distinguer le temps d'extraction de la charge du lecteur. Comparer CPU, disque et GPU dans le Gestionnaire des tâches.
3. Mesurer 10 minutes d'écoute audio, puis 12 heures avec changements de morceaux, mises en pause, mini-lecteur ouvert/fermé. Comparer la mémoire privée après échauffement et à la fin, pas uniquement le pic du démarrage.
4. Avec le même compte Google et l'historique activé, écouter un morceau différent sur chaque appareil, consulter Historique dans YT Music et dans l'application officielle, actualiser si nécessaire. Vérifier les deux sens et les filtres DNS/VPN éventuels.
5. Tester individuellement les 31 extensions activées/désactivées, notamment celles qui touchent au lecteur ou au réseau. L'audit de présence ne garantit pas leur bon fonctionnement en direct.
6. Installer deux versions Setup successives au même emplacement ; vérifier le maintien des préférences, des raccourcis et la taille des dossiers d'installation/cache. Ne pas supprimer les données utilisateur.
7. Contrôler que la source de mise à jour reste le dépôt YT-Music ; YouTube/Google demeurent nécessaires au streaming et à la synchronisation.

Ne pas désactiver l'antivirus ni l'accélération matérielle par défaut. Les chiffres cibles de CPU, RAM et démarrage ne sont pas des résultats mesurés.
