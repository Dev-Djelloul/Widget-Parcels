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
const weatherRadarStatus = document.querySelector('#weather-radar-status');
const weatherRadarPlayButton = document.querySelector('#weather-radar-play');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const installButton = document.querySelector('#install-button');
const mobileMenuQuery = window.matchMedia('(max-width: 760px)');
let installPrompt;
let shipments = loadShipments();
let selectedTracking = shipments[0]?.number ?? '';

function loadShipments() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored)
      ? stored.filter(item => typeof item?.number === 'string' && typeof item?.addedAt === 'string')
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

const mapMaps = {};
function getMap(id, { center = [20, 0], zoom = 2 } = {}) {
  if (!window.L) return null;
  if (!mapMaps[id]) {
    const map = L.map(id, { scrollWheelZoom: false }).setView(center, zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    mapMaps[id] = { map, layer: L.layerGroup().addTo(map) };
  }
  return mapMaps[id];
}

function showPoints(id, points) {
  const element = document.getElementById(id);
  element.hidden = false;
  const entry = getMap(id);
  if (!entry) return;
  entry.layer.clearLayers();
  points.forEach(point => L.marker([point.latitude, point.longitude]).bindPopup(point.label).addTo(entry.layer));
  if (points.length > 1) {
    L.polyline(points.map(point => [point.latitude, point.longitude]), { color: '#2f6b55', dashArray: '6 8', weight: 3 }).addTo(entry.layer);
    entry.map.fitBounds(points.map(point => [point.latitude, point.longitude]), { padding: [30, 30] });
  } else {
    entry.map.setView([points[0].latitude, points[0].longitude], points[0].zoom ?? 8);
  }
  setTimeout(() => entry.map.invalidateSize(), 0);
}

const placeName = location => [location.name, location.admin1, location.country]
  .filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ');

const weatherMapEntry = getMap('weather-map', { center: [46.6, 2.4], zoom: 5 });
let weatherRadarLayer;
let weatherRadarFrames = [];
let weatherRadarFrameIndex = -1;
let weatherRadarPlayback;
let weatherCoordinates;
let weatherLocationMarker;

function showRadarFrame(index) {
  const frame = weatherRadarFrames[index];
  if (!frame || !weatherMapEntry) return;
  weatherRadarFrameIndex = index;
  const tileUrl = `${weatherRadarHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
  if (!weatherRadarLayer) {
    weatherRadarLayer = L.tileLayer(tileUrl, {
      maxZoom: 18,
      maxNativeZoom: 7,
      opacity: 0.68,
      attribution: '&copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
    }).addTo(weatherMapEntry.map);
  } else {
    weatherRadarLayer.setUrl(tileUrl);
  }
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .format(new Date(frame.time * 1000));
  weatherRadarStatus.textContent = `Radar des précipitations · image de ${time}`;
}

let weatherRadarHost = '';
async function refreshWeatherRadar() {
  weatherRadarStatus.classList.remove('is-error');
  if (weatherRadarFrames.length === 0) weatherRadarStatus.textContent = 'Chargement du radar…';
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Radar météo indisponible (${response.status}).`);
    const metadata = await response.json();
    const host = new URL(metadata.host);
    if (host.protocol !== 'https:' || !host.hostname.endsWith('.rainviewer.com')) {
      throw new Error('Adresse du radar météo invalide.');
    }
    if (!weatherMapEntry) throw new Error('La carte météo ne peut pas être affichée.');
    const frames = metadata.radar?.past;
    if (!Array.isArray(frames)) throw new Error('Les images du radar météo sont indisponibles.');
    const validFrames = frames.filter(frame =>
      Number.isFinite(frame.time) && typeof frame.path === 'string' && /^\/v2\/radar\/[\w-]+$/.test(frame.path)
    );
    if (validFrames.length === 0) throw new Error('Aucune image récente du radar météo.');
    weatherRadarHost = host.origin;
    weatherRadarFrames = validFrames;
    weatherRadarPlayButton.disabled = false;
    if (!weatherRadarPlayback) showRadarFrame(validFrames.length - 1);
    if (weatherMapEntry) setTimeout(() => weatherMapEntry.map.invalidateSize(), 0);
  } catch (error) {
    weatherRadarStatus.textContent = error.message || 'Impossible de charger le radar météo.';
    weatherRadarStatus.classList.add('is-error');
  }
}

weatherRadarPlayButton.addEventListener('click', () => {
  if (weatherRadarPlayback) {
    clearInterval(weatherRadarPlayback);
    weatherRadarPlayback = undefined;
    weatherRadarPlayButton.textContent = 'Lire le radar';
    showRadarFrame(weatherRadarFrames.length - 1);
    return;
  }
  if (weatherRadarFrames.length === 0) return;
  weatherRadarPlayButton.textContent = 'Mettre en pause';
  let index = 0;
  showRadarFrame(index);
  weatherRadarPlayback = setInterval(() => {
    index = (index + 1) % weatherRadarFrames.length;
    showRadarFrame(index);
  }, 700);
});

refreshWeatherRadar();
setInterval(() => {
  if (!document.hidden) refreshWeatherRadar();
}, 600_000);

const worldClock = document.querySelector('#world-clock');
const localClock = document.querySelector('#local-clock');
const localTimezone = document.querySelector('#local-timezone');
const localTimezoneName = new Intl.DateTimeFormat().resolvedOptions().timeZone || 'fuseau de l’appareil';
localTimezone.textContent = localTimezoneName.replaceAll('_', ' ');

function updateClocks() {
  const now = new Date();
  const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
  worldClock.textContent = new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(now);
  localClock.textContent = new Intl.DateTimeFormat('fr-FR', options).format(now);
  worldClock.dateTime = now.toISOString();
  localClock.dateTime = now.toISOString();
}

updateClocks();
setInterval(updateClocks, 1000);

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
setInterval(() => {
  if (!document.hidden) refreshNews();
}, 600_000);

const parcelRouteForm = document.querySelector('#parcel-route-form');
const parcelRouteResult = document.querySelector('#parcel-route-result');
getMap('parcel-map');

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
    showPoints('parcel-map', [
      { latitude: from.latitude, longitude: from.longitude, label: `Provenance : ${placeName(from)}` },
      { latitude: to.latitude, longitude: to.longitude, label: `Destination : ${placeName(to)}` }
    ]);
    parcelRouteResult.textContent = `${placeName(from)} → ${placeName(to)}`;
  } catch (error) {
    parcelRouteResult.textContent = error.message || 'Impossible d’afficher le trajet.';
    parcelRouteResult.classList.add('is-error');
  } finally {
    button.disabled = false;
  }
});

async function loadCurrentWeather(latitude, longitude) {
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
  const current = data.current;
  if (!current || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') {
    throw new Error('Les données météo reçues sont incomplètes.');
  }
  const apparentTemperature = typeof current.apparent_temperature === 'number'
    ? ` · ressenti ${Math.round(current.apparent_temperature)} °C`
    : '';
  weatherResult.textContent =
    `${Math.round(current.temperature_2m)} °C · ${weatherLabels[current.weather_code] ?? 'Conditions actuelles'}` +
    `${apparentTemperature}`;
  weatherDescription.textContent = 'Conditions météo à votre position, actualisées toutes les 10 minutes.';
}

weatherButton.addEventListener('click', () => {
  if (!navigator.geolocation) {
    weatherResult.textContent = 'La géolocalisation n’est pas disponible dans ce navigateur.';
    return;
  }
  weatherButton.disabled = true;
  weatherButton.textContent = 'Localisation…';
  weatherResult.textContent = 'Recherche de la météo près de vous…';
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const { latitude, longitude } = position.coords;
      weatherCoordinates = { latitude, longitude };
      if (weatherMapEntry) {
        weatherMapEntry.map.setView([latitude, longitude], 6);
        weatherLocationMarker?.remove();
        weatherLocationMarker = L.circleMarker([latitude, longitude], {
          color: '#fff',
          fillColor: '#2f6b55',
          fillOpacity: 1,
          radius: 7,
          weight: 2
        }).bindPopup('Votre position').addTo(weatherMapEntry.map);
      }
      await loadCurrentWeather(latitude, longitude);
      weatherButton.textContent = 'Actualiser ↻';
    } catch (error) {
      weatherResult.textContent = error.message || 'Impossible de récupérer la météo pour le moment.';
      weatherButton.textContent = 'Réessayer →';
    } finally {
      weatherButton.disabled = false;
    }
  }, error => {
    const message = error.code === error.PERMISSION_DENIED
      ? 'Autorisez la localisation pour afficher la météo près de vous.'
      : 'Votre position est indisponible. Vérifiez les réglages de localisation.';
    weatherResult.textContent = message;
    weatherButton.textContent = 'Réessayer →';
    weatherButton.disabled = false;
  }, { timeout: 10000, maximumAge: 300000 });
});

setInterval(() => {
  if (!document.hidden && weatherCoordinates) {
    loadCurrentWeather(weatherCoordinates.latitude, weatherCoordinates.longitude)
      .catch(error => {
        weatherResult.textContent = error.message || 'Impossible de mettre à jour la météo.';
      });
  }
}, 600_000);

renderShipments();
updateWidget();
