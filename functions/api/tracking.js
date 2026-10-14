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
  return data.results?.find(result => result.state !== 'rejected')?.shipment ?? null;
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
  if (typeof payload?.requestId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(payload.requestId)) {
    endpoint = `https://parcelsapp.com/api/v4/trackings/${encodeURIComponent(payload.requestId)}`;
  } else {
    const trackingNumber = typeof payload?.trackingNumber === 'string' ? payload.trackingNumber.trim() : '';
    if (!trackingNumber || trackingNumber.length > 120) {
      return json({ error: 'Numéro de suivi invalide.' }, 400);
    }
    const carrierHint = typeof payload.carrierHint === 'string' ? payload.carrierHint : '';
    if (carrierHint && !allowedCarrierHints.has(carrierHint)) {
      return json({ error: 'Transporteur non pris en charge.' }, 400);
    }
    endpoint = 'https://parcelsapp.com/api/v4/trackings';
    body = JSON.stringify({
      language: 'en',
      shipments: [{
        tracking_number: trackingNumber,
        ...(carrierHint ? { carrier_hint: carrierHint } : {})
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
      detail: `Parcels API v4 · HTTP ${upstream.status} · ${code}`
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
  if (!data.done) {
    return typeof data.request_id === 'string'
      ? json({ pending: true, requestId: data.request_id }, 202)
      : json({ error: 'Identifiant de requête manquant dans la réponse Parcels.' }, 502);
  }

  const shipment = getShipment(data);
  if (!shipment) return json({ origin: null, destination: null });
  const states = Array.isArray(shipment.states) ? shipment.states : [];
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
      if (!state || typeof state.state !== 'string') return [];
      return [{
        state: state.state.slice(0, 300),
        location: typeof state.location === 'string' ? state.location.slice(0, 200) : null,
        date: typeof state.date === 'string' ? state.date : null,
        eventCode: typeof state.event_code === 'string' ? state.event_code.slice(0, 40) : null,
        station: typeof state.station === 'string' ? state.station.slice(0, 40) : null,
        flightNumber: typeof state.flight_number === 'string' ? state.flight_number.slice(0, 40) : null
      }];
    })
  });
}
