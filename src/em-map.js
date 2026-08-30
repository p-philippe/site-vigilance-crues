// ── EM-MAP — Carte État-Major ─────────────────────────────────────────────

import { ST, CODES, VC, VT, VL, EM_SENSITIVE_META, POINTS_22, SOL_POINTS, SOL_LAYERS, PORTS_22 } from './config.js';
import { OBS, METEO_DATA, SOL_DATA, NAPPES_DATA, MAREE_DATA, COEFF_DATA } from './state.js';
import { vigi, vigiSourceLabel, trendInfo, formatSpeed } from './vigi.js';
import { solComposite, solColor, solLabel, nappePctClass, pressureAlert } from './meteo.js';
import { escapeHtml, toast, fmtDateTime, fmtTime, fmtDate } from './utils.js';
import { nowStrParis } from './meteo.js';

// EM_SENSITIVE_INLINE : chargé dynamiquement (JSON 230KB) pour ne pas bloquer le module
let EM_SENSITIVE_INLINE = null;
async function getEmSensitiveInline() {
  if (EM_SENSITIVE_INLINE) return EM_SENSITIVE_INLINE;
  const r = await fetch('./src/em-sensitive-inline.json');
  EM_SENSITIVE_INLINE = await r.json();
  return EM_SENSITIVE_INLINE;
}

// ── État ──
let emMap = null;
let emCurrentTool = 'select';
let emCurrentColor = '#e63946';
let emDrawing = false;
let emDrawPoints = [];
let emDrawLayer = null;
let emAnnotations = null;
let emStationsLayer = null;
let emShowStations = true;
let emSensitiveData = null;
let emSensitiveLoading = false;
let emSensitiveLayers = {};
let emShowSensitive = {school:false, health:false, ehpad:false};
let emSensitiveFilters = { text: '', schoolKind: 'all' };
let emBaseLayers = {};
let emCurrentBase = 'osm';
let emCircleCenter = null;
let emCirclePreview = null;
let EM_MEMORY = '';

function emFmtDist(m) { return m < 1000 ? Math.round(m)+' m' : (m/1000).toFixed(2)+' km'; }

// ── Utilitaires ──
function emSafeColor(color, fallback='#e63946') {
  const v = String(color || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return '#' + v.slice(1).split('').map(c => c + c).join('');
  return fallback;
}

function emMakeIcon(color, label='') {
  const L = window.L;
  const safeColor = emSafeColor(color);
  const safeLabel = escapeHtml(String(label).slice(0,2));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z" fill="${safeColor}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
    <circle cx="14" cy="14" r="7" fill="white" opacity="0.9"/>
    <text x="14" y="18" text-anchor="middle" font-size="10" font-family="sans-serif" font-weight="700" fill="${safeColor}">${safeLabel}</text>
  </svg>`;
  return L.divIcon({ html:svg, iconSize:[28,36], iconAnchor:[14,36], popupAnchor:[0,-36], className:'' });
}

function emGetStyleOpts(alpha) {
  const a = alpha !== undefined ? alpha : 0.25;
  return { color:emCurrentColor, weight:3, opacity:0.9, fillColor:emCurrentColor, fillOpacity:a, dashArray:null };
}

// ── Init ──
export function emInitMap() {
  const L = window.L;
  if (emMap) return;

  emAnnotations = L.featureGroup();
  emStationsLayer = L.featureGroup();

  emMap = L.map('em-map', {zoomControl:false, attributionControl:true}).setView([48.42, -2.95], 9);
  L.control.zoom({position:'bottomright'}).addTo(emMap);
  emBaseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap', maxZoom:19});
  emBaseLayers.topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {attribution:'© OpenTopoMap', maxZoom:17});
  emBaseLayers.osm.addTo(emMap);
  emAnnotations.addTo(emMap);
  emStationsLayer.addTo(emMap);
  emSensitiveLayers = {
    school: L.featureGroup(),
    health: L.featureGroup(),
    ehpad: L.featureGroup()
  };

  emRefreshStations();
  emLoadLocal();
  emLoadTroncons();

  emMap.on('click', emHandleMapClick);
  emMap.on('mousemove', emHandleMouseMove);
  emMap.on('dblclick', emHandleDblClick);
  emMap.on('contextmenu', e => { e.originalEvent.preventDefault(); emCancelDraw(); });

  // Exposer sur window pour les appels depuis index.html
  window.emMap = emMap;
  window.emAnnotations = emAnnotations;
}

const EM_BT22 = new Set(['BT2','BT5','BT7','BT13','BT14','BT15']);
const EM_NIV_COLORS = { 2:'#e6c600', 3:'#FF7F00', 4:'#FF2200' };
const EM_NIV_LABELS = { 1:'Vert — normal', 2:'Vigilance jaune', 3:'Alerte orange', 4:'Alerte rouge' };

let emTronconsLayer = null;

async function emLoadTroncons(attempt = 0) {
  const L = window.L;
  try {
    // Pane dédié, toujours au-dessus du radar (250) et sous les stations (markerPane 600)
    if (!emMap.getPane('tronconsPane')) {
      emMap.createPane('tronconsPane');
      emMap.getPane('tronconsPane').style.zIndex = 550;
    }
    const r = await fetch('/api/vigicrues');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const gj = await r.json();
    if (emTronconsLayer) { emMap.removeLayer(emTronconsLayer); emTronconsLayer = null; }
    emTronconsLayer = L.geoJSON(gj, {
      filter: f => EM_BT22.has(f.properties?.CdEntCru),
      style: f => {
        const niv = f.properties.NivInfViCr || 1;
        const col = EM_NIV_COLORS[niv] || '#27ae60';
        return { color: col, weight: niv >= 3 ? 5 : niv === 2 ? 4 : 3, opacity: 0.85, pane: 'tronconsPane' };
      },
      onEachFeature: (f, layer) => {
        const p = f.properties;
        const niv = p.NivInfViCr || 1;
        layer.bindTooltip(
          `<strong>${p.lbentcru || p.CdEntCru}</strong><br>${EM_NIV_LABELS[niv] || ''}`,
          { sticky: true }
        );
      }
    }).addTo(emMap);
  } catch(e) {
    // Panne réseau/proxy transitoire — on retente une fois avant d'abandonner silencieusement
    if (attempt < 1) setTimeout(() => emLoadTroncons(attempt + 1), 3000);
  }
}

export function emRefreshStations() {
  const L = window.L;
  if (!emStationsLayer) return;
  emStationsLayer.clearLayers();
  if (!emShowStations) return;
  for (const code of CODES) {
    const st = ST[code];
    const o = OBS[code];
    const hm = o?.H ? o.H.val/1000 : null;
    const v = vigi(code, hm);
    const color = VC[v] || '#888';
    const border = v === 1 ? '#bbb' : 'rgba(0,0,0,0.35)';
    const icon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${border};box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.4)"></div>`,
      iconSize:[14,14], iconAnchor:[7,7], className:''
    });
    const marker = L.marker([st.lat, st.lon], { icon, pane:'markerPane' });
    marker.bindPopup(() => emStationPopup(code), { maxWidth: 300 });
    marker.bindTooltip(() => {
      const hm2 = OBS[code]?.H ? OBS[code].H.val/1000 : null;
      return `<strong>${escapeHtml(st.n.replace(' ★',''))}</strong> · ${hm2!=null?hm2.toFixed(2)+' m':'—'}`;
    }, { direction:'top', opacity:.9 });
    emStationsLayer.addLayer(marker);
  }
}

function emStationPopup(code) {
  const st = ST[code], o = OBS[code];
  const hm = o?.H ? o.H.val/1000 : null;
  const v = vigi(code, hm);
  const tr = trendInfo(code);
  const brd = v===1 ? 'border:1px solid #bbb;' : '';
  const row = (l, val) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:1px 0"><span style="color:#666">${l}</span><span>${val}</span></div>`;
  const crues = (st.h || []).slice(0,3).map((c,i) =>
    row(`#${i+1} ${escapeHtml(c.l)}`, `<strong style="font-family:monospace">${c.v.toFixed(2)} m</strong>`)
  ).join('');
  return `<div style="font-family:sans-serif;font-size:12px;min-width:235px">
    <div style="font-weight:700;font-size:14px">${escapeHtml(st.n.replace(' ★',''))}</div>
    <div style="color:#666;margin-bottom:6px">${escapeHtml(st.c)} · ${code}</div>
    <span style="background:${VC[v]||'#888'};color:${VT[v]||'#fff'};${brd}border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${VL[v]||'N/A'}</span>
    <div style="color:#888;font-size:10px;margin:4px 0 6px">${escapeHtml(vigiSourceLabel(code))}</div>
    ${row('Hauteur', `<strong style="font-family:monospace">${hm!=null?hm.toFixed(3)+' m':'—'}</strong>`)}
    ${row('Débit', `<strong style="font-family:monospace">${o?.Q?(o.Q.val/1000).toFixed(2)+' m³/s':'—'}</strong>`)}
    ${row('Tendance', `<strong>${tr.icon} ${formatSpeed(tr.speed)}</strong>`)}
    ${o?.H?.date ? row('Observation', `<span style="font-family:monospace;font-size:10px">${fmtDateTime(o.H.date)}</span>`) : ''}
    <div style="margin-top:6px;font-weight:600;font-size:11px">Crues historiques</div>
    ${crues}
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
      <button onclick="openMod('${code}')" style="flex:1;background:#2980b9;color:#fff;border:none;border-radius:4px;padding:5px 8px;cursor:pointer;font-size:11px">📊 Fiche complète</button>
      <a href="https://www.vigicrues.gouv.fr/station/${code}" target="_blank" style="font-size:11px;white-space:nowrap">↗ Vigicrues</a>
    </div>
  </div>`;
}

// ── Couches environnement : météo, sols, nappes ──
let emMeteoLayer = null, emSolLayer = null, emNappesLayer = null;
let emShowMeteo = false, emShowSol = false, emShowNappes = false;

function emNowIdx(hourly) {
  if (!hourly?.time) return -1;
  const nowStr = nowStrParis();
  const i = hourly.time.findIndex(t => t >= nowStr);
  return i >= 0 ? i : hourly.time.length - 1;
}

function emMeteoPopup(i) {
  const pt = POINTS_22[i], d = METEO_DATA?.[i], h = d?.hourly;
  if (!h?.time) return `<strong>${escapeHtml(pt.nom)}</strong><br>Données météo indisponibles`;
  const idx = emNowIdx(h);
  const past12 = h.precipitation.slice(Math.max(0, idx-12), idx).reduce((a,b)=>a+(b||0),0);
  const fut24  = h.precipitation.slice(idx, idx+24).reduce((a,b)=>a+(b||0),0);
  const row = (l,v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:1px 0"><span style="color:#666">${l}</span><strong>${v}</strong></div>`;
  return `<div style="font-family:sans-serif;font-size:12px;min-width:210px">
    <div style="font-weight:700;font-size:13px">🌦️ ${escapeHtml(pt.nom)}</div>
    <div style="color:#666;margin-bottom:6px">${escapeHtml(pt.zone)} — Open-Meteo (modèle)</div>
    ${row('Température', (h.temperature_2m?.[idx]??'—') + ' °C')}
    ${row('Pluie actuelle', (h.precipitation[idx]??0).toFixed(1) + ' mm/h')}
    ${row('Cumul 12 h passées', past12.toFixed(1) + ' mm')}
    ${row('Prévu 24 h', fut24.toFixed(1) + ' mm')}
    ${row('Vent', Math.round(h.wind_speed_10m?.[idx]??0) + ' km/h')}
    ${row('Rafales', Math.round(h.wind_gusts_10m?.[idx]??0) + ' km/h')}
    ${row('Humidité', (h.relative_humidity_2m?.[idx]??'—') + ' %')}
    ${row('Pression', Math.round(h.pressure_msl?.[idx]??0) + ' hPa')}
    <div style="margin-top:6px;font-size:10px;color:#999">Détails et graphiques : onglet Météo</div>
  </div>`;
}

function emBuildMeteoLayer() {
  const L = window.L;
  if (emMeteoLayer) { emMap.removeLayer(emMeteoLayer); }
  emMeteoLayer = L.featureGroup();
  POINTS_22.forEach((pt, i) => {
    const h = METEO_DATA?.[i]?.hourly;
    const idx = emNowIdx(h);
    const rain = idx >= 0 ? (h.precipitation[idx] || 0) : 0;
    const temp = idx >= 0 && h.temperature_2m ? Math.round(h.temperature_2m[idx]) : null;
    const bg = rain >= 10 ? '#c0392b' : rain >= 5 ? '#e67e22' : rain > 0 ? '#2980b9' : '#5a6b7a';
    const icon = L.divIcon({
      html: `<div style="background:${bg};color:#fff;border-radius:6px;padding:2px 6px;font-size:11px;font-weight:700;font-family:sans-serif;white-space:nowrap;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.4)">🌦 ${temp!=null?temp+'°':''} ${rain.toFixed(1)}mm</div>`,
      className:'', iconSize:null, iconAnchor:[20,10], popupAnchor:[0,-10]
    });
    const m = L.marker([pt.lat, pt.lon], { icon });
    m.bindPopup(() => emMeteoPopup(i), { maxWidth: 280 });
    m.bindTooltip(escapeHtml(pt.nom), { direction:'top', opacity:.9 });
    emMeteoLayer.addLayer(m);
  });
  emMeteoLayer.addTo(emMap);
}

export async function emToggleMeteo() {
  emShowMeteo = !emShowMeteo;
  const btn = document.getElementById('em-btn-meteo');
  if (btn) btn.classList.toggle('active', emShowMeteo);
  if (!emShowMeteo) {
    if (emMeteoLayer) { emMap.removeLayer(emMeteoLayer); emMeteoLayer = null; }
    emSetStatus('Couche météo masquée');
    return;
  }
  if (!METEO_DATA) { emSetStatus('Chargement météo…'); await window.loadMeteo?.(); }
  if (!METEO_DATA) { emSetStatus('Météo indisponible'); return; }
  emBuildMeteoLayer();
  emSetStatus('Couche météo affichée — cliquer sur un point pour le détail');
}

function emSolPopup(i) {
  const pt = SOL_POINTS[i], d = SOL_DATA?.[i], h = d?.hourly;
  if (!h?.time) return `<strong>${escapeHtml(pt.nom)}</strong><br>Données sol indisponibles`;
  const idx = emNowIdx(h);
  const pct = solComposite(h, idx);
  const layers = SOL_LAYERS.map(l => {
    const theta = h[l.key]?.[idx];
    return `<div style="display:flex;justify-content:space-between;gap:10px;padding:1px 0"><span style="color:#666">${l.label}</span><strong style="font-family:monospace">${theta!=null?(theta*100).toFixed(0)+' %':'—'}</strong></div>`;
  }).join('');
  return `<div style="font-family:sans-serif;font-size:12px;min-width:215px">
    <div style="font-weight:700;font-size:13px">🌱 ${escapeHtml(pt.nom)}</div>
    <div style="color:#666;margin-bottom:6px">${escapeHtml(pt.zone)} — Open-Meteo (modèle)</div>
    <div style="background:${solColor(pct)};color:#fff;border-radius:4px;padding:4px 8px;font-weight:700;text-align:center">Saturation ${pct.toFixed(0)} %</div>
    <div style="font-size:11px;color:#555;margin:5px 0">${escapeHtml(solLabel(pct))}</div>
    <div style="font-weight:600;font-size:11px;margin-top:4px">Humidité par profondeur (vol.)</div>
    ${layers}
    <div style="margin-top:5px;font-size:10px;color:#999">Bassins : ${pt.bassins.map(escapeHtml).join(', ')}</div>
  </div>`;
}

function emBuildSolLayer() {
  const L = window.L;
  if (emSolLayer) { emMap.removeLayer(emSolLayer); }
  emSolLayer = L.featureGroup();
  SOL_POINTS.forEach((pt, i) => {
    const h = SOL_DATA?.[i]?.hourly;
    const pct = solComposite(h, emNowIdx(h));
    const m = L.circleMarker([pt.lat, pt.lon], {
      radius: 13, color:'#fff', weight: 2, fillColor: solColor(pct), fillOpacity: .85
    });
    m.bindPopup(() => emSolPopup(i), { maxWidth: 270 });
    m.bindTooltip(`${escapeHtml(pt.nom)} — saturation ${pct.toFixed(0)} %`, { direction:'top', opacity:.9 });
    emSolLayer.addLayer(m);
  });
  emSolLayer.addTo(emMap);
}

export async function emToggleSol() {
  emShowSol = !emShowSol;
  const btn = document.getElementById('em-btn-sol');
  if (btn) btn.classList.toggle('active', emShowSol);
  if (!emShowSol) {
    if (emSolLayer) { emMap.removeLayer(emSolLayer); emSolLayer = null; }
    emSetStatus('Couche sols masquée');
    return;
  }
  if (!SOL_DATA) { emSetStatus('Chargement saturation des sols…'); await window.loadSol?.(); }
  if (!SOL_DATA) { emSetStatus('Données sol indisponibles'); return; }
  emBuildSolLayer();
  emSetStatus('Saturation des sols affichée — cliquer sur un cercle pour le détail');
}

function emNappePopup(sta) {
  const m = (sta.mesures || [])[0];
  const cls = nappePctClass(sta.pct);
  const row = (l,v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:1px 0"><span style="color:#666">${l}</span><strong>${v}</strong></div>`;
  return `<div style="font-family:sans-serif;font-size:12px;min-width:215px">
    <div style="font-weight:700;font-size:13px">💧 ${escapeHtml(sta.libelle_pe || sta.code_bss)}</div>
    <div style="color:#666;margin-bottom:6px">${escapeHtml(sta.nom_commune || '')} · ${escapeHtml(sta.code_bss)}</div>
    ${sta.pct != null ? row('Vs historique (même mois)', `<span style="color:${cls.color}">${sta.pct}ᵉ centile — ${cls.label}</span>`) : ''}
    ${m ? row('Dernière mesure', escapeHtml(m.date_mesure || '—')) : '<div style="color:#999">Aucune mesure récente</div>'}
    ${m && m.profondeur_nappe != null ? row('Profondeur nappe', m.profondeur_nappe.toFixed(2) + ' m') : ''}
    ${m && m.niveau_nappe_eau != null ? row('Niveau (NGF)', m.niveau_nappe_eau.toFixed(2) + ' m') : ''}
    ${sta.altitude_station != null ? row('Altitude station', sta.altitude_station + ' m') : ''}
    <div style="margin-top:5px;font-size:10px;color:#999">Hub'Eau ADES — mesures différées (~1 sem.)${sta.pctYears ? ` · chronique ${sta.pctYears} ans` : ''}</div>
  </div>`;
}

function emBuildNappesLayer() {
  const L = window.L;
  if (emNappesLayer) { emMap.removeLayer(emNappesLayer); }
  emNappesLayer = L.featureGroup();
  for (const sta of NAPPES_DATA || []) {
    if (!Number.isFinite(+sta.x) || !Number.isFinite(+sta.y)) continue;
    const bg = sta.pct != null ? nappePctClass(sta.pct).color : '#2471a3';
    const icon = L.divIcon({
      html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.4)"><span style="display:block;transform:rotate(45deg);text-align:center;font-size:10px;line-height:18px;color:#fff">💧</span></div>`,
      className:'', iconSize:[18,18], iconAnchor:[9,14], popupAnchor:[0,-12]
    });
    const m = L.marker([+sta.y, +sta.x], { icon });
    m.bindPopup(() => emNappePopup(sta), { maxWidth: 270 });
    m.bindTooltip(escapeHtml(sta.libelle_pe || sta.code_bss), { direction:'top', opacity:.9 });
    emNappesLayer.addLayer(m);
  }
  emNappesLayer.addTo(emMap);
}

// ── Marée (Open-Meteo Marine — niveau de la mer / MSL) ──
let emMareeLayer = null, emShowMaree = false;

function emMareeSeries(i) {
  const h = MAREE_DATA?.[i]?.hourly;
  if (!h?.time || !h.sea_level_height_msl) return null;
  // timezone=UTC → heures ISO sans suffixe Z
  const t = h.time.map(s => Date.parse(s.endsWith('Z') ? s : s + 'Z'));
  return { t, v: h.sea_level_height_msl };
}

// Extrema locaux affinés par interpolation parabolique (précision ≈ min sur un pas horaire)
function emMareeExtrema(s) {
  const out = [];
  for (let i = 1; i < s.v.length - 1; i++) {
    const a = s.v[i-1], b = s.v[i], c = s.v[i+1];
    if (a == null || b == null || c == null) continue;
    const isMax = b >= a && b > c, isMin = b <= a && b < c;
    if (!isMax && !isMin) continue;
    const denom = a - 2*b + c;
    let dt = 0, hv = b;
    if (denom !== 0) { dt = 0.5 * (a - c) / denom; hv = b - (a - c) * (a - c) / (8 * denom); }
    out.push({ time: s.t[i] + dt * 3600000, h: hv, type: isMax ? 'PM' : 'BM' });
  }
  return out;
}

function emMareeNow(s) {
  const now = Date.now();
  let i = s.t.findIndex(t => t > now);
  if (i <= 0) i = s.t.length - 1;
  const t0 = s.t[i-1], t1 = s.t[i], v0 = s.v[i-1], v1 = s.v[i];
  if (v0 == null || v1 == null) return null;
  const frac = (now - t0) / (t1 - t0);
  return { h: v0 + (v1 - v0) * frac, rising: v1 > v0 };
}

// Coefficient de marée officiel SHOM (échelle 20-120) pour une date donnée — voir /api/coefficient.js
function coeffForDate(d) {
  if (!COEFF_DATA) return null;
  const key = d.toISOString().slice(0, 10);
  return COEFF_DATA.find(c => c.date === key) || null;
}

function coeffLabel(c) {
  if (c == null) return '';
  if (c >= 100) return 'très grande marée';
  if (c >= 70) return 'vive-eau';
  if (c >= 40) return 'marée moyenne';
  return 'morte-eau';
}

// Pression minimale prévue (parmi les 5 points météo) pour une date calendaire donnée (Europe/Paris)
function minPressureForDate(dateStr) {
  if (!METEO_DATA) return null;
  let min = null;
  METEO_DATA.forEach(d => {
    const h = d.hourly;
    if (!h?.time || !h.pressure_msl) return;
    h.time.forEach((t, idx) => {
      if (t.slice(0, 10) !== dateStr) return;
      const p = h.pressure_msl[idx];
      if (p != null && (min == null || p < min)) min = p;
    });
  });
  return min;
}

function pressureLevel(min) {
  if (min == null) return 'none';
  return min < 990 ? 'strong' : min < 1000 ? 'moderate' : 'none';
}

/**
 * Anticipation du risque de surcote sur les prochains jours (limité par l'horizon fiable des
 * prévisions météo — au-delà de 3 jours la pression prévue devient peu fiable). Croise le
 * coefficient de marée (SHOM, fiable à 10 jours) avec la dépression prévue (Open-Meteo, 3 jours).
 */
function surgeForecastDays(nDays = 3) {
  if (!COEFF_DATA || !METEO_DATA) return [];
  return COEFF_DATA.slice(0, nDays).map(c => {
    const min = minPressureForDate(c.date);
    const level = pressureLevel(min);
    return { date: c.date, coeff: c.max, minPressure: min, level, concern: level !== 'none' && c.max != null && c.max >= 70 };
  });
}

export function emUpdateSurgeAlert() {
  const box = document.getElementById('surge-alert');
  const text = document.getElementById('surge-alert-text');
  if (!box || !text) return;
  const days = surgeForecastDays(3).filter(d => d.concern);
  if (!days.length) { box.classList.remove('visible'); return; }
  const list = days.map(d => {
    const label = fmtDate(new Date(d.date + 'T12:00:00Z'), { weekday: 'short', day: '2-digit', month: '2-digit' });
    const dep = d.level === 'strong' ? 'dépression forte' : 'dépression modérée';
    return `${label} (coef. ${d.coeff}, ${dep})`;
  }).join(' · ');
  text.innerHTML = `<strong>Risque de surcote côtière</strong> — concomitance dépression + grande marée prévue : ${list}. Prévision météo peu fiable au-delà de 2-3 jours, à réactualiser à l'approche de l'échéance.`;
  box.classList.add('visible');
}

// Coefficient associé à une extremum (PM/BM) : matin ou après-midi selon l'heure locale Paris
function coeffForExtremum(ext) {
  if (!ext) return null;
  const day = coeffForDate(new Date(ext.time));
  if (!day) return null;
  const hour = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(ext.time)));
  const v = hour < 13 ? (day.am ?? day.pm) : (day.pm ?? day.am);
  return v;
}

function emMareeInfo(i) {
  const s = emMareeSeries(i);
  if (!s) return null;
  const ext = emMareeExtrema(s);
  const now = Date.now();
  const nowState = emMareeNow(s);
  const next = ext.filter(e => e.time > now);
  const prev = ext.filter(e => e.time <= now);
  const nextPM = next.find(e => e.type === 'PM');
  const nextBM = next.find(e => e.type === 'BM');
  const lastExt = prev[prev.length - 1];
  const nextExt = next[0];
  const marnage = (lastExt && nextExt) ? Math.abs(nextExt.h - lastExt.h) : null;
  const coeffNext = coeffForExtremum(nextExt);
  const coeffToday = coeffForDate(new Date());
  // Concomitance dépression + grande marée = risque de surcote accru (effet baromètre inverse)
  const pressure = pressureAlert();
  const surgeWatch = pressure.level !== 'none' && coeffToday != null && coeffToday.max >= 70;
  return { nowState, nextPM, nextBM, nextExt, marnage, coeffNext, coeffToday, pressure, surgeWatch };
}

function emMareePopup(i) {
  const pt = PORTS_22[i];
  const info = emMareeInfo(i);
  if (!info || !info.nowState) return `<strong>${escapeHtml(pt.nom)}</strong><br>Données marée indisponibles`;
  const { nowState, nextPM, nextBM, marnage, coeffToday, pressure, surgeWatch } = info;
  const row = (l, v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:1px 0"><span style="color:#666">${l}</span><strong>${v}</strong></div>`;
  const dir = nowState.rising
    ? '<span style="color:#2980b9">⇑ montante</span>'
    : '<span style="color:#16a085">⇓ descendante</span>';
  const coeffRow = coeffToday
    ? row('Coefficient (auj.)', `${[coeffToday.am, coeffToday.pm].filter(v => v != null).join(' / ')} <span style="font-weight:400;color:#888">— ${coeffLabel(coeffToday.max)}</span>`)
    : '';
  const pressureLabel = pressure.level === 'strong' ? 'dépression marquée' : pressure.level === 'moderate' ? 'dépression modérée' : 'normale';
  const pressureColor = pressure.level === 'strong' ? '#c0392b' : pressure.level === 'moderate' ? '#e67e22' : '#888';
  const pressureRow = pressure.min != null
    ? row('Pression atmo.', `${Math.round(pressure.min)} hPa <span style="font-weight:400;color:${pressureColor}">— ${pressureLabel}</span>`)
    : '';
  const surgeBanner = surgeWatch
    ? `<div style="margin-top:6px;padding:5px 7px;background:#fdecea;border:1px solid #c0392b;border-radius:5px;color:#c0392b;font-weight:600;font-size:11px">⚠️ Concomitance dépression + grande marée — risque de surcote côtière accru (effet baromètre inverse)</div>`
    : '';
  return `<div style="font-family:sans-serif;font-size:12px;min-width:220px">
    <div style="font-weight:700;font-size:13px">🌊 ${escapeHtml(pt.nom)}</div>
    <div style="color:#666;margin-bottom:6px">Open-Meteo Marine (modèle) · coefficient SHOM</div>
    ${row('Marée', dir)}
    ${row('Niveau actuel', nowState.h.toFixed(2) + ' m <span style="font-weight:400;color:#888">/ niveau moyen</span>')}
    ${coeffRow}
    ${pressureRow}
    ${nextPM ? row('Prochaine PM', `${fmtTime(new Date(nextPM.time))} · ${nextPM.h >= 0 ? '+' : ''}${nextPM.h.toFixed(2)} m`) : ''}
    ${nextBM ? row('Prochaine BM', `${fmtTime(new Date(nextBM.time))} · ${nextBM.h >= 0 ? '+' : ''}${nextBM.h.toFixed(2)} m`) : ''}
    ${marnage != null ? row('Marnage (cycle)', marnage.toFixed(1) + ' m') : ''}
    ${surgeBanner}
    <div style="margin-top:6px;font-size:10px;color:#999">Hauteurs par rapport au niveau moyen de la mer (MSL),<br>pas les hauteurs carte marine (CM). Heures ± quelques min.<br>Coefficient identique sur la façade Côtes-d'Armor (référence commune).<br>Pression = mesure la plus basse relevée sur le département, pas nécessairement au port.</div>
  </div>`;
}

function emBuildMareeLayer() {
  const L = window.L;
  if (emMareeLayer) { emMap.removeLayer(emMareeLayer); }
  emMareeLayer = L.featureGroup();
  PORTS_22.forEach((pt, i) => {
    const info = emMareeInfo(i);
    const rising = info?.nowState?.rising;
    const nextExt = info?.nextExt;
    const bg = info?.surgeWatch ? '#c0392b' : rising == null ? '#5a6b7a' : rising ? '#2980b9' : '#16a085';
    const label = nextExt
      ? (info.coeffNext != null ? `${rising ? '⇑' : '⇓'} Coef. ${info.coeffNext}` : `${rising ? '⇑' : '⇓'} ${nextExt.type} ${fmtTime(nextExt.time)}`)
      : '—';
    const prefix = info?.surgeWatch ? '⚠️ ' : '🌊 ';
    const icon = L.divIcon({
      html: `<div style="background:${bg};color:#fff;border-radius:6px;padding:2px 6px;font-size:11px;font-weight:700;font-family:sans-serif;white-space:nowrap;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.4)">${prefix}${label}</div>`,
      className:'', iconSize:null, iconAnchor:[24,10], popupAnchor:[0,-10]
    });
    const m = L.marker([pt.lat, pt.lon], { icon });
    m.bindPopup(() => emMareePopup(i), { maxWidth: 280 });
    m.bindTooltip(escapeHtml(pt.nom), { direction:'top', opacity:.9 });
    emMareeLayer.addLayer(m);
  });
  emMareeLayer.addTo(emMap);
}

export async function emToggleMaree() {
  emShowMaree = !emShowMaree;
  const btn = document.getElementById('em-btn-maree');
  if (btn) btn.classList.toggle('active', emShowMaree);
  if (!emShowMaree) {
    if (emMareeLayer) { emMap.removeLayer(emMareeLayer); emMareeLayer = null; }
    emSetStatus('Couche marée masquée');
    return;
  }
  if (!MAREE_DATA) { emSetStatus('Chargement marées Open-Meteo Marine…'); await window.loadMaree?.(); }
  if (!MAREE_DATA) { emSetStatus('Marées indisponibles'); return; }
  emBuildMareeLayer();
  emSetStatus('Marées affichées (PM = pleine mer, BM = basse mer) — cliquer sur un port pour le détail');
}

export async function emToggleNappes() {
  emShowNappes = !emShowNappes;
  const btn = document.getElementById('em-btn-nappes');
  if (btn) btn.classList.toggle('active', emShowNappes);
  if (!emShowNappes) {
    if (emNappesLayer) { emMap.removeLayer(emNappesLayer); emNappesLayer = null; }
    emSetStatus('Couche nappes masquée');
    return;
  }
  if (!NAPPES_DATA) { emSetStatus('Chargement des piézomètres Hub\'Eau ADES…'); await window.loadNappes?.(); }
  if (!NAPPES_DATA || !NAPPES_DATA.length) { emSetStatus('Piézomètres indisponibles'); return; }
  emBuildNappesLayer();
  emSetStatus(`${emNappesLayer.getLayers().length} piézomètres affichés — cliquer pour le détail`);
}

function emHandleMapClick(e) {
  if (emCurrentTool === 'select') return;
  if (emCurrentTool === 'erase') return;
  if (emCurrentTool === 'note') { emAddNote(e.latlng); return; }
  if (emCurrentTool === 'circle') {
    if (!emCircleCenter) {
      emCircleCenter = e.latlng;
      emSetStatus('Déplacez la souris puis cliquez pour fixer le rayon · Échap pour annuler');
    } else {
      const radius = emCircleCenter.distanceTo(e.latlng);
      emAddCircle(emCircleCenter, radius);
      emCircleCenter = null;
      if (emCirclePreview) { emMap.removeLayer(emCirclePreview); emCirclePreview = null; }
      emSetStatus('Zone circulaire ajoutée (rayon ' + emFmtDist(radius) + ')');
    }
    return;
  }
  if (emCurrentTool === 'polyline' || emCurrentTool === 'polygon') {
    // Un clic qui fait partie d'un double-clic (detail > 1) ne doit pas ajouter de point :
    // il sera géré par emHandleDblClick, qui termine le tracé.
    if (e.originalEvent && e.originalEvent.detail > 1) return;
    if (!emDrawing) {
      emDrawing = true; emDrawPoints = [e.latlng]; emShowDrawBar();
    } else {
      emDrawPoints.push(e.latlng);
    }
    emUpdateDrawInfo(); emUpdateDrawPreview(); return;
  }
}

function emHandleDblClick(e) {
  if (!emDrawing) return;
  if (e && e.originalEvent) window.L.DomEvent.stop(e.originalEvent);
  emFinishDraw();
}

function emHandleMouseMove(e) {
  if (emCurrentTool === 'circle' && emCircleCenter) {
    const L = window.L;
    const r = emCircleCenter.distanceTo(e.latlng);
    if (emCirclePreview) emMap.removeLayer(emCirclePreview);
    emCirclePreview = L.circle(emCircleCenter, {radius:r, ...emGetStyleOpts(0.12), dashArray:'6 4', opacity:0.75}).addTo(emMap);
    emSetStatus('Rayon : ' + emFmtDist(r) + ' · cliquez pour valider');
    return;
  }
  if (!emDrawing || emDrawPoints.length === 0) return;
  const L = window.L;
  const pts = [...emDrawPoints, e.latlng];
  if (emDrawLayer) { emMap.removeLayer(emDrawLayer); emDrawLayer = null; }
  const opts = emGetStyleOpts();
  emDrawLayer = (emCurrentTool === 'polyline' ? L.polyline(pts, opts) : L.polygon(pts, opts)).addTo(emMap);
}

function emShowDrawBar() {
  const bar = document.getElementById('em-draw-bar');
  if (bar) bar.classList.add('show');
  emUpdateDrawInfo();
}
function emHideDrawBar() {
  const bar = document.getElementById('em-draw-bar');
  if (bar) bar.classList.remove('show');
}
function emUpdateDrawInfo() {
  const el = document.getElementById('em-draw-info');
  if (!el) return;
  const n = emDrawPoints.length;
  let len = 0;
  for (let i = 1; i < emDrawPoints.length; i++) len += emDrawPoints[i-1].distanceTo(emDrawPoints[i]);
  const kind = emCurrentTool === 'polygon' ? 'sommet' : 'point';
  el.textContent = `${n} ${kind}${n>1?'s':''}` + (len > 0 ? ` · ${emFmtDist(len)}` : '');
}

function emUpdateDrawPreview() {
  if (!emDrawing || emDrawPoints.length < 2) return;
  const L = window.L;
  if (emDrawLayer) { emMap.removeLayer(emDrawLayer); }
  const opts = {...emGetStyleOpts(), dashArray:'6 4', opacity:0.6};
  emDrawLayer = (emCurrentTool === 'polyline' ? L.polyline(emDrawPoints, opts) : L.polygon(emDrawPoints, opts)).addTo(emMap);
}

export function emFinishDraw() {
  const L = window.L;
  if (emDrawLayer) { emMap.removeLayer(emDrawLayer); emDrawLayer = null; }
  if (emDrawPoints.length < 2) { emCancelDraw(); return; }
  const opts = emGetStyleOpts();
  let layer;
  if (emCurrentTool === 'polyline') {
    layer = L.polyline(emDrawPoints, opts);
  } else {
    layer = L.polygon(emDrawPoints, opts);
  }
  emBindErasePopup(layer);
  emAnnotations.addLayer(layer);
  emDrawing = false; emDrawPoints = []; emDrawLayer = null;
  emHideDrawBar();
  emSetStatus('Tracé ajouté · Double-clic sur un élément pour le supprimer');
  emSaveLocal();
}

export function emCancelDraw() {
  if (emDrawLayer) { emMap.removeLayer(emDrawLayer); emDrawLayer = null; }
  emDrawing = false; emDrawPoints = []; emDrawLayer = null;
  emHideDrawBar();
  emSetStatus('Dessin annulé');
}

function emMakeNoteIcon(color, title, note) {
  const L = window.L;
  const c = emSafeColor(color);
  const t = escapeHtml(String(title || '').trim());
  const n = escapeHtml(String(note || '').trim());
  let body = '';
  if (t) body += `<div class="em-postit-title">${t}</div>`;
  if (n) body += `<div class="em-postit-note">${n}</div>`;
  if (!body) body = '<div class="em-postit-empty">(note vide)</div>';
  return L.divIcon({
    html: `<div class="em-postit"><div class="em-postit-bar" style="background:${c}"></div><div class="em-postit-body">${body}</div></div>`,
    iconSize: null, iconAnchor: [10, 8], className: 'em-postit-wrap'
  });
}

function emBindNoteErase(marker) {
  marker.on('click', () => {
    if (emCurrentTool === 'erase') { emAnnotations.removeLayer(marker); emSaveLocal(); emSetStatus('Post-it supprimé'); }
  });
}

function emAddNote(latlng) {
  const title = (prompt('Titre du post-it (court) :', '') || '').trim();
  const note  = (prompt('Détail / note (optionnel) :', '') || '').trim();
  if (!title && !note) return;
  const L = window.L;
  const marker = L.marker(latlng, { icon: emMakeNoteIcon(emCurrentColor, title, note), draggable: true });
  emBindNoteErase(marker);
  marker._emData = { type: 'note', color: emCurrentColor, title, note };
  emAnnotations.addLayer(marker);
  emSaveLocal();
  emSetStatus('Post-it ajouté');
}

function emLabelTextColor(bg) {
  bg = emSafeColor(bg, '#e63946');
  const r=parseInt(bg.slice(1,3),16), g=parseInt(bg.slice(3,5),16), b=parseInt(bg.slice(5,7),16);
  return (0.299*r+0.587*g+0.114*b) > 150 ? '#000' : '#fff';
}

function emAddCircle(center, radius) {
  const L = window.L;
  const layer = L.circle(center, {radius, ...emGetStyleOpts(0.15)});
  emBindErasePopup(layer);
  emAnnotations.addLayer(layer);
  emSaveLocal();
}

function emBindErasePopup(layer) {
  layer.on('click', e => {
    if (emCurrentTool === 'erase') {
      window.L.DomEvent.stopPropagation(e);
      emAnnotations.removeLayer(layer);
      emSaveLocal();
      return;
    }
    window.L.DomEvent.stopPropagation(e);
    const popup = window.L.popup()
      .setLatLng(e.latlng)
      .setContent(`<button class="em-popup-btn" style="background:#c0392b" onclick="emAnnotations.removeLayer(${emAnnotations.getLayerId(layer)});emSaveLocal();emMap.closePopup()">🗑 Supprimer</button>`)
      .openOn(emMap);
  });
}

export function emSetTool(tool) {
  if (emDrawing) emCancelDraw();
  emCircleCenter = null;
  if (emCirclePreview) { emMap.removeLayer(emCirclePreview); emCirclePreview = null; }
  emHideDrawBar();
  emCurrentTool = tool;
  document.querySelectorAll('.em-btn[id^="em-tool-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`em-tool-${tool}`);
  if (btn) btn.classList.add('active');
  if (emMap && emMap.doubleClickZoom) {
    if (tool === 'polyline' || tool === 'polygon') emMap.doubleClickZoom.disable();
    else emMap.doubleClickZoom.enable();
  }
  const labels = {
    select:'Sélection / Déplacer', note:'Post-it (cliquez sur la carte)',
    polyline:'Tracé : cliquez pour ajouter des points · double-clic ou Entrée pour terminer',
    polygon:'Zone : cliquez pour ajouter des sommets · double-clic ou Entrée pour terminer',
    circle:'Cercle : clic = centre, puis clic = rayon', erase:'Suppression (cliquer sur un élément)'
  };
  emSetStatus(`Outil : ${labels[tool] || tool}`);
  if (emMap) emMap.getContainer().style.cursor = tool === 'select' ? '' : 'crosshair';
}

export function emSetColor(color) {
  emCurrentColor = color;
  document.querySelectorAll('.em-color-btn').forEach(b => b.classList.remove('active'));
  const id = {
    '#e63946':'emc-red','#FF7F00':'emc-orange','#2196F3':'emc-blue',
    '#4CAF50':'emc-green','#9C27B0':'emc-purple','#F5F5F5':'emc-white'
  }[color];
  if (id) document.getElementById(id)?.classList.add('active');
}

export function emSetLayer(name) {
  Object.values(emBaseLayers).forEach(l => { if (emMap.hasLayer(l)) emMap.removeLayer(l); });
  emBaseLayers[name]?.addTo(emMap);
  emCurrentBase = name;
}

export function emToggleStations() {
  emShowStations = !emShowStations;
  const btn = document.getElementById('em-btn-sta');
  if (btn) btn.classList.toggle('active', emShowStations);
  emRefreshStations();
}

export function emSetStatus(msg) {
  const el = document.getElementById('em-status');
  if (el) el.textContent = msg;
}

export function emClearConfirm() {
  if (confirm('Effacer toutes les annotations de la carte ?')) {
    emAnnotations.clearLayers();
    emSaveLocal();
    emSetStatus('Carte effacée');
  }
}

export function emAddTimestamp() {
  const L = window.L;
  const now = new Date();
  const txt = `Situation du ${fmtDate(now,{day:'2-digit',month:'2-digit',year:'numeric'})} ${fmtTime(now)}`;
  const center = emMap.getCenter();
  const icon = L.divIcon({
    html:`<div style="background:rgba(26,35,50,0.85);color:#fff;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;font-family:sans-serif;border:1px solid rgba(255,255,255,.3)">${txt}</div>`,
    iconAnchor:[0,10], className:''
  });
  const marker = L.marker(center, {icon, draggable:true});
  marker._emData = {type:'label', color:'#1a2332', text:txt};
  emAnnotations.addLayer(marker);
  emSaveLocal();
  toast('Horodatage ajouté : ' + txt);
}

export function emPrint() {
  emMap.invalidateSize();
  setTimeout(() => window.print(), 150);
}

export function emExportGeoJSON() {
  const features = [];
  emAnnotations.eachLayer(layer => {
    try {
      const gj = layer.toGeoJSON ? layer.toGeoJSON() : null;
      if (gj) {
        gj.properties = { ...(gj.properties || {}), ...(layer._emData || {}), color: emCurrentColor };
        if (layer._emData?.color) gj.properties.color = layer._emData.color;
        if (typeof layer.getRadius === 'function') {
          gj.properties.type   = 'circle';
          gj.properties.radius = layer.getRadius();
        }
        features.push(gj);
      }
    } catch(e) {}
  });
  const geojson = {type:'FeatureCollection', features, metadata:{date:new Date().toISOString(), source:'Suivi stations Côtes-d\'Armor 22', version:'1.0'}};
  const blob = new Blob([JSON.stringify(geojson, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `etatmajor_${new Date().toISOString().slice(0,10)}.geojson`;
  a.click();
  toast(`${features.length} annotation(s) exportée(s)`);
}

export function emImportGeoJSON(event) {
  const L = window.L;
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const geojson = JSON.parse(e.target.result);
      let count = 0;
      L.geoJSON(geojson, {
        style: f => ({color:emSafeColor(f.properties?.color), weight:3, opacity:0.9, fillColor:emSafeColor(f.properties?.color), fillOpacity:0.2}),
        pointToLayer: (f, latlng) => {
          const color = emSafeColor(f.properties?.color);
          if (f.properties?.type === 'note') return L.marker(latlng, {icon:emMakeNoteIcon(color, f.properties?.title, f.properties?.note), draggable:true});
          if (f.properties?.type === 'label') {
            const txt = escapeHtml(f.properties?.text || '?');
            const icon = L.divIcon({html:`<div style="background:${color};color:${emLabelTextColor(color)};padding:3px 8px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;font-family:sans-serif">${txt}</div>`, iconAnchor:[0,10], className:''});
            return L.marker(latlng, {icon, draggable:true});
          }
          if (f.properties?.type === 'circle' && f.properties?.radius) {
            const style = emGetStyleOpts(0.15);
            style.color = color; style.fillColor = color;
            return L.circle(latlng, {radius:f.properties.radius, ...style});
          }
          return L.marker(latlng, {icon:emMakeIcon(color, f.properties?.label||''), draggable:true});
        },
        onEachFeature: (f, layer) => {
          layer._emData = f.properties || {};
          if (f.properties?.type === 'note' || f.properties?.type === 'label') emBindNoteErase(layer);
          else emBindErasePopup(layer);
          emAnnotations.addLayer(layer);
          count++;
        }
      });
      emSaveLocal();
      toast(`${count} annotation(s) importée(s)`);
    } catch(err) { toast('Erreur d\'import : fichier GeoJSON invalide'); }
    event.target.value = '';
  };
  reader.readAsText(file);
}

export function emSaveLocal() {
  try {
    const features = [];
    emAnnotations.eachLayer(layer => {
      try {
        const gj = layer.toGeoJSON ? layer.toGeoJSON() : null;
        if (gj) {
          gj.properties = {...(gj.properties||{}), ...(layer._emData||{})};
          if (layer._emData?.color) gj.properties.color = layer._emData.color;
          if (typeof layer.getRadius === 'function') {
            gj.properties.type   = 'circle';
            gj.properties.radius = layer.getRadius();
          }
          features.push(gj);
        }
      } catch(e) {}
    });
    EM_MEMORY = JSON.stringify({type:'FeatureCollection', features});
    toast('Annotations sauvegardées pour cette session');
  } catch(e) {}
}

function emLoadLocal() {
  const L = window.L;
  try {
    const raw = EM_MEMORY;
    if (!raw) return;
    const geojson = JSON.parse(raw);
    L.geoJSON(geojson, {
      style: f => ({color:emSafeColor(f.properties?.color), weight:3, opacity:0.9, fillColor:emSafeColor(f.properties?.color), fillOpacity:0.2}),
      pointToLayer: (f, latlng) => {
        const color = emSafeColor(f.properties?.color);
        if (f.properties?.type === 'note') return L.marker(latlng, {icon:emMakeNoteIcon(color, f.properties?.title, f.properties?.note), draggable:true});
        if (f.properties?.type === 'label') {
          const txt = escapeHtml(f.properties?.text || '?');
          const icon = L.divIcon({html:`<div style="background:${color};color:${emLabelTextColor(color)};padding:3px 8px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;font-family:sans-serif">${txt}</div>`, iconAnchor:[0,10], className:''});
          return L.marker(latlng, {icon, draggable:true});
        }
        return L.marker(latlng, {icon:emMakeIcon(color, f.properties?.label||''), draggable:true});
      },
      onEachFeature: (f, layer) => {
        layer._emData = f.properties || {};
        if (f.properties?.type === 'note' || f.properties?.type === 'label') emBindNoteErase(layer);
        else emBindErasePopup(layer);
        emAnnotations.addLayer(layer);
      }
    });
    const n = geojson.features?.length || 0;
    if (n > 0) emSetStatus(`${n} annotation(s) restaurée(s) depuis la sauvegarde`);
  } catch(e) {}
}

// ── Établissements sensibles ──
async function emLoadSensitiveSites() {
  if (emSensitiveData) return emSensitiveData;
  if (emSensitiveLoading) {
    while (emSensitiveLoading) await new Promise(resolve => setTimeout(resolve, 80));
    return emSensitiveData;
  }
  emSensitiveLoading = true;
  emSetStatus('Chargement des établissements sensibles…');
  try {
    emSensitiveData = await getEmSensitiveInline();
    emBuildSensitiveLayers();
    const c = emSensitiveData.meta?.counts || {};
    for (const kind of Object.keys(EM_SENSITIVE_META)) {
      const el = document.getElementById(`em-count-${kind}`);
      if (el && Number.isFinite(+c[kind])) el.textContent = String(c[kind]);
    }
    emSetStatus(`Établissements chargés : ${c.total || 0} points`);
  } catch(e) {
    emSetStatus('Erreur chargement établissements sensibles');
    toast('Impossible de charger les établissements sensibles');
    emSensitiveData = {sites:[], meta:{counts:{total:0}}};
  } finally { emSensitiveLoading = false; }
  return emSensitiveData;
}

function emBuildSensitiveLayers() {
  if (!emSensitiveData?.sites) return;
  const L = window.L;
  for (const kind of Object.keys(EM_SENSITIVE_META)) emSensitiveLayers[kind]?.clearLayers();
  const ftxt = (emSensitiveFilters?.text || '').toLowerCase();
  const fsk  = emSensitiveFilters?.schoolKind || 'all';
  for (const site of emSensitiveData.sites) {
    const kind = site.category;
    if (ftxt && !site.name?.toLowerCase().includes(ftxt) && !site.commune?.toLowerCase().includes(ftxt)) continue;
    if (kind === 'school' && fsk !== 'all') {
      if (fsk === 'none') continue;
      if (fsk === 'college-lycee' && site.kind !== 'Collège' && site.kind !== 'Lycée') continue;
      if (fsk === 'college' && site.kind !== 'Collège') continue;
      if (fsk === 'lycee' && site.kind !== 'Lycée') continue;
    }
    const layer = emSensitiveLayers[kind];
    const meta = EM_SENSITIVE_META[kind];
    if (!layer || !meta || !Number.isFinite(+site.lat) || !Number.isFinite(+site.lon)) continue;
    const badgeColor = emSafeColor(meta.color);
    const icon = L.divIcon({
      html:`<div style="width:26px;height:26px;border-radius:50%;background:${badgeColor};display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.4)" title="${escapeHtml(site.name)}">${escapeHtml(meta.icon)}</div>`,
      className:'', iconSize:[26,26], iconAnchor:[13,13], popupAnchor:[0,-16]
    });
    const marker = L.marker([+site.lat, +site.lon], {icon, keyboard:true, bubblingMouseEvents:false, riseOnHover:true});
    marker.bindPopup(emSensitivePopup(site, meta), {className:''});
    marker.bindTooltip(`${escapeHtml(meta.icon)} ${escapeHtml(site.name)}`, {direction:'top', opacity:.9, sticky:true});
    marker.on('click', e => { if (e?.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); marker.openPopup(); });
    layer.addLayer(marker);
  }
}

function emSensitivePopup(site, meta) {
  const safeColor = emSafeColor(meta.color);
  const address = site.address ? `<div style="margin-top:5px;color:#555">${escapeHtml(site.address)}</div>` : '';
  const details = site.details ? `<div style="margin-top:5px;color:#777;font-size:11px">${escapeHtml(site.details)}</div>` : '';
  const commune = site.commune ? `<div style="color:#666;margin-top:2px">${escapeHtml(site.commune)}</div>` : '';
  return `<div style="font-family:sans-serif;font-size:12px;min-width:210px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
      <span style="width:20px;height:20px;border-radius:50%;background:${safeColor};display:flex;align-items:center;justify-content:center;font-size:12px">${escapeHtml(meta.icon)}</span>
      <strong style="font-size:13px">${escapeHtml(site.name)}</strong>
    </div>
    <div style="color:${safeColor};font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(meta.label)}</div>
    ${commune}${address}${details}
    <div style="margin-top:8px;font-size:10px;color:#999">Source : données publiques</div>
  </div>`;
}

export async function emToggleSensitive(kind) {
  if (!EM_SENSITIVE_META[kind]) return;
  await emLoadSensitiveSites();
  emShowSensitive[kind] = !emShowSensitive[kind];
  const btn = document.getElementById(`em-btn-${kind}`);
  if (btn) btn.classList.toggle('active', emShowSensitive[kind]);
  const layer = emSensitiveLayers[kind];
  if (!layer) return;
  if (emShowSensitive[kind]) layer.addTo(emMap);
  else if (emMap.hasLayer(layer)) emMap.removeLayer(layer);
  const active = Object.entries(emShowSensitive).filter(([,v]) => v).map(([k]) => EM_SENSITIVE_META[k].label);
  emSetStatus(active.length ? `Couches actives : ${active.join(' · ')}` : 'Couches sensibles masquées');
}

export function emApplyFilters() {
  emSensitiveFilters.text = (document.getElementById('em-filter-text')?.value || '').toLowerCase().trim();
  emSensitiveFilters.schoolKind = document.getElementById('em-filter-school-kind')?.value || 'all';
  if (!emSensitiveData?.sites) return;
  emBuildSensitiveLayers();
  for (const [kind, show] of Object.entries(emShowSensitive)) {
    if (!show) continue;
    const layer = emSensitiveLayers[kind];
    if (!layer) continue;
    if (emMap.hasLayer(layer)) emMap.removeLayer(layer);
    layer.addTo(emMap);
  }
}

function emUpdateSensitiveCounts(counts={}) {
  for (const kind of Object.keys(EM_SENSITIVE_META)) {
    const el = document.getElementById(`em-count-${kind}`);
    if (el && Number.isFinite(+counts[kind])) el.textContent = String(counts[kind]);
  }
}

// ── Recherche géocodage ──
let emSearchTimer = null;
let emSearchMarker = null;
const EM_SEARCH_VIEWBOX = '-4.00,49.05,-1.75,47.95';

export function emSearchDebounce(val) {
  clearTimeout(emSearchTimer);
  if (!val.trim()) {
    const r = document.getElementById('em-search-results');
    if (r) { r.innerHTML = ''; r.classList.remove('open'); }
    return;
  }
  emSearchTimer = setTimeout(() => emSearchFetch(val), 350);
}

async function emSearchFetch(query) {
  const res = document.getElementById('em-search-results');
  res.innerHTML = '<div class="em-search-loading">Recherche…</div>';
  res.classList.add('open');
  try {
    const q = encodeURIComponent(`${query}, Côtes-d'Armor, Bretagne, France`);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=7&countrycodes=fr&accept-language=fr&addressdetails=1&viewbox=${EM_SEARCH_VIEWBOX}&bounded=0`;
    const r = await fetch(url);
    const data = await r.json();
    if (!data.length) { res.innerHTML = '<div class="em-search-loading">Aucun résultat trouvé.</div>'; return; }
    res.innerHTML = data.map((item) => {
      const parts = item.display_name.split(', ');
      const main  = parts.slice(0,2).join(', ');
      const detail= parts.slice(2, 5).join(', ');
      const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
      if (isNaN(lat) || isNaN(lon)) return '';
      return `<div class="em-search-result" data-lat="${lat}" data-lon="${lon}" data-label="${escapeHtml(main)}">
        <strong>${escapeHtml(detail || 'Côtes-d\'Armor')}</strong>${escapeHtml(main)}
        <div class="em-search-hint">Cliquer pour centrer la carte</div>
      </div>`;
    }).join('');
    res.querySelectorAll('.em-search-result').forEach(row => {
      row.addEventListener('click', () => emSearchSelect(+row.dataset.lat, +row.dataset.lon, row.dataset.label));
    });
  } catch(e) { res.innerHTML = '<div class="em-search-loading">Erreur de connexion.</div>'; }
}

export async function emSearchGo() {
  const val = document.getElementById('em-search-input')?.value?.trim();
  if (val) await emSearchFetch(val);
}

export function emSearchSelect(lat, lon, label) {
  const L = window.L;
  const latlng = L.latLng(parseFloat(lat), parseFloat(lon));
  emMap.setView(latlng, 14, {animate:true});
  if (emSearchMarker) { emMap.removeLayer(emSearchMarker); emSearchMarker = null; }
  const icon = L.divIcon({
    html:`<div style="position:relative"><div style="width:16px;height:16px;background:#7ec87e;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div><div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);background:#1a2332;color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;white-space:nowrap;font-family:sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3)">${escapeHtml(label)}</div></div>`,
    iconAnchor:[8,8], className:''
  });
  emSearchMarker = L.marker(latlng, {icon}).addTo(emMap);
  const res = document.getElementById('em-search-results');
  if (res) res.classList.remove('open');
  const inp = document.getElementById('em-search-input');
  if (inp) inp.value = label;
}
