import { Map as MapLibreMap, Marker, NavigationControl, Popup } from './vendor/maplibre-gl/maplibre-gl.mjs';

const STORAGE_KEY = 'colis-saved-trackings';
const THEME_KEY = 'colis-theme';
const SIDEBAR_KEY = 'colis-sidebar-collapsed';
const WORLD_CLOCKS_KEY = 'colis-world-clock-timezones';
const form = document.querySelector('#add-form');
const input = document.querySelector('#tracking-input');
const formMessage = document.querySelector('#form-message');
const shipmentList = document.querySelector('#shipment-list');
const shipmentCount = document.querySelector('#shipment-count');
const shipmentSortOrder = document.querySelector('#shipment-sort-order');
const emptyState = document.querySelector('#empty-state');
const parcelTrackingLink = document.querySelector('#parcel-tracking-link');
const track17TrackingLink = document.querySelector('#track17-tracking-link');
const trackingSummary = document.querySelector('#tracking-summary');
const trackingEvents = document.querySelector('#tracking-events');
const trackingTranslationToggle = document.querySelector('#tracking-translation-toggle');
const trackingTranslationControls = document.querySelector('#tracking-translation-controls');
const trackingTranslationLanguage = document.querySelector('#tracking-translation-language');
const trackingTranslationMessage = document.querySelector('#tracking-translation-message');
const deliveryCountdownTime = document.querySelector('#delivery-countdown-time');
const deliveryCountdownWindow = document.querySelector('#delivery-countdown-window');
const deliveryCountdownNote = document.querySelector('#delivery-countdown-note');
const deliveryCountdownConfidence = document.querySelector('#delivery-countdown-confidence');
const parcelWidgetDetails = document.querySelector('#parcel-widget-details');
const parcelWidget = document.querySelector('#parcels-widget');
const trackingCountryForm = document.querySelector('#tracking-country-form');
const trackingDestinationCountry = document.querySelector('#tracking-destination-country');
const trackingCarrierSearch = document.querySelector('#tracking-carrier-search');
const trackingCarrierSelect = document.querySelector('#tracking-carrier-select');
const trackingCarrierMessage = document.querySelector('#tracking-carrier-message');
const trackingRecipientPostalCode = document.querySelector('#tracking-recipient-postal-code');
const trackingRecipientEmail = document.querySelector('#tracking-recipient-email');
const trackingRecipientPhone = document.querySelector('#tracking-recipient-phone');
const weatherButton = document.querySelector('#weather-button');
const weatherResult = document.querySelector('#weather-result');
const weatherDescription = document.querySelector('#weather-description');
const weatherMap = document.querySelector('#weather-map');
const weatherMapLayer = document.querySelector('#weather-map-layer');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const backToTop = document.querySelector('#back-to-top');
const installButton = document.querySelector('#install-button');
const sidebarShipmentCount = document.querySelector('#sidebar-shipment-count');
const sidebarCurrentParcel = document.querySelector('#sidebar-current-parcel');
const sidebarParcelIcon = document.querySelector('#sidebar-parcel-icon');
const sidebarParcelCarrier = document.querySelector('#sidebar-parcel-carrier');
const sidebarParcelNumber = document.querySelector('#sidebar-parcel-number');
const sidebarParcelStatus = document.querySelector('#sidebar-parcel-status');
const mobileMenuQuery = window.matchMedia('(max-width: 760px)');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let installPrompt;
let shipments = loadShipments();
let selectedTracking = shipments[0]?.number ?? '';
let shipmentSort = 'newest';
try {
  const savedShipmentSort = localStorage.getItem('colis-shipment-sort');
  if (savedShipmentSort === 'oldest' || savedShipmentSort === 'newest') shipmentSort = savedShipmentSort;
} catch (error) {
  console.warn('Impossible de lire le tri des colis enregistré.', error);
}
shipmentSortOrder.value = shipmentSort;
let weatherCoordinates;
let weatherMapCoordinates = { latitude: 46.6, longitude: 2.4 };
let trackingTranslationEnabled = true;
let carrierSearchTimeout;
let carrierSearchSequence = 0;
let trackingCarrierSelectionFor = '';
let editingCarrierShipment = '';
const carrierInputRequirements = new Map();
const trackingTranslations = new Map();
const trackingTranslationJobs = new Set();
const deliveryEstimateRequests = new Set();

function updateBackToTopVisibility() {
  backToTop.hidden = window.scrollY < 500;
}

window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reducedMotionQuery.matches ? 'auto' : 'smooth' });
});
updateBackToTopVisibility();

const clockList = document.querySelector('#clock-list');
const clockAddForm = document.querySelector('#clock-add-form');
const clockTimezoneInput = document.querySelector('#clock-timezone-input');
const clockTimezoneOptions = document.querySelector('#clock-timezone-options');
const clockMessage = document.querySelector('#clock-message');
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const availableTimeZones = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : [
    'Africa/Cairo', 'Africa/Johannesburg', 'America/Anchorage', 'America/Argentina/Buenos_Aires',
    'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City',
    'America/New_York', 'America/Sao_Paulo', 'Asia/Bangkok', 'Asia/Dubai', 'Asia/Hong_Kong',
    'Asia/Jakarta', 'Asia/Kolkata', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore',
    'Asia/Tokyo', 'Australia/Melbourne', 'Australia/Sydney', 'Europe/Berlin', 'Europe/London',
    'Europe/Madrid', 'Europe/Paris', 'Europe/Rome', 'Pacific/Auckland', 'UTC'
  ];
const zoneLabel = timeZone => timeZone === localTimeZone
  ? 'Votre heure locale'
  : timeZone.split('/').at(-1).replaceAll('_', ' ');
function formatZoneDetails(timeZone, date = new Date()) {
  const offset = new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    timeZoneName: 'shortOffset'
  }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value;
  return `${timeZone.replaceAll('_', ' ')}${offset ? ` · ${offset}` : ''}`;
}

function loadWorldClockZones() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORLD_CLOCKS_KEY) ?? 'null');
    if (Array.isArray(saved)) {
      return saved.filter((zone, index) =>
        typeof zone === 'string' && zone !== localTimeZone && zone !== 'UTC' &&
        availableTimeZones.includes(zone) && saved.indexOf(zone) === index
      );
    }
  } catch (error) {
    console.error('Impossible de lire les fuseaux horaires enregistrés.', error);
  }
  return ['Asia/Tokyo', 'America/New_York'];
}

let extraClockZones = loadWorldClockZones();
const worldClocks = [];
let worldClockTimer;

function saveWorldClockZones() {
  try {
    localStorage.setItem(WORLD_CLOCKS_KEY, JSON.stringify(extraClockZones));
    clockMessage.textContent = 'Ajoutez une ville ou un fuseau pour suivre l’heure locale de vos colis.';
  } catch (error) {
    clockMessage.textContent = 'Le fuseau est affiché, mais n’a pas pu être enregistré sur cet appareil.';
    console.error('Impossible d’enregistrer les fuseaux horaires.', error);
  }
}

function addWorldClock(timeZone, { persist = true } = {}) {
  const item = document.createElement('article');
  item.className = 'clock-item';
  const label = document.createElement('span');
  label.textContent = zoneLabel(timeZone);
  const time = document.createElement('time');
  time.dateTime = new Date().toISOString();
  const zone = document.createElement('small');
  zone.textContent = formatZoneDetails(timeZone);
  const remove = document.createElement('button');
  remove.className = 'clock-remove';
  remove.type = 'button';
  remove.setAttribute('aria-label', `Retirer l’horloge ${zoneLabel(timeZone)}`);
  remove.title = `Retirer ${zoneLabel(timeZone)}`;
  remove.textContent = '×';
  remove.addEventListener('click', () => {
    extraClockZones = extraClockZones.filter(savedZone => savedZone !== timeZone);
    worldClocks.splice(worldClocks.indexOf(clock), 1);
    item.remove();
    saveWorldClockZones();
    startWorldClockTimer();
  });
  item.append(label, time, zone, remove);
  clockList.append(item);
  const clock = { timeZone, timeElement: time, zoneElement: zone };
  worldClocks.push(clock);
  updateWorldClocks();
  startWorldClockTimer();
  if (persist) saveWorldClockZones();
}

function renderWorldClocks() {
  const pinned = [
    { timeZone: localTimeZone, label: 'Votre heure locale', zone: localTimeZone },
    { timeZone: 'UTC', label: 'Temps universel', zone: 'UTC' }
  ];
  for (const { timeZone, label, zone } of pinned) {
    const item = document.createElement('article');
    item.className = 'clock-item is-pinned';
    const title = document.createElement('span');
    title.textContent = label;
    const time = document.createElement('time');
    time.dateTime = new Date().toISOString();
    const details = document.createElement('small');
    details.textContent = formatZoneDetails(timeZone);
    item.append(title, time, details);
    clockList.append(item);
    worldClocks.push({ timeZone, timeElement: time, zoneElement: details });
  }
  for (const timeZone of extraClockZones) addWorldClock(timeZone, { persist: false });
  clockTimezoneOptions.replaceChildren(...availableTimeZones.map(timeZone => {
    const option = document.createElement('option');
    option.value = timeZone;
    option.label = timeZone.split('/').at(-1).replaceAll('_', ' ');
    return option;
  }));
}

function updateWorldClocks() {
  const now = new Date();
  for (const clock of worldClocks) {
    clock.timeElement.textContent = new Intl.DateTimeFormat('fr-FR', {
      timeZone: clock.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      ...(worldClocks.length <= 12 ? { second: '2-digit' } : {}),
      hourCycle: 'h23'
    }).format(now);
    clock.timeElement.dateTime = now.toISOString();
    clock.zoneElement.textContent = formatZoneDetails(clock.timeZone, now);
  }
}

function startWorldClockTimer() {
  window.clearInterval(worldClockTimer);
  worldClockTimer = window.setInterval(updateWorldClocks, worldClocks.length <= 12 ? 1000 : 60_000);
}
renderWorldClocks();
updateWorldClocks();
startWorldClockTimer();

clockAddForm.addEventListener('submit', event => {
  event.preventDefault();
  const timeZone = clockTimezoneInput.value.trim();
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone });
  } catch {
    clockMessage.textContent = 'Fuseau inconnu. Choisissez une ville proposée, par exemple Asia/Dubai.';
    clockTimezoneInput.focus();
    return;
  }
  if (timeZone === localTimeZone || worldClocks.some(clock => clock.timeZone === timeZone)) {
    clockMessage.textContent = 'Cette horloge est déjà affichée.';
    return;
  }
  if (!availableTimeZones.includes(timeZone) && timeZone !== 'UTC') {
    clockMessage.textContent = 'Choisissez un fuseau IANA proposé dans la liste.';
    return;
  }
  extraClockZones.push(timeZone);
  addWorldClock(timeZone);
  clockTimezoneInput.value = '';
  clockTimezoneInput.focus();
});

const liveNewsItems = document.querySelector('#live-news-items');
const liveNewsUpdated = document.querySelector('#live-news-updated');
let newsRefreshInProgress = false;

function showNewsMessage(message, isError = false) {
  const paragraph = document.createElement('p');
  paragraph.className = 'live-news-message';
  paragraph.textContent = message;
  if (liveNewsItems.querySelector('.live-news-item')) {
    liveNewsUpdated.textContent = ` · ${message}`;
  } else {
    liveNewsItems.replaceChildren(paragraph);
  }
  if (isError) console.error(message);
}

function safeNewsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim(), 'https://www.franceinfo.fr');
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function getNewsImage(item) {
  const imageElements = [
    ...item.getElementsByTagName('media:content'),
    ...item.getElementsByTagName('media:thumbnail'),
    ...item.getElementsByTagName('enclosure')
  ];
  const imageUrl = imageElements
    .filter(element => {
      const type = element.getAttribute('type');
      const url = element.getAttribute('url') || element.getAttribute('href') || '';
      return type?.startsWith('image/') || /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(url);
    })
    .map(element => element.getAttribute('url') || element.getAttribute('href'))
    .map(safeNewsUrl)
    .find(Boolean);
  if (imageUrl) return imageUrl;

  const description = item.getElementsByTagName('description')[0]?.textContent ?? '';
  const descriptionDocument = new DOMParser().parseFromString(description, 'text/html');
  return safeNewsUrl(descriptionDocument.querySelector('img')?.getAttribute('src'));
}

function createNewsCard({ title, href, imageUrl, published }) {
  title = typeof title === 'string' ? title.trim() : '';
  href = safeNewsUrl(href);
  imageUrl = safeNewsUrl(imageUrl);
  if (!title || !href) return null;

  const link = document.createElement('a');
  link.className = 'live-news-item';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Lire l’article : ${title}`);

  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'live-news-image';
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      image.remove();
      link.classList.add('live-news-no-image');
    }, { once: true });
    link.append(image);
  } else {
    link.classList.add('live-news-no-image');
  }

  const content = document.createElement('span');
  content.className = 'live-news-content';
  const headline = document.createElement('strong');
  headline.textContent = title;
  content.append(headline);
  if (published && Number.isFinite(Date.parse(published))) {
    const time = document.createElement('time');
    time.dateTime = new Date(published).toISOString();
    time.textContent = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(published));
    content.append(time);
  }
  link.append(content);
  return link;
}

async function refreshNews() {
  if (newsRefreshInProgress || document.hidden) return;
  newsRefreshInProgress = true;
  try {
    let response;
    let directFeedError;
    try {
      response = await fetch('https://www.franceinfo.fr/titres.rss', {
        cache: 'no-store',
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' }
      });
      if (!response.ok) directFeedError = new Error(`Flux franceinfo indisponible (${response.status}).`);
    } catch (error) {
      directFeedError = error;
    }
    if (!response?.ok) {
      console.warn('Franceinfo RSS direct fetch unavailable; using rss2json fallback.', directFeedError);
      const fallbackEndpoint = new URL('https://api.rss2json.com/v1/api.json');
      fallbackEndpoint.searchParams.set('rss_url', 'https://www.franceinfo.fr/titres.rss');
      response = await fetch(fallbackEndpoint, { cache: 'no-store' });
    }
    if (!response.ok) throw new Error(`Actualités indisponibles (${response.status}).`);
    let cards;
    if (response.headers.get('content-type')?.includes('application/json')) {
      const feed = await response.json();
      if (feed.status && feed.status !== 'ok') throw new Error('Le flux des actualités est temporairement indisponible.');
      cards = (Array.isArray(feed.items) ? feed.items : []).slice(0, 6).map(article => {
        const enclosure = Array.isArray(article.enclosure)
          ? article.enclosure.find(item => item?.type?.startsWith('image/'))
          : article.enclosure;
        const description = typeof article.content === 'string' ? article.content : article.description;
        const descriptionDocument = new DOMParser().parseFromString(description ?? '', 'text/html');
        return createNewsCard({
          title: article.title,
          href: article.link,
          imageUrl: article.thumbnail || enclosure?.link || descriptionDocument.querySelector('img')?.getAttribute('src'),
          published: article.pubDate
        });
      }).filter(Boolean);
    } else {
      const xml = await response.text();
      const feed = new DOMParser().parseFromString(xml, 'application/xml');
      if (feed.querySelector('parsererror')) throw new Error('Le flux des actualités contient un format invalide.');
      cards = [...feed.getElementsByTagName('item')].slice(0, 6).map(item => createNewsCard({
        title: item.getElementsByTagName('title')[0]?.textContent,
        href: item.getElementsByTagName('link')[0]?.textContent,
        imageUrl: getNewsImage(item),
        published: item.getElementsByTagName('pubDate')[0]?.textContent?.trim()
      })).filter(Boolean);
    }
    if (cards.length === 0) throw new Error('Aucun titre d’actualité disponible.');
    liveNewsItems.replaceChildren(...cards);
    liveNewsUpdated.textContent = ` · mis à jour à ${new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date())}`;
  } catch (error) {
    showNewsMessage(error.message || 'Impossible de charger les actualités.', true);
  } finally {
    newsRefreshInProgress = false;
  }
}

refreshNews();
window.setInterval(refreshNews, 600_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshNews();
});

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

const sectionNavigation = [...document.querySelectorAll('.main-nav .nav-link')];
const navigationSections = sectionNavigation
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

function setActiveNavigation(sectionId) {
  for (const link of sectionNavigation) {
    const isActive = link.hash === `#${sectionId}`;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

if ('IntersectionObserver' in window) {
  const navigationObserver = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (visible) setActiveNavigation(visible.target.id);
  }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.2, 0.5, 1] });
  navigationSections.forEach(section => navigationObserver.observe(section));
}

function renderSidebarCurrentParcel() {
  sidebarShipmentCount.textContent = String(shipments.length);
  const shipment = shipments.find(item => item.number === selectedTracking);
  sidebarCurrentParcel.classList.toggle('is-empty', !shipment);
  if (!shipment) {
    delete sidebarCurrentParcel.dataset.tint;
    sidebarParcelIcon.dataset.carrier = 'generic';
    sidebarParcelIcon.textContent = 'PKG';
    sidebarParcelCarrier.textContent = 'Aucun colis suivi';
    sidebarParcelNumber.textContent = 'Ajoutez un colis pour commencer';
    sidebarParcelStatus.textContent = 'Ajouter un colis';
    sidebarCurrentParcel.href = '#add-form';
    sidebarCurrentParcel.setAttribute('aria-label', 'Ajouter un colis à suivre');
    return;
  }

  sidebarCurrentParcel.dataset.tint = String(getSortedShipments().indexOf(shipment) % 6);
  const carrier = getShipmentCarrier(shipment);
  const status = typeof shipment.tracking?.status === 'string' && shipment.tracking.status.trim()
    ? shipment.tracking.status.trim()
    : shipment.tracking?.error ? 'Suivi indisponible' : 'En attente du suivi';
  renderCarrierIcon(sidebarParcelIcon, shipment, carrier);
  sidebarParcelCarrier.textContent = shipment.name || carrier.label;
  sidebarParcelNumber.textContent = shipment.name
    ? `${carrier.label} · ${shipment.number}`
    : shipment.number;
  sidebarParcelStatus.replaceChildren();
  const statusText = document.createElement('span');
  statusText.textContent = trackingTranslationEnabled ? translateTrackingState(status) : status;
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  sidebarParcelStatus.append(statusText, arrow);
  sidebarCurrentParcel.href = '#suivi';
  sidebarCurrentParcel.setAttribute('aria-label', `Afficher le suivi du colis ${shipment.number} : ${status}`);
}

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
  const selectedCarrier = typeof shipment.carrierName === 'string' ? shipment.carrierName.trim() : '';
  const storedCarrier = typeof shipment.tracking?.carrier === 'string'
    ? shipment.tracking.carrier.trim()
    : '';
  const staleNumericFedExGuess = /^\d+$/.test(shipment.number) &&
    shipment.tracking?.error &&
    /^fedex$/i.test(storedCarrier);
  const name = selectedCarrier || (storedCarrier && !staleNumericFedExGuess ? storedCarrier : detected.label);
  if (!shipment.tracking?.carrier && !selectedCarrier) return detected;

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

const carrierLogoFiles = new Map([
  ['aramex', 'aramex.svg'],
  ['bpost', 'bpost.svg'],
  ['budbee', 'budbee.svg'],
  ['canadapost', 'canadapost_symbol.svg'],
  ['chronopost', 'chronopost_symbol.svg'],
  ['colissimo', 'colissimo_symbol.svg'],
  ['correos', 'correos_symbol.svg'],
  ['dao', 'dao.svg'],
  ['dhl', 'dhl.svg'],
  ['dhlecommerce', 'dhl.svg'],
  ['dhlexpress', 'dhl.svg'],
  ['dhlpaket', 'dhl.svg'],
  ['dhlparcel', 'dhl.svg'],
  ['dpd', 'dpd_symbol.svg'],
  ['evri', 'evri.svg'],
  ['fedex', 'fedex.svg'],
  ['fedexground', 'fedex.svg'],
  ['federalexpress', 'fedex.svg'],
  ['gls', 'gls.svg'],
  ['helthjem', 'helthjem.svg'],
  ['instabox', 'instabox.svg'],
  ['israelpost', 'israelpost.svg'],
  ['laposte', 'laposte.svg'],
  ['mondialrelay', 'mondialrelay_symbol.svg'],
  ['naqel', 'naqelexpress.svg'],
  ['naqelexpress', 'naqelexpress.svg'],
  ['porterbuddy', 'porterbuddy.svg'],
  ['posteitaliane', 'posteitaliane.svg'],
  ['posten', 'posten.svg'],
  ['postnl', 'postnl.svg'],
  ['postnord', 'postnord.svg'],
  ['royalmail', 'royalmail.svg'],
  ['sendle', 'sendle.svg'],
  ['smsa', 'smsaexpress.svg'],
  ['smsaexpress', 'smsaexpress.svg'],
  ['ups', 'ups.svg'],
  ['usps', 'usps_symbol.svg']
]);

function normalizeCarrierLogoKey(value) {
  return typeof value === 'string'
    ? value.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '')
    : '';
}

function renderCarrierIcon(element, shipment, carrier) {
  element.replaceChildren();
  element.dataset.carrier = carrier.id;
  element.title = carrier.label;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', `Transporteur : ${carrier.label}`);

  const fallback = document.createElement('span');
  fallback.className = 'carrier-icon-fallback';
  fallback.textContent = carrier.mark;
  element.append(fallback);

  const logoKey = [
    shipment.carrierHint,
    shipment.tracking?.carrierSlug,
    carrier.id,
    carrier.label
  ].map(normalizeCarrierLogoKey).find(key => carrierLogoFiles.has(key));
  const logoFile = logoKey ? carrierLogoFiles.get(logoKey) : null;
  if (!logoFile) return;

  const logo = document.createElement('img');
  logo.className = 'carrier-icon-logo';
  logo.alt = '';
  logo.loading = 'lazy';
  logo.decoding = 'async';
  logo.src = `./icons/carriers/${logoFile}`;
  logo.addEventListener('load', () => { fallback.hidden = true; }, { once: true });
  logo.addEventListener('error', () => { logo.remove(); }, { once: true });
  element.append(logo);
}

function carrierTrackingUrl(carrierId, trackingNumber) {
  const trackingPages = {
    ups: ['https://www.ups.com/track', 'tracknum', { loc: 'en_US' }],
    dhl: ['https://www.dhl.com/global-en/home/tracking.html', 'tracking-id'],
    laposte: ['https://www.laposte.fr/outils/track-a-parcel', 'code'],
    fedex: ['https://www.fedex.com/fedextrack/', 'trknbr'],
    'royal-mail': ['https://www.royalmail.com/track-your-item', 'trackNumber'],
    postnl: ['https://www.internationalparceltracking.com', 'B'],
    usps: ['https://tools.usps.com/go/TrackConfirmAction', 'tLabels']
  };
  const page = trackingPages[carrierId];
  if (!page) return null;
  const [baseUrl, trackingParameter, extraParameters = {}] = page;
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    ...extraParameters,
    [trackingParameter]: trackingNumber
  }).toString();
  return url.toString();
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

function resetCarrierSearch() {
  window.clearTimeout(carrierSearchTimeout);
  carrierSearchSequence += 1;
  trackingCarrierSearch.value = '';
  trackingCarrierSelect.replaceChildren(new Option('Choisissez un transporteur après la recherche', ''));
  trackingCarrierSelect.disabled = true;
  carrierInputRequirements.clear();
  trackingRecipientPostalCode.value = '';
  trackingRecipientEmail.value = '';
  trackingRecipientPhone.value = '';
  trackingRecipientPostalCode.hidden = true;
  trackingRecipientEmail.hidden = true;
  trackingRecipientPhone.hidden = true;
  trackingCarrierMessage.textContent = 'Choisissez le transporteur, ou indiquez le pays de destination.';
}

trackingCarrierSearch.addEventListener('input', () => {
  window.clearTimeout(carrierSearchTimeout);
  const query = trackingCarrierSearch.value.trim();
  const sequence = ++carrierSearchSequence;
  trackingCarrierSelect.replaceChildren(new Option('Recherche des transporteurs…', ''));
  trackingCarrierSelect.disabled = true;

  if (query.length < 2) {
    trackingCarrierSelect.replaceChildren(new Option('Choisissez un transporteur après la recherche', ''));
    trackingCarrierMessage.textContent = 'Saisissez au moins 2 caractères pour rechercher un transporteur.';
    return;
  }

  trackingCarrierMessage.textContent = 'Recherche dans le catalogue Parcels…';
  carrierSearchTimeout = window.setTimeout(async () => {
    try {
      const response = await fetch(`/api/carriers?${new URLSearchParams({ query })}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Le catalogue des transporteurs est indisponible.');
      if (sequence !== carrierSearchSequence) return;

      const carriers = Array.isArray(data.carriers) ? data.carriers : [];
      carrierInputRequirements.clear();
      for (const carrier of carriers) {
        if (carrier?.slug && carrier.inputRequirements) {
          carrierInputRequirements.set(carrier.slug, carrier.inputRequirements);
        }
      }
      trackingCarrierSelect.replaceChildren(
        new Option(
          carriers.length ? 'Sélectionnez le transporteur correspondant' : 'Aucun transporteur trouvé',
          ''
        ),
        ...carriers.map(carrier => new Option(carrier.name, carrier.slug))
      );
      trackingCarrierSelect.disabled = carriers.length === 0;
      trackingCarrierMessage.textContent = carriers.length
        ? `${carriers.length} transporteur${carriers.length > 1 ? 's' : ''} trouvé${carriers.length > 1 ? 's' : ''}. Sélectionnez celui indiqué par le vendeur ou le suivi officiel.`
        : 'Aucun résultat. Essayez un autre nom ou indiquez le pays de destination.';
    } catch (error) {
      if (sequence !== carrierSearchSequence) return;
      trackingCarrierSelect.replaceChildren(new Option('Recherche indisponible', ''));
      trackingCarrierMessage.textContent = error.message || 'La recherche de transporteur a échoué.';
    }
  }, 300);
});

trackingCarrierSearch.addEventListener('keydown', event => {
  if (event.key === 'Enter') event.preventDefault();
});

trackingCarrierSelect.addEventListener('change', () => {
  const selectedCarrier = trackingCarrierSelect.selectedOptions[0];
  const requirements = carrierInputRequirements.get(trackingCarrierSelect.value);
  const requiredFields = Array.isArray(requirements?.required) ? requirements.required : [];
  const optionalAlternatives = Array.isArray(requirements?.any_of) ? requirements.any_of : [];
  trackingRecipientPostalCode.hidden = ![...requiredFields, ...optionalAlternatives].includes('postal_code');
  trackingRecipientEmail.hidden = ![...requiredFields, ...optionalAlternatives].includes('email');
  trackingRecipientPhone.hidden = ![...requiredFields, ...optionalAlternatives].includes('phone');
  trackingCarrierMessage.textContent = selectedCarrier?.value
    ? `${selectedCarrier.textContent} sera transmis à Parcels comme transporteur à rechercher.${requiredFields.length || optionalAlternatives.length ? ` Informations demandées : ${[...new Set([...requiredFields, ...optionalAlternatives])].join(', ')}.` : ''}`
    : 'Choisissez le transporteur, ou indiquez le pays de destination.';
});

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
    track17TrackingLink.href = `https://t.17track.net/en#nums=${encodeURIComponent(selectedTracking)}`;
  } else {
    parcelTrackingLink.href = 'https://parcelsapp.com/';
    track17TrackingLink.href = 'https://t.17track.net/en';
  }
  setOutboundLinkBehavior(parcelTrackingLink);
  setOutboundLinkBehavior(track17TrackingLink);
}

function translateTrackingState(state) {
  const normalized = state.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLocaleLowerCase('en').replace(/[.!?]+$/, '');
  const translations = {
    'la poste is ready to take care of your shipment. as soon as it is entrusted to us, you will be able to track its journey here': 'La Poste est prête à prendre en charge votre colis. Vous pourrez suivre son acheminement dès qu’il nous sera confié.',
    'ready to take care of your shipment. as soon as it is entrusted to us, you will be able to track its journey here': 'Prise en charge en attente. Vous pourrez suivre le colis dès qu’il sera confié au transporteur.',
    'shipment information received': 'Informations d’expédition reçues',
    'we have received your shipment information': 'Nous avons reçu les informations d’expédition',
    'the sender has provided shipment information': 'L’expéditeur a transmis les informations d’expédition',
    'your parcel is on its way': 'Votre colis est en cours d’acheminement',
    'your shipment is on its way': 'Votre colis est en cours d’acheminement',
    'we have your package': 'Le transporteur a pris en charge votre colis',
    'we have your parcel': 'Le transporteur a pris en charge votre colis',
    'delivered': 'Livré',
    'shipment delivered': 'Colis livré',
    'delivered to recipient': 'Colis remis au destinataire',
    'delivered to the recipient': 'Colis remis au destinataire',
    'out for delivery': 'En cours de livraison',
    'shipment is out for delivery': 'Colis en cours de livraison',
    'shipment is in transit': 'Colis en transit',
    'shipment moving through network': 'Colis en cours d’acheminement',
    'delivery attempted': 'Tentative de livraison',
    'delivery attempt': 'Tentative de livraison',
    'picked up': 'Pris en charge',
    'shipment picked up': 'Colis pris en charge',
    'accepted': 'Pris en charge par le transporteur',
    'in transit': 'En transit',
    'transit': 'En transit',
    'on the way': 'En transit',
    'arrived at destination': 'Arrivé à destination',
    'arrived at facility': 'Arrivé dans un centre de tri',
    'departed from facility': 'Parti du centre de tri',
    'departed facility': 'Parti du centre de tri',
    'label created': 'Étiquette créée',
    'shipment information sent': 'Informations d’expédition transmises',
    'shipment information sent to fedex': 'Informations d’expédition transmises à FedEx',
    'shipment exception': 'Incident de transport',
    'delivery exception': 'Incident de livraison',
    'clearance in progress': 'Dédouanement en cours',
    'customs clearance': 'Dédouanement en cours',
    'package available for pickup': 'Colis disponible au retrait',
    'available for pickup': 'Disponible au retrait',
    'left at': 'Déposé à l’adresse de livraison',
    'international shipment release': 'Colis libéré par la douane'
  };
  if (translations[normalized]) return translations[normalized];
  const shipmentInformation = state.match(/^(?:shipment information|shipping information) (?:has been )?(received|submitted|sent)(?: by (.+))?\.?$/i);
  if (shipmentInformation) {
    const action = shipmentInformation[1].toLowerCase() === 'received' ? 'reçues' : 'transmises';
    const carrier = shipmentInformation[2] ? ` par ${shipmentInformation[2]}` : '';
    return `Informations d’expédition ${action}${carrier}`;
  }
  const packageAction = state.match(/^(?:your )?(?:package|parcel|shipment) (?:has been )?(picked up|accepted|delivered|is in transit|is out for delivery)\.?$/i);
  if (packageAction) {
    const action = packageAction[1].toLowerCase();
    const translationsByAction = {
      'picked up': 'pris en charge',
      'accepted': 'accepté par le transporteur',
      'delivered': 'livré',
      'is in transit': 'en cours d’acheminement',
      'is out for delivery': 'en cours de livraison'
    };
    return `Colis ${translationsByAction[action]}`;
  }
  const destinationReady = state.match(/^(?:your )?(?:package|parcel|shipment) is (?:ready|available) for pickup\.?$/i);
  if (destinationReady) return 'Votre colis est disponible au retrait';
  const hubArrival = state.match(/^arrived at (.+?) hub$/i);
  if (hubArrival) return `Arrivé au centre de tri ${hubArrival[1]}`;
  const hubDeparture = state.match(/^departed (?:from )?(.+?) hub$/i);
  if (hubDeparture) return `Parti du centre de tri ${hubDeparture[1]}`;
  const facilityUpdate = state.match(/^(?:shipment )?(arrived|departed|processed) (?:at|from) (.+?)(?: facility| location)?$/i);
  if (facilityUpdate) {
    const action = { arrived: 'Arrivé au centre de tri', departed: 'Parti du centre de tri', processed: 'Traité au centre de tri' };
    return `${action[facilityUpdate[1].toLowerCase()]} ${facilityUpdate[2]}`;
  }
  const localFacility = state.match(/^at (?:the )?local (.+?) facility$/i);
  if (localFacility) return `Au centre de tri local ${localFacility[1]}`;
  const deliveredPlace = state.match(/^left at (.+)$/i);
  if (deliveredPlace) return `Déposé à ${deliveredPlace[1]}`;
  const carrierShipmentInfo = state.match(/^shipment information sent to (.+)$/i);
  if (carrierShipmentInfo) return `Informations d’expédition transmises à ${carrierShipmentInfo[1]}`;
  return state;
}

function trackingTranslationKey(language, text) {
  return `${language}\u0000${text}`;
}

function getTrackingDisplayText(text) {
  if (!trackingTranslationEnabled || trackingTranslationLanguage.value === 'en') return text;
  const translated = trackingTranslations.get(trackingTranslationKey(trackingTranslationLanguage.value, text));
  if (translated) return translated;
  return trackingTranslationLanguage.value === 'fr' ? translateTrackingState(text) : text;
}

function requestTrackingTranslations(shipment, texts) {
  const language = trackingTranslationLanguage.value;
  if (!trackingTranslationEnabled || language === 'en') {
    trackingTranslationMessage.hidden = true;
    return;
  }

  const unresolved = [...new Set(texts)].filter(text =>
    text && !trackingTranslations.has(trackingTranslationKey(language, text))
  );
  if (unresolved.length === 0) {
    trackingTranslationMessage.hidden = true;
    return;
  }

  const jobKey = `${shipment.number}\u0000${language}`;
  if (trackingTranslationJobs.has(jobKey)) return;
  trackingTranslationJobs.add(jobKey);
  trackingTranslationMessage.hidden = false;
  trackingTranslationMessage.classList.remove('is-error');
  trackingTranslationMessage.textContent = `Traduction en cours… ${unresolved.length} texte(s)`;

  void (async () => {
    try {
      for (let index = 0; index < unresolved.length; index += 10) {
        const textsToTranslate = unresolved.slice(index, index + 10);
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetLanguage: language, texts: textsToTranslate })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'La traduction a échoué.');
        if (!Array.isArray(result.translations) || result.translations.length !== textsToTranslate.length) {
          throw new Error('La réponse de traduction est incomplète.');
        }
        textsToTranslate.forEach((text, textIndex) => {
          const translated = result.translations[textIndex];
          if (typeof translated !== 'string' || !translated.trim()) {
            throw new Error('Une étape n’a pas pu être traduite.');
          }
          trackingTranslations.set(trackingTranslationKey(language, text), translated.trim());
        });
      }
    } catch (error) {
      if (selectedTracking === shipment.number && trackingTranslationLanguage.value === language) {
        trackingTranslationMessage.textContent = `${error.message} Les traductions locales disponibles sont conservées.`;
        trackingTranslationMessage.classList.add('is-error');
      }
      return;
    } finally {
      trackingTranslationJobs.delete(jobKey);
    }

    if (
      selectedTracking === shipment.number &&
      trackingTranslationEnabled &&
      trackingTranslationLanguage.value === language
    ) {
      trackingTranslationMessage.hidden = true;
      renderTrackingHistory(shipments.find(item => item.number === selectedTracking));
    }
  })();
}

function findCarrierAcceptanceDate(events) {
  const acceptedEvents = events.flatMap(event => {
    const state = typeof event.state === 'string' ? event.state : '';
    const timestamp = Date.parse(event.date);
    if (
      !/(?:\b(?:picked up|collected by (?:the )?carrier|accepted by (?:the )?carrier|received by (?:the )?carrier|shipment accepted|package accepted|handed over to (?:the )?carrier)\b|pris en charge|collecté par le transporteur|accepté par le transporteur|reçu par le transporteur|remis au transporteur)/i.test(state) ||
      !Number.isFinite(timestamp) ||
      timestamp > Date.now()
    ) return [];
    return [{ date: new Date(timestamp).toISOString(), timestamp }];
  });
  return acceptedEvents.sort((left, right) => left.timestamp - right.timestamp)[0]?.date ?? '';
}

function getShipmentTrackingTimestamp(shipment) {
  const events = Array.isArray(shipment.tracking?.events) ? shipment.tracking.events : [];
  const acceptanceDate = findCarrierAcceptanceDate(events);
  if (acceptanceDate) return Date.parse(acceptanceDate);
  const eventTimestamps = events
    .map(event => Date.parse(event.date))
    .filter(timestamp => Number.isFinite(timestamp) && timestamp <= Date.now());
  return eventTimestamps.length ? Math.min(...eventTimestamps) : Date.parse(shipment.addedAt);
}

function getTransitDurationLabel(shipment) {
  const events = Array.isArray(shipment.tracking?.events) ? shipment.tracking.events : [];
  const datedEvents = events.flatMap(event => {
    const timestamp = Date.parse(event.date);
    return Number.isFinite(timestamp) && timestamp <= Date.now()
      ? [{ event, timestamp }]
      : [];
  });
  if (!datedEvents.length) return '';

  const acceptanceDate = findCarrierAcceptanceDate(events);
  const startTimestamp = acceptanceDate
    ? Date.parse(acceptanceDate)
    : datedEvents
      .filter(({ event }) => !/\b(?:label created|shipment information received|awaiting|ready to take care)\b/i.test(event.state))
      .sort((left, right) => left.timestamp - right.timestamp)[0]?.timestamp;
  if (!Number.isFinite(startTimestamp)) return '';

  datedEvents.sort((left, right) => left.timestamp - right.timestamp);
  const deliveredEvent = datedEvents
    .filter(({ event }) => /(?:\bdelivered\b|livré|livrée)/i.test(event.state))
    .sort((left, right) => left.timestamp - right.timestamp)[0];
  const delivered = deliveredEvent || /(?:\bdelivered\b|livré|livrée)/i.test(shipment.tracking?.status ?? '');
  const endTimestamp = delivered
    ? deliveredEvent?.timestamp ?? datedEvents.at(-1).timestamp
    : Date.now();
  const days = Math.floor(Math.max(0, endTimestamp - startTimestamp) / 86_400_000);
  const duration = days === 0 ? 'moins d’un jour' : `${days} ${days === 1 ? 'jour' : 'jours'}`;
  return delivered ? `Transit : ${duration}` : `En transit depuis ${duration}`;
}

function saveDeliveryEstimate(trackingNumber, estimate) {
  const previousShipments = shipments;
  shipments = shipments.map(shipment => shipment.number === trackingNumber
    ? { ...shipment, tracking: { ...shipment.tracking, deliveryEstimate: estimate } }
    : shipment);
  if (!saveShipments()) {
    shipments = previousShipments;
    return;
  }
  if (selectedTracking === trackingNumber) renderDeliveryEstimate(shipments.find(item => item.number === trackingNumber));
}

function renderDeliveryEstimate(shipment) {
  deliveryCountdownWindow.textContent = '';
  deliveryCountdownConfidence.hidden = true;
  if (!shipment) {
    deliveryCountdownTime.textContent = 'Sélectionnez un colis pour afficher une estimation.';
    deliveryCountdownNote.textContent = 'L’estimation dépend des données fournies par le transporteur.';
    return;
  }

  const status = typeof shipment.tracking?.status === 'string' ? shipment.tracking.status : '';
  const events = Array.isArray(shipment.tracking?.events) ? shipment.tracking.events : [];
  const isDelivered = /\bdelivered\b/i.test(status) ||
    events.some(event => /\bdelivered\b/i.test(typeof event.state === 'string' ? event.state : ''));
  if (isDelivered) {
    deliveryCountdownTime.textContent = 'Colis livré';
    deliveryCountdownWindow.textContent = '';
    deliveryCountdownNote.textContent = 'Le transporteur a confirmé la livraison.';
    return;
  }

  const estimate = shipment.tracking?.deliveryEstimate;
  if (deliveryEstimateRequests.has(shipment.number) || estimate?.state === 'loading') {
    deliveryCountdownTime.textContent = 'Calcul de la fenêtre estimée…';
    deliveryCountdownNote.textContent = 'L’estimation ne consomme pas le quota de suivi Parcels.';
    return;
  }
  if (estimate?.state !== 'ready' || !Number.isFinite(Date.parse(estimate.from)) || !Number.isFinite(Date.parse(estimate.to))) {
    deliveryCountdownTime.textContent = 'Pas encore d’estimation fiable';
    const unavailableMessages = {
      missing_acceptance: 'Une fenêtre pourra être calculée après un scan de prise en charge confirmé par le transporteur.',
      insufficient_data: 'Les données historiques du transporteur ne suffisent pas à estimer ce trajet.',
      feature_unavailable: 'Le service d’estimation Parcels n’est pas disponible actuellement pour ce compte.',
      rate_limited: 'Le service limite temporairement les estimations. Réessayez lors de la prochaine actualisation.',
      service_unavailable: 'Le service d’estimation est temporairement indisponible. Actualisez le suivi plus tard.'
    };
    deliveryCountdownNote.textContent = unavailableMessages[estimate?.reason] ??
      'Une estimation s’affichera lorsque le transporteur et les lieux de départ et d’arrivée seront connus.';
    return;
  }

  const now = Date.now();
  const from = Date.parse(estimate.from);
  const to = Date.parse(estimate.to);
  const formatDate = date => new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
  deliveryCountdownWindow.textContent = `${formatDate(new Date(from))} – ${formatDate(new Date(to))} · heure locale de l’appareil`;
  const confidenceLabels = {
    high: 'Fiabilité élevée',
    medium: 'Fiabilité moyenne',
    low: 'Fiabilité faible'
  };
  const confidence = confidenceLabels[estimate.confidence];
  if (confidence) {
    deliveryCountdownConfidence.textContent = confidence;
    deliveryCountdownConfidence.hidden = false;
  }
  if (now < from) {
    const remainingMinutes = Math.ceil((from - now) / 60_000);
    const days = Math.floor(remainingMinutes / 1440);
    const hours = Math.floor((remainingMinutes % 1440) / 60);
    const minutes = remainingMinutes % 60;
    deliveryCountdownTime.textContent = `Fenêtre dans ${days ? `${days} j ` : ''}${hours} h ${minutes.toString().padStart(2, '0')} min`;
    deliveryCountdownNote.textContent = 'Prévision statistique indicative, susceptible d’évoluer avec les prochains scans.';
  } else if (now <= to) {
    const remainingMinutes = Math.ceil((to - now) / 60_000);
    const days = Math.floor(remainingMinutes / 1440);
    const hours = Math.floor((remainingMinutes % 1440) / 60);
    deliveryCountdownTime.textContent = `Fenêtre de livraison en cours${remainingMinutes ? ` · jusqu’à ${days ? `${days} j ` : ''}${hours} h` : ''}`;
    deliveryCountdownNote.textContent = 'Prévision statistique indicative, susceptible d’évoluer avec les prochains scans.';
  } else {
    deliveryCountdownTime.textContent = 'La fenêtre estimée est dépassée';
    deliveryCountdownNote.textContent = 'L’ETA a peut-être évolué. Actualisez le suivi pour obtenir les dernières données.';
  }
}

async function refreshDeliveryEstimate(trackingNumber, trackingResult, events) {
  const trackingStatus = typeof trackingResult.status === 'string' ? trackingResult.status : '';
  const acceptanceDate = findCarrierAcceptanceDate(events);
  const canEstimate = typeof trackingResult.carrierSlug === 'string' &&
    typeof trackingResult.transportMode === 'string' &&
    typeof trackingResult.originCountryCode === 'string' &&
    typeof trackingResult.destinationCountryCode === 'string';
  if (!acceptanceDate || !canEstimate || /\bdelivered\b/i.test(trackingStatus)) {
    saveDeliveryEstimate(trackingNumber, {
      state: 'unavailable',
      reason: /\bdelivered\b/i.test(trackingStatus) ? 'delivered' : 'missing_acceptance'
    });
    return;
  }

  deliveryEstimateRequests.add(trackingNumber);
  if (selectedTracking === trackingNumber) renderDeliveryEstimate(shipments.find(item => item.number === trackingNumber));
  try {
    const response = await fetch('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrierSlug: trackingResult.carrierSlug,
        transportMode: trackingResult.transportMode,
        originCountryCode: trackingResult.originCountryCode,
        destinationCountryCode: trackingResult.destinationCountryCode,
        acceptedAt: acceptanceDate
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Le service d’estimation est momentanément indisponible.');
    const range = data.estimate;
    if (
      !range ||
      !Number.isFinite(Date.parse(range.from)) ||
      !Number.isFinite(Date.parse(range.to)) ||
      Date.parse(range.to) < Date.parse(range.from)
    ) {
      const insufficientData = data.reason === 'INSUFFICIENT_DATA' ||
        data.reason === 'insufficient_censored_data' ||
        data.reason === 'insufficient_tail_data';
      saveDeliveryEstimate(trackingNumber, {
        state: 'unavailable',
        reason: insufficientData
          ? 'insufficient_data'
          : data.reason === 'FEATURE_UNAVAILABLE'
            ? 'feature_unavailable'
            : data.reason === 'RATE_LIMITED'
              ? 'rate_limited'
              : 'no_reliable_window'
      });
      return;
    }
    saveDeliveryEstimate(trackingNumber, {
      state: 'ready',
      from: range.from,
      to: range.to,
      confidence: range.confidence,
      medianDays: range.medianDays
    });
  } catch (error) {
    console.warn('Impossible de calculer la fenêtre de livraison estimée.', error);
    saveDeliveryEstimate(trackingNumber, { state: 'unavailable', reason: 'service_unavailable' });
  } finally {
    deliveryEstimateRequests.delete(trackingNumber);
    if (selectedTracking === trackingNumber) renderDeliveryEstimate(shipments.find(item => item.number === trackingNumber));
  }
}

function renderTrackingHistory(shipment) {
  trackingSummary.replaceChildren();
  trackingEvents.replaceChildren();
  const trackingNumber = shipment?.number ?? '';
  if (trackingCarrierSelectionFor !== trackingNumber) {
    resetCarrierSearch();
    trackingCarrierSelectionFor = trackingNumber;
  }
  renderDeliveryEstimate(shipment);
  const events = Array.isArray(shipment?.tracking?.events) ? shipment.tracking.events : [];
  const flightLegs = Array.isArray(shipment?.tracking?.flightLegs) ? shipment.tracking.flightLegs : [];
  const hasTranslatableTexts = events.length > 0 || flightLegs.some(leg => typeof leg.status === 'string' && leg.status);
  trackingTranslationControls.hidden = !hasTranslatableTexts;
  trackingTranslationToggle.hidden = trackingTranslationLanguage.value === 'en';
  trackingTranslationLanguage.disabled = !hasTranslatableTexts;
  trackingTranslationToggle.textContent = trackingTranslationEnabled
    ? 'Afficher le texte original'
    : `Traduire en ${trackingTranslationLanguage.selectedOptions[0]?.textContent ?? 'français'}`;
  if (!hasTranslatableTexts || !trackingTranslationEnabled || trackingTranslationLanguage.value === 'en') {
    trackingTranslationMessage.hidden = true;
  }
  renderSidebarCurrentParcel();
  parcelWidgetDetails.hidden = !shipment?.tracking || events.length > 0 || flightLegs.length > 0;
  trackingCountryForm.hidden = !shipment?.tracking?.needsDestinationCountry &&
    !shipment?.tracking?.needsRecipientDetails;
  if (shipment?.tracking?.needsRecipientDetails) {
    const selectedRequirements = carrierInputRequirements.get(trackingCarrierSelect.value) ?? {};
    const acceptedFields = new Set(shipment.tracking.acceptedFields ?? []);
    const requirements = shipment.tracking.inputRequirements ?? selectedRequirements;
    const requestedFields = new Set([
      ...acceptedFields,
      ...(requirements.required ?? []),
      ...(requirements.any_of ?? [])
    ]);
    const showAllRecipientFields = requestedFields.size === 0;
    trackingRecipientPostalCode.hidden = !showAllRecipientFields && !requestedFields.has('postal_code');
    trackingRecipientEmail.hidden = !showAllRecipientFields && !requestedFields.has('email');
    trackingRecipientPhone.hidden = !showAllRecipientFields && !requestedFields.has('phone');
    trackingCarrierMessage.textContent = showAllRecipientFields
      ? 'Parcels demande des informations sur le destinataire. Saisissez uniquement celles demandées par le transporteur ; elles ne seront transmises qu’à Parcels pour cette recherche.'
      : 'Le transporteur demande ces informations pour confirmer le destinataire ; elles ne sont transmises qu’à Parcels pour cette recherche.';
  }
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
  const currentStatus = typeof shipment.tracking?.status === 'string' ? shipment.tracking.status : '';
  const isInTransit = /\b(?:in[\s_-]*)?transit\b/i.test(currentStatus);
  summaryTitle.classList.toggle('is-transit', isInTransit);
  summaryTitle.textContent = shipment.tracking?.error
    ? 'Suivi indisponible'
    : currentStatus
      ? getTrackingDisplayText(currentStatus)
      : 'Suivi du colis';
  if (shipment.name?.trim()) {
    const shipmentName = document.createElement('span');
    shipmentName.className = 'tracking-summary-name';
    shipmentName.textContent = shipment.name.trim();
    trackingSummary.append(shipmentName);
  }
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

  const carrierLinkUrl = carrierTrackingUrl(getShipmentCarrier(shipment).id, shipment.number);
  if (carrierLinkUrl) {
    const carrierLink = document.createElement('a');
    carrierLink.className = 'tracking-carrier-link';
    carrierLink.href = carrierLinkUrl;
    carrierLink.textContent = `Suivre chez ${carrier}`;
    carrierLink.setAttribute('aria-label', `Ouvrir le suivi ${carrier} pour le colis ${shipment.number}`);
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ' ↗';
    carrierLink.append(icon);
    setOutboundLinkBehavior(carrierLink);
    trackingSummary.append(carrierLink);
  }

  if (shipment.tracking?.error) {
    const message = document.createElement('p');
    message.className = 'tracking-summary-message';
    message.textContent = shipment.tracking.error.replace(/\s*\(Parcels API v4[^)]*\)/g, '');
    trackingEvents.append(message);
    if (shipment.tracking.detail) {
      const detail = document.createElement('p');
      detail.className = 'tracking-summary-message';
      detail.textContent = `Détail du service : ${shipment.tracking.detail}`;
      trackingEvents.append(detail);
    }
  }

  if (events.length === 0 && flightLegs.length === 0) {
    const message = document.createElement('p');
    message.className = 'tracking-summary-message';
    message.textContent = shipment.tracking?.error
      ? ''
      : shipment.tracking
        ? shipment.tracking.provider === '17TRACK'
          ? `17TRACK a reconnu ${getShipmentCarrier(shipment).label}, mais n’a pas encore renvoyé d’événement détaillé pour ce colis.`
          : `Parcels a reconnu ${getShipmentCarrier(shipment).label}, mais n’a renvoyé aucun événement détaillé pour ce colis. Le suivi complet est accessible via le lien Parcel App ci-dessous.`
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
        timeZone: 'Europe/Paris',
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }).format(date);
    } else {
      time.textContent = 'Date inconnue';
    }
    const content = document.createElement('div');
    content.className = 'tracking-event-content';
    const state = document.createElement('strong');
    state.textContent = getTrackingDisplayText(event.state);
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
      const status = typeof leg.status === 'string'
        ? getTrackingDisplayText(leg.status)
        : '';
      details.textContent = [leg.flightNumber, status].filter(Boolean).join(' · ');
      content.append(details);
    }
    item.append(time, content);
    trackingEvents.append(item);
  }
  requestTrackingTranslations(shipment, [
    currentStatus,
    ...events.map(event => event.state),
    ...flightLegs.map(leg => leg.status)
  ].filter(text => typeof text === 'string' && text.trim()));
}

trackingTranslationToggle.addEventListener('click', () => {
  trackingTranslationEnabled = !trackingTranslationEnabled;
  const shipment = shipments.find(item => item.number === selectedTracking);
  renderTrackingHistory(shipment);
});

trackingTranslationLanguage.addEventListener('change', () => {
  trackingTranslationEnabled = true;
  trackingTranslationMessage.hidden = true;
  renderTrackingHistory(shipments.find(item => item.number === selectedTracking));
});

parcelWidgetDetails.addEventListener('toggle', () => {
  if (parcelWidgetDetails.open && parcelWidget.dataset.src && parcelWidget.src !== parcelWidget.dataset.src) {
    parcelWidget.src = parcelWidget.dataset.src;
  }
});

function renderShipments() {
  shipmentList.replaceChildren();
  shipmentCount.textContent = String(shipments.length);
  renderSidebarCurrentParcel();
  emptyState.hidden = shipments.length > 0;

  const sortedShipments = getSortedShipments();

  let shipmentIndex = 0;
  for (const shipment of sortedShipments) {
    const item = document.createElement('article');
    item.className = `shipment-item${shipment.number === selectedTracking ? ' is-selected' : ''}`;
    item.dataset.tint = String(shipmentIndex % 6);
    shipmentIndex += 1;

    const icon = document.createElement('span');
    icon.className = 'shipment-icon';
    const carrier = getShipmentCarrier(shipment);
    renderCarrierIcon(icon, shipment, carrier);

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
      name.className = shipment.name ? 'shipment-name' : 'shipment-name shipment-number';
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
      const transitDuration = getTransitDurationLabel(shipment);
      if (transitDuration) {
        const transit = document.createElement('span');
        transit.className = 'shipment-transit-duration';
        transit.textContent = transitDuration;
        info.append(transit);
      }
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
      updateSelectedParcelRoute({ fetchDetails: true, forceRefresh: true });
      document.querySelector('#suivi').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const rename = document.createElement('button');
    rename.className = 'shipment-rename';
    rename.type = 'button';
    rename.textContent = 'Renommer';
    rename.setAttribute('aria-label', `Renommer le colis ${shipment.number}`);
    rename.addEventListener('click', () => {
      editingShipment = shipment.number;
      editingCarrierShipment = '';
      renderShipments();
    });

    const correctCarrier = document.createElement('button');
    correctCarrier.className = 'shipment-carrier-edit';
    correctCarrier.type = 'button';
    correctCarrier.textContent = editingCarrierShipment === shipment.number ? 'Fermer' : 'Corriger transporteur';
    correctCarrier.setAttribute('aria-expanded', String(editingCarrierShipment === shipment.number));
    correctCarrier.setAttribute('aria-label', `Corriger le transporteur du colis ${shipment.number}`);
    correctCarrier.addEventListener('click', () => {
      editingCarrierShipment = editingCarrierShipment === shipment.number ? '' : shipment.number;
      editingShipment = '';
      renderShipments();
      if (editingCarrierShipment === shipment.number) {
        item.querySelector('.shipment-carrier-search')?.focus();
      }
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
      actions.append(select, rename, correctCarrier, remove);
    }
    item.append(icon, info, actions);
    if (editingCarrierShipment === shipment.number) {
      const correctionForm = document.createElement('form');
      correctionForm.className = 'shipment-carrier-form';
      const instructions = document.createElement('p');
      instructions.textContent = 'Recherchez le transporteur indiqué par le vendeur ou le suivi officiel, puis relancez la recherche du colis.';
      const search = document.createElement('input');
      search.className = 'shipment-carrier-search';
      search.type = 'search';
      search.autocomplete = 'off';
      search.maxLength = 100;
      search.placeholder = 'Rechercher un transporteur (ex. La Poste)';
      search.setAttribute('aria-label', `Rechercher un transporteur pour le colis ${shipment.number}`);
      const carrierSelect = document.createElement('select');
      carrierSelect.disabled = true;
      carrierSelect.setAttribute('aria-label', `Transporteur à utiliser pour le colis ${shipment.number}`);
      carrierSelect.add(new Option('Recherchez puis choisissez un transporteur', ''));
      const country = document.createElement('input');
      country.type = 'text';
      country.autocomplete = 'country-name';
      country.maxLength = 100;
      country.placeholder = 'Pays de destination (facultatif)';
      country.setAttribute('aria-label', `Pays de destination du colis ${shipment.number}`);
      const postalCode = document.createElement('input');
      postalCode.type = 'text';
      postalCode.autocomplete = 'postal-code';
      postalCode.maxLength = 32;
      postalCode.placeholder = 'Code postal (si demandé)';
      postalCode.setAttribute('aria-label', `Code postal du destinataire pour le colis ${shipment.number}`);
      postalCode.hidden = true;
      const email = document.createElement('input');
      email.type = 'email';
      email.autocomplete = 'email';
      email.maxLength = 254;
      email.placeholder = 'E-mail du destinataire (si demandé)';
      email.setAttribute('aria-label', `E-mail du destinataire pour le colis ${shipment.number}`);
      email.hidden = true;
      const phone = document.createElement('input');
      phone.type = 'tel';
      phone.autocomplete = 'tel';
      phone.maxLength = 40;
      phone.placeholder = 'Téléphone du destinataire (si demandé)';
      phone.setAttribute('aria-label', `Téléphone du destinataire pour le colis ${shipment.number}`);
      phone.hidden = true;
      const message = document.createElement('p');
      message.className = 'shipment-carrier-message';
      message.setAttribute('aria-live', 'polite');
      message.textContent = 'La sélection sera enregistrée pour ce colis et transmise à Parcels.';
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.textContent = 'Enregistrer et relancer le suivi';
      let searchTimer;
      let searchSequence = 0;
      let requirements = {};

      search.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        const query = search.value.trim();
        const sequence = ++searchSequence;
        carrierSelect.replaceChildren(new Option('Recherche des transporteurs…', ''));
        carrierSelect.disabled = true;
        requirements = {};
        if (query.length < 2) {
          carrierSelect.replaceChildren(new Option('Saisissez au moins 2 caractères', ''));
          message.textContent = 'Saisissez au moins 2 caractères pour rechercher un transporteur.';
          return;
        }
        message.textContent = 'Recherche dans le catalogue Parcels…';
        searchTimer = window.setTimeout(async () => {
          try {
            const response = await fetch(`/api/carriers?${new URLSearchParams({ query })}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Le catalogue des transporteurs est indisponible.');
            if (sequence !== searchSequence) return;
            const carriers = Array.isArray(data.carriers) ? data.carriers : [];
            requirements = Object.fromEntries(carriers
              .filter(carrier => typeof carrier?.slug === 'string')
              .map(carrier => [carrier.slug, carrier.inputRequirements ?? {}]));
            carrierSelect.replaceChildren(
              new Option(carriers.length ? 'Sélectionnez le bon transporteur' : 'Aucun transporteur trouvé', ''),
              ...carriers.map(carrier => new Option(carrier.name, carrier.slug))
            );
            carrierSelect.disabled = carriers.length === 0;
            message.textContent = carriers.length
              ? `${carriers.length} résultat${carriers.length > 1 ? 's' : ''}. Choisissez le transporteur correspondant à l’étiquette ou au vendeur.`
              : 'Aucun résultat. Essayez un autre nom.';
          } catch (error) {
            if (sequence !== searchSequence) return;
            carrierSelect.replaceChildren(new Option('Recherche indisponible', ''));
            message.textContent = error.message || 'La recherche de transporteur a échoué.';
          }
        }, 300);
      });
      search.addEventListener('keydown', event => {
        if (event.key === 'Enter') event.preventDefault();
      });
      carrierSelect.addEventListener('change', () => {
        const choice = carrierSelect.selectedOptions[0];
        const requirementsForCarrier = requirements[carrierSelect.value] ?? {};
        const requiredFields = Array.isArray(requirementsForCarrier.required) ? requirementsForCarrier.required : [];
        const alternatives = Array.isArray(requirementsForCarrier.any_of) ? requirementsForCarrier.any_of : [];
        postalCode.hidden = ![...requiredFields, ...alternatives].includes('postal_code');
        email.hidden = ![...requiredFields, ...alternatives].includes('email');
        phone.hidden = ![...requiredFields, ...alternatives].includes('phone');
        message.textContent = choice?.value
          ? `${choice.textContent} sera utilisé pour ce suivi.${requiredFields.length || alternatives.length ? ` Informations demandées : ${[...new Set([...requiredFields, ...alternatives])].join(', ')}.` : ''}`
          : 'Choisissez le transporteur indiqué par le vendeur ou le suivi officiel.';
      });
      correctionForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (routeRequests.has(shipment.number)) {
          message.textContent = 'Une recherche est déjà en cours pour ce colis. Réessayez dès qu’elle est terminée.';
          return;
        }
        const carrierHint = carrierSelect.value;
        const carrierName = carrierSelect.selectedOptions[0]?.textContent?.trim() ?? '';
        if (!carrierHint || !carrierName) {
          message.textContent = 'Recherchez puis sélectionnez le transporteur avant de relancer le suivi.';
          search.focus();
          return;
        }
        const recipientDetails = {
          postal_code: postalCode.value.trim(),
          email: email.value.trim(),
          phone: phone.value.trim()
        };
        for (const [key, value] of Object.entries(recipientDetails)) {
          if (!value) delete recipientDetails[key];
        }
        const previousShipments = shipments;
        shipments = shipments.map(saved => saved.number === shipment.number
          ? { ...saved, carrierHint, carrierName, ...(country.value.trim() ? { destinationCountry: country.value.trim() } : {}) }
          : saved);
        if (!saveShipments()) {
          shipments = previousShipments;
          return;
        }
        selectedTracking = shipment.number;
        updateParcelTrackingLink();
        renderShipments();
        const activeForm = shipmentList.querySelector('.shipment-carrier-form button[type="submit"]');
        if (activeForm) activeForm.disabled = true;
        const activeMessage = shipmentList.querySelector('.shipment-carrier-message');
        if (activeMessage) activeMessage.textContent = `Relance du suivi avec ${carrierName}…`;
        try {
          await updateSelectedParcelRoute({
            fetchDetails: true,
            forceRefresh: true,
            destinationCountry: country.value.trim(),
            carrierHint,
            recipientDetails
          });
          const updatedShipment = shipments.find(item => item.number === shipment.number);
          if (updatedShipment?.tracking?.error) {
            showMessage(`Le transporteur a été enregistré, mais le suivi a échoué : ${updatedShipment.tracking.error}`, true);
          } else {
            showMessage(`Transporteur corrigé en ${carrierName}.`);
          }
        } finally {
          window.clearTimeout(searchTimer);
          editingCarrierShipment = '';
          renderShipments();
        }
      });
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'shipment-carrier-cancel';
      cancel.textContent = 'Annuler';
      const closeCorrection = () => {
        editingCarrierShipment = '';
        renderShipments();
      };
      cancel.addEventListener('click', closeCorrection);
      correctionForm.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeCorrection();
      });
      correctionForm.append(instructions, search, carrierSelect, country, postalCode, email, phone, message, cancel, submit);
      item.append(correctionForm);
    }
    shipmentList.append(item);
  }
}

function getSortedShipments() {
  return shipments
    .map((shipment, index) => ({ shipment, index, timestamp: getShipmentTrackingTimestamp(shipment) }))
    .sort((left, right) => {
      const leftTimestamp = Number.isFinite(left.timestamp) ? left.timestamp : 0;
      const rightTimestamp = Number.isFinite(right.timestamp) ? right.timestamp : 0;
      const difference = shipmentSort === 'oldest'
        ? leftTimestamp - rightTimestamp
        : rightTimestamp - leftTimestamp;
      return difference || left.index - right.index;
    })
    .map(item => item.shipment);
}

shipmentSortOrder.addEventListener('change', () => {
  shipmentSort = shipmentSortOrder.value === 'oldest' ? 'oldest' : 'newest';
  try {
    localStorage.setItem('colis-shipment-sort', shipmentSort);
  } catch (error) {
    showMessage('Le tri a changé, mais votre préférence ne peut pas être enregistrée.', true);
  }
  renderShipments();
});

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

const routeCountryNames = {
  DE: 'Allemagne',
  ES: 'Espagne',
  FR: 'France',
  GB: 'Royaume-Uni',
  IT: 'Italie',
  NL: 'Pays-Bas',
  US: 'États-Unis',
  CN: 'Chine',
  JP: 'Japon',
  BE: 'Belgique',
  CH: 'Suisse',
  PT: 'Portugal'
};

function normalizeRouteLocation(query) {
  let value = query.trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
  let country = '';
  const codeMatch = value.match(/(?:,\s*|\s+)([A-Z]{2})$/i);
  const countryCode = codeMatch?.[1].toUpperCase();
  if (codeMatch && routeCountryNames[countryCode]) {
    country = routeCountryNames[countryCode];
    value = value.slice(0, codeMatch.index).trim();
  }
  value = value
    .replace(/\bST\.?\s+/gi, 'Saint ')
    .replace(/\bSTE\.?\s+/gi, 'Sainte ')
    .replace(/\bSAINT\s+OUEN\b/gi, 'Saint-Ouen')
    .replace(/\s+(?:CEDEX(?:\s+\d+)?|\d{5})\b/gi, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s-])\p{L}/gu, character => character.toLocaleUpperCase('fr-FR'));
  return { place: value, country };
}

async function geocodeRouteLocation(query) {
  const normalized = normalizeRouteLocation(query);
  const queries = [
    [normalized.place, normalized.country].filter(Boolean).join(', '),
    normalized.place
  ].filter((value, index, values) => value && values.indexOf(value) === index);

  for (const candidate of queries) {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({
      name: candidate,
      count: '10',
      language: 'fr',
      format: 'json'
    }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Recherche de lieu indisponible (${response.status}).`);
    const { results } = await response.json();
    if (!Array.isArray(results) || results.length === 0) continue;
    return results.find(result =>
      normalized.country && result.country_code?.toUpperCase() === Object.keys(routeCountryNames)
        .find(code => routeCountryNames[code] === normalized.country)
    ) ?? results[0];
  }
  throw new Error(`Aucun lieu trouvé pour « ${query} ».`);
}

function isCountryOnlyPoint(point) {
  const pointName = point?.name?.trim().toLocaleLowerCase('fr-FR');
  return Object.values(routeCountryNames).some(country =>
    pointName === country.toLocaleLowerCase('fr-FR') ||
    pointName?.endsWith(`, ${country.toLocaleLowerCase('fr-FR')}`)
  );
}

async function refreshStoredRouteDestination(shipment) {
  const events = Array.isArray(shipment.tracking?.events) ? shipment.tracking.events : [];
  if (!isValidStoredRoute(shipment.route) || !isCountryOnlyPoint(shipment.route.destination) || !events.length) {
    return shipment;
  }
  const latestLocation = [...events].reverse().find(event =>
    typeof event.location === 'string' && event.location.trim()
  )?.location.trim();
  if (!latestLocation) return shipment;

  const place = await geocodeRouteLocation(latestLocation);
  if (place.feature_code === 'PCLI') return shipment;
  const oldStops = Array.isArray(shipment.route.stops) && shipment.route.stops.length > 1
    ? shipment.route.stops
    : [shipment.route.origin, shipment.route.destination];
  const destination = {
    name: placeName(place),
    latitude: place.latitude,
    longitude: place.longitude,
    label: `Destination : ${latestLocation}`
  };
  const route = {
    ...shipment.route,
    destination,
    stops: [...oldStops.slice(0, -1), destination]
  };
  const previousShipments = shipments;
  shipments = shipments.map(item => item.number === shipment.number ? { ...item, route } : item);
  if (!saveShipments()) {
    shipments = previousShipments;
    throw new Error('Le trajet corrigé n’a pas pu être enregistré sur cet appareil.');
  }
  return shipments.find(item => item.number === shipment.number) ?? shipment;
}

const placeName = location => [location.name, location.admin1, location.country]
  .filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ');

function setWeatherMapLocation(latitude, longitude) {
  weatherMapCoordinates = { latitude, longitude };
  const [overlay, level = 'surface'] = weatherMapLayer.value.split(':');
  const endpoint = new URL('https://embed.windy.com/embed.html');
  endpoint.search = new URLSearchParams({
    type: 'map',
    location: 'coordinates',
    metricRain: 'default',
    metricTemp: 'default',
    metricWind: 'default',
    zoom: '2',
    overlay,
    product: 'ecmwf',
    level,
    lat: String(latitude),
    lon: String(longitude),
    detailLat: String(latitude),
    detailLon: String(longitude),
    lang: 'fr'
  }).toString();
  weatherMap.src = endpoint.toString();
}

weatherMapLayer.addEventListener('change', () => {
  setWeatherMapLocation(weatherMapCoordinates.latitude, weatherMapCoordinates.longitude);
});

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

function createNightArea(date = new Date()) {
  const year = date.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - yearStart) / 86_400_000) + 1;
  const yearLength = new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365;
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3_600_000;
  const gamma = 2 * Math.PI / yearLength * (dayOfYear - 1 + (utcHours - 12) / 24);
  const equationOfTime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const solarLongitude = 180 - (utcHours * 15 + equationOfTime / 4);
  const longitude = ((solarLongitude + 360) % 360 - 180 + 180) % 360 - 180;
  // Terminator latitude for each longitude, closed through the pole that is in darkness.
  const safeDeclination = Math.abs(declination) < 1e-4 ? 1e-4 : declination;
  const nightPole = safeDeclination > 0 ? -90 : 90;
  const ring = [[-180, nightPole]];
  for (let lon = -180; lon <= 180; lon += 2) {
    const hourAngle = (lon - longitude - 180) * Math.PI / 180;
    ring.push([lon, Math.atan(-Math.cos(hourAngle) / Math.tan(safeDeclination)) * 180 / Math.PI]);
  }
  ring.push([180, nightPole], [-180, nightPole]);
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] }
    }]
  };
}

function updateDayNightOverlay() {
  parcelGlobe?.getSource('parcel-night')?.setData(createNightArea());
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
    const isOrigin = index === 0 && points.length > 1;
    element.className = `parcel-map-marker${isDestination ? ' is-destination' : index > 0 ? ' is-stop' : ''}`;
    if (isDestination || isOrigin) {
      const place = [point.name, point.label].filter(Boolean).join(' — ');
      const label = isDestination ? 'destination' : 'origine';
      element.setAttribute('role', 'button');
      element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', `Afficher l’${label} à l’échelle de la rue : ${place}`);
      element.title = isDestination
        ? 'Cliquez pour afficher la destination à l’échelle de la rue'
        : 'Double-cliquez pour afficher l’origine à l’échelle de la rue';
      const zoomToPlace = () => parcelGlobe.flyTo({
        center: [point.longitude, point.latitude],
        zoom: 15.5,
        duration: 1800,
        essential: true
      });
      if (isDestination) {
        element.addEventListener('click', zoomToPlace);
      } else {
        element.addEventListener('dblclick', event => {
          event.preventDefault();
          event.stopPropagation();
          zoomToPlace();
        });
      }
      element.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        zoomToPlace();
      });
    } else {
      element.setAttribute('aria-hidden', 'true');
    }
    return new Marker({ element, anchor: 'center' })
      .setLngLat([point.longitude, point.latitude])
      .setPopup(new Popup({ offset: 12, className: 'parcel-map-popup' }).setText(point.label))
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

parcelMapElement.addEventListener('wheel', event => {
  if (event.deltaMode !== 0 || !event.deltaY) return;
  const rect = parcelMapElement.getBoundingClientRect();
  const around = parcelGlobe?.unproject([event.clientX - rect.left, event.clientY - rect.top]);
  if (!parcelGlobe || !around) return;
  event.preventDefault();
  parcelGlobe.zoomTo(parcelGlobe.getZoom() - event.deltaY * 0.004, {
    around,
    duration: 0
  });
}, { passive: false });

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
    parcelGlobe.addSource('parcel-night', {
      type: 'geojson',
      data: createNightArea()
    });
    parcelGlobe.addLayer({
      id: 'parcel-night-shade',
      type: 'fill',
      source: 'parcel-night',
      paint: {
        'fill-color': '#172b43',
        'fill-opacity': 0.34,
        'fill-outline-color': '#b9c8da'
      }
    });
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
    window.setInterval(updateDayNightOverlay, 60_000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateDayNightOverlay();
    });
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

async function requestParcelTracking(trackingNumber, requestId, destinationCountry, requestedCarrier, recipientDetails, provider) {
  const carrier = detectCarrier(trackingNumber);
  const carrierHint = requestedCarrier || (carrier.hint ? carrier.id : '');
  const body = requestId
    ? { requestId, ...(provider ? { provider } : {}) }
    : {
      trackingNumber,
      ...(carrierHint ? { carrierHint, carrierHintExplicit: Boolean(requestedCarrier) } : {}),
      ...(destinationCountry ? { destinationCountry } : {}),
      ...(recipientDetails ? { recipientDetails } : {})
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
    error.needsRecipientDetails = result.needsRecipientDetails === true;
    error.acceptedFields = Array.isArray(result.acceptedFields) ? result.acceptedFields : [];
    error.inputRequirements = result.inputRequirements ?? null;
    error.detail = typeof result.detail === 'string' ? result.detail : '';
    throw error;
  }
  return result;
}

async function updateSelectedParcelRoute({
  fetchDetails = false,
  forceRefresh = false,
  destinationCountry,
  carrierHint,
  recipientDetails
} = {}) {
  if (!selectedTracking) {
    parcelRouteResult.textContent = 'Ajoutez un colis pour rechercher automatiquement son trajet.';
    parcelRouteResult.classList.remove('is-error');
    renderTrackingHistory(null);
    showParcelGlobePoints([]);
    return;
  }

  let shipment = shipments.find(item => item.number === selectedTracking);
  if (!shipment) return;
  renderTrackingHistory(shipment);
  if (isValidStoredRoute(shipment.route)) {
    let routeRefreshError = '';
    try {
      shipment = await refreshStoredRouteDestination(shipment);
    } catch (error) {
      routeRefreshError = error.message || 'la destination du dernier scan n’a pas pu être actualisée';
    }
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
    if (!forceRefresh && Array.isArray(shipment.tracking?.events) && (storedEvents.length > 0 || !fetchDetails)) {
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
      if (routeRefreshError) parcelRouteResult.textContent += ` · ${routeRefreshError}`;
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
    let result = await requestParcelTracking(
      trackingNumber,
      undefined,
      country,
      carrierHint || shipment.carrierHint,
      recipientDetails
    );
    for (let attempt = 0; result.pending && attempt < 8; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 1500));
      result = await requestParcelTracking(trackingNumber, result.requestId, undefined, undefined, undefined, result.provider);
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
    const allEventLocations = [];
    for (const event of chronologicalEvents) {
      const location = typeof event.location === 'string' ? event.location.trim() : '';
      const eventPlaces = [location, event.flightOrigin, event.flightDestination, event.station]
        .filter(value => typeof value === 'string' && value.trim());
      for (const place of eventPlaces) {
        if (!allEventLocations.some(item => item.toLocaleLowerCase() === place.toLocaleLowerCase())) {
          allEventLocations.push(place);
        }
      }
    }
    const flightLegs = Array.isArray(result.flightLegs) ? result.flightLegs : [];
    const flightCodes = new Set(flightLegs
      .flatMap(leg => [leg.origin, leg.destination])
      .filter(value => typeof value === 'string'));
    for (const leg of flightLegs) {
      for (const place of [leg.origin, leg.destination]) {
        if (
          typeof place === 'string' &&
          !allEventLocations.some(item => item.toLocaleLowerCase() === place.toLocaleLowerCase())
        ) allEventLocations.push(place);
      }
    }
    const eventLocations = allEventLocations.length <= 8
      ? allEventLocations
      : Array.from({ length: 8 }, (_, index) =>
        allEventLocations[Math.floor(index * (allEventLocations.length - 1) / 7)]);

    const originName = typeof result.origin === 'string' && result.origin.trim() ? result.origin.trim() : '';
    const destinationName = typeof result.destination === 'string' && result.destination.trim() ? result.destination.trim() : '';
    const endpointQueries = [originName, destinationName].filter(Boolean);
    const [endpointResults, eventResults] = await Promise.all([
      Promise.allSettled(endpointQueries.map(query => geocodeRouteLocation(query))),
      Promise.allSettled(eventLocations.map(query => geocodeRouteLocation(query)))
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
    const mappedEventCount = eventResults.filter(result => result.status === 'fulfilled').length;
    const addEndpoint = (name, label) => {
      const place = endpointPlaces.get(name);
      if (!place) return;
      if (place.feature_code === 'PCLI' && mappedEventCount > 0) return;
      addRoutePoint(place, label);
    };
    if (originName) addEndpoint(originName, `Provenance : ${originName}`);
    eventResults.forEach((resolution, index) => {
      if (resolution.status === 'fulfilled') {
        addRoutePoint(resolution.value, `Étape transporteur : ${eventLocations[index]}`);
      } else {
        unresolvedStops += 1;
      }
    });
    if (destinationName) addEndpoint(destinationName, `Destination : ${destinationName}`);
    const connectRoute = routePoints.length > 2 || mappedFlightPoints;

    const previousShipment = shipment;
    const tracking = {
      provider: result.provider === '17TRACK' ? '17TRACK' : 'Parcels',
      status: result.status,
      carrier: result.carrier || shipment.carrierName,
      carrierSlug: result.carrierSlug || carrierHint || shipment.carrierHint,
      transportMode: result.transportMode,
      originCountryCode: result.originCountryCode,
      destinationCountryCode: result.destinationCountryCode,
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
    void refreshDeliveryEstimate(trackingNumber, result, chronologicalEvents);
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
          carrier: previousShipment.tracking?.error
            ? detectCarrier(trackingNumber).label
            : previousShipment.tracking?.carrier || detectCarrier(trackingNumber).label,
          events: previousShipment.tracking?.events ?? [],
          error: error.message || 'Trajet automatique indisponible.',
          detail: error.detail || '',
          needsDestinationCountry: error.needsDestinationCountry === true,
          needsRecipientDetails: error.needsRecipientDetails === true,
          acceptedFields: error.acceptedFields ?? [],
          inputRequirements: error.inputRequirements ?? null
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
  const carrierHint = trackingCarrierSelect.value;
  const recipientDetails = {
    postal_code: trackingRecipientPostalCode.value.trim(),
    email: trackingRecipientEmail.value.trim(),
    phone: trackingRecipientPhone.value.trim()
  };
  for (const [key, value] of Object.entries(recipientDetails)) {
    if (!value) delete recipientDetails[key];
  }
  if (!selectedTracking) return;
  if (!country && !carrierHint) {
    trackingCarrierMessage.textContent = 'Choisissez le transporteur ou indiquez le pays de destination pour lancer la recherche.';
    trackingCarrierSearch.focus();
    return;
  }
  const button = trackingCountryForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    if (country) {
      shipments = shipments.map(item => item.number === selectedTracking
        ? { ...item, destinationCountry: country }
        : item);
      if (!saveShipments()) return;
    }
    await updateSelectedParcelRoute({
      fetchDetails: true,
      forceRefresh: true,
      destinationCountry: country,
      carrierHint,
      recipientDetails
    });
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

window.setInterval(() => {
  if (!document.hidden) {
    renderDeliveryEstimate(shipments.find(item => item.number === selectedTracking));
  }
}, 60_000);

renderShipments();
updateParcelTrackingLink();
const selectedShipment = shipments.find(item => item.number === selectedTracking);
const retryAmbiguousFedExDetection = Boolean(
  selectedShipment &&
  /^\d+$/.test(selectedShipment.number) &&
  selectedShipment.tracking?.error &&
  /^fedex$/i.test(selectedShipment.tracking.carrier ?? '')
);
updateSelectedParcelRoute({
  fetchDetails: retryAmbiguousFedExDetection,
  forceRefresh: retryAmbiguousFedExDetection
});
