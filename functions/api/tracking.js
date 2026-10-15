import { track17 } from '../_lib/track17.js';

const allowedCarrierHints = new Set([
  'ups',
  'dhl',
  'laposte',
  'royal-mail',
  'postnl',
  'usps',
  'fedex'
]);

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

function getShipment(data) {
  return data.results?.find(result => result.state === 'completed' && result.shipment)?.shipment ?? null;
}

function hasProcessingShipment(data) {
  return data.results?.some(result => result.state === 'processing') ?? false;
}

function routePlace(shipment, field, flightField) {
  const direct = shipment[field];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const flights = Array.isArray(shipment.flight_legs) ? shipment.flight_legs : [];
  const flightPlace = field === 'origin' ? flights[0]?.[flightField] : flights.at(-1)?.[flightField];
  return typeof flightPlace === 'string' && flightPlace.trim() ? flightPlace.trim() : null;
}

function parcelsErrorCode(data) {
  const code = data?.error?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? code : null;
}

function parcelsErrorMessage(code) {
  const messages = {
    NO_SHIPMENTS: 'Parcels n’a pas trouvé de suivi pour ce numéro. Pour certains transporteurs, le pays de destination est nécessaire.',
    DESTINATION_COUNTRY_REQUIRED: 'Parcels a besoin du pays de destination pour détecter le transporteur.',
    MISSING_API_KEY: 'Parcels ne reçoit pas la clé API. Vérifiez le secret PARCELS_API_KEY et son format Bearer.',
    INVALID_API_KEY: 'Parcels ne reconnaît pas cette clé API. Vérifiez qu’elle est bien activée pour l’API v4.',
    SUBSCRIPTION_NOT_FOUND: 'La clé est reconnue, mais aucun abonnement Parcels ne lui est associé.',
    UNCONFIRMED_ACCOUNT: 'L’adresse e-mail du compte Parcels doit être confirmée.',
    SUBSCRIPTION_INACTIVE: 'L’abonnement Parcels associé à la clé est inactif.',
    INVALID_SUBSCRIPTION_STATE: 'L’état de l’abonnement Parcels ne permet pas le suivi.',
    FORBIDDEN: 'Le suivi API est désactivé pour ce compte Parcels.',
    SUBSCRIPTION_LIMIT_REACHED: 'Le quota de suivi Parcels de cet abonnement est atteint.',
    RATE_LIMITED: 'Parcels limite temporairement le nombre de requêtes. Réessayez plus tard.',
    BUSY: 'Le service de suivi Parcels est temporairement occupé. Réessayez plus tard.',
    SERVER_ERROR: 'Parcels a rencontré une erreur interne.'
  };
  return messages[code] ?? 'Parcels n’a pas pu traiter la requête.';
}

export async function onRequestPost({ request, env }) {
  const requestUrl = new URL(request.url);
  if (request.headers.get('Origin') !== requestUrl.origin) {
    return json({ error: 'Cette requête doit provenir de l’application.' }, 403);
  }
  let payload = null;
  try {
    payload = await request.clone().json();
  } catch {
    // The Parcels handler reports invalid bodies.
  }

  if (payload?.provider === '17TRACK' && typeof payload.requestId === 'string') {
    const result = await track17(env, payload.requestId, { register: false });
    if (!result) return json({ error: '17TRACK n’a pas pu fournir le suivi.' }, 502);
    return json(result, result.pending ? 202 : 200);
  }

  const response = await parcelsHandler({ request, env });
  const trackingNumber = typeof payload?.trackingNumber === 'string' ? payload.trackingNumber.trim() : '';
  if (!trackingNumber || response.status === 202) return response;

  let needsFallback = response.status >= 400;
  if (!needsFallback) {
    const data = await response.clone().json().catch(() => null);
    needsFallback = !Array.isArray(data?.events) || data.events.length === 0;
  }
  if (!needsFallback || response.status === 403 || response.status === 413) return response;

  const fallback = await track17(env, trackingNumber);
  if (!fallback || fallback.pending) return response;
  return json(fallback);
}

async function parcelsHandler({ request, env }) {
  const requestUrl = new URL(request.url);
  if (request.headers.get('Origin') !== requestUrl.origin) {
    return json({ error: 'Cette requête doit provenir de l’application.' }, 403);
  }
  if (!env.PARCELS_API_KEY) {
    return json({ error: 'La clé API Parcels doit être configurée comme secret Cloudflare PARCELS_API_KEY.' }, 503);
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > 2048) return json({ error: 'Requête trop volumineuse.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Corps JSON invalide.' }, 400);
  }

  let endpoint;
  let body;
  let trackingNumber = '';
  let carrierHint = '';
  let destinationCountry = '';
  if (typeof payload?.requestId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(payload.requestId)) {
    endpoint = `https://parcelsapp.com/api/v4/trackings/${encodeURIComponent(payload.requestId)}`;
  } else {
    trackingNumber = typeof payload?.trackingNumber === 'string' ? payload.trackingNumber.trim() : '';
    if (!trackingNumber || trackingNumber.length > 120) {
      return json({ error: 'Numéro de suivi invalide.' }, 400);
    }
    carrierHint = typeof payload.carrierHint === 'string' ? payload.carrierHint : '';
    if (carrierHint && !allowedCarrierHints.has(carrierHint)) {
      return json({ error: 'Transporteur non pris en charge.' }, 400);
    }
    destinationCountry = typeof payload.destinationCountry === 'string'
      ? payload.destinationCountry.trim()
      : '';
    if (destinationCountry.length > 100) {
      return json({ error: 'Pays de destination invalide.' }, 400);
    }
    endpoint = 'https://parcelsapp.com/api/v4/trackings';
    body = JSON.stringify({
      language: 'en',
      shipments: [{
        tracking_number: trackingNumber,
        ...(carrierHint ? { carrier_hint: carrierHint } : {}),
        ...(destinationCountry ? { destination_country: destinationCountry } : {})
      }]
    });
  }

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${env.PARCELS_API_KEY}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body } : {})
    });
  } catch (error) {
    console.error('Parcels API network request failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError'
    });
    return json({ error: 'L’API Parcels est momentanément injoignable.' }, 502);
  }

  if (!upstream.ok && body && carrierHint && upstream.status === 400 && !destinationCountry) {
    let errorData = null;
    if (upstream.headers.get('content-type')?.includes('application/json')) {
      try {
        errorData = await upstream.clone().json();
      } catch {
        // Fall through to the original Parcels error.
      }
    }
    if (parcelsErrorCode(errorData) === 'NO_SHIPMENTS') {
      body = JSON.stringify({
        language: 'en',
        shipments: [{ tracking_number: trackingNumber }]
      });
      try {
        upstream = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.PARCELS_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body
        });
      } catch (error) {
        console.error('Parcels API fallback request failed', {
          errorName: error instanceof Error ? error.name : 'UnknownError'
        });
        return json({ error: 'L’API Parcels est momentanément injoignable.' }, 502);
      }
    }
  }

  if (!upstream.ok) {
    let errorData = null;
    if (upstream.headers.get('content-type')?.includes('application/json')) {
      try {
        errorData = await upstream.json();
      } catch {
        // The status and content type still provide a useful diagnostic.
      }
    }
    const code = parcelsErrorCode(errorData) ?? `HTTP_${upstream.status}`;
    console.error('Parcels API returned an error', { status: upstream.status, code });
    const status = upstream.status === 400
      ? 422
      : upstream.status === 402 || upstream.status === 429
        ? 429
        : 502;
    return json({
      error: parcelsErrorMessage(code),
      detail: `Parcels API v4 · HTTP ${upstream.status} · ${code}`,
      needsDestinationCountry: ['NO_SHIPMENTS', 'DESTINATION_COUNTRY_REQUIRED'].includes(code)
    }, status);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: 'Réponse invalide de l’API Parcels.' }, 502);
  }
  if (!data || typeof data.done !== 'boolean') {
    return json({ error: 'Réponse incomplète de l’API Parcels.' }, 502);
  }
  if (!data.done || hasProcessingShipment(data)) {
    return typeof data.request_id === 'string'
      ? json({ pending: true, requestId: data.request_id }, 202)
      : json({ error: 'Identifiant de requête manquant dans la réponse Parcels.' }, 502);
  }

  const shipment = getShipment(data);
  if (!shipment) {
    const rejected = Array.isArray(data.rejected) ? data.rejected[0] : null;
    const code = typeof rejected?.code === 'string' ? rejected.code : 'NO_SHIPMENTS';
    return json({
      error: parcelsErrorMessage(code),
      detail: `Parcels API v4 · ${code}`,
      needsDestinationCountry: ['NO_SHIPMENTS', 'DESTINATION_COUNTRY_REQUIRED'].includes(code)
    }, 422);
  }
  if (typeof shipment.error === 'string' && shipment.error) {
    return json({
      error: parcelsErrorMessage(shipment.error),
      detail: `Parcels API v4 · ${shipment.error}`,
      needsDestinationCountry: ['NO_SHIPMENTS', 'DESTINATION_COUNTRY_REQUIRED'].includes(shipment.error)
    }, 422);
  }
  const states = [
    shipment.states,
    shipment.events,
    shipment.tracking_events
  ].find(events => Array.isArray(events) && events.length > 0) ?? [];
  return json({
    origin: routePlace(shipment, 'origin', 'origin'),
    destination: routePlace(shipment, 'destination', 'destination'),
    status: typeof shipment.status === 'string' ? shipment.status : null,
    carrier: typeof shipment.detectedCarrier?.name === 'string'
      ? shipment.detectedCarrier.name
      : Array.isArray(shipment.services) && typeof shipment.services[0]?.name === 'string'
        ? shipment.services[0].name
        : null,
    events: states.slice(0, 80).flatMap(state => {
      const description = [state?.state, state?.status, state?.description, state?.title]
        .find(value => typeof value === 'string' && value.trim());
      if (!description) return [];
      return [{
        state: description.slice(0, 300),
        location: typeof state.location === 'string' ? state.location.slice(0, 200) : null,
        date: typeof state.date === 'string' ? state.date : null,
        eventCode: typeof state.event_code === 'string' ? state.event_code.slice(0, 40) : null,
        station: typeof state.station === 'string' ? state.station.slice(0, 40) : null,
        flightNumber: typeof state.flight_number === 'string' ? state.flight_number.slice(0, 40) : null,
        flightOrigin: typeof state.flight_origin === 'string' ? state.flight_origin.slice(0, 8) : null,
        flightDestination: typeof state.flight_destination === 'string' ? state.flight_destination.slice(0, 8) : null
      }];
    }),
    flightLegs: (Array.isArray(shipment.flight_legs) ? shipment.flight_legs : []).slice(0, 20).flatMap(leg => {
      if (!leg || typeof leg !== 'object') return [];
      return [{
        flightNumber: typeof leg.flight_number === 'string' ? leg.flight_number.slice(0, 40) : null,
        origin: typeof leg.origin === 'string' ? leg.origin.slice(0, 8) : null,
        destination: typeof leg.destination === 'string' ? leg.destination.slice(0, 8) : null,
        status: typeof leg.status === 'string' ? leg.status.slice(0, 100) : null
      }];
    })
  });
}
