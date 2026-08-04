// Vercel serverless — proxy GeoJSON Vigicrues (pas de CORS natif)
export default async function handler(req, res) {
  const URL_GJ = 'https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson/';
  try {
    const r = await fetch(URL_GJ, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Vigicrues22/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json(data);
  } catch(e) {
    res.status(502).json({ error: 'Vigicrues injoignable', detail: e.message });
  }
}
