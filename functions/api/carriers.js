function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.PARCELS_API_KEY) {
    return json({ error: 'La clé API Parcels doit être configurée comme secret Cloudflare PARCELS_API_KEY.' }, 503);
  }

  const query = (new URL(request.url).searchParams.get('query') ?? '').trim().slice(0, 80);
  if (query.length < 2) return json({ carriers: [] });

  const upstreamUrl = new URL('https://parcelsapp.com/api/v4/tracking-carriers');
  upstreamUrl.searchParams.set('query', query);
  upstreamUrl.searchParams.set('limit', '30');

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${env.PARCELS_API_KEY}`, Accept: 'application/json' }
    });
  } catch {
    return json({ error: 'Le catalogue des transporteurs est momentanément injoignable.' }, 502);
  }
  if (!upstream.ok) {
    return json({ error: `Le catalogue des transporteurs est indisponible (HTTP ${upstream.status}).` }, 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: 'Réponse invalide du catalogue des transporteurs.' }, 502);
  }

  const carriers = (Array.isArray(data.carriers) ? data.carriers : []).flatMap(carrier => {
    if (typeof carrier?.slug !== 'string' || typeof carrier?.name !== 'string') return [];
    return [{
      slug: carrier.slug,
      name: carrier.name,
      inputRequirements: carrier.input_requirements ?? {}
    }];
  });
  return json({ carriers });
}
