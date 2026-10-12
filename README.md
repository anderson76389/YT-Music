<a id="haut"></a>
<div align="center">

  <img src="assets/readme-banner.svg" alt="YT Music — une onde musicale violette, rose et cyan sur fond sombre" width="100%">

  <br><br>

  <img src="assets/icon.png" alt="Icône de l'application YouTube Music" width="92">

  <h1>🎵 YT Music</h1>
  <h3>Édition personnelle basée sur Pear Desktop</h3>

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

**YT Music** est une édition personnelle de **[Pear Desktop](https://github.com/pear-devs/pear-desktop)**, client de bureau communautaire pour YouTube Music.

L'objectif est de retrouver l'expérience du service musical dans une véritable application de bureau, tout en profitant des possibilités offertes par l'écosystème de plugins : **apparence, lecture, paroles, audio, raccourcis et intégrations**.

Ce dépôt héberge les **fichiers sources** de cette édition. Il ne représente pas un client officiel de Google ou de YouTube et ne fournit pas de catalogue musical indépendant : la lecture et certaines fonctionnalités dépendent du service YouTube Music.

> **État du dépôt :** le code source est disponible. Les installateurs et versions portables ne sont **pas encore publiés** dans les [Releases](https://github.com/anderson76389/YT-Music/releases). Les commandes de compilation ci-dessous correspondent à la configuration du projet ; elles ne constituent pas une garantie de fonctionnement sur chaque machine.

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
| 🎮 | **Discord** | Intégration de présence Discord via le plugin dédié. |
| 🎼 | **Scrobbling** | Intégrations Last.fm et ListenBrainz. |
| ⌨️ | **Contrôle rapide** | Raccourcis clavier, notifications et commandes de lecture. |
| 📥 | **Téléchargement** | Plugin de téléchargement présent dans le projet, selon ses limitations et celles des services concernés. |
| 🌐 | **Langues** | Ressources de traduction comprenant notamment le français. |

## 🧩 Une application modulaire

Les fonctionnalités avancées sont organisées autour des plugins présents dans [`src/plugins/`](src/plugins/).

Vous pouvez notamment adapter l'expérience selon vos préférences : améliorer l'affichage des albums, activer les paroles synchronisées, utiliser les commandes multimédias, configurer un égaliseur ou activer des intégrations compatibles.

**Remarque :** les plugins ne sont pas tous nécessairement activés par défaut. Une fonctionnalité listée ici indique que son module existe dans le dépôt, pas qu'elle a été individuellement testée sur toutes les plateformes.

## 💻 Installation

### Option 1 — Télécharger une version compilée

Lorsque des versions publiques seront proposées, elles seront accessibles ici :

**➡️ [Consulter les versions disponibles (GitHub Releases)](https://github.com/anderson76389/YT-Music/releases)**

La configuration de compilation prévoit pour Windows des **versions installables (NSIS web)** et **portables**. Cela ne signifie pas qu'un exécutable est déjà disponible au téléchargement.

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

Le dépôt contient le code source, pas les exécutables générés. Les fichiers de distribution peuvent être publiés séparément dans **Releases** lorsqu'une compilation est prête.

</details>

<details>
<summary><strong>L'application est-elle officielle ?</strong></summary>

Non. Il s'agit d'un projet communautaire basé sur Pear Desktop, sans affiliation officielle avec Google ou YouTube.

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

Cette édition repose sur le travail du projet **[pear-devs/pear-desktop](https://github.com/pear-devs/pear-desktop)** et de ses contributeurs, dans la continuité du client **[th-ch/youtube-music](https://github.com/th-ch/youtube-music)**.

Le code, les plugins et les bibliothèques tiers demeurent attribués à leurs auteurs respectifs. Le fichier `package.json` du projet déclare une licence MIT ; les notices de licence et obligations de redistribution des composants d'origine doivent être respectées.

**YT Music est une édition communautaire indépendante, non affiliée à YouTube, Google ni à l'équipe officielle de Pear Desktop.**

---

<div align="center">
  <p><strong>🎵 Votre musique. Votre lecteur. Vos réglages.</strong></p>
  <p><a href="#haut">↑ Retour en haut</a> · <a href="https://github.com/anderson76389/YT-Music/issues">Signaler un problème</a> · <a href="https://github.com/pear-devs/pear-desktop">Remercier le projet d'origine</a></p>
</div>
