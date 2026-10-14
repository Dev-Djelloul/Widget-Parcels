# Widget Parcels

Widget Parcels is a French/English parcel-tracking dashboard. It stores tracking numbers and preferences in the browser, embeds the Parcel App tracking widget, and offers current weather lookup for a manually selected city or country. A country-only query uses an approximate central location. The map can show a manually entered parcel origin and destination; it is an illustrative route, not live parcel geolocation.

## Run locally

Use Node.js and npm to build the static app:

```bash
npm install
npm run build
```

Serve the project root or the generated `dist/` directory with any static HTTP server. The app is also available without a build step by serving the project root directly.

## External services

- Parcel tracking: [Parcel App](https://parcelsapp.com/)
- Geocoding and weather: [Open-Meteo](https://open-meteo.com/)
- Maps: [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/)

Tracking numbers and preferences remain in the browser's local storage. Weather lookup, geocoding, map tiles, and parcel tracking require an internet connection.

## Deployment

The `deploy` npm script builds the static files and deploys `dist/` to the configured Cloudflare Pages project. Adjust the project name in `package.json` if using a different Pages project.
