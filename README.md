<a id="haut"></a>
<div align="center">

  <img src="assets/readme-banner.svg" alt="YT Music — une onde musicale violette, rose et cyan sur fond sombre" width="100%">

  <br><br>

  <img src="assets/icon.svg" alt="Logo YouTube Music rouge et blanc" width="92">

  <h1>🎵 YT Music</h1>
  <h3>Ton client musical indépendant pour ordinateur</h3>

  <p>
    <strong>Votre musique, à votre façon.</strong><br>
    Un client YouTube Music pour ordinateur, avec une interface personnalisable, des plugins et des fonctions avancées de lecture.
  </p>

  <p>
    <img alt="Documentation en français" src="https://img.shields.io/badge/README-Fran%C3%A7ais-2563eb?style=for-the-badge">
    <img alt="Application Electron" src="https://img.shields.io/badge/Application-Electron-6554c0?style=for-the-badge">
    <img alt="Code TypeScript" src="https://img.shields.io/badge/Code-TypeScript-3178c6?style=for-the-badge">
    <img alt="Plugins" src="https://img.shields.io/badge/Plugins-Personnalisables-ec4899?style=for-the-badge">
  </p>

  <p>
    <a href="#-fonctionnalités">✨ Fonctionnalités</a> ·
    <a href="#-installation">💻 Installation</a> ·
    <a href="#-développement">🛠️ Développement</a> ·
    <a href="https://github.com/anderson76389/YT-Music/releases">📦 Releases</a> ·
    <a href="https://github.com/pear-devs/pear-desktop">🌱 Projet d'origine</a>
  </p>

</div>

---

## 🎧 Le projet

**YT Music** est un projet de bureau autonome maintenu dans **[ce dépôt GitHub](https://github.com/anderson76389/YT-Music)**. Il reprend et adapte du code open source de l'écosystème YouTube Music ; il n'a besoin d'aucun dépôt Pear Desktop pour être compilé à partir des sources enregistrées ici.

L'objectif est de retrouver l'expérience du service musical dans une véritable application de bureau, avec **34 plugins conservés : thèmes, transparence, mode ambiant, paroles, audio et contrôles du lecteur**.

Ce dépôt héberge les **fichiers sources** de cette édition. Il ne représente pas un client officiel de Google ou de YouTube et ne fournit pas de catalogue musical indépendant : la lecture et certaines fonctionnalités dépendent du service YouTube Music.

> **Téléchargement Windows :** chaque compilation validée publie désormais **deux exécutables x64** dans [GitHub Releases](https://github.com/anderson76389/YT-Music/releases/latest) : un **installateur Windows Setup** (recommandé, raccourcis stables) et une version **portable** sans installation. Ce sont des versions communautaires non officielles ; les tests automatisés ne remplacent pas des essais en conditions réelles.

## 🔒 Projet indépendant de Pear Desktop

Ce dépôt **n'est pas un fork GitHub** de Pear Desktop. Son code source, ses correctifs, ses ressources, ses workflows et sa licence sont hébergés dans `anderson76389/YT-Music`. Si le dépôt de l'ancien projet disparaît, **tes sources et tes commits restent disponibles ici**, tant que tu conserves ton propre dépôt ou une copie locale.

- **Identité propre :** application `YT Music`, identifiant `com.github.anderson76389.yt-music`.
- **Mises à jour :** aucune vérification vers le GitHub de Pear Desktop. Les mises à jour YT Music utiliseront uniquement [tes Releases](https://github.com/anderson76389/YT-Music/releases) ; elles sont désactivées par défaut jusqu'à ta première publication.
- **Distribution Windows :** [GitHub Actions](.github/workflows/build-portable-windows.yml) construit le Setup et le portable x64 puis les ajoute ensemble dans la même Release après validation.
- **Crédits et licence :** le fichier [`license`](license) contient la licence MIT d'origine et son attribution. Le respect des licences reste nécessaire même si leurs dépôts disparaissent.

**Limites de cette indépendance :** YouTube Music est un service externe ; son site, ses API, l'authentification, les packages npm et les intégrations tierces ne sont pas hébergés dans ce dépôt. Leur disponibilité n'est pas garantie si leurs fournisseurs changent les règles ou interrompent les services.

### Données et ancienne installation

Le nouveau nom et l'identifiant d'application peuvent créer un **nouveau profil de configuration**. Les réglages, cookies ou extensions de l'ancienne installation ne sont pas supprimés automatiquement. Sauvegarde ton ancien dossier de données avant de supprimer une ancienne version ; ne copie pas à l'aveugle tout le répertoire, et vérifie les chemins lors de la migration.

## ✨ Fonctionnalités

Les modules ci-dessous sont **présents dans le code source**. Leur disponibilité effective dépend de la version compilée, de l'activation des plugins et, pour certaines intégrations, de services externes.

| | Fonction | Ce qu'elle apporte |
|:--:|---|---|
| 🎨 | **Thèmes et apparence** | Couleurs d'album, mode ambiant, barre de navigation floutée et personnalisation du lecteur. |
| 🎤 | **Paroles synchronisées** | Affichage des paroles avec plusieurs fournisseurs prévus par le plugin. |
| 🎚️ | **Réglages audio** | Égaliseur, fondu enchaîné (*crossfade*), compression et contrôle précis du volume. |
| 🚫 | **SponsorBlock** | Module de gestion des segments communautaires lorsque la source et le service le permettent. |
| 🖥️ | **Mini-lecteur et vidéo** | Mode image dans l'image, affichage discret et contrôle de la vidéo. |
| 🌈 | **Visualiseurs** | Animations musicales et visualisations réactives à l'audio. |
| ⏯️ | **Contrôle du lecteur** | Notifications, commandes de lecture et contrôles multimédias Windows. |
| 📥 | **Téléchargement** | Plugin de téléchargement présent dans le projet, selon ses limitations et celles des services concernés. |
| 🌐 | **Langues** | Ressources de traduction comprenant notamment le français. |

## 🧹 Nettoyage de la version 3.12.1

Huit plugins ont été **supprimés des sources**, ainsi que leurs ressources : adaptateur de proxy d’authentification, Discord Rich Presence, Horloge, Lumia Stream, Music Together, Raccourcis & MPRIS, Scrobbler et Serveur API. Les autres **34 plugins sont conservés**.

Les mentions « Beta/Bêta » ont été retirées des intitulés des plugins conservés, mais cela ne signifie pas que leurs fonctions ont toutes été certifiées en conditions réelles.

Le gestionnaire de thèmes CSS a été corrigé pour réappliquer les styles après navigation et pour prendre en compte l’import et le retrait des fichiers CSS sans redémarrage. Le mode transparent nécessite toujours un redémarrage après activation afin de créer une fenêtre Electron transparente.

### Activer les plugins visuels

Depuis la barre supérieure, ouvre **Plugins** (à côté de **Paramètres**). Pour activer **Mode ambiant** ou **Mode transparent**, clique sur leur **case à cocher** : la coche indique qu'ils sont activés. Quand un plugin propose des options, celles-ci sont accessibles juste en dessous via **« Mode ambiant — Réglages »** ou **« Mode transparent — Réglages »**.

- **Mode ambiant :** applique le fond flouté sur la page de lecture d'un morceau. La pochette ou la vidéo sert de source si elle est disponible.
- **Mode transparent :** exige un **redémarrage complet** de YT Music après activation ou désactivation, car Windows doit créer une fenêtre de type transparent avant le chargement de l'interface. L'opacité se règle ensuite dans le sous-menu du plugin.
- **Ne cherche plus les plugins dans Paramètres :** les raccourcis supplémentaires ont été retirés pour conserver un seul endroit cohérent.

## 🧩 Une application modulaire

Les fonctionnalités avancées sont organisées autour des plugins présents dans [`src/plugins/`](src/plugins/).

Vous pouvez notamment adapter l'expérience selon vos préférences : améliorer l'affichage des albums, activer les paroles synchronisées, utiliser les commandes multimédias, configurer un égaliseur ou activer des intégrations compatibles.

**Remarque :** les plugins ne sont pas tous nécessairement activés par défaut. Une fonctionnalité listée ici indique que son module existe dans le dépôt, pas qu'elle a été individuellement testée sur toutes les plateformes.

## 💻 Installation

### Option 1 — Installer YT Music ou utiliser la version portable (Windows 64 bits)

| Version | Fichier | Pour qui ? |
|---|---|---|
| **Windows Setup — recommandée** | [📥 Télécharger l'installateur](https://github.com/anderson76389/YT-Music/releases/latest/download/YT-Music-Setup-Windows-x64.exe) | Application installée dans un dossier durable, raccourci Bureau, entrée dans le menu Démarrer, désinstallation depuis Windows. |
| **Windows Portable** | [📥 Télécharger le portable](https://github.com/anderson76389/YT-Music/releases/latest/download/YT-Music-Portable-Windows-x64.exe) | Un unique programme à lancer sans installation, depuis un dossier que tu choisis. Aucun raccourci n'est ajouté ou modifié automatiquement. |

**Conseil :** choisis l'installateur si tu épingles YT Music dans la barre des tâches. Il te permettra de conserver un raccourci stable quand une nouvelle version paraît. Pendant l'installation, tu peux choisir le dossier de destination et les raccourcis Windows sont créés par l'installateur, pas par l'application.

Si tu avais épinglé **un ancien exécutable portable**, désépingle cet ancien raccourci, installe la nouvelle version, lance **YT Music** depuis le menu Démarrer et épingle **cette version installée** une seule fois. La migration ne corrige pas automatiquement les anciens raccourcis qui pointent déjà vers un fichier déplacé.

Tu peux conserver les deux fichiers pour choisir ton mode d'utilisation, mais évite de lancer simultanément les deux versions, car elles partagent une identité de programme et peuvent partager des données utilisateur.

Chaque compilation réussie crée une nouvelle [Release GitHub](https://github.com/anderson76389/YT-Music/releases/latest) avec **les deux variantes**. Le workflow [`build-portable-windows.yml`](.github/workflows/build-portable-windows.yml) vérifie que les deux exécutables sont bien présents avant leur publication.

### Option 2 — Lancer depuis le code source

**Prérequis :**

- [Node.js](https://nodejs.org/) **22 ou supérieur**
- [pnpm](https://pnpm.io/) **11 ou supérieur**
- [Git](https://git-scm.com/)

```bash
git clone https://github.com/anderson76389/YT-Music.git
cd YT-Music
pnpm install
pnpm dev
```

La première installation télécharge les dépendances nécessaires. Elle nécessite une connexion Internet.

## 🛠️ Développement

Le projet utilise **Electron**, **TypeScript**, **electron-vite** et **electron-builder**.

| Commande | Utilité |
|---|---|
| `pnpm dev` | Démarrer l'environnement de développement |
| `pnpm build` | Compiler l'application |
| `pnpm start` | Prévisualiser la version compilée |
| `pnpm check` | Lancer lint, contrôle du format et vérification TypeScript |
| `pnpm dist:win` | Préparer les distributions Windows |
| `pnpm dist:linux` | Préparer les distributions Linux |
| `pnpm dist:mac` | Préparer les distributions macOS |

Les scripts sont définis dans [`package.json`](package.json). Pour fabriquer un exécutable Windows, utilisez de préférence un environnement Windows adapté à Electron Builder.

Les résultats de compilation sont écrits dans des dossiers générés, notamment `dist/` et `pack/`. Ils ne sont pas inclus dans le dépôt source : les dépendances de `node_modules/` doivent également être réinstallées localement.

## 📂 Organisation du dépôt

| Dossier ou fichier | Rôle |
|---|---|
| [`src/`](src/) | Code principal du lecteur |
| [`src/plugins/`](src/plugins/) | Modules et fonctionnalités optionnelles |
| [`src/i18n/resources/`](src/i18n/resources/) | Ressources de traduction |
| [`assets/`](assets/) | Icônes, éléments visuels et ressources |
| [`patches/`](patches/) | Correctifs appliqués à certaines dépendances |
| [`tools/`](tools/) | Outils de développement |
| [`vite-plugins/`](vite-plugins/) | Plugins internes de compilation |
| [`electron.vite.config.mts`](electron.vite.config.mts) | Configuration electron-vite |
| [`electron-builder.yml`](electron-builder.yml) | Configuration des paquets et installateurs |
| [`package.json`](package.json) | Scripts et dépendances |
| [`pnpm-lock.yaml`](pnpm-lock.yaml) | Verrouillage des versions de dépendances |

## ❓ Questions fréquentes

<details>
<summary><strong>Pourquoi aucun fichier .exe n'apparaît-il dans le dépôt ?</strong></summary>

Les exécutables Windows restent exclus du dépôt source (limite GitHub de 100 Mio par fichier). Ils sont construits et accessibles dans **[Releases](https://github.com/anderson76389/YT-Music/releases)**, sans avoir besoin de cloner le projet.

</details>

<details>
<summary><strong>L'application est-elle officielle ?</strong></summary>

Non. Il s'agit d'un projet communautaire indépendant, utilisant du code open source de prédécesseurs crédités plus bas, sans affiliation officielle avec Google ou YouTube.

</details>

<details>
<summary><strong>Peut-on choisir les plugins ?</strong></summary>

Le projet propose un système de plugins personnalisables. Les réglages et la disponibilité de chaque plugin dépendent de la version utilisée.

</details>

<details>
<summary><strong>Pourquoi certains modules peuvent-ils cesser de fonctionner ?</strong></summary>

Plusieurs fonctions communiquent avec YouTube Music ou des services tiers. Leurs changements d'API, restrictions et interruptions peuvent affecter les plugins indépendamment du code de ce dépôt.

</details>

## 🤝 Crédits et origine

Le code réutilise des travaux historiques de **[pear-devs/pear-desktop](https://github.com/pear-devs/pear-desktop)** et de **[th-ch/youtube-music](https://github.com/th-ch/youtube-music)**. Ces liens servent uniquement de crédits et de référence historique : ils ne sont pas requis au démarrage ou à la compilation.

Le code, les plugins et les bibliothèques tiers demeurent attribués à leurs auteurs respectifs. La licence MIT originale est incluse localement dans [`license`](license) ; les notices de licence et obligations de redistribution des composants d'origine et dépendances doivent rester respectées.

**YT Music est un projet communautaire indépendant, non affilié à YouTube, Google ni à l'équipe Pear Desktop.**

---

<div align="center">
  <p><strong>🎵 Votre musique. Votre lecteur. Vos réglages.</strong></p>
  <p><a href="#haut">↑ Retour en haut</a> · <a href="https://github.com/anderson76389/YT-Music/issues">Signaler un problème</a> · <a href="https://github.com/pear-devs/pear-desktop">Remercier le projet d'origine</a></p>
</div>
