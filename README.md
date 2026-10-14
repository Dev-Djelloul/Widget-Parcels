# Widget Parcels

Widget Parcels est un tableau de bord bilingue de suivi de colis. Il enregistre les numéros de suivi et les préférences dans le navigateur, intègre le widget de suivi Parcel App et permet de consulter la météo actuelle d’une ville ou d’un pays choisi manuellement. Pour une recherche portant uniquement sur un pays, la météo est calculée à partir d’un point central approximatif. La carte peut afficher une provenance et une destination saisies manuellement ; le trajet est indicatif et ne représente pas la position réelle du colis.

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

Les numéros de suivi et les préférences restent dans le stockage local du navigateur. La consultation de la météo, le géocodage, les tuiles de carte et le suivi des colis nécessitent une connexion Internet.

## Déploiement

Le script npm `deploy` compile les fichiers statiques et déploie le contenu de `dist/` sur le projet Cloudflare Pages configuré. Si vous utilisez un autre projet Pages, modifiez son nom dans `package.json`.

Le workflow GitHub Actions `.github/workflows/deploy-pages.yml` déploie automatiquement chaque mise à jour de `main`. Pour l’activer, configurez dans les secrets Actions du dépôt `CLOUDFLARE_ACCOUNT_ID` et `CLOUDFLARE_API_TOKEN`. Le jeton doit disposer de l’autorisation de modification de Cloudflare Pages sur le compte concerné. Consultez le [guide Cloudflare pour les déploiements CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) pour créer ces identifiants.
