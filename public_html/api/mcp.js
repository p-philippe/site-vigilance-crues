// Vercel serverless — MCP Streamable HTTP pour Grok Bot
// Endpoint: POST https://vigilance-des-crues.vercel.app/api/mcp
// Auth optionnelle: Authorization: Bearer $MCP_TOKEN (si la variable est définie)

const PROTOCOL = '2025-03-26';
const SITE = 'https://vigilance-des-crues.vercel.app';
const UA = 'Mozilla/5.0 (compatible; Vigicrues22-MCP/1.0)';
const VL = { '-1': 'N/A', 0: 'Vert — normal', 1: 'Jaune — vigilance', 2: 'Orange — important', 3: 'Rouge — majeur' };

const ST = {
  J061161001: { n: "St-Jouan-de-l'Isle [Pont Rimbert]", c: 'Rance', s: { s1: 1.2, s2: 1.8, s3: 2.4 }, t: 'BT15' },
  J100452001: { n: 'Pleslin-Trigavou [Vieux Moulin]', c: 'Frémur', s: { s1: 0.7, s2: 1.1, s3: 1.5 }, t: 'BT15' },
  J110301001: { n: 'Jugon-les-Lacs [Bois Léard]', c: 'Arguenon', s: { s1: 1.0, s2: 1.5, s3: 2.0 }, t: 'BT15' },
  J110581001: { n: 'Plénée-Jugon [La Salle ès Pies]', c: 'Quiloury', s: { s1: 1.0, s2: 1.5, s3: 1.9 }, t: 'BT15' },
  J111401001: { n: 'Mégrit [Pont D 19]', c: 'Rosette', s: { s1: 0.8, s2: 1.2, s3: 1.55 }, t: 'BT15' },
  J131301001: { n: 'Andel [Le Quingueret]', c: 'Gouessant', s: { s1: 1.2, s2: 1.8, s3: 2.4 }, t: 'BT15' },
  J132401001: { n: 'Coëtmieux [La Rue]', c: 'Evron', s: { s1: 1.0, s2: 1.5, s3: 2.1 }, t: 'BT15' },
  J140531001: { n: 'Plédran [Magenta]', c: 'Urne', s: { s1: 0.7, s2: 1.0, s3: 1.4 }, t: 'BT14' },
  J151301001: { n: 'St-Julien [La Saudraie]', c: 'Gouët', s: { s1: 0.9, s2: 1.3, s3: 1.8 }, t: 'BT14' },
  J161401002: { n: 'Binic [Saint Gilles]', c: 'Ic', s: { s1: 0.9, s2: 1.3, s3: 1.8 }, t: 'BT14' },
  J171171001: { n: 'St-Péver [Pont Locminé]', c: 'Trieux', s: { s1: 0.9, s2: 1.3, s3: 1.8 }, t: 'BT14' },
  J172172001: { n: 'St-Clet [Chateaulin]', c: 'Trieux', s: { s1: 1.1, s2: 1.6, s3: 2.2 }, t: 'BT14' },
  J180301001: { n: 'Boqueho [Moulin Neuf]', c: 'Leff', s: { s1: 0.8, s2: 1.2, s3: 1.7 }, t: 'BT14' },
  J181301001: { n: 'Quemper-Guézennec [Rivoallan]', c: 'Leff', s: { s1: 1.0, s2: 1.5, s3: 2.1 }, t: 'BT14' },
  J202301001: { n: 'Mantallot [Kerbrido]', c: 'Jaudy', s: { s1: 1.2, s2: 1.8, s3: 2.5 }, t: 'BT13' },
  J203401001: { n: 'Plouguiel [Kerallio]', c: 'Guindy', s: { s1: 0.6, s2: 0.9, s3: 1.15 }, t: 'BT13' },
  J223301001: { n: 'Belle-Isle-en-Terre', c: 'Léguer', s: { s1: 1.0, s2: 1.5, s3: 2.1 }, t: 'BT13' },
  J223302001: { n: 'Pluzunet [Pont Coat Dunois]', c: 'Léguer', s: { s1: 1.1, s2: 1.7, s3: 2.3 }, t: 'BT13' },
  J371301001: { n: 'Trébrivan [Le Nezert]', c: 'Hyère', s: { s1: 1.2, s2: 1.8, s3: 2.4 }, t: 'BT2' },
  J520211001: { n: 'Kerien [Kerlouët]', c: 'Blavet', s: { s1: 0.4, s2: 0.6, s3: 0.75 }, t: 'BT5' },
  J520521001: { n: 'Kerien [Moulin de Camel]', c: 'Moulin Estolet', s: { s1: 0.6, s2: 0.9, s3: 1.1 }, t: 'BT5' },
  J521212001: { n: 'Lanrivain [Pont D 87]', c: 'Blavet aval Kerné-Uhel', s: { s1: 0.8, s2: 1.2, s3: 1.6 }, t: 'BT5' },
  J522401002: { n: 'Ste-Tréphine [Trozulon]', c: 'Sulon', s: { s1: 0.7, s2: 1.0, s3: 1.35 }, t: 'BT5' },
  J540212001: { n: 'Plélauff [Bon-Repos]', c: 'Blavet', s: { s1: 1.65, s2: 1.9, s3: 2.1 }, t: 'BT5' },
  J800231002: { n: 'St-Martin-des-Prés', c: 'Oust', s: { s1: 0.7, s2: 1.0, s3: 1.4 }, t: 'BT7' },
  J802231003: { n: 'Hémonstoir [Pont D 69]', c: 'Oust', s: { s1: 1.2, s2: 1.8, s3: 2.3 }, t: 'BT7' },
  J813301001: { n: 'Plémet [St-Sauveur-le-Haut]', c: 'Lié', s: { s1: 1.2, s2: 1.8, s3: 2.3 }, t: 'BT7' },
};

const TOOLS = [
  {
    name: 'list_stations',
    description: 'Liste les 27 stations hydrométriques Côtes-d\'Armor suivies par Vigilance 22 (code, nom, cours d\'eau, seuils s1/s2/s3, tronçon Vigicrues).',
    inputSchema: { type: 'object', properties: { cours_eau: { type: 'string', description: 'Filtre optionnel sur le nom du cours d\'eau (ex: Gouët, Blavet)' } } },
  },
  {
    name: 'get_station',
    description: 'Fiche d\'une station : nom, cours d\'eau, seuils, tronçon Vigicrues.',
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Code station Hub\'Eau (ex: J151301001)' } }, required: ['code'] },
  },
  {
    name: 'get_vigilance',
    description: 'Niveaux officiels Vigicrues des tronçons suivis (BT13, BT14, BT15, BT2, BT5, BT7) et stations rattachées.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_observations',
    description: 'Dernière hauteur d\'eau (m) d\'une station via Hub\'Eau observations temps réel.',
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Code station Hub\'Eau' } }, required: ['code'] },
  },
  {
    name: 'get_summary',
    description: 'Synthèse courte : max vigilance officielle + hauteurs récentes des stations principales.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function ok(id, result) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function fail(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}
function text(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function authorized(req) {
  const token = process.env.MCP_TOKEN;
  if (!token) return true;
  const h = req.headers.authorization || '';
  return h === `Bearer ${token}`;
}

function officialLevel(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 4) return n - 1;
  if (n >= 0 && n <= 3) return n;
  return null;
}

async function fetchJson(url, ms = 8000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function loadVigilance() {
  const geo = await fetchJson('https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson/');
  const wanted = new Set(['BT13', 'BT14', 'BT15', 'BT2', 'BT5', 'BT7']);
  const byTroncon = {};
  for (const f of geo.features || []) {
    const p = f.properties || {};
    const troncon = p.CdEntCru || p.acroentcru;
    const level = officialLevel(p.NivInfViCr);
    if (troncon && wanted.has(troncon) && level != null) {
      byTroncon[troncon] = {
        troncon,
        label: p.lbentcru || troncon,
        level,
        libelle: VL[level] || String(level),
        updated: p.dhmentcru || p.dhcentcru || '',
      };
    }
  }
  const stations = Object.entries(ST).map(([code, st]) => ({
    code,
    nom: st.n,
    cours_eau: st.c,
    troncon: st.t,
    vigilance: byTroncon[st.t] || null,
  }));
  return { source: 'Vigicrues', site: SITE, troncons: byTroncon, stations };
}

async function loadObs(code) {
  const url = `https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?code_entite=${encodeURIComponent(code)}&grandeur_hydro=H&size=3&sort=desc`;
  const data = await fetchJson(url);
  const rows = (data.data || []).map((d) => ({
    date: d.date_obs,
    hauteur_m: d.resultat_obs != null ? Number(d.resultat_obs) / 1000 : null,
    qualification: d.qualification_obs,
  }));
  const st = ST[code];
  const last = rows[0]?.hauteur_m;
  let seuil = null;
  if (last != null && st) {
    if (last >= st.s.s3) seuil = 's3';
    else if (last >= st.s.s2) seuil = 's2';
    else if (last >= st.s.s1) seuil = 's1';
    else seuil = 'sous_s1';
  }
  return { code, nom: st?.n, cours_eau: st?.c, seuils_m: st?.s, derniere: rows[0] || null, recentes: rows, seuil_atteint: seuil, source: 'HubEau' };
}

async function callTool(name, args = {}) {
  if (name === 'list_stations') {
    const q = (args.cours_eau || '').toLowerCase();
    const list = Object.entries(ST)
      .filter(([, st]) => !q || st.c.toLowerCase().includes(q) || st.n.toLowerCase().includes(q))
      .map(([code, st]) => ({ code, nom: st.n, cours_eau: st.c, seuils_m: st.s, troncon: st.t }));
    return text({ count: list.length, stations: list });
  }
  if (name === 'get_station') {
    const code = String(args.code || '').toUpperCase();
    const st = ST[code];
    if (!st) return text({ error: 'Station inconnue', code });
    return text({ code, nom: st.n, cours_eau: st.c, seuils_m: st.s, troncon: st.t, url: `${SITE}/#${code}` });
  }
  if (name === 'get_vigilance') return text(await loadVigilance());
  if (name === 'get_observations') {
    const code = String(args.code || '').toUpperCase();
    if (!ST[code]) return text({ error: 'Station inconnue', code });
    return text(await loadObs(code));
  }
  if (name === 'get_summary') {
    const vigi = await loadVigilance();
    const levels = Object.values(vigi.troncons).map((t) => t.level);
    const max = levels.length ? Math.max(...levels) : -1;
    const principals = ['J151301001', 'J131301001', 'J540212001', 'J202301001', 'J802231003'];
    const obs = [];
    for (const code of principals) {
      try { obs.push(await loadObs(code)); } catch (e) { obs.push({ code, error: e.message }); }
    }
    return text({
      site: SITE,
      vigilance_max: { level: max, libelle: VL[max] || 'N/A' },
      troncons: vigi.troncons,
      stations_principales: obs,
    });
  }
  throw new Error(`Outil inconnu: ${name}`);
}

async function handleRpc(body) {
  if (Array.isArray(body)) {
    const out = [];
    for (const msg of body) out.push(await handleOne(msg));
    return out.filter(Boolean);
  }
  return handleOne(body);
}

async function handleOne(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || !msg.method) {
    return fail(msg?.id, -32600, 'Requête JSON-RPC invalide');
  }
  const { id, method, params } = msg;
  if (id === undefined) return null;

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'vigilance22-mcp', version: '1.0.0', title: 'Vigilance crues 22' },
      instructions: 'Données hydrométriques Côtes-d\'Armor. Utiliser get_summary en premier, puis get_observations(code) pour une station.',
    });
  }
  if (method === 'ping' || method === 'notifications/initialized') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    try {
      const result = await callTool(params?.name, params?.arguments || {});
      return ok(id, result);
    } catch (e) {
      return ok(id, { content: [{ type: 'text', text: e.message }], isError: true });
    }
  }
  if (method === 'resources/list') return ok(id, { resources: [] });
  if (method === 'prompts/list') return ok(id, { prompts: [] });
  return fail(id, -32601, `Méthode inconnue: ${method}`);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'vigilance22-mcp',
      protocol: PROTOCOL,
      transport: 'streamable-http',
      endpoint: `${SITE}/api/mcp`,
      tools: TOOLS.map((t) => t.name),
      auth: process.env.MCP_TOKEN ? 'bearer' : 'none',
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const out = await handleRpc(req.body);
    if (out == null) return res.status(202).end();
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json(fail(null, -32603, e.message));
  }
}
