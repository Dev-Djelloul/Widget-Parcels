# Widget Parcels

Widget Parcels est un tableau de bord bilingue de suivi de colis. Il enregistre les numéros de suivi et les préférences dans le navigateur, affiche les heures de plusieurs fuseaux horaires et des actualités françaises, intègre le widget de suivi Parcel App et propose une carte météo Windy avec les conditions actuelles d’une ville ou d’un pays choisi manuellement. Pour une recherche portant uniquement sur un pays, la météo est calculée à partir d’un point central approximatif. Le globe interactif trace les lieux de scan et les escales aériennes transmis par l’API Parcels ; si seuls l’origine et la destination sont disponibles, il affiche les points sans inventer un trajet intermédiaire. Certains transporteurs exigent le pays de destination pour être détectés ; l’application le demande alors avant de relancer la recherche. Le trajet reste indicatif et ne représente pas la position réelle du colis.

## Lancer l’application en local

Utilisez Node.js et npm pour compiler l’application statique :

```bash
npm install
npm run build
```

Servez le répertoire du projet ou le répertoire généré `dist/` avec n’importe quel serveur HTTP statique. L’application peut également être utilisée sans compilation en servant directement le répertoire du projet.

## Services externes

- Suivi des colis : widget [Parcel App](https://parcelsapp.com/) et API Parcels v4 (clé gardée comme secret Cloudflare Pages)
- Géocodage et météo : [Open-Meteo](https://open-meteo.com/)
- Carte météo et prévisions ECMWF : intégration [Windy](https://www.windy.com/)
- Globe interactif et tuiles : [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/) et [OpenFreeMap](https://openfreemap.org/)
- Actualités françaises : flux RSS de [franceinfo](https://www.franceinfo.fr/titres.rss), converti par [RSS2JSON](https://rss2json.com/)

Les numéros de suivi, les lieux du trajet et les préférences restent dans le stockage local du navigateur. La carte météo, les actualités, le géocodage, les tuiles de carte et l’API de suivi nécessitent une connexion Internet. L’API Parcels consomme le quota de l’abonnement pour chaque numéro distinct. La position n’est demandée qu’après action sur le bouton météo et n’est pas transmise au service d’actualités.

## Déploiement

Pour activer le remplissage automatique du trajet, configurez une fois la clé API comme secret Cloudflare Pages, sans la saisir dans le code ni dans le navigateur :

```bash
npx wrangler pages secret put PARCELS_API_KEY --project-name colis-digitalblueskye
```

Wrangler demandera la valeur de façon interactive. Le déploiement est manuel : après vous être authentifié avec Wrangler (`npx wrangler login`), `npm run deploy` compile l’application et publie `dist/` ainsi que la fonction `/api/tracking` sur le projet Cloudflare Pages. Si vous utilisez un autre projet Pages, modifiez son nom dans `package.json`.
