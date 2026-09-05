// Vercel serverless — proxy coefficients de marée SHOM (API interne maree.shom.fr, nécessite un Referer valide)
// Les coefficients sont quasi identiques sur toute la façade Côtes-d'Armor (référence commune),
// donc un seul port (Perros-Guirec) suffit pour représenter les 6 ports affichés dans l'app.
// La clé de service SHOM vit dans les variables d'environnement Vercel (SHOM_KEY),
// pas dans ce fichier : le dépôt est public, et une clé changée par le SHOM se
// remplace ainsi sans commit ni redéploiement.
const HARBOR = 'PERROS-GUIREC_TRESTRAOU';

export default async function handler(req, res) {
  const key = process.env.SHOM_KEY;
  if (!key) {
    return res.status(502).json({ error: 'SHOM non configuré', detail: 'Variable SHOM_KEY absente' });
  }
  const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 10));
  const today = new Date().toISOString().slice(0, 10);

  try {
    const url = `https://services.data.shom.fr/${key}/hdm/spm/coeff?harborName=${HARBOR}&duration=${days}&date=${today}&utc=1&correlation=1`;
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
    // La clé ne doit jamais ressortir dans un message d'erreur servi publiquement.
    res.status(502).json({ error: 'SHOM injoignable', detail: String(e.message || e).split(key).join('***') });
  }
}
