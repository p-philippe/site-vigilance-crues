// Vercel serverless — proxy coefficients de marée SHOM (API interne maree.shom.fr, nécessite un Referer valide)
// Les coefficients sont quasi identiques sur toute la façade Côtes-d'Armor (référence commune),
// donc un seul port (Perros-Guirec) suffit pour représenter les 6 ports affichés dans l'app.
const SHOM_URL = 'https://services.data.shom.fr/b2q8lrcdl4s04cbabsj4nhcb/hdm/spm/coeff';
const HARBOR = 'PERROS-GUIREC_TRESTRAOU';

export default async function handler(req, res) {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 10));
  const today = new Date().toISOString().slice(0, 10);

  try {
    const url = `${SHOM_URL}?harborName=${HARBOR}&duration=${days}&date=${today}&utc=1&correlation=1`;
    const r = await fetch(url, {
      headers: { 'Referer': 'https://maree.shom.fr/', 'User-Agent': 'Mozilla/5.0 (compatible; Vigicrues22/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const months = await r.json();

    // Format SHOM : 12 buckets (un par mois calendaire), chaque bucket contenant les jours
    // du mois en séquence à partir de la date de début — on aplatit en assignant les dates
    // séquentiellement, sans avoir besoin de connaître les bornes de mois.
    const start = new Date(today + 'T00:00:00Z');
    const out = [];
    let dayOffset = 0;
    for (const bucket of months) {
      for (const entry of bucket) {
        const d = new Date(start.getTime() + dayOffset * 86400000);
        const vals = entry.map(Number).filter(n => !isNaN(n));
        out.push({
          date: d.toISOString().slice(0, 10),
          am: vals[0] ?? null,
          pm: vals[1] ?? null,
          max: vals.length ? Math.max(...vals) : null,
        });
        dayOffset++;
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    res.status(200).json({ source: 'SHOM', harbor: HARBOR, days: out });
  } catch (e) {
    res.status(502).json({ error: 'SHOM injoignable', detail: e.message });
  }
}
