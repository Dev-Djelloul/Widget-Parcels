# Widget Parcels

Widget Parcels est une application web progressive (PWA) en français pour centraliser le suivi de colis, les informations de trajet et quelques outils utiles au quotidien. L’interface est statique ; une fonction Cloudflare Pages protège la clé API utilisée pour le suivi détaillé.

## Fonctionnalités

- Enregistrer plusieurs colis sur l’appareil, les sélectionner, les renommer et les retirer.
- Détecter certains transporteurs à partir du numéro et récupérer les événements détaillés via l’API Parcels v4. Si nécessaire, l’application demande le pays de destination avant de réessayer.
- Afficher les étapes du suivi de la plus récente à la plus ancienne. La carte représente le trajet de la provenance vers la destination ; elle ne donne pas la position GPS du colis.
- Visualiser sur un globe interactif les lieux de scan et escales aériennes transmis par le transporteur. Les étapes manquantes ne sont pas inventées ; les lieux peuvent aussi être saisis manuellement.
- Ouvrir la fiche et le widget Parcel App pour consulter des informations complémentaires.
- Consulter les heures locale, UTC, Tokyo et New York, ainsi que des actualités françaises actualisées périodiquement.
- Rechercher la météo d’une ville ou d’un pays, afficher la carte Windy et, sur demande, utiliser la position de l’appareil.
- Installer l’application comme PWA. Le service worker met en cache les ressources de l’interface pour permettre de la rouvrir hors ligne ; le suivi, les cartes, la météo et les actualités nécessitent Internet.
- Choisir un thème clair ou sombre et réduire le menu latéral. Les préférences sont mémorisées sur l’appareil.

## Développement local

Prérequis : Node.js et npm.

```bash
npm install
npm run build
npx wrangler pages dev dist
```

Wrangler sert le site et la fonction `functions/api/tracking.js`. Pour tester les requêtes de suivi en local, créez un fichier `.dev.vars` à la racine du projet :

```dotenv
PARCELS_API_KEY=votre_cle_api_parcels
```

Ne partagez pas ce fichier et ne le commitez pas : il contient un secret. Ne placez jamais la clé dans le code ou dans le navigateur. Sans clé configurée, les autres parties de l’interface restent utilisables, mais le suivi détaillé par l’API ne fonctionnera pas.

## Déploiement sur Cloudflare Pages

Authentifiez Wrangler, puis ajoutez la clé comme secret Cloudflare Pages. Wrangler demandera sa valeur :

```bash
npx wrangler login
npx wrangler pages secret put PARCELS_API_KEY --project-name colis-digitalblueskye
npm run deploy
```

Le script `deploy` compile l’application dans `dist/`, puis publie les fichiers statiques et la fonction `/api/tracking`. Le nom du projet Pages est défini dans `package.json` ; adaptez-le si vous déployez vers un autre projet. Le déploiement est manuel.

## Données et confidentialité

Les numéros de suivi, les événements récupérés, les lieux du trajet et les préférences sont stockés dans le stockage local du navigateur : ils ne sont pas synchronisés entre appareils. Effacer les données du site dans le navigateur peut les supprimer. Le suivi détaillé transmet le numéro et, si nécessaire, le pays de destination à la fonction Cloudflare puis à l’API Parcels ; chaque recherche peut consommer le quota de l’abonnement Parcels.

La position de l’appareil n’est utilisée qu’après avoir choisi « Utiliser ma position » et sert à centrer la météo. Elle n’est pas transmise au service d’actualités. Les appels météo, actualités, géocodage et cartes utilisent les services tiers ci-dessous.

## Services externes

| Usage | Service |
| --- | --- |
| Suivi détaillé et widget de colis | [Parcels / Parcel App](https://parcelsapp.com/) — API v4 via la fonction Cloudflare Pages |
| Géocodage et données météo | [Open-Meteo](https://open-meteo.com/) |
| Carte météo et prévisions ECMWF | [Windy](https://www.windy.com/) |
| Globe interactif et fonds de carte | [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/) et [OpenFreeMap](https://openfreemap.org/) |
| Actualités françaises | Flux RSS de [franceinfo](https://www.franceinfo.fr/titres.rss), converti par [RSS2JSON](https://rss2json.com/) |

## Structure du projet

- `index.html`, `styles.css`, `app.js` : interface et logique de l’application.
- `functions/api/tracking.js` : proxy Cloudflare Pages vers l’API Parcels ; la clé reste côté serveur.
- `service-worker.js`, `manifest.webmanifest`, `icons/` : installation PWA et cache de l’interface.
- `build.js` : copie les fichiers nécessaires et MapLibre dans `dist/`.
