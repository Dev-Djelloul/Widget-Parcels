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
  } catch {
    return json({ error: 'L’API Parcels est momentanément injoignable.' }, 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) {
      return json({ error: 'La clé API Parcels est refusée. Vérifiez le secret Cloudflare.' }, 502);
    }
    if (upstream.status === 402 || upstream.status === 429) {
      return json({ error: 'Le quota gratuit Parcels est atteint ou temporairement indisponible.' }, 429);
    }
    if (upstream.status === 400) {
      return json({ error: 'Ce numéro ne peut pas être suivi automatiquement. Vous pouvez renseigner les lieux manuellement.' }, 422);
    }
    return json({ error: 'L’API Parcels n’a pas pu fournir le trajet.' }, 502);
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
  return json({
    origin: routePlace(shipment, 'origin', 'origin'),
    destination: routePlace(shipment, 'destination', 'destination')
  });
}
