// Vercel serverless function — proxy RSS sans CORS
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Paramètre url manquant' });

  // N'autorise que Google News RSS
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'URL invalide' }); }
  if (parsed.hostname !== 'news.google.com') {
    return res.status(403).json({ error: 'Domaine non autorisé' });
  }

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Vigicrues22/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const text = await upstream.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ error: 'Upstream injoignable', detail: e.message });
  }
}
