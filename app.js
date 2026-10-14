import { Map as MapLibreMap, Marker, NavigationControl, Popup } from './vendor/maplibre-gl/maplibre-gl.mjs';

const STORAGE_KEY = 'colis-saved-trackings';
const THEME_KEY = 'colis-theme';
const SIDEBAR_KEY = 'colis-sidebar-collapsed';
const form = document.querySelector('#add-form');
const input = document.querySelector('#tracking-input');
const formMessage = document.querySelector('#form-message');
const shipmentList = document.querySelector('#shipment-list');
const shipmentCount = document.querySelector('#shipment-count');
const emptyState = document.querySelector('#empty-state');
const widget = document.querySelector('#parcels-widget');
const parcelTrackingLink = document.querySelector('#parcel-tracking-link');
const weatherButton = document.querySelector('#weather-button');
const weatherResult = document.querySelector('#weather-result');
const weatherDescription = document.querySelector('#weather-description');
const weatherMap = document.querySelector('#weather-map');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const installButton = document.querySelector('#install-button');
const mobileMenuQuery = window.matchMedia('(max-width: 760px)');
let installPrompt;
let shipments = loadShipments();
let selectedTracking = shipments[0]?.number ?? '';
let weatherCoordinates;

const worldClocks = [
  { id: 'local-clock', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { id: 'utc-clock', timeZone: 'UTC' },
  { id: 'tokyo-clock', timeZone: 'Asia/Tokyo' },
  { id: 'new-york-clock', timeZone: 'America/New_York' }
];
document.querySelector('#local-timezone').textContent =
  (worldClocks[0].timeZone ?? 'UTC').replaceAll('_', ' ');
function updateWorldClocks() {
  const now = new Date();
  for (const clock of worldClocks) {
    document.getElementById(clock.id).textContent = new Intl.DateTimeFormat('fr-FR', {
      timeZone: clock.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(now);
  }
}
updateWorldClocks();
window.setInterval(updateWorldClocks, 1000);

const liveNewsItems = document.querySelector('#live-news-items');
function showNewsMessage(message, isError = false) {
  const paragraph = document.createElement('p');
  paragraph.className = 'live-news-message';
  paragraph.textContent = message;
  liveNewsItems.replaceChildren(paragraph);
  if (isError) console.error(message);
}

async function refreshNews() {
  try {
    const endpoint = new URL('https://api.rss2json.com/v1/api.json');
    endpoint.searchParams.set('rss_url', 'https://www.franceinfo.fr/titres.rss');
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Actualités indisponibles (${response.status}).`);
    const feed = await response.json();
    if (feed.status !== 'ok' || !Array.isArray(feed.items)) {
      throw new Error('Le flux des actualités est temporairement indisponible.');
    }
    const links = feed.items.slice(0, 3).map(article => {
      const title = typeof article.title === 'string' ? article.title.trim() : '';
      const href = typeof article.link === 'string' ? article.link.trim() : '';
      if (!title || !href) return null;
      let url;
      try {
        url = new URL(href);
      } catch {
        return null;
      }
      if (url.protocol !== 'https:') return null;
      const link = document.createElement('a');
      link.className = 'live-news-item';
      link.href = url.toString();
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = title;
      return link;
    }).filter(Boolean);
    if (links.length === 0) throw new Error('Aucun titre d’actualité disponible.');
    liveNewsItems.replaceChildren(...links);
  } catch (error) {
    showNewsMessage(error.message || 'Impossible de charger les actualités.', true);
  }
}

refreshNews();
window.setInterval(() => {
  if (!document.hidden) refreshNews();
}, 600_000);

function loadShipments() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored)
      ? stored
        .filter(item => typeof item?.number === 'string' && typeof item?.addedAt === 'string')
        .map(item => ({ ...item, route: isValidStoredRoute(item.route) ? item.route : undefined }))
      : [];
  } catch (error) {
    formMessage.textContent = 'Les colis enregistrés n’ont pas pu être lus.';
    formMessage.classList.add('is-error');
    return [];
  }
}

function saveShipments() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shipments));
    return true;
  } catch (error) {
    showMessage('Impossible d’enregistrer ce colis sur cet appareil.', true);
    return false;
  }
}

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle('is-error', isError);
}

function setSidebarCollapsed(collapsed, persist = true) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  if (!mobileMenuQuery.matches) {
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Déployer le menu latéral' : 'Réduire le menu latéral');
    sidebarToggle.title = collapsed ? 'Déployer le menu latéral' : 'Réduire le menu latéral';
    sidebarToggle.querySelector('span').textContent = collapsed ? '›' : '‹';
  }
  if (!persist) return;
  try {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  } catch (error) {
    showMessage('Le menu a changé, mais votre préférence ne peut pas être enregistrée.', true);
  }
}

function setMobileMenuOpen(open) {
  document.body.classList.toggle('mobile-menu-open', open);
  sidebarToggle.setAttribute('aria-expanded', String(open));
  sidebarToggle.setAttribute('aria-label', open ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation');
  sidebarToggle.title = open ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation';
  sidebarToggle.querySelector('span').textContent = '';
}

try {
  setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === 'true', false);
} catch (error) {
  showMessage('Votre préférence de menu latéral ne peut pas être lue.', true);
}

if (mobileMenuQuery.matches) setMobileMenuOpen(false);

sidebarToggle.addEventListener('click', () => {
  if (mobileMenuQuery.matches) {
    setMobileMenuOpen(!document.body.classList.contains('mobile-menu-open'));
    return;
  }
  setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
});

mobileMenuQuery.addEventListener('change', event => {
  setMobileMenuOpen(false);
  if (!event.matches) {
    const collapsed = document.body.classList.contains('sidebar-collapsed');
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Déployer le menu latéral' : 'Réduire le menu latéral');
    sidebarToggle.title = collapsed ? 'Déployer le menu latéral' : 'Réduire le menu latéral';
    sidebarToggle.querySelector('span').textContent = collapsed ? '›' : '‹';
  }
});

document.querySelectorAll('.main-nav .nav-link').forEach(link => {
  link.addEventListener('click', () => {
    if (mobileMenuQuery.matches) setMobileMenuOpen(false);
  });
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  installButton.disabled = true;
  try {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  } catch (error) {
    console.error('Impossible d’ouvrir l’invite d’installation de l’application.', error);
  } finally {
    installButton.disabled = false;
  }
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(error => console.error('Impossible d’activer le mode hors ligne de l’application.', error));
  });
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
    .format(new Date(dateString));
}

function detectCarrier(trackingNumber) {
  const number = trackingNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const carriers = [
    { id: 'ups', label: 'UPS', mark: 'UPS', matches: value => /^1Z[A-Z0-9]{16}$/.test(value) },
    { id: 'dhl', label: 'DHL', mark: 'DHL', matches: value => /^(?:JJD|JVGL|JD|3S)[A-Z0-9]{8,}$/.test(value) },
    { id: 'laposte', label: 'La Poste / Colissimo', mark: 'LP', matches: value => /^[A-Z]{2}\d{9}FR$/.test(value) },
    { id: 'royal-mail', label: 'Royal Mail', mark: 'RM', matches: value => /^[A-Z]{2}\d{9}GB$/.test(value) },
    { id: 'postnl', label: 'PostNL', mark: 'NL', matches: value => /^[A-Z]{2}\d{9}NL$/.test(value) },
    { id: 'usps', label: 'USPS', mark: 'US', matches: value => /^(?:92|93|94|95)\d{18,20}$/.test(value) },
    { id: 'fedex', label: 'FedEx', mark: 'FDX', matches: value => /^\d{12}$|^\d{15}$|^\d{20}$|^\d{22}$/.test(value) }
  ];
  return carriers.find(carrier => carrier.matches(number)) ?? {
    id: 'generic',
    label: 'Transporteur non détecté',
    mark: '▣'
  };
}

function setOutboundLinkBehavior(link) {
  if (!(link instanceof HTMLAnchorElement) || !link.href) return;
  try {
    if (new URL(link.href).origin === window.location.origin) return;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } catch (error) {
    console.warn('Lien externe ignoré : adresse invalide.');
  }
}

document.querySelectorAll('a[href]').forEach(setOutboundLinkBehavior);
document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  setOutboundLinkBehavior(event.target.closest('a[href]'));
});

function updateWidget() {
  const url = new URL('https://parcelsapp.com/widget');
  url.searchParams.set('textButton', 'Suivre le colis');
  url.searchParams.set('placeholder', 'Entrez votre numéro de suivi');
  url.searchParams.set('backgroundColorButton', '#2f6b55');
  url.searchParams.set('colorButton', '#ffffff');
  url.searchParams.set('borderRadiusButton', '10px');
  url.searchParams.set('borderRadiusInput', '10px');
  url.searchParams.set('widgetWrapBorder', '0');
  url.searchParams.set('widgetWrapBorderRadius', '12px');
  if (selectedTracking) {
    url.searchParams.set('trackingNumber', selectedTracking);
    parcelTrackingLink.href = `https://parcelsapp.com/en/tracking/${encodeURIComponent(selectedTracking)}`;
  } else {
    parcelTrackingLink.href = 'https://parcelsapp.com/';
  }
  setOutboundLinkBehavior(parcelTrackingLink);
  widget.src = url.toString();
}

function renderShipments() {
  shipmentList.replaceChildren();
  shipmentCount.textContent = String(shipments.length);
  emptyState.hidden = shipments.length > 0;

  for (const shipment of shipments) {
    const item = document.createElement('article');
    item.className = `shipment-item${shipment.number === selectedTracking ? ' is-selected' : ''}`;

    const icon = document.createElement('span');
    icon.className = 'shipment-icon';
    const carrier = detectCarrier(shipment.number);
    icon.dataset.carrier = carrier.id;
    icon.textContent = carrier.mark;
    icon.title = carrier.label;
    icon.setAttribute('aria-label', carrier.label);

    const info = document.createElement('div');
    info.className = 'shipment-info';
    if (shipment.number === editingShipment) {
      const renameForm = document.createElement('form');
      renameForm.className = 'shipment-rename-form';
      const renameInput = document.createElement('input');
      renameInput.className = 'shipment-rename-input';
      renameInput.type = 'text';
      renameInput.maxLength = 60;
      renameInput.value = shipment.name ?? '';
      renameInput.placeholder = 'Nom du colis';
      renameInput.setAttribute('aria-label', `Nom du colis ${shipment.number}`);
      const saveName = document.createElement('button');
      saveName.className = 'shipment-save-name';
      saveName.type = 'submit';
      saveName.textContent = 'Enregistrer';
      const cancelRename = document.createElement('button');
      cancelRename.className = 'shipment-cancel-rename';
      cancelRename.type = 'button';
      cancelRename.textContent = 'Annuler';
      cancelRename.addEventListener('click', () => {
        editingShipment = '';
        renderShipments();
      });
      renameForm.addEventListener('submit', event => {
        event.preventDefault();
        const name = renameInput.value.trim();
        const previousShipments = shipments;
        shipments = shipments.map(saved => {
          if (saved.number !== shipment.number) return saved;
          const renamed = { ...saved };
          if (name) renamed.name = name;
          else delete renamed.name;
          return renamed;
        });
        if (!saveShipments()) {
          shipments = previousShipments;
          return;
        }
        editingShipment = '';
        renderShipments();
        showMessage(name ? 'Nom du colis mis à jour.' : 'Nom personnalisé supprimé.');
      });
      renameForm.append(renameInput, saveName, cancelRename);
      info.append(renameForm);
      queueMicrotask(() => renameInput.focus());
    } else {
      const name = document.createElement('span');
      name.className = 'shipment-name';
      name.textContent = shipment.name || shipment.number;
      info.append(name);
      if (shipment.name) {
        const number = document.createElement('span');
        number.className = 'shipment-number';
        number.textContent = shipment.number;
        info.append(number);
      }
      const date = document.createElement('span');
      date.className = 'shipment-date';
      date.textContent = `Ajouté le ${formatDate(shipment.addedAt)}`;
      info.append(date);
    }

    const actions = document.createElement('div');
    actions.className = 'shipment-actions';
    const select = document.createElement('button');
    select.className = 'shipment-select';
    select.type = 'button';
    select.textContent = shipment.number === selectedTracking ? 'Sélectionné' : 'Suivre';
    select.setAttribute('aria-label', `Suivre le colis ${shipment.number}`);
    select.addEventListener('click', () => {
      selectedTracking = shipment.number;
      updateWidget();
      renderShipments();
      updateSelectedParcelRoute();
      document.querySelector('#suivi').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const rename = document.createElement('button');
    rename.className = 'shipment-rename';
    rename.type = 'button';
    rename.textContent = 'Renommer';
    rename.setAttribute('aria-label', `Renommer le colis ${shipment.number}`);
    rename.addEventListener('click', () => {
      editingShipment = shipment.number;
      renderShipments();
    });

    const remove = document.createElement('button');
    remove.className = 'shipment-remove';
    remove.type = 'button';
    remove.textContent = 'Retirer';
    remove.setAttribute('aria-label', `Retirer le colis ${shipment.number}`);
    remove.addEventListener('click', () => {
      const previousShipments = shipments;
      const previousSelection = selectedTracking;
      shipments = shipments.filter(saved => saved.number !== shipment.number);
      if (selectedTracking === shipment.number) selectedTracking = shipments[0]?.number ?? '';
      if (!saveShipments()) {
        shipments = previousShipments;
        selectedTracking = previousSelection;
        return;
      }
      updateWidget();
      renderShipments();
      updateSelectedParcelRoute();
    });
    if (shipment.number === editingShipment) {
      actions.append(remove);
    } else {
      actions.append(select, rename, remove);
    }
    item.append(icon, info, actions);
    shipmentList.append(item);
  }
}

let editingShipment = '';

form.addEventListener('submit', event => {
  event.preventDefault();
  const trackingNumber = input.value.trim();
  if (!trackingNumber) {
    showMessage('Saisissez un numéro de suivi pour continuer.', true);
    input.focus();
    return;
  }
  if (shipments.some(shipment => shipment.number.toLowerCase() === trackingNumber.toLowerCase())) {
    showMessage('Ce numéro est déjà dans votre liste.', true);
    input.focus();
    return;
  }

  shipments.unshift({ number: trackingNumber, addedAt: new Date().toISOString() });
  selectedTracking = trackingNumber;
  if (!saveShipments()) {
    shipments.shift();
    selectedTracking = shipments[0]?.number ?? '';
    return;
  }
  updateWidget();
  renderShipments();
  updateSelectedParcelRoute();
  input.value = '';
  showMessage('Colis ajouté à votre liste.');
});

document.querySelector('#theme-toggle').addEventListener('click', event => {
  const isDark = document.body.classList.toggle('dark-theme');
  event.currentTarget.setAttribute('aria-label', isDark ? 'Activer le thème clair' : 'Activer le thème sombre');
  try {
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  } catch (error) {
    showMessage('Le thème a changé, mais votre préférence ne peut pas être enregistrée.', true);
  }
});

try {
  if (localStorage.getItem(THEME_KEY) === 'dark') {
    document.body.classList.add('dark-theme');
    document.querySelector('#theme-toggle').setAttribute('aria-label', 'Activer le thème clair');
  }
} catch (error) {
  showMessage('Votre préférence de thème ne peut pas être lue.', true);
}

const weatherLabels = {
  0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Nuageux',
  45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine',
  55: 'Bruine dense', 61: 'Pluie légère', 63: 'Pluie', 65: 'Forte pluie',
  71: 'Neige légère', 73: 'Neige', 75: 'Forte neige', 80: 'Averses légères',
  81: 'Averses', 82: 'Fortes averses', 95: 'Orage',
  56: 'Bruine verglaçante', 57: 'Bruine verglaçante dense',
  66: 'Pluie verglaçante', 67: 'Pluie verglaçante forte',
  77: 'Grains de neige', 85: 'Averses de neige', 86: 'Fortes averses de neige',
  96: 'Orage avec grêle légère', 99: 'Orage avec forte grêle'
};

async function geocode(query) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query, count: '10', language: 'fr', format: 'json' }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Recherche de lieu indisponible (${response.status}).`);
  const { results } = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`Aucun lieu trouvé pour « ${query} ». Essayez « ville, pays ».`);
  }
  return results.find(result => result.feature_code === 'PCLI') ?? results[0];
}

const placeName = location => [location.name, location.admin1, location.country]
  .filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ');

function setWeatherMapLocation(latitude, longitude) {
  const endpoint = new URL('https://embed.windy.com/embed.html');
  endpoint.search = new URLSearchParams({
    type: 'map',
    location: 'coordinates',
    metricRain: 'default',
    metricTemp: 'default',
    metricWind: 'default',
    zoom: '6',
    overlay: 'rain',
    product: 'ecmwf',
    level: 'surface',
    lat: String(latitude),
    lon: String(longitude),
    detailLat: String(latitude),
    detailLon: String(longitude),
    lang: 'fr'
  }).toString();
  weatherMap.src = endpoint.toString();
}

async function fetchCurrentWeather(latitude, longitude) {
  const endpoint = new URL('https://api.open-meteo.com/v1/forecast');
  endpoint.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code',
    temperature_unit: 'celsius',
    timezone: 'auto'
  }).toString();
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Météo indisponible (${response.status}).`);
  const data = await response.json();
  if (
    typeof data.current?.temperature_2m !== 'number' ||
    typeof data.current.weather_code !== 'number'
  ) {
    throw new Error('Les données météo reçues sont incomplètes.');
  }
  return data.current;
}

function formatWeather(current) {
  const apparentTemperature = typeof current.apparent_temperature === 'number'
    ? ` · ressenti ${Math.round(current.apparent_temperature)} °C`
    : '';
  const currentTime = typeof current.time === 'string'
    ? ` · ${current.time.slice(-5)} heure locale`
    : '';
  return `${Math.round(current.temperature_2m)} °C · ` +
    `${weatherLabels[current.weather_code] ?? 'Conditions actuelles'}` +
    `${apparentTemperature}${currentTime}`;
}

async function refreshCurrentWeather() {
  if (!weatherCoordinates) return;
  try {
    const current = await fetchCurrentWeather(weatherCoordinates.latitude, weatherCoordinates.longitude);
    weatherResult.textContent = formatWeather(current);
    weatherResult.classList.remove('is-error');
  } catch (error) {
    weatherResult.textContent = error.message || 'Impossible de mettre à jour la météo.';
    weatherResult.classList.add('is-error');
  }
}

const parcelRouteForm = document.querySelector('#parcel-route-form');
const parcelRouteResult = document.querySelector('#parcel-route-result');
const parcelMapElement = document.querySelector('#parcel-map');
let parcelGlobe;
let parcelGlobeLoaded = false;
let parcelGlobeMarkers = [];
let parcelMapPoints = [];
const routeRequests = new Set();

function isValidStoredRoute(route) {
  const isPoint = point =>
    typeof point?.name === 'string' &&
    Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
    Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
  return isPoint(route?.origin) && isPoint(route?.destination);
}

function greatCircle(from, to, steps = 64) {
  const toVector = ({ latitude, longitude }) => {
    const lat = latitude * Math.PI / 180;
    const lon = longitude * Math.PI / 180;
    return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  };
  const start = toVector(from);
  const end = toVector(to);
  const dot = Math.min(1, Math.max(-1, start.reduce((sum, value, index) => sum + value * end[index], 0)));
  const angle = Math.acos(dot);
  if (angle < 1e-6) return [[from.longitude, from.latitude], [to.longitude, to.latitude]];
  const sinAngle = Math.sin(angle);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    const startWeight = Math.sin((1 - progress) * angle) / sinAngle;
    const endWeight = Math.sin(progress * angle) / sinAngle;
    const vector = start.map((value, axis) => startWeight * value + endWeight * end[axis]);
    const latitude = Math.atan2(vector[2], Math.hypot(vector[0], vector[1])) * 180 / Math.PI;
    const longitude = Math.atan2(vector[1], vector[0]) * 180 / Math.PI;
    return [longitude, latitude];
  });
}

function showParcelGlobePoints(points) {
  parcelMapPoints = points;
  parcelMapElement.hidden = false;
  if (!parcelGlobeLoaded) return;

  parcelGlobeMarkers.forEach(marker => marker.remove());
  parcelGlobeMarkers = points.map((point, index) => {
    const element = document.createElement('span');
    element.className = `parcel-map-marker${index === 1 ? ' is-destination' : ''}`;
    element.setAttribute('aria-hidden', 'true');
    return new Marker({ element, anchor: 'center' })
      .setLngLat([point.longitude, point.latitude])
      .setPopup(new Popup({ offset: 12 }).setText(point.label))
      .addTo(parcelGlobe);
  });

  const route = parcelGlobe.getSource('parcel-route');
  route.setData({
    type: 'FeatureCollection',
    features: points.length > 1 ? [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: greatCircle(points[0], points[1]) }
    }] : []
  });

  if (points.length > 1) {
    const toVector = ({ latitude, longitude }) => {
      const lat = latitude * Math.PI / 180;
      const lon = longitude * Math.PI / 180;
      return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    };
    const origin = toVector(points[0]);
    const destination = toVector(points[1]);
    const midpoint = origin.map((value, axis) => value + destination[axis]);
    const length = Math.hypot(...midpoint);
    const center = length < 1e-6
      ? [points[0].longitude, points[0].latitude]
      : [
        Math.atan2(midpoint[1], midpoint[0]) * 180 / Math.PI,
        Math.atan2(midpoint[2], Math.hypot(midpoint[0], midpoint[1])) * 180 / Math.PI
      ];
    parcelGlobe.easeTo({ center, zoom: 0.7, duration: 900 });
  } else if (points.length === 1) {
    parcelGlobe.easeTo({ center: [points[0].longitude, points[0].latitude], zoom: 0.7, duration: 900 });
  }
}

function initializeParcelGlobe() {
  if (parcelGlobe) return;
  parcelGlobe = new MapLibreMap({
    container: parcelMapElement,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [0, 20],
    zoom: 0.7,
    projection: { type: 'globe' },
    attributionControl: true,
    scrollZoom: false
  });
  parcelGlobe.addControl(new NavigationControl(), 'top-right');
  parcelGlobe.once('load', () => {
    parcelGlobe.addSource('parcel-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    parcelGlobe.addLayer({
      id: 'parcel-route-line',
      type: 'line',
      source: 'parcel-route',
      paint: { 'line-color': '#2f6b55', 'line-width': 3, 'line-dasharray': [2, 2] }
    });
    parcelGlobeLoaded = true;
    showParcelGlobePoints(parcelMapPoints);
  });
}

if ('IntersectionObserver' in window) {
  const globeObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      initializeParcelGlobe();
      globeObserver.disconnect();
    }
  }, { rootMargin: '200px' });
  globeObserver.observe(parcelMapElement);
} else {
  initializeParcelGlobe();
}

async function requestParcelTracking(trackingNumber, requestId) {
  const carrier = detectCarrier(trackingNumber);
  const body = requestId
    ? { requestId }
    : {
      trackingNumber,
      ...(carrier.id === 'generic' ? {} : { carrierHint: carrier.id })
    };
  const response = await fetch('/api/tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    const message = response.status === 502
      ? 'Le serveur de suivi a renvoyé une erreur Cloudflare (502).'
      : `Réponse invalide du serveur de suivi (HTTP ${response.status}).`;
    throw new Error(message);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Le serveur de suivi a renvoyé une réponse JSON invalide.');
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Le serveur de suivi a renvoyé une réponse invalide.');
  }
  if (!response.ok) throw new Error(result.error || `Suivi indisponible (${response.status}).`);
  return result;
}

async function updateSelectedParcelRoute() {
  if (!selectedTracking) {
    parcelRouteResult.textContent = 'Ajoutez un colis pour rechercher automatiquement son trajet.';
    parcelRouteResult.classList.remove('is-error');
    showParcelGlobePoints([]);
    return;
  }

  const shipment = shipments.find(item => item.number === selectedTracking);
  if (!shipment) return;
  if (isValidStoredRoute(shipment.route)) {
    showParcelGlobePoints([
      { ...shipment.route.origin, label: `Provenance : ${shipment.route.origin.name}` },
      { ...shipment.route.destination, label: `Destination : ${shipment.route.destination.name}` }
    ]);
    parcelRouteResult.textContent =
      `${shipment.route.origin.name} → ${shipment.route.destination.name} · trajet indicatif`;
    parcelRouteResult.classList.remove('is-error');
    return;
  }
  if (routeRequests.has(selectedTracking)) return;

  const trackingNumber = selectedTracking;
  routeRequests.add(trackingNumber);
  parcelRouteResult.textContent = 'Recherche du trajet auprès du transporteur…';
  parcelRouteResult.classList.remove('is-error');
  try {
    let result = await requestParcelTracking(trackingNumber);
    for (let attempt = 0; result.pending && attempt < 8; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 1500));
      result = await requestParcelTracking(trackingNumber, result.requestId);
    }
    if (result.pending) throw new Error('Le transporteur n’a pas encore transmis les lieux du colis.');
    if (!result.origin || !result.destination) {
      throw new Error('Le transporteur ne fournit pas la provenance ou la destination. Vous pouvez les saisir manuellement.');
    }
    const [from, to] = await Promise.all([geocode(result.origin), geocode(result.destination)]);
    const route = {
      origin: { name: placeName(from), latitude: from.latitude, longitude: from.longitude },
      destination: { name: placeName(to), latitude: to.latitude, longitude: to.longitude }
    };
    shipments = shipments.map(item => item.number === trackingNumber ? { ...item, route } : item);
    if (!saveShipments()) return;
    renderShipments();
    if (selectedTracking === trackingNumber) {
      showParcelGlobePoints([
        { ...route.origin, label: `Provenance : ${route.origin.name}` },
        { ...route.destination, label: `Destination : ${route.destination.name}` }
      ]);
      parcelRouteResult.textContent = `${route.origin.name} → ${route.destination.name} · trajet indicatif`;
      parcelRouteResult.classList.remove('is-error');
    }
  } catch (error) {
    if (selectedTracking === trackingNumber) {
      parcelRouteResult.textContent =
        `${error.message || 'Trajet automatique indisponible.'} Saisie manuelle disponible ci-dessous.`;
      parcelRouteResult.classList.add('is-error');
    }
  } finally {
    routeRequests.delete(trackingNumber);
  }
}

parcelRouteForm.addEventListener('submit', async event => {
  event.preventDefault();
  const origin = document.querySelector('#parcel-origin').value.trim();
  const destination = document.querySelector('#parcel-destination').value.trim();
  const button = parcelRouteForm.querySelector('button[type="submit"]');
  button.disabled = true;
  parcelRouteResult.classList.remove('is-error');
  parcelRouteResult.textContent = 'Recherche du trajet…';
  try {
    const [from, to] = await Promise.all([geocode(origin), geocode(destination)]);
    const route = {
      origin: { name: placeName(from), latitude: from.latitude, longitude: from.longitude },
      destination: { name: placeName(to), latitude: to.latitude, longitude: to.longitude }
    };
    shipments = shipments.map(item => item.number === selectedTracking ? { ...item, route } : item);
    if (!saveShipments()) return;
    renderShipments();
    showParcelGlobePoints([
      { ...route.origin, label: `Provenance : ${route.origin.name}` },
      { ...route.destination, label: `Destination : ${route.destination.name}` }
    ]);
    parcelRouteResult.textContent = `${placeName(from)} → ${placeName(to)}`;
  } catch (error) {
    parcelRouteResult.textContent = error.message || 'Impossible d’afficher le trajet.';
    parcelRouteResult.classList.add('is-error');
  } finally {
    button.disabled = false;
  }
});

const destinationWeatherForm = document.querySelector('#destination-weather-form');
const destinationLocationInput = document.querySelector('#destination-location');

destinationWeatherForm.addEventListener('submit', async event => {
  event.preventDefault();
  const query = destinationLocationInput.value.trim();
  if (query.length < 2) {
    weatherResult.textContent = 'Saisissez au moins deux caractères.';
    weatherResult.classList.add('is-error');
    return;
  }

  const submitButton = destinationWeatherForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Recherche…';
  weatherResult.classList.remove('is-error');
  weatherDescription.textContent = 'Recherche de la météo…';
  weatherResult.textContent = '';
  try {
    const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geocodingUrl.search = new URLSearchParams({
      name: query,
      count: '10',
      language: 'fr',
      format: 'json'
    }).toString();
    const geocodingResponse = await fetch(geocodingUrl);
    if (!geocodingResponse.ok) throw new Error(`Recherche de destination indisponible (${geocodingResponse.status}).`);
    const geocoding = await geocodingResponse.json();
    const locations = geocoding.results;
    if (!Array.isArray(locations) || locations.length === 0) {
      throw new Error('Aucune ville ou aucun pays correspondant. Essayez « ville, pays ».');
    }
    const location = locations.find(result => result.feature_code === 'PCLI') ?? locations[0];
    const current = await fetchCurrentWeather(location.latitude, location.longitude);
    const isCountryCenter = location.feature_code === 'PCLI';
    const place = isCountryCenter
      ? `${location.name} (centre du pays, estimation)`
      : placeName(location);
    weatherResult.textContent = formatWeather(current);
    weatherResult.classList.remove('is-error');
    weatherDescription.textContent = place;
    weatherCoordinates = { latitude: location.latitude, longitude: location.longitude };
    setWeatherMapLocation(location.latitude, location.longitude);
  } catch (error) {
    weatherDescription.textContent = 'La météo de ce lieu n’a pas pu être chargée.';
    weatherResult.textContent = error.message || 'Impossible de récupérer la météo.';
    weatherResult.classList.add('is-error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Rechercher';
  }
});

weatherButton.addEventListener('click', () => {
  if (!navigator.geolocation) {
    weatherDescription.textContent = 'La géolocalisation n’est pas disponible dans ce navigateur.';
    weatherResult.textContent = 'Essayez plutôt une recherche par ville.';
    return;
  }
  weatherResult.classList.remove('is-error');
  weatherButton.disabled = true;
  weatherButton.textContent = 'Localisation…';
  weatherDescription.textContent = 'Recherche de la météo près de vous…';
  weatherResult.textContent = '';
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const { latitude, longitude } = position.coords;
      weatherCoordinates = { latitude, longitude };
      setWeatherMapLocation(latitude, longitude);
      const current = await fetchCurrentWeather(latitude, longitude);
      weatherResult.textContent = formatWeather(current);
      weatherDescription.textContent = 'Météo actuelle près de vous';
    } catch (error) {
      weatherDescription.textContent = error.message || 'Impossible de récupérer la météo pour le moment.';
      weatherResult.textContent = 'Essayez une recherche par ville.';
      weatherResult.classList.add('is-error');
    } finally {
      weatherButton.disabled = false;
      weatherButton.innerHTML = 'Utiliser ma position <span aria-hidden="true">→</span>';
    }
  }, error => {
    const message = error.code === error.PERMISSION_DENIED
      ? 'Autorisez la localisation pour afficher la météo près de vous.'
      : 'Votre position est indisponible. Vérifiez les réglages de localisation.';
    weatherDescription.textContent = message;
    weatherResult.textContent = 'Vous pouvez aussi rechercher une ville.';
    weatherButton.disabled = false;
    weatherButton.innerHTML = 'Utiliser ma position <span aria-hidden="true">→</span>';
  }, { timeout: 10000, maximumAge: 300000 });
});

window.setInterval(() => {
  if (!document.hidden) refreshCurrentWeather();
}, 600_000);

renderShipments();
updateWidget();
updateSelectedParcelRoute();
