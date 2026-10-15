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
const parcelTrackingLink = document.querySelector('#parcel-tracking-link');
const trackingSummary = document.querySelector('#tracking-summary');
const trackingEvents = document.querySelector('#tracking-events');
const parcelWidgetDetails = document.querySelector('#parcel-widget-details');
const parcelWidget = document.querySelector('#parcels-widget');
const trackingCountryForm = document.querySelector('#tracking-country-form');
const trackingDestinationCountry = document.querySelector('#tracking-destination-country');
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
    { id: 'ups', label: 'UPS', mark: 'UPS', hint: true, matches: value => /^1Z[A-Z0-9]{16}$/.test(value) },
    { id: 'dhl', label: 'DHL', mark: 'DHL', hint: true, matches: value => /^(?:JJD|JVGL|JD|3S)[A-Z0-9]{8,}$/.test(value) },
    { id: 'laposte', label: 'La Poste / Colissimo', mark: 'LP', hint: true, matches: value => /^[A-Z]{2}\d{9}FR$/.test(value) },
    { id: 'royal-mail', label: 'Royal Mail', mark: 'RM', hint: true, matches: value => /^[A-Z]{2}\d{9}GB$/.test(value) },
    { id: 'postnl', label: 'PostNL', mark: 'postNL', hint: true, matches: value => /^[A-Z]{2}\d{9}NL$/.test(value) },
    { id: 'usps', label: 'USPS', mark: 'USPS', hint: true, matches: value => /^(?:92|93|94|95)\d{18,20}$/.test(value) },
    { id: 'fedex', label: 'FedEx', mark: 'FedEx', hint: true, matches: value => /^\d{12}$|^\d{15}$|^\d{20}$|^\d{22}$/.test(value) },
    { id: 'canada-post', label: 'Canada Post', mark: 'CA', matches: value => /^[A-Z]{2}\d{9}CA$/.test(value) },
    { id: 'australia-post', label: 'Australia Post', mark: 'AU', matches: value => /^[A-Z]{2}\d{9}AU$/.test(value) },
    { id: 'china-post', label: 'China Post', mark: 'CN', matches: value => /^[A-Z]{2}\d{9}CN$/.test(value) },
    { id: 'japan-post', label: 'Japan Post', mark: 'JP', matches: value => /^[A-Z]{2}\d{9}JP$/.test(value) },
    { id: 'india-post', label: 'India Post', mark: 'IN', matches: value => /^[A-Z]{2}\d{9}IN$/.test(value) },
    { id: 'correos', label: 'Correos', mark: 'ES', matches: value => /^[A-Z]{2}\d{9}ES$/.test(value) },
    { id: 'ctt', label: 'CTT Portugal', mark: 'CTT', matches: value => /^[A-Z]{2}\d{9}PT$/.test(value) },
    { id: 'poste-italiane', label: 'Poste Italiane', mark: 'IT', matches: value => /^[A-Z]{2}\d{9}IT$/.test(value) },
    { id: 'swiss-post', label: 'Swiss Post', mark: 'CH', matches: value => /^[A-Z]{2}\d{9}CH$/.test(value) },
    { id: 'deutsche-post', label: 'Deutsche Post', mark: 'DE', matches: value => /^[A-Z]{2}\d{9}DE$/.test(value) },
    { id: 'austrian-post', label: 'Austrian Post', mark: 'AT', matches: value => /^[A-Z]{2}\d{9}AT$/.test(value) },
    { id: 'singapore-post', label: 'Singapore Post', mark: 'SG', matches: value => /^[A-Z]{2}\d{9}SG$/.test(value) },
    { id: 'new-zealand-post', label: 'New Zealand Post', mark: 'NZ', matches: value => /^[A-Z]{2}\d{9}NZ$/.test(value) },
    { id: 'brazil-post', label: 'Correios Brasil', mark: 'BR', matches: value => /^[A-Z]{2}\d{9}BR$/.test(value) },
    { id: 'bpost', label: 'bpost Belgique', mark: 'BE', matches: value => /^[A-Z]{2}\d{9}BE$/.test(value) },
    { id: 'postnord', label: 'PostNord', mark: 'PN', matches: value => /^[A-Z]{2}\d{9}(?:SE|DK)$/.test(value) },
    { id: 'posten', label: 'Posten Norge', mark: 'NO', matches: value => /^[A-Z]{2}\d{9}NO$/.test(value) },
    { id: 'posti', label: 'Posti Finlande', mark: 'FI', matches: value => /^[A-Z]{2}\d{9}FI$/.test(value) },
    { id: 'korea-post', label: 'Korea Post', mark: 'KR', matches: value => /^[A-Z]{2}\d{9}KR$/.test(value) },
    { id: 'hongkong-post', label: 'Hongkong Post', mark: 'HK', matches: value => /^[A-Z]{2}\d{9}HK$/.test(value) },
    { id: 'correos-mexico', label: 'Correos de México', mark: 'MX', matches: value => /^[A-Z]{2}\d{9}MX$/.test(value) },
    { id: 'south-african-post', label: 'South African Post', mark: 'ZA', matches: value => /^[A-Z]{2}\d{9}ZA$/.test(value) },
    { id: 'poczta-polska', label: 'Poczta Polska', mark: 'PL', matches: value => /^[A-Z]{2}\d{9}PL$/.test(value) },
    { id: 'ptt', label: 'PTT Türkiye', mark: 'PTT', matches: value => /^[A-Z]{2}\d{9}TR$/.test(value) },
    { id: 'an-post', label: 'An Post', mark: 'IE', matches: value => /^[A-Z]{2}\d{9}IE$/.test(value) },
    { id: 'israel-post', label: 'Israel Post', mark: 'IL', matches: value => /^[A-Z]{2}\d{9}IL$/.test(value) },
    { id: 'emirates-post', label: 'Emirates Post', mark: 'AE', matches: value => /^[A-Z]{2}\d{9}AE$/.test(value) },
    { id: 'yunexpress', label: 'YunExpress', mark: 'YUN', matches: value => /^YT\d{16}$/.test(value) },
    { id: 'sf-express', label: 'SF Express', mark: 'SF', matches: value => /^SF\d{13}$/.test(value) },
    { id: '4px', label: '4PX', mark: '4PX', matches: value => /^4PX[A-Z0-9]{12,16}$/.test(value) }
  ];
  return carriers.find(carrier => carrier.matches(number)) ?? {
    id: 'generic',
    label: 'Transporteur non détecté',
    mark: 'PKG',
    hint: false
  };
}

function getShipmentCarrier(shipment) {
  const detected = detectCarrier(shipment.number);
  const name = typeof shipment.tracking?.carrier === 'string' && shipment.tracking.carrier.trim()
    ? shipment.tracking.carrier.trim()
    : detected.label;
  if (!shipment.tracking?.carrier) return detected;

  const normalizedName = name.toLocaleLowerCase();
  const knownCarriers = [
    { pattern: /la poste|colissimo/, id: 'laposte', mark: 'LP' },
    { pattern: /royal mail/, id: 'royal-mail', mark: 'RM' },
    { pattern: /fedex/, id: 'fedex', mark: 'FedEx' },
    { pattern: /\bups\b/, id: 'ups', mark: 'UPS' },
    { pattern: /\bdhl\b/, id: 'dhl', mark: 'DHL' },
    { pattern: /postnl/, id: 'postnl', mark: 'postNL' },
    { pattern: /\busps\b/, id: 'usps', mark: 'USPS' }
  ];
  const known = knownCarriers.find(carrier => carrier.pattern.test(normalizedName));
  const mark = known?.mark ?? name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() ?? detected.mark;
  return {
    ...detected,
    id: known?.id ?? 'generic',
    label: name,
    mark: mark || detected.mark
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

function updateParcelTrackingLink() {
  const widgetUrl = new URL('https://parcelsapp.com/widget');
  widgetUrl.search = new URLSearchParams({
    textButton: 'Suivre le colis',
    placeholder: 'Entrez votre numéro de suivi',
    backgroundColorButton: '#2f6b55',
    colorButton: '#ffffff',
    borderRadiusButton: '10px',
    borderRadiusInput: '10px',
    widgetWrapBorder: '0',
    widgetWrapBorderRadius: '12px',
    ...(selectedTracking ? { trackingNumber: selectedTracking } : {})
  }).toString();
  parcelWidget.dataset.src = selectedTracking ? widgetUrl.toString() : '';
  if (parcelWidgetDetails.open && selectedTracking) {
    parcelWidget.src = widgetUrl.toString();
  } else if (!selectedTracking) {
    parcelWidget.src = 'about:blank';
  }
  if (selectedTracking) {
    parcelTrackingLink.href = `https://parcelsapp.com/en/tracking/${encodeURIComponent(selectedTracking)}`;
  } else {
    parcelTrackingLink.href = 'https://parcelsapp.com/';
  }
  setOutboundLinkBehavior(parcelTrackingLink);
}

function renderTrackingHistory(shipment) {
  trackingSummary.replaceChildren();
  trackingEvents.replaceChildren();
  const events = Array.isArray(shipment?.tracking?.events) ? shipment.tracking.events : [];
  const flightLegs = Array.isArray(shipment?.tracking?.flightLegs) ? shipment.tracking.flightLegs : [];
  parcelWidgetDetails.hidden = !shipment?.tracking || events.length > 0 || flightLegs.length > 0;
  trackingCountryForm.hidden = !shipment?.tracking?.needsDestinationCountry;
  trackingDestinationCountry.value =
    shipment?.destinationCountry ?? shipment?.route?.destination?.country ?? '';

  if (!shipment) {
    const message = document.createElement('p');
    message.className = 'tracking-summary-message';
    message.textContent = 'Ajoutez ou sélectionnez un colis pour afficher ses étapes de suivi.';
    trackingSummary.append(message);
    return;
  }

  const summaryTitle = document.createElement('strong');
  summaryTitle.className = 'tracking-summary-status';
  summaryTitle.textContent = shipment.tracking?.error
    ? 'Suivi indisponible'
    : shipment.tracking?.status || 'Suivi du colis';
  trackingSummary.append(summaryTitle);

  const summaryDetails = document.createElement('span');
  summaryDetails.className = 'tracking-summary-details';
  const carrier = getShipmentCarrier(shipment).label;
  const stops = isValidStoredRoute(shipment.route)
    ? [shipment.route.origin.name, shipment.route.destination.name]
    : [];
  summaryDetails.textContent = [
    carrier,
    stops.length ? `${stops[0]} → ${stops[1]}` : '',
    `${events.length + flightLegs.length} ${events.length + flightLegs.length === 1 ? 'étape' : 'étapes'}`
  ].filter(Boolean).join(' · ');
  trackingSummary.append(summaryDetails);

  if (shipment.tracking?.error) {
    const message = document.createElement('p');
    message.className = 'tracking-summary-message';
    message.textContent = shipment.tracking.error.replace(/\s*\(Parcels API v4[^)]*\)/g, '');
    trackingEvents.append(message);
  }

  if (events.length === 0 && flightLegs.length === 0) {
    const message = document.createElement('p');
    message.className = 'tracking-summary-message';
    message.textContent = shipment.tracking?.error
      ? ''
      : shipment.tracking
        ? `Parcels a reconnu ${getShipmentCarrier(shipment).label}, mais n’a renvoyé aucun événement détaillé pour ce colis. Le suivi complet est accessible via le lien Parcel App ci-dessous.`
        : 'Cliquez sur « Suivre » dans Mes colis pour demander les étapes détaillées à Parcels.';
    if (message.textContent) trackingEvents.append(message);
    return;
  }

  for (const event of [...events].reverse()) {
    const item = document.createElement('li');
    item.className = 'tracking-event';
    const time = document.createElement('time');
    if (event.date && Number.isFinite(Date.parse(event.date))) {
      const date = new Date(event.date);
      time.dateTime = event.date;
      time.textContent = new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }).format(date);
    } else {
      time.textContent = 'Date inconnue';
    }
    const content = document.createElement('div');
    content.className = 'tracking-event-content';
    const state = document.createElement('strong');
    state.textContent = event.state;
    content.append(state);
    if (event.location) {
      const location = document.createElement('span');
      location.textContent = event.location;
      content.append(location);
    }
    if (event.flightNumber) {
      const flight = document.createElement('small');
      const route = [event.flightOrigin, event.flightDestination].filter(Boolean).join(' → ');
      flight.textContent = `Vol ${event.flightNumber}${route ? ` · ${route}` : ''}`;
      content.append(flight);
    } else if (event.station) {
      const station = document.createElement('small');
      station.textContent = `Station ${event.station}`;
      content.append(station);
    }
    item.append(time, content);
    trackingEvents.append(item);
  }
  for (const leg of [...flightLegs].reverse()) {
    const item = document.createElement('li');
    item.className = 'tracking-event';
    const time = document.createElement('time');
    time.textContent = 'Vol';
    const content = document.createElement('div');
    content.className = 'tracking-event-content';
    const route = document.createElement('strong');
    route.textContent = [leg.origin, leg.destination].filter(Boolean).join(' → ') || 'Trajet aérien';
    content.append(route);
    if (leg.flightNumber || leg.status) {
      const details = document.createElement('span');
      details.textContent = [leg.flightNumber, leg.status].filter(Boolean).join(' · ');
      content.append(details);
    }
    item.append(time, content);
    trackingEvents.append(item);
  }
}

parcelWidgetDetails.addEventListener('toggle', () => {
  if (parcelWidgetDetails.open && parcelWidget.dataset.src && parcelWidget.src !== parcelWidget.dataset.src) {
    parcelWidget.src = parcelWidget.dataset.src;
  }
});

function renderShipments() {
  shipmentList.replaceChildren();
  shipmentCount.textContent = String(shipments.length);
  emptyState.hidden = shipments.length > 0;

  for (const shipment of shipments) {
    const item = document.createElement('article');
    item.className = `shipment-item${shipment.number === selectedTracking ? ' is-selected' : ''}`;

    const icon = document.createElement('span');
    icon.className = 'shipment-icon';
    const carrier = getShipmentCarrier(shipment);
    icon.dataset.carrier = carrier.id;
    icon.textContent = carrier.mark;
    icon.title = carrier.label;
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', `Transporteur : ${carrier.label}`);

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
      const carrierName = document.createElement('span');
      carrierName.className = 'shipment-carrier';
      carrierName.textContent = carrier.label;
      info.append(carrierName, date);
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
      updateParcelTrackingLink();
      renderShipments();
      updateSelectedParcelRoute({ fetchDetails: true });
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
      updateParcelTrackingLink();
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
  updateParcelTrackingLink();
  renderShipments();
  updateSelectedParcelRoute({ fetchDetails: true });
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
let parcelMapConnect = true;
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

function showParcelGlobePoints(points, { connect = true } = {}) {
  parcelMapPoints = points;
  parcelMapConnect = connect;
  parcelMapElement.hidden = false;
  if (!parcelGlobeLoaded) return;

  parcelGlobeMarkers.forEach(marker => marker.remove());
  parcelGlobeMarkers = points.map((point, index) => {
    const element = document.createElement('span');
    const isDestination = index === points.length - 1;
    element.className = `parcel-map-marker${isDestination ? ' is-destination' : index > 0 ? ' is-stop' : ''}`;
    element.setAttribute('aria-hidden', 'true');
    return new Marker({ element, anchor: 'center' })
      .setLngLat([point.longitude, point.latitude])
      .setPopup(new Popup({ offset: 12 }).setText(point.label))
      .addTo(parcelGlobe);
  });

  const route = parcelGlobe.getSource('parcel-route');
  const legs = connect
    ? points.slice(1).map((point, index) => greatCircle(points[index], point, 32))
    : [];
  route.setData({
    type: 'FeatureCollection',
    features: legs.length > 0 ? [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: legs }
    }] : []
  });

  if (points.length > 1) {
    const toVector = ({ latitude, longitude }) => {
      const lat = latitude * Math.PI / 180;
      const lon = longitude * Math.PI / 180;
      return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    };
    const centerVector = points.reduce((sum, point) => {
      const vector = toVector(point);
      return sum.map((value, axis) => value + vector[axis]);
    }, [0, 0, 0]);
    const length = Math.hypot(...centerVector);
    const center = length < 1e-6
      ? [points[0].longitude, points[0].latitude]
      : [
        Math.atan2(centerVector[1], centerVector[0]) * 180 / Math.PI,
        Math.atan2(centerVector[2], Math.hypot(centerVector[0], centerVector[1])) * 180 / Math.PI
      ];
    parcelGlobe.easeTo({ center, zoom: points.length > 2 ? 0.55 : 0.7, duration: 900 });
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
    attributionControl: true,
    scrollZoom: false
  });
  parcelGlobe.addControl(new NavigationControl(), 'top-right');
  parcelGlobe.once('load', () => {
    parcelGlobe.setProjection({ type: 'globe' });
    parcelGlobe.addSource('parcel-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    parcelGlobe.addLayer({
      id: 'parcel-route-line',
      type: 'line',
      source: 'parcel-route',
      paint: {
        'line-color': '#d47c45',
        'line-width': 3.5,
        'line-opacity': 0.9,
        'line-dasharray': [1.5, 1.5]
      }
    });
    parcelGlobeLoaded = true;
    showParcelGlobePoints(parcelMapPoints, { connect: parcelMapConnect });
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

async function requestParcelTracking(trackingNumber, requestId, destinationCountry) {
  const carrier = detectCarrier(trackingNumber);
  const body = requestId
    ? { requestId }
    : {
      trackingNumber,
      ...(carrier.hint ? { carrierHint: carrier.id } : {}),
      ...(destinationCountry ? { destinationCountry } : {})
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
  if (!response.ok) {
    const message = result.error || `Suivi indisponible (${response.status}).`;
    const error = new Error(message);
    error.needsDestinationCountry = result.needsDestinationCountry === true;
    throw error;
  }
  return result;
}

async function updateSelectedParcelRoute({ fetchDetails = false, destinationCountry } = {}) {
  if (!selectedTracking) {
    parcelRouteResult.textContent = 'Ajoutez un colis pour rechercher automatiquement son trajet.';
    parcelRouteResult.classList.remove('is-error');
    renderTrackingHistory(null);
    showParcelGlobePoints([]);
    return;
  }

  const shipment = shipments.find(item => item.number === selectedTracking);
  if (!shipment) return;
  renderTrackingHistory(shipment);
  if (isValidStoredRoute(shipment.route)) {
    const storedEvents = Array.isArray(shipment.tracking?.events) ? shipment.tracking.events : [];
    const storedFlightLegs = Array.isArray(shipment.tracking?.flightLegs) ? shipment.tracking.flightLegs : [];
    const storedPoints = Array.isArray(shipment.route.stops) && shipment.route.stops.length > 1
      ? shipment.route.stops
      : [shipment.route.origin, shipment.route.destination];
    const legacyEndpointOnlyRoute = !shipment.route.source &&
      shipment.tracking &&
      storedEvents.length === 0 &&
      storedFlightLegs.length === 0 &&
      storedPoints.length === 2;
    const isCarrierRoute = shipment.route.source === 'carrier' || legacyEndpointOnlyRoute;
    showParcelGlobePoints(storedPoints.map((point, index) => ({
      ...point,
      label: index === 0
        ? `Provenance : ${point.name}`
        : index === storedPoints.length - 1
          ? `Destination : ${point.name}`
          : `Étape : ${point.name}`
    })), {
      connect: shipment.route.connect ?? (!isCarrierRoute || storedPoints.length > 2)
    });
    if (Array.isArray(shipment.tracking?.events) && (storedEvents.length > 0 || !fetchDetails)) {
      const storedFlightLeg = storedFlightLegs.find(item => item.origin || item.destination);
      const hasStoredFlightRoute = isCarrierRoute &&
        storedPoints.length === 2 &&
        (shipment.route.connect ?? storedPoints.length > 2) &&
        storedFlightLeg;
      const hasUnmappedFlightRoute = isCarrierRoute && storedPoints.length === 2 &&
        !(shipment.route.connect ?? storedPoints.length > 2) && storedFlightLeg;
      const hasIncompleteCarrierRoute = isCarrierRoute &&
        storedPoints.length === 2 &&
        !(shipment.route.connect ?? storedPoints.length > 2) &&
        storedEvents.length === 0 &&
        storedFlightLegs.length === 0;
      if (hasStoredFlightRoute) {
        parcelRouteResult.textContent =
          `Trajet aérien communiqué : ${[storedFlightLeg.origin, storedFlightLeg.destination].filter(Boolean).join(' → ')}.`;
      } else if (hasUnmappedFlightRoute) {
        parcelRouteResult.textContent =
          `Escales aériennes communiquées (${storedFlightLeg.origin || 'départ'} → ${storedFlightLeg.destination || 'arrivée'}), mais non cartographiables.`;
      } else if (hasIncompleteCarrierRoute) {
        parcelRouteResult.textContent =
          `${storedPoints[0].name} → ${storedPoints.at(-1).name} · aucun scan intermédiaire transmis, trajet détaillé indisponible.`;
      } else {
        parcelRouteResult.textContent =
          `${storedPoints[0].name} → ${storedPoints.at(-1).name} · ${Math.max(0, storedPoints.length - 2)} étape(s) cartographiée(s)`;
      }
      parcelRouteResult.classList.remove('is-error');
      return;
    }
  }
  if (!fetchDetails) {
    parcelRouteResult.textContent = 'Sélectionnez le colis dans Mes colis pour demander son historique détaillé à Parcels.';
    parcelRouteResult.classList.remove('is-error');
    return;
  }
  if (routeRequests.has(selectedTracking)) return;

  const trackingNumber = selectedTracking;
  const country = destinationCountry || shipment.destinationCountry || shipment.route?.destination?.country || '';
  routeRequests.add(trackingNumber);
  parcelRouteResult.textContent = 'Récupération des étapes et du trajet auprès du transporteur…';
  parcelRouteResult.classList.remove('is-error');
  try {
    let result = await requestParcelTracking(trackingNumber, undefined, country);
    for (let attempt = 0; result.pending && attempt < 8; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 1500));
      result = await requestParcelTracking(trackingNumber, result.requestId);
    }
    if (result.pending) throw new Error('Le transporteur n’a pas encore terminé la recherche du colis.');

    const events = Array.isArray(result.events)
      ? result.events.filter(event => typeof event?.state === 'string').slice(0, 80)
      : [];
    const chronologicalEvents = events
      .map((event, index) => ({ event, index, timestamp: Date.parse(event.date) }))
      .sort((left, right) => {
        if (Number.isFinite(left.timestamp) && Number.isFinite(right.timestamp)) {
          return left.timestamp - right.timestamp;
        }
        return left.index - right.index;
      })
      .map(item => item.event);
    const eventLocations = [];
    for (const event of chronologicalEvents) {
      const location = typeof event.location === 'string' ? event.location.trim() : '';
      const eventPlaces = [location, event.flightOrigin, event.flightDestination, event.station]
        .filter(value => typeof value === 'string' && value.trim());
      for (const place of eventPlaces) {
        if (!eventLocations.some(item => item.toLocaleLowerCase() === place.toLocaleLowerCase())) {
          eventLocations.push(place);
        }
        if (eventLocations.length >= 8) break;
      }
      if (eventLocations.length >= 8) break;
    }
    const flightLegs = Array.isArray(result.flightLegs) ? result.flightLegs : [];
    const flightCodes = new Set(flightLegs
      .flatMap(leg => [leg.origin, leg.destination])
      .filter(value => typeof value === 'string'));
    for (const leg of flightLegs) {
      for (const place of [leg.origin, leg.destination]) {
        if (
          typeof place === 'string' &&
          !eventLocations.some(item => item.toLocaleLowerCase() === place.toLocaleLowerCase())
        ) eventLocations.push(place);
        if (eventLocations.length >= 8) break;
      }
      if (eventLocations.length >= 8) break;
    }

    const originName = typeof result.origin === 'string' && result.origin.trim() ? result.origin.trim() : '';
    const destinationName = typeof result.destination === 'string' && result.destination.trim() ? result.destination.trim() : '';
    const endpointQueries = [originName, destinationName].filter(Boolean);
    const [endpointResults, eventResults] = await Promise.all([
      Promise.allSettled(endpointQueries.map(query => geocode(query))),
      Promise.allSettled(eventLocations.map(query => geocode(query)))
    ]);
    const endpointPlaces = new Map(endpointQueries.flatMap((query, index) =>
      endpointResults[index].status === 'fulfilled' ? [[query, endpointResults[index].value]] : []));
    const routePoints = [];
    const mappedFlightPoints = eventLocations.some((query, index) =>
      flightCodes.has(query) && eventResults[index].status === 'fulfilled');
    const addRoutePoint = (place, label) => {
      if (!place) return;
      const point = {
        name: placeName(place),
        latitude: place.latitude,
        longitude: place.longitude,
        label
      };
      const previous = routePoints.at(-1);
      if (
        previous &&
        Math.abs(previous.latitude - point.latitude) < 0.05 &&
        Math.abs(previous.longitude - point.longitude) < 0.05
      ) return;
      routePoints.push(point);
    };

    let unresolvedStops = endpointResults.filter(result => result.status === 'rejected').length;
    if (originName) addRoutePoint(endpointPlaces.get(originName), `Provenance : ${originName}`);
    eventResults.forEach((resolution, index) => {
      if (resolution.status === 'fulfilled') {
        addRoutePoint(resolution.value, `Étape transporteur : ${eventLocations[index]}`);
      } else {
        unresolvedStops += 1;
      }
    });
    if (destinationName) addRoutePoint(endpointPlaces.get(destinationName), `Destination : ${destinationName}`);
    const connectRoute = routePoints.length > 2 || mappedFlightPoints;

    const previousShipment = shipment;
    const tracking = {
      status: result.status,
      carrier: result.carrier,
      events: chronologicalEvents,
      flightLegs: Array.isArray(result.flightLegs) ? result.flightLegs : []
    };
    shipments = shipments.map(item => item.number === trackingNumber ? {
      ...item,
      ...(country ? { destinationCountry: country } : {}),
      tracking,
      ...(routePoints.length > 1 ? {
        route: {
          origin: routePoints[0],
          destination: routePoints.at(-1),
          stops: routePoints,
          source: 'carrier',
          connect: connectRoute
        }
      } : {})
    } : item);
    if (!saveShipments()) {
      shipments = shipments.map(item => item.number === trackingNumber ? previousShipment : item);
      return;
    }
    renderShipments();
    const updatedShipment = shipments.find(item => item.number === trackingNumber);
    if (selectedTracking === trackingNumber) {
      renderTrackingHistory(updatedShipment);
      showParcelGlobePoints(routePoints, { connect: connectRoute });
      if (routePoints.length > 2) {
        parcelRouteResult.textContent =
          `${routePoints[0].name} → ${routePoints.at(-1).name} · ${routePoints.length - 2} étape(s) de transit${unresolvedStops ? ` · ${unresolvedStops} lieu(x) non cartographié(s)` : ''}`;
        parcelRouteResult.classList.remove('is-error');
      } else if (connectRoute && routePoints.length === 2) {
        const leg = result.flightLegs?.find(item => item.origin || item.destination);
        const routeLabel = leg
          ? [leg.origin, leg.destination].filter(Boolean).join(' → ')
          : '';
        parcelRouteResult.textContent =
          `Trajet aérien communiqué${routeLabel ? ` : ${routeLabel}` : ''}. Les étapes de transit intermédiaires ne sont pas disponibles.`;
        parcelRouteResult.classList.remove('is-error');
      } else if (chronologicalEvents.length > 0) {
        parcelRouteResult.textContent =
          'Les événements sont disponibles, mais leurs lieux ne peuvent pas être placés sur la carte.';
        parcelRouteResult.classList.remove('is-error');
      } else if (routePoints.length === 2) {
        parcelRouteResult.textContent =
          `${routePoints[0].name} → ${routePoints.at(-1).name} · aucun scan intermédiaire fourni, le trajet détaillé n’est pas disponible.`;
        parcelRouteResult.classList.remove('is-error');
      } else {
        parcelRouteResult.textContent = 'Le transporteur n’a transmis ni lieux ni événements détaillés. Vous pouvez saisir les lieux manuellement.';
        parcelRouteResult.classList.add('is-error');
      }
    }
  } catch (error) {
    if (selectedTracking === trackingNumber) {
      const previousShipment = shipments.find(item => item.number === trackingNumber);
      const failedShipment = {
        ...previousShipment,
        tracking: {
          ...(previousShipment.tracking ?? {}),
          carrier: previousShipment.tracking?.carrier || detectCarrier(trackingNumber).label,
          events: previousShipment.tracking?.events ?? [],
          error: error.message || 'Trajet automatique indisponible.',
          needsDestinationCountry: error.needsDestinationCountry === true
        }
      };
      shipments = shipments.map(item => item.number === trackingNumber ? failedShipment : item);
      if (!saveShipments()) {
        shipments = shipments.map(item => item.number === trackingNumber ? previousShipment : item);
      }
      renderShipments();
      renderTrackingHistory(shipments.find(item => item.number === trackingNumber));
      parcelRouteResult.textContent =
        `${error.message || 'Trajet automatique indisponible.'} Saisie manuelle disponible ci-dessous.`;
      parcelRouteResult.classList.add('is-error');
    }
  } finally {
    routeRequests.delete(trackingNumber);
  }
}

trackingCountryForm.addEventListener('submit', async event => {
  event.preventDefault();
  const country = trackingDestinationCountry.value.trim();
  if (!country || !selectedTracking) return;
  const button = trackingCountryForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    shipments = shipments.map(item => item.number === selectedTracking
      ? { ...item, destinationCountry: country }
      : item);
    if (!saveShipments()) return;
    await updateSelectedParcelRoute({ fetchDetails: true, destinationCountry: country });
  } finally {
    button.disabled = false;
  }
});

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
      destination: { name: placeName(to), latitude: to.latitude, longitude: to.longitude, country: to.country },
      source: 'manual'
    };
    route.stops = [route.origin, route.destination];
    route.connect = true;
    shipments = shipments.map(item => item.number === selectedTracking ? { ...item, route } : item);
    if (!saveShipments()) return;
    renderShipments();
    renderTrackingHistory(shipments.find(item => item.number === selectedTracking));
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
updateParcelTrackingLink();
updateSelectedParcelRoute();
