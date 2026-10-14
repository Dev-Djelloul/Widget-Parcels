# Widget Parcels

Widget Parcels est un tableau de bord bilingue de suivi de colis. Il enregistre les numéros de suivi et les préférences dans le navigateur, intègre le widget Parcel App et affiche un radar météo avec les conditions locales, les heures UTC et locale ainsi que les dernières actualités françaises. La carte de suivi peut représenter une provenance et une destination saisies manuellement ; le trajet est indicatif et ne représente pas la position réelle du colis.

## Lancer l’application en local

Utilisez Node.js et npm pour compiler l’application statique :

```bash
npm install
npm run build
```

Servez le répertoire du projet ou le répertoire généré `dist/` avec n’importe quel serveur HTTP statique. L’application peut également être utilisée sans compilation en servant directement le répertoire du projet.

## Services externes

- Suivi des colis : [Parcel App](https://parcelsapp.com/)
- Géocodage et météo : [Open-Meteo](https://open-meteo.com/)
- Cartes : [Leaflet](https://leafletjs.com/) et [OpenStreetMap](https://www.openstreetmap.org/)
- Radar de précipitations : [RainViewer](https://www.rainviewer.com/)
- Actualités françaises : flux RSS de [franceinfo](https://www.franceinfo.fr/titres.rss), converti par [RSS2JSON](https://rss2json.com/)

Les numéros de suivi et les préférences restent dans le stockage local du navigateur. La météo locale, le radar, les actualités, le géocodage, les tuiles de carte et le suivi des colis nécessitent une connexion Internet. La position n’est demandée qu’après action sur le bouton météo et n’est pas transmise au service d’actualités.

## Déploiement

Le script npm `deploy` compile les fichiers statiques et déploie le contenu de `dist/` sur le projet Cloudflare Pages configuré. Si vous utilisez un autre projet Pages, modifiez son nom dans `package.json`.

Le workflow GitHub Actions `.github/workflows/deploy-pages.yml` déploie automatiquement chaque mise à jour de `main`. Pour l’activer, configurez dans les secrets Actions du dépôt `CLOUDFLARE_ACCOUNT_ID` et `CLOUDFLARE_API_TOKEN`. Le jeton doit disposer de l’autorisation de modification de Cloudflare Pages sur le compte concerné. Consultez le [guide Cloudflare pour les déploiements CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) pour créer ces identifiants.
