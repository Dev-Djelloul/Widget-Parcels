const API = 'https://api.17track.net/track/v2.4';

const statusLabels = {
  NotFound: 'Not found',
  InfoReceived: 'Info received',
  InTransit: 'In transit',
  Expired: 'Expired',
  AvailableForPickup: 'Available for pickup',
  OutForDelivery: 'Out for delivery',
  DeliveryFailure: 'Delivery failure',
  Delivered: 'Delivered',
  Exception: 'Exception'
};

const text = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

async function call(env, path, number) {
  const response = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { '17token': env['17TRACK_API_KEY'], 'Content-Type': 'application/json' },
    body: JSON.stringify([{ number }])
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data?.code !== 0) throw new Error(`CODE ${data?.code}`);
  return data.data ?? {};
}

function placeOf(address) {
  if (!address || typeof address !== 'object') return null;
  const parts = [address.city, address.state, address.country].filter(part => typeof part === 'string' && part.trim());
  return parts.length ? parts.join(', ').slice(0, 200) : null;
}

function normalize(item) {
  const info = item.track_info;
  const providers = Array.isArray(info?.tracking?.providers) ? info.tracking.providers : [];
  const events = providers
    .flatMap(entry => Array.isArray(entry?.events) ? entry.events : [])
    .filter(event => text(event?.description, 300))
    .sort((a, b) => String(b.time_iso ?? '').localeCompare(String(a.time_iso ?? '')))
    .slice(0, 80)
    .map(event => ({
      state: text(event.description, 300),
      location: text(event.location, 200) ?? placeOf(event.address),
      date: text(event.time_iso, 40),
      eventCode: text(event.stage, 40),
      station: null,
      flightNumber: null,
      flightOrigin: null,
      flightDestination: null
    }));
  if (!events.length) return null;
  const shipping = info?.shipping_info ?? {};
  const status = info?.latest_status?.status;
  return {
    origin: placeOf(shipping.shipper_address),
    destination: placeOf(shipping.recipient_address),
    status: statusLabels[status] ?? text(status, 60),
    carrier: text(providers[0]?.provider?.name, 100),
    events,
    flightLegs: [],
    provider: '17TRACK'
  };
}

// Returns a tracking result, { pending: true, requestId, provider }, or null when 17TRACK has nothing.
export async function track17(env, trackingNumber, { register = true } = {}) {
  if (!env['17TRACK_API_KEY'] || !/^[A-Za-z0-9_-]{1,64}$/.test(trackingNumber)) return null;
  try {
    if (register) await call(env, 'register', trackingNumber).catch(() => null);
    const data = await call(env, 'gettrackinfo', trackingNumber);
    const item = data.accepted?.[0];
    if (!item) return null;
    return normalize(item) ?? { pending: true, requestId: trackingNumber, provider: '17TRACK' };
  } catch (error) {
    console.error('17TRACK request failed', { message: error instanceof Error ? error.message : 'unknown' });
    return null;
  }
}
