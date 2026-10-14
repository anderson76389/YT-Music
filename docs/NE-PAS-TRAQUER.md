# Ne pas traquer : fonctionnement vérifié

Ce plugin propose **deux modes différents** :

- **Bloquer les traqueurs et publicités (listes Ghostery)** : installe le moteur de filtrage `@ghostery/adblocker-electron` dans la session réseau Electron. Il charge les listes **EasyList** et **EasyPrivacy** (ou le jeu précompilé publicités + traqueurs fourni par Ghostery), ainsi que les listes HTTPS supplémentaires configurées.
- **Filtrage du lecteur uniquement (ne bloque pas les traqueurs)** : modifie des objets JSON liés aux annonces YouTube Music. **Ce mode ne bloque pas les requêtes vers les serveurs de suivi.**

## Activer la protection réseau

1. Dans **Plugins**, activer **Ne pas traquer**.
2. Ouvrir ses **Réglages**, puis **Mode de protection**.
3. Choisir **Bloquer les traqueurs et publicités (listes Ghostery)**.
4. **Fermer complètement YT Music, puis le relancer**. Le blocage du réseau et l'injection du preload ne peuvent pas être reconfigurés entièrement à chaud.
5. Laisser un accès réseau au premier démarrage pour télécharger les listes. Le cache local accélère les démarrages suivants.

> Les configurations antérieures qui ont explicitement enregistré le mode « In player » le conservent. Le changement du mode par défaut pour les nouvelles configurations ne modifie pas silencieusement les réglages existants.

## Tests et limites

Le workflow Windows est configuré pour vérifier **un blocage HTTP réel en local**, sans connexion au site YouTube Music : une requête passe normalement, est bloquée par une règle Ghostery installée dans la vraie session Electron, puis repasse après désactivation de cette règle. La publication est refusée en cas d'échec.

Le moteur vérifie également la présence de règles réseau, confirme l'activation dans la session Electron et consigne une erreur explicite lorsqu'il n'a pas pu charger ses listes.

**Ce test local ne garantit pas le blocage de tous les traqueurs réels.** L'efficacité dépend de la mise à jour des listes, des URL rencontrées et des exceptions prévues par les filtres ; les requêtes dites « first-party » ne sont pas toutes identifiables comme du suivi. Un accès réseau absent ou un téléchargement des listes défaillant peut empêcher la protection de démarrer. Dans ce cas, les journaux Electron indiquent `Ne pas traquer : filtrage réseau NON ACTIF`.

Pour contrôler une session réelle, examiner les requêtes réseau avec les outils de développement d'Electron avant et après activation et redémarrage, idéalement sans autres bloqueurs ou extensions interférant avec la mesure.
