// ── RP — Revue de presse inondations + SIG ────────────────────────────────

import { RP_BASSINS, RP_NIV } from './config.js';
import { escapeHtml, toast } from './utils.js';

const RP_LS_KEY = 'vigicrues22_rp_v1';

let RP_DB = { articles: [], meta: { created: null, updated: null } };
let RP_CANDIDATES = [];
let RP_SIG_MAP = null;
let RP_SIG_MARKERS = [];

// Mots-clés inondation — seuls articles les contenant sont retenus depuis RSS
const FLOOD_KEYWORDS = [
  'inondation','inondé','inondée','inondées','inondés',
  'crue','crues','débordement','déborde','débordé','débordements',
  'submersion','submergé','submergée','submersions',
  'montée des eaux','hausse des eaux',
  'vigicrues','vigilance crue','vigilance inondation',
  'ruissellement torrentiel','rivière déborde','fleuve déborde',
  'zone inondable','plan d\'inondation','ppri',
];

const RP_RSS_QUERIES = [
  'inondation Côtes-d\'Armor',
  'crue Bretagne Côtes-d\'Armor',
  'submersion Côtes-d\'Armor',
  'vigicrues 22 crue',
  'débordement rivière Côtes-d\'Armor',
];

// Le proxy Vercel contrôle le domaine amont et évite de transmettre les requêtes
// vers des proxys CORS publics tiers.
const RP_CORS_PROXIES = [url => `/api/rss?url=${encodeURIComponent(url)}`];

// Couleurs par niveau pour la carte SIG
const SIG_COLORS = {
  info:      '#2980b9',
  vigilance: '#c8b800',
  alerte:    '#FF7F00',
  crise:     '#FF0000',
};

function rpUUID() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function rpIsFlood(item) {
  const hay = (item.title + ' ' + item.extract).toLowerCase();
  return FLOOD_KEYWORDS.some(kw => hay.includes(kw));
}

// Liste des 344 communes des Côtes-d'Armor (source : geo.api.gouv.fr)
const COMMUNES_22 = ["Allineuc","Andel","Aucaleuc","Beaussais-sur-Mer","Belle-Isle-en-Terre","Berhet","Binic-Étables-sur-Mer","Bobital","Bon Repos sur Blavet","Boqueho","Bourbriac","Bourseul","Bringolo","Broons","Brusvily","Bréhand","Brélidy","Bulat-Pestivien","Bégard","Calanhel","Callac","Calorguen","Camlez","Canihuel","Caouënnec-Lanvézéac","Carnoët","Caulnes","Caurel","Cavan","Châtelaudren-Plouagat","Coadout","Coatascorn","Coatréven","Cohiniac","Corlay","Corseul","Coëtmieux","Créhen","Dinan","Duault","Erquy","Fréhel","Gausson","Glomel","Gomené","Gommenec'h","Gouarec","Goudelin","Grâce-Uzel","Grâces","Guenroc","Guerlédan","Guingamp","Guitté","Gurunhuel","Hillion","Hémonstoir","Hénanbihen","Hénansal","Hénon","Illifaut","Jugon-les-Lacs","Kerbors","Kerfot","Kergrist-Moëlou","Kerien","Kermaria-Sulard","Kermoroc'h","Kerpert","La Bouillie","La Chapelle-Blanche","La Chapelle-Neuve","La Chèze","La Harmoye","La Landec","La Malhoure","La Motte","La Méaugon","La Prénessaye","La Roche-Jaudy","La Vicomté-sur-Rance","Lamballe-Armor","Lancieux","Landebaëron","Landébia","Landéhen","Lanfains","Langoat","Langrolay-sur-Rance","Languenan","Langueux","Languédias","Lanleff","Lanloup","Lanmodez","Lanmérin","Lannebert","Lannion","Lanrelas","Lanrivain","Lanrodec","Lantic","Lanvallay","Lanvellec","Lanvollon","Laurenan","Le Bodéo","Le Faouët","Le Fœil","Le Haut-Corlay","Le Hinglé","Le Leslay","Le Mené","Le Merzer","Le Moustoir","Le Quillio","Le Quiou","Le Vieux-Bourg","Le Vieux-Marché","Les Champs-Géraux","Lescouët-Gouarec","Loc-Envel","Locarn","Loguivy-Plougras","Lohuec","Loscouët-sur-Meu","Louannec","Louargat","Loudéac","Lézardrieux","Magoar","Mantallot","Matignon","Maël-Carhaix","Maël-Pestivien","Mellionnec","Merdrignac","Merléac","Minihy-Tréguier","Moncontour","Moustéru","Mégrit","Mérillac","Noyal","Pabu","Paimpol","Paule","Penguily","Penvénan","Perros-Guirec","Peumerit-Quintin","Plaine-Haute","Plaintel","Plancoët","Plerneuf","Pleslin-Trigavou","Plestan","Plestin-les-Grèves","Pleubian","Pleudaniel","Pleudihen-sur-Rance","Pleumeur-Bodou","Pleumeur-Gautier","Plorec-sur-Arguenon","Plouaret","Plouasne","Ploubazlanec","Ploubezre","Ploufragan","Plougonver","Plougras","Plougrescant","Plouguenast-Langast","Plouguernével","Plouguiel","Plouha","Plouisy","Ploulec'h","Ploumagoar","Ploumilliau","Plounérin","Plounévez-Moëdec","Plounévez-Quintin","Plourac'h","Plourhan","Plourivo","Plouvara","Plouzélambre","Plouézec","Plouëc-du-Trieux","Plouër-sur-Rance","Ploëzal","Pludual","Plufur","Plumaudan","Plumaugat","Plumieux","Plurien","Plusquellec","Plussulien","Pluzunet","Pléboulle","Plédran","Plédéliac","Pléguien","Pléhédel","Plélan-le-Petit","Plélauff","Plélo","Plémet","Plémy","Pléneuf-Val-André","Plénée-Jugon","Plérin","Plésidy","Plévenon","Plévin","Plœuc-L'Hermitage","Pommeret","Pommerit-le-Vicomte","Pont-Melvez","Pontrieux","Pordic","Prat","Pédernec","Quemper-Guézennec","Quemperven","Quessoy","Quintenic","Quintin","Quévert","Rospez","Rostrenen","Rouillac","Ruca","Runan","Saint-Adrien","Saint-Agathon","Saint-Alban","Saint-André-des-Eaux","Saint-Barnabé","Saint-Bihy","Saint-Brandan","Saint-Brieuc","Saint-Caradec","Saint-Carné","Saint-Carreuc","Saint-Cast-le-Guildo","Saint-Clet","Saint-Connan","Saint-Connec","Saint-Denoual","Saint-Donan","Saint-Fiacre","Saint-Gildas","Saint-Gilles-Pligeaux","Saint-Gilles-Vieux-Marché","Saint-Gilles-les-Bois","Saint-Glen","Saint-Hervé","Saint-Hélen","Saint-Igeaux","Saint-Jacut-de-la-Mer","Saint-Jean-Kerdaniel","Saint-Jouan-de-l'Isle","Saint-Judoce","Saint-Julien","Saint-Juvat","Saint-Laurent","Saint-Lormel","Saint-Maden","Saint-Martin-des-Prés","Saint-Maudan","Saint-Maudez","Saint-Mayeux","Saint-Michel-de-Plélan","Saint-Michel-en-Grève","Saint-Méloir-des-Bois","Saint-Nicodème","Saint-Nicolas-du-Pélem","Saint-Péver","Saint-Pôtan","Saint-Quay-Perros","Saint-Quay-Portrieux","Saint-Rieul","Saint-Samson-sur-Rance","Saint-Servais","Saint-Thélo","Saint-Trimoël","Saint-Vran","Saint-Étienne-du-Gué-de-l'Isle","Sainte-Tréphine","Senven-Léhart","Squiffiec","Sévignac","Taden","Tonquédec","Tramain","Treffrin","Tressignaux","Troguéry","Trébeurden","Trébrivan","Trébry","Trébédan","Trédaniel","Trédarzec","Trédias","Trédrez-Locquémeau","Tréduder","Tréfumel","Trégastel","Tréglamus","Trégomeur","Trégonneau","Trégrom","Trégueux","Tréguidel","Tréguier","Trélivan","Trélévern","Trémargat","Trémel","Trémeur","Trémorel","Trémuson","Tréméreuc","Tréméven","Tréogan","Tréveneuc","Trévou-Tréguignec","Trévron","Trévé","Trévérec","Trézény","Uzel","Val-d'Arguenon","Vildé-Guingalan","Yffiniac","Yvias","Yvignac-la-Tour","Éréac","Évran","Île-de-Bréhat"];

function rpNorm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[-']/g,' ');
}

// Triées par longueur décroissante pour matcher "Plestin-les-Grèves" avant "Plestan"
const COMMUNES_22_IDX = COMMUNES_22
  .map(c => ({ orig: c, norm: rpNorm(c) }))
  .sort((a, b) => b.norm.length - a.norm.length);

function rpAutoCommune(text) {
  const hay = rpNorm(text);
  for (const { orig, norm } of COMMUNES_22_IDX) {
    const re = new RegExp('(?:^|[\\s,;.!?:\'"-])' + norm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(?=$|[\\s,;.!?:\'"-])');
    if (re.test(hay)) return orig;
  }
  return '';
}

export function rpLoad() {
  try {
    const s = localStorage.getItem(RP_LS_KEY);
    if (s) RP_DB = JSON.parse(s);
  } catch(e) {}
}

export function rpSave() {
  try { localStorage.setItem(RP_LS_KEY, JSON.stringify(RP_DB)); } catch(e) {}
}

export function rpInit() {
  rpLoad();
  const wrap = document.getElementById('rpf-bassins-wrap');
  if (wrap) {
    wrap.innerHTML = RP_BASSINS.map(b =>
      `<label class="rp-bassin-lbl"><input type="checkbox" class="rp-bassin-chk" value="${escapeHtml(b)}"> ${escapeHtml(b)}</label>`
    ).join('');
  }
  const dateEl = document.getElementById('rpf-date');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0,10);
  rpRender();
  rpRenderStats();
  // Carte SIG — initialiser après le premier affichage du panel
  const tab10 = document.getElementById('tab10');
  if (tab10) tab10.addEventListener('click', () => { setTimeout(rpInitSIG, 100); }, { once: true });
}

// ── Géocodage Nominatim ──────────────────────────────────────────────────

// Niveaux Nominatim acceptés : adresse → rue → quartier → commune (jamais département/région)
const NOM_ACCEPT = new Set([
  'house','building','amenity','tourism','shop','office','place_of_worship',
  'road','pedestrian','footway','path','residential','living_street','unclassified',
  'suburb','quarter','neighbourhood','city_block','hamlet','isolated_dwelling','farm',
  'village','town','city','municipality',
]);

export async function rpGeocode(place) {
  if (!place) return null;
  try {
    const q = encodeURIComponent(place + ', Côtes-d\'Armor, France');
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&addressdetails=1&countrycodes=fr&bounded=1&viewbox=-4.1,48.0,-1.4,48.95`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    // Garder le premier résultat dont le type est commune ou plus précis
    for (const r of data) {
      if (NOM_ACCEPT.has(r.type) || NOM_ACCEPT.has(r.class) || NOM_ACCEPT.has(r.addresstype)) {
        const addr = r.address || {};
        // Vérifier qu'une commune est identifiée (pas seulement département/région)
        const hasCommune = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || addr.suburb;
        if (!hasCommune) continue;
        return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), display: r.display_name };
      }
    }
    return null;
  } catch(e) { return null; }
}

export async function rpGeocodeForm() {
  const communeEl = document.getElementById('rpf-commune');
  if (!communeEl) return;
  const commune = communeEl.value.trim();
  if (!commune) { toast('Entrez une commune'); return; }
  const btn = document.querySelector('[onclick="rpGeocodeForm()"]');
  if (btn) btn.textContent = '⏳';
  const result = await rpGeocode(commune);
  if (btn) btn.textContent = '📍 Localiser';
  if (!result) { toast('Commune introuvable — vérifiez le nom'); return; }
  document.getElementById('rpf-lat').value = result.lat.toFixed(5);
  document.getElementById('rpf-lon').value = result.lon.toFixed(5);
  toast(`✓ Localisé : ${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}`);
}

// ── Fetch RSS ─────────────────────────────────────────────────────────────

export async function rpFetchAll() {
  const box = document.getElementById('rp-fetch-box');
  if (box) { box.className='rp-fetch-box loading'; box.innerHTML='⏳ Recherche en cours sur Google News…'; }

  const existingUrls = new Set(RP_DB.articles.map(a => a.url));
  const allCandidates = [];
  const seenUrls = new Set();
  let fetchOk = false;

  for (const query of RP_RSS_QUERIES) {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`;
    for (const proxyFn of RP_CORS_PROXIES) {
      try {
        const proxyUrl = proxyFn(rssUrl);
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 9000);
        const resp = await fetch(proxyUrl, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!resp.ok) continue;
        let text;
        if (proxyUrl.includes('allorigins')) {
          const contentType = resp.headers.get('content-type')||'';
          if (contentType.includes('json')) {
            const j = await resp.json(); text = j.contents || j.data || '';
          } else { text = await resp.text(); }
        } else { text = await resp.text(); }
        const items = rpParseRSS(text);
        for (const item of items) {
          if (!existingUrls.has(item.url) && !seenUrls.has(item.url)) {
            // Filtrer : garder uniquement les articles inondation
            if (rpIsFlood(item)) {
              seenUrls.add(item.url);
              // Tenter détection auto de commune
              if (!item.commune) item.commune = rpAutoCommune(item.title + ' ' + item.extract);
              allCandidates.push(item);
            }
          }
        }
        fetchOk = true;
        break;
      } catch(e) { continue; }
    }
  }

  RP_CANDIDATES = allCandidates.slice(0, 40);

  if (box) {
    if (RP_CANDIDATES.length > 0) {
      box.className='rp-fetch-box ok';
      box.innerHTML=`✓ <strong>${RP_CANDIDATES.length} article${RP_CANDIDATES.length>1?'s':''}</strong> inondation trouvé${RP_CANDIDATES.length>1?'s':''} — vérifiez et validez la sélection ci-dessous`;
    } else if (fetchOk) {
      box.className='rp-fetch-box ok';
      box.innerHTML='✓ Aucun article inondation nouveau trouvé — votre base est à jour.';
    } else {
      box.className='rp-fetch-box err';
      box.innerHTML='⚠ Proxy CORS indisponible. Essayez plus tard ou ajoutez les articles manuellement.';
    }
  }
  rpRenderCandidates();
}

function rpParseRSS(xmlText) {
  const items = [];
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    for (const item of doc.querySelectorAll('item')) {
      const title = item.querySelector('title')?.textContent?.trim() || '';
      let link = item.querySelector('link')?.nextSibling?.nodeValue?.trim()
               || item.querySelector('link')?.textContent?.trim()
               || item.querySelector('guid')?.textContent?.trim() || '';
      const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
      const desc = (item.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,'').slice(0,280);
      const srcEl = item.querySelector('source');
      const srcText = srcEl?.textContent?.trim() || '';
      if (!title || !link) continue;
      let date = '';
      try { const d=new Date(pubDate); if(!isNaN(d)) date=d.toISOString().slice(0,10); } catch(e){}
      let source = 'Autre';
      const haystack = (link+title+srcText).toLowerCase();
      if (haystack.includes('ouest-france'))       source='Ouest-France';
      else if (haystack.includes('letelegramme') || haystack.includes('télégramme')) source='Le Télégramme';
      else if (haystack.includes('actu.fr'))       source='Actu.fr';
      else if (haystack.includes('francebleu') || haystack.includes('france bleu')) source='France Bleu';
      else if (haystack.includes('vigicrues'))     source='Vigicrues';
      else if (haystack.includes('meteofrance') || haystack.includes('météo-france')) source='Météo-France';
      else if (srcText) source = srcText.replace(/\.(fr|com|net|org).*/,'');
      items.push({ url:link, title, source, date, extract:desc, commune:'', lat:null, lon:null });
    }
  } catch(e) {}
  return items;
}

export function rpRenderCandidates() {
  const wrap = document.getElementById('rp-candidates');
  const list = document.getElementById('rp-cand-list');
  const sub  = document.getElementById('rp-cand-sub');
  if (!wrap || !list) return;
  if (!RP_CANDIDATES.length) { wrap.style.display='none'; return; }
  wrap.style.display='block';
  if (sub) sub.textContent = `${RP_CANDIDATES.length} article${RP_CANDIDATES.length>1?'s':''} inondation — sélectionnez les pertinents`;
  list.innerHTML = RP_CANDIDATES.map((c,i) => `
    <div class="rp-cand-item">
      <input type="checkbox" class="rp-cand-check" data-idx="${i}" checked>
      <div class="rp-cand-body">
        <a class="rp-cand-link" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.title)}</a>
        <div class="rp-cand-meta">${escapeHtml(c.source)} · ${c.date||'—'}${c.commune?' · 📍 '+escapeHtml(c.commune):''}</div>
        ${c.extract?`<div class="rp-cand-ext">${escapeHtml(c.extract)}</div>`:''}
      </div>
    </div>`).join('');
}

export function rpSelectAllCandidates(checked) {
  document.querySelectorAll('.rp-cand-check').forEach(el => el.checked=checked);
}

export function rpValidateCandidates() {
  const checked = [...document.querySelectorAll('.rp-cand-check:checked')];
  if (!checked.length) { toast('Sélectionnez au moins un article'); return; }
  const idxs = new Set(checked.map(el => +el.dataset.idx));
  let added = 0;
  const geoPromises = [];
  for (const i of idxs) {
    const c = RP_CANDIDATES[i];
    if (!c) continue;
    const art = {...c, auto:true};
    // Géocodage auto si commune détectée mais pas encore de coordonnées
    if (art.commune && art.lat == null) {
      geoPromises.push(
        rpGeocode(art.commune).then(geo => {
          if (geo) { art.lat = geo.lat; art.lon = geo.lon; }
          rpAddArticle(art);
        })
      );
    } else {
      rpAddArticle(art);
    }
    added++;
  }
  Promise.all(geoPromises).then(() => {
    rpSave(); rpRender(); rpRenderStats(); rpRenderSIG();
  });
  RP_CANDIDATES = RP_CANDIDATES.filter((_,i) => !idxs.has(i));
  rpRenderCandidates();
  if (!geoPromises.length) { rpRender(); rpRenderStats(); rpRenderSIG(); }
  toast(`✓ ${added} article${added>1?'s':''} ajouté${added>1?'s':''}`);
}

export function rpAddArticle(art) {
  const a = {
    id:      rpUUID(),
    url:     art.url     || '',
    title:   art.title   || '',
    source:  art.source  || 'Autre',
    date:    art.date    || new Date().toISOString().slice(0,10),
    extract: art.extract || '',
    commune: art.commune || '',
    lat:     art.lat     != null ? +art.lat : null,
    lon:     art.lon     != null ? +art.lon : null,
    bassins: art.bassins || [],
    niveau:  art.niveau  || 'info',
    added:   new Date().toISOString(),
    auto:    !!art.auto,
  };
  RP_DB.articles.unshift(a);
  RP_DB.meta.updated = a.added;
  if (!RP_DB.meta.created) RP_DB.meta.created = a.added;
  rpSave();
}

export function rpDeleteArticle(id) {
  if (!confirm('Supprimer cet article ?')) return;
  RP_DB.articles = RP_DB.articles.filter(a => a.id !== id);
  rpSave(); rpRender(); rpRenderStats(); rpRenderSIG();
}

export function rpToggleForm() {
  const body = document.getElementById('rp-form-body');
  const tog  = document.getElementById('rp-form-toggle');
  if (!body) return;
  body.classList.toggle('open');
  if (tog) tog.textContent = body.classList.contains('open') ? '▲' : '▼';
}

export function rpToggleSIG() {
  const body = document.getElementById('rp-sig-body');
  const tog  = document.getElementById('rp-sig-toggle');
  if (!body) return;
  body.style.display = body.style.display === 'none' ? '' : 'none';
  if (tog) tog.textContent = body.style.display === 'none' ? '▼' : '▲';
  if (body.style.display !== 'none') {
    rpInitSIG();
    if (RP_SIG_MAP) setTimeout(() => RP_SIG_MAP.invalidateSize(), 50);
  }
}

export function rpSubmitForm() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const url   = g('rpf-url');
  const title = g('rpf-title');
  if (!url && !title) { toast('URL ou titre requis'); return; }
  const bassins = [...document.querySelectorAll('.rp-bassin-chk:checked')].map(el=>el.value);
  const lat = parseFloat(g('rpf-lat')) || null;
  const lon = parseFloat(g('rpf-lon')) || null;
  rpAddArticle({ url, title, source:g('rpf-source'), date:g('rpf-date'), extract:g('rpf-extract'),
    commune:g('rpf-commune'), lat, lon, bassins, niveau:g('rpf-niveau'), auto:false });
  ['rpf-url','rpf-title','rpf-extract','rpf-commune','rpf-lat','rpf-lon'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.querySelectorAll('.rp-bassin-chk').forEach(el=>el.checked=false);
  const niv = document.getElementById('rpf-niveau'); if (niv) niv.value='info';
  rpRender(); rpRenderStats(); rpRenderSIG();
  toast('Article ajouté');
}

export function rpExport() {
  const blob = new Blob([JSON.stringify(RP_DB, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`revue-presse-22-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
  toast(`📤 ${RP_DB.articles.length} articles exportés`);
}

export function rpImport(ev) {
  const file = ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const db = JSON.parse(e.target.result);
      if (!Array.isArray(db.articles)) throw new Error('Format invalide');
      const existing = new Set(RP_DB.articles.map(a=>a.url));
      let added=0;
      for (const a of [...db.articles].reverse()) {
        if (!existing.has(a.url)) { RP_DB.articles.unshift(a); added++; }
      }
      RP_DB.meta.updated = new Date().toISOString();
      rpSave(); rpRender(); rpRenderStats(); rpRenderSIG();
      toast(`📥 ${added} articles importés (${db.articles.length-added} déjà présents)`);
    } catch(err) { toast('Erreur import : '+err.message, 5000); }
  };
  reader.readAsText(file);
  ev.target.value='';
}

export function rpRenderStats() {
  const statBox = document.getElementById('rp-stats');
  if (!statBox) return;
  const n = RP_DB.articles.length;
  if (!n) { statBox.style.display='none'; return; }
  statBox.style.display='grid';
  const cutoff7 = new Date(); cutoff7.setDate(cutoff7.getDate()-7);
  const t = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  t('rps-total', n);
  t('rps-crise', RP_DB.articles.filter(a=>a.niveau==='crise').length);
  t('rps-alerte', RP_DB.articles.filter(a=>a.niveau==='alerte').length);
  t('rps-7j', RP_DB.articles.filter(a=>new Date(a.date)>=cutoff7).length);
  t('rps-geo', RP_DB.articles.filter(a=>a.lat!=null).length);
}

// ── Carte SIG ─────────────────────────────────────────────────────────────

export function rpInitSIG() {
  const el = document.getElementById('rp-sig-map');
  if (!el || RP_SIG_MAP) return;
  if (typeof L === 'undefined') return;
  RP_SIG_MAP = L.map('rp-sig-map', { zoomControl: true }).setView([48.47, -2.75], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18,
  }).addTo(RP_SIG_MAP);
  rpRenderSIG();
}

export function rpRenderSIG() {
  if (!RP_SIG_MAP) return;
  // Supprimer les anciens marqueurs
  RP_SIG_MARKERS.forEach(m => m.remove());
  RP_SIG_MARKERS = [];
  const geoArts = RP_DB.articles.filter(a => a.lat != null && a.lon != null);
  for (const a of geoArts) {
    const color = SIG_COLORS[a.niveau] || SIG_COLORS.info;
    const niv = RP_NIV[a.niveau] || RP_NIV.info;
    const marker = L.circleMarker([a.lat, a.lon], {
      radius: 8,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85,
    });
    const popupHtml = `
      <div style="max-width:240px;font-size:12px">
        <div style="font-weight:600;margin-bottom:4px;line-height:1.4">
          ${a.url ? `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" style="color:#2980b9;text-decoration:none">${escapeHtml(a.title||'(sans titre)')}</a>` : escapeHtml(a.title||'(sans titre)')}
        </div>
        <div style="color:#888;margin-bottom:4px">${escapeHtml(a.source)} · ${a.date||'—'}${a.commune?' · 📍 '+escapeHtml(a.commune):''}</div>
        <span style="display:inline-block;padding:1px 8px;border-radius:99px;font-size:10px;font-weight:600;background:${color};color:#fff">${niv.label}</span>
      </div>`;
    marker.bindPopup(popupHtml);
    marker.addTo(RP_SIG_MAP);
    RP_SIG_MARKERS.push(marker);
  }
  // Mettre à jour le compteur SIG
  const cntEl = document.getElementById('rp-sig-count');
  if (cntEl) cntEl.textContent = `${geoArts.length} événement${geoArts.length!==1?'s':''} localisé${geoArts.length!==1?'s':''}`;
}

// ── Rendu liste articles ──────────────────────────────────────────────────

export function rpRender() {
  const q    = document.getElementById('rp-search')?.value?.toLowerCase()||'';
  const fSrc = document.getElementById('rp-fsource')?.value||'';
  const fBas = document.getElementById('rp-fbassin')?.value||'';
  const fNiv = document.getElementById('rp-fniveau')?.value||'';
  const fPer = document.getElementById('rp-fperiod')?.value||'';
  const fGeo = document.getElementById('rp-fgeo')?.checked || false;

  let arts = RP_DB.articles;
  if (q)    arts = arts.filter(a => (a.title+a.source+a.extract+(a.commune||'')).toLowerCase().includes(q));
  if (fSrc) arts = arts.filter(a => a.source===fSrc);
  if (fBas) arts = arts.filter(a => (a.bassins||[]).includes(fBas));
  if (fNiv) arts = arts.filter(a => a.niveau===fNiv);
  if (fGeo) arts = arts.filter(a => a.lat != null);
  if (fPer) {
    const cut=new Date();
    if(fPer==='1') cut.setDate(cut.getDate()-1);
    else if(fPer==='7') cut.setDate(cut.getDate()-7);
    else if(fPer==='30') cut.setDate(cut.getDate()-30);
    arts=arts.filter(a=>new Date(a.date)>=cut);
  }

  const cnt = document.getElementById('rp-count');
  if (cnt) cnt.textContent = arts.length+' article'+(arts.length!==1?'s':'');

  const list = document.getElementById('rp-list');
  if (!list) return;

  if (!arts.length) {
    list.innerHTML = `<div class="rp-empty">${RP_DB.articles.length?'Aucun article ne correspond aux filtres.':'Aucun article enregistré — actualisez via RSS ou ajoutez manuellement.'}</div>`;
    return;
  }

  list.innerHTML = arts.map(a => {
    const niv = RP_NIV[a.niveau] || RP_NIV.info;
    const tags = (a.bassins||[]).map(b=>`<span class="rp-bassin-tag">${escapeHtml(b)}</span>`).join('');
    const geoTag = a.lat != null
      ? `<span class="rp-geo-tag" title="${a.lat.toFixed(4)}, ${a.lon.toFixed(4)}">📍 ${escapeHtml(a.commune||'Localisé')}</span>`
      : '';
    return `<div class="rp-article ${niv.art}">
      <div class="rp-article-body">
        <div class="rp-article-top">
          <a class="rp-article-title" href="${escapeHtml(a.url||'#')}" target="_blank" rel="noopener">${escapeHtml(a.title||'(sans titre)')}</a>
          <span class="rp-niv-badge ${niv.cls}">${niv.label}</span>
          ${a.auto?'<span class="rp-rss-badge">RSS</span>':''}
        </div>
        <div class="rp-article-meta">
          <span class="rp-source-badge">${escapeHtml(a.source)}</span>${a.date||'—'}
        </div>
        ${a.extract?`<div class="rp-article-extract">${escapeHtml(a.extract)}</div>`:''}
        <div class="rp-article-footer">${geoTag}${tags}</div>
      </div>
      <button aria-label="Supprimer l'article" class="rp-del" onclick="rpDeleteArticle('${escapeHtml(a.id)}')" title="Supprimer">✕</button>
    </div>`;
  }).join('');
}
