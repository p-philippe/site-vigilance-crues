// Vercel serverless — proxy observations.json Vigicrues (pas de CORS natif)
export default async function handler(req, res) {
  const { code } = req.query;
  if (!code || !/^[A-Za-z0-9]{1,12}$/.test(code)) {
    return res.status(400).json({ error: 'Paramètre code invalide' });
  }
  const URL_OBS = `https://www.vigicrues.gouv.fr/services/observations.json/index.php?CdStationHydro=${encodeURIComponent(code)}&GrdSerie=H&FormatDate=iso`;
  try {
    const r = await fetch(URL_OBS, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Vigicrues22/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.status(200).json(data);
  } catch(e) {
    res.status(502).json({ error: 'Vigicrues injoignable', detail: e.message });
  }
}
