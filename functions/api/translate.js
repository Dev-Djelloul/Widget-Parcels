const languageNames = {
  fr: 'french', en: 'english', es: 'spanish', de: 'german', it: 'italian', pt: 'portuguese', nl: 'dutch'
};
const maxTexts = 10;
const maxTextLength = 500;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
  });
}

export async function onRequestPost({ request, env }) {
  const requestUrl = new URL(request.url);
  if (request.headers.get('Origin') !== requestUrl.origin) {
    return json({ error: 'Cette requête doit provenir de l’application.' }, 403);
  }
  if (!env.AI) {
    return json({ error: 'La liaison Workers AI « AI » doit être ajoutée au projet Cloudflare Pages.' }, 503);
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > 8192) return json({ error: 'Requête trop volumineuse.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Corps JSON invalide.' }, 400);
  }

  const { targetLanguage, texts } = payload ?? {};
  if (
    !Object.hasOwn(languageNames, targetLanguage) ||
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > maxTexts ||
    texts.some(text => typeof text !== 'string' || !text.trim() || text.length > maxTextLength)
  ) {
    return json({ error: 'Texte ou langue de traduction invalide.' }, 400);
  }

  try {
    const translations = await Promise.all(texts.map(async text => {
      const result = await env.AI.run('@cf/meta/m2m100-1.2b', {
        text,
        source_lang: 'english',
        target_lang: languageNames[targetLanguage]
      });
      const translated = result?.translated_text;
      if (typeof translated !== 'string' || !translated.trim()) throw new Error('Traduction vide.');
      return translated.trim();
    }));
    return json({ translations });
  } catch (error) {
    console.error('Workers AI translation failed', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    return json({ error: 'La traduction a échoué.' }, 502);
  }
}
