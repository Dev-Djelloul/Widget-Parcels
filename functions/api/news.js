const NEWS_FEED_URL = 'https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr';

export async function onRequestGet() {
  try {
    const upstream = await fetch(NEWS_FEED_URL, {
      headers: { Accept: 'application/rss+xml, application/xml;q=0.9' }
    });
    if (!upstream.ok) {
      console.error(`Google Actualités a répondu avec le statut ${upstream.status}.`);
      return new Response('Le flux d’actualités est temporairement indisponible.', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' }
      });
    }
    return new Response(upstream.body, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Impossible de récupérer le flux Google Actualités.', error);
    return new Response('Le flux d’actualités est temporairement indisponible.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
