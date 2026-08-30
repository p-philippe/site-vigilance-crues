// ── SYNTH — Carte de synthèse et renderSynthese ───────────────────────────

import { ST, CODES, VC, VT, BASSINS, SYNTH_ZONES, POINTS_22, SOL_POINTS, VIGICRUES_GEOJSON } from './config.js';
import { OBS, METEO_DATA, SOL_DATA, FAVORITES } from './state.js';
import { vigi, refValue, refCrues, trendInfo, refBadge, formatSpeed } from './vigi.js';
import { escapeHtml, badge } from './utils.js';
import { solComposite, solColor, nowStrParis } from './meteo.js';

let synthMap = null;
let synthTronconsLayer = null;
let synthMarkersLayer = null;

const VIGI_COLORS = { 0:'#27ae60', 1:'#e6c600', 2:'#FF7F00', 3:'#FF2200' };
const TRONCON_COLORS = { 1:'#e6c600', 2:'#FF7F00', 3:'#FF2200', 4:'#c0392b' };

export function synthMapInit() {
  const L = window.L;
  if (synthMap) return;
  if (!document.getElementById('synth-map')) return;
  synthMap = L.map('synth-map', {zoomControl:true, attributionControl:false}).setView([48.42, -2.72], 8);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {maxZoom:19, subdomains:'abcd'}).addTo(synthMap);
  L.control.attribution({prefix:'© CartoDB · OSM'}).addTo(synthMap);
  synthMarkersLayer = L.layerGroup().addTo(synthMap);

  window.synthMap = synthMap;
  window.synthMapInit = synthMapInit;
}

async function synthUpdateChoropleth() {
  const L = window.L;
  if (!synthMap) return;

  // ── Tronçons Vigicrues officiels ──
  try {
    if (synthTronconsLayer) { synthMap.removeLayer(synthTronconsLayer); synthTronconsLayer = null; }
    const r = await fetch(VIGICRUES_GEOJSON);
    const gj = await r.json();
    const BT22 = new Set(['BT2','BT5','BT7','BT13','BT14','BT15']);
    const nivLabels = {1:'Vert — normal', 2:'Vigilance jaune', 3:'Alerte orange', 4:'Alerte rouge'};
    synthTronconsLayer = L.geoJSON(gj, {
      filter: f => BT22.has(f.properties?.CdEntCru),
      style: f => {
        const niv = f.properties.NivInfViCr || 1;
        const col = niv >= 4 ? '#c0392b' : niv === 3 ? '#FF7F00' : niv === 2 ? '#e6c600' : '#27ae60';
        return { color: col, weight: niv >= 3 ? 5 : niv === 2 ? 4 : 3, opacity: 0.9 };
      },
      onEachFeature: (f, layer) => {
        const p = f.properties;
        const niv = p.NivInfViCr || 1;
        layer.bindTooltip(`<strong>${p.lbentcru || p.CdEntCru}</strong><br>${nivLabels[niv] || ''}`, {className:'synth-tip'});
      }
    }).addTo(synthMap);
  } catch(e) { /* silencieux si hors ligne */ }

  // ── Cercles par station colorés par niveau calculé ──
  synthMarkersLayer.clearLayers();
  for (const code of CODES) {
    const st = ST[code]; if (!st) continue;
    const hm = OBS[code]?.H ? OBS[code].H.val / 1000 : null;
    const v = hm != null ? vigi(code, hm) : -1;
    const col = v >= 0 ? VIGI_COLORS[v] : '#9ea7ad';
    const nom = st.n.replace(' ★','').split('[')[0].trim();
    const circle = L.circleMarker([st.lat, st.lon], {
      radius: v >= 2 ? 9 : v === 1 ? 7 : 5,
      fillColor: col, color: v > 0 ? '#000' : '#666',
      weight: v > 0 ? 1.5 : 0.8,
      fillOpacity: v > 0 ? 0.95 : 0.65,
    });
    circle.bindTooltip(
      `<strong>${nom}</strong><br>${st.c}<br>H = ${hm != null ? hm.toFixed(3)+' m' : '—'}`,
      {direction:'top', className:'synth-tip'}
    );
    circle.on('click', () => window.openMod && window.openMod(code));
    synthMarkersLayer.addLayer(circle);
  }
}

function synthMapUpdate() {
  if (!synthMap) return;
  synthUpdateChoropleth();
}

// ── RENDER SYNTHÈSE ──
export function renderSynthese() {
  // Mettre à jour la carte de synthèse
  synthMapUpdate();

  // Indicateurs globaux
  let nAlert = 0, nMontee = 0;
  const watchStations = [];
  for (const code of CODES) {
    const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null;
    const v = vigi(code, hm);
    if (v > 0) nAlert++;
    const tr = trendInfo(code);
    if (tr.speed != null && tr.speed >= 1) nMontee++;
    if (v > 0 || (tr.speed != null && tr.speed >= 1)) watchStations.push({code, v, speed: tr.speed});
  }
  watchStations.sort((a,b) => (b.v - a.v) || ((b.speed||0) - (a.speed||0)));

  const env = environmentStats();

  // Titre alerte global
  const agTitre = document.getElementById('ag-titre');
  const agSous  = document.getElementById('ag-sous');
  if (agTitre) {
    if (nAlert === 0) {
      agTitre.textContent = '✅ Situation normale';
      agTitre.style.color = '#00A000';
      if (agSous) agSous.textContent = 'Aucune station en vigilance — cours d\'eau sous les seuils d\'alerte';
    } else {
      const highest = watchStations[0];
      const vLabels = {1:'Vigilance jaune',2:'Alerte orange',3:'Alerte rouge'};
      agTitre.textContent = `⚠ ${nAlert} station${nAlert>1?'s':''} en vigilance`;
      agTitre.style.color = ['#e6c600','#FF7F00','#FF2200'][Math.max(0,(highest?.v||1)-1)];
      if (agSous) {
        const top3 = watchStations.slice(0,3).map(ws => ST[ws.code]?.n?.replace(' ★','').split('[')[0].trim()).join(', ');
        agSous.textContent = `Stations prioritaires : ${top3}`;
      }
    }
  }

  // KPIs synthèse
  const hydroVal = document.getElementById('sk-hydro-val');
  const hydroSub = document.getElementById('sk-hydro-sub');
  if (hydroVal) hydroVal.textContent = nAlert + ' en alerte';
  if (hydroSub) hydroSub.textContent = nMontee + ' en hausse · ' + CODES.length + ' stations';

  const meteoVal = document.getElementById('sk-meteo-val');
  const meteoSub = document.getElementById('sk-meteo-sub');
  if (meteoVal) {
    const rain24 = env.maxFut24;
    if (rain24 >= 20) { meteoVal.textContent = rain24.toFixed(0) + ' mm/24h'; meteoVal.style.color = '#c0392b'; }
    else if (rain24 >= 10) { meteoVal.textContent = rain24.toFixed(0) + ' mm/24h'; meteoVal.style.color = '#e67e22'; }
    else { meteoVal.textContent = rain24 > 0 ? rain24.toFixed(0) + ' mm/24h' : 'Sec'; meteoVal.style.color = '#27ae60'; }
  }
  if (meteoSub && env.maxFut24 > 0) meteoSub.textContent = 'Cumul 24h prévu max';

  const solVal = document.getElementById('sk-sol-val');
  const solSub = document.getElementById('sk-sol-sub');
  if (solVal) {
    const sat = env.maxSat;
    const col = sat >= 90 ? '#c0392b' : sat >= 75 ? '#e67e22' : sat >= 60 ? '#e6c600' : '#27ae60';
    solVal.textContent = sat ? Math.round(sat) + '%' : '—';
    solVal.style.color = col;
    if (solSub) solSub.textContent = sat ? `${env.maxSatNom} le plus saturé` : 'Chargement…';
  }

  // Render sub-composants
  renderBasinScores(env);
  renderBriefings(env, nAlert, nMontee, watchStations);
  renderFavorites();
  renderWatchStations(watchStations);
  renderConvergence(env, nAlert, nMontee, watchStations);
}

function basinRiskScore(bv, env) {
  let maxV = -1, maxPctHist = 0, maxSpeed = 0, active = 0, n = 0;
  for (const {code} of bv.stations) {
    const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null;
    if (hm == null) continue;
    n++;
    const v = vigi(code, hm);
    maxV = Math.max(maxV, v);
    if (v > 0) active++;
    maxPctHist = Math.max(maxPctHist, hm / refValue(code, 's1') * 100);
    const tr = trendInfo(code);
    if (tr.speed != null) maxSpeed = Math.max(maxSpeed, tr.speed);
  }
  const hydro = maxV >= 3 ? 55 : maxV === 2 ? 42 : maxV === 1 ? 28 : Math.min(24, maxPctHist / 4);
  const trend = Math.max(0, Math.min(18, maxSpeed * 4));
  const rain = Math.min(14, env.maxFut24 * 0.7);
  const soil = env.maxSat >= 80 ? 8 : env.maxSat >= 65 ? 5 : env.maxSat >= 50 ? 2 : 0;
  const score = Math.round(Math.min(100, hydro + trend + rain + soil));
  return {score, maxV, active, n, maxSpeed, maxPctHist};
}

function renderBasinScores(env) {
  const grid = document.getElementById('basin-score-grid');
  if (!grid) return;
  const items = BASSINS.map(bv => ({bv, ...basinRiskScore(bv, env)})).sort((a,b) => b.score - a.score).slice(0,8);
  grid.innerHTML = items.map(item => {
    const label = item.score >= 70 ? 'Risque fort' : item.score >= 45 ? 'À surveiller' : item.score >= 25 ? 'Modéré' : 'Calme';
    const color = item.score >= 70 ? '#FF0000' : item.score >= 45 ? '#FF7F00' : item.score >= 25 ? '#FFFF00' : '#00A000';
    const textColor = item.score >= 25 && item.score < 45 ? '#333' : color;
    return `<div class="basin-score-card" onclick="switchTab(5);BV_OPEN.add('${escapeHtml(item.bv.id)}');renderBassins()">
      <div class="basin-score-title"><span>${escapeHtml(item.bv.nom)}</span><span style="color:${textColor}">${label}</span></div>
      <div class="basin-score-val">${item.score}</div>
      <div class="basin-score-sub">${item.active}/${item.n || item.bv.stations.length} station(s) en vigilance · tendance max ${formatSpeed(item.maxSpeed)}</div>
      <div class="basin-score-bar"><div class="basin-score-fill" style="width:${item.score}%"></div></div>
    </div>`;
  }).join('');
}

function renderBriefings(env, nAlert, nMontee, watchStations) {
  const top = watchStations.slice(0,3).map(ws => ST[ws.code]?.n?.replace(' ★','').split('[')[0].trim()).filter(Boolean).join(', ') || 'aucune station prioritaire';
  const rain = env.maxFut24 ? `${env.maxFut24.toFixed(0)} mm/24h prévus` : 'météo à charger';
  const soil = env.maxSat ? `sols max ${Math.round(env.maxSat)}% (${env.maxSatNom})` : 'sols à charger';
  const score = Math.min(100, Math.round(nAlert*12 + nMontee*3 + env.maxFut24*1.2 + Math.max(0,env.maxSat-60)*0.5));
  const color = score >= 70 ? '#FF0000' : score >= 45 ? '#FF7F00' : score >= 25 ? '#FFFF00' : '#00A000';
  const scoreTextColor = score >= 25 && score < 45 ? '#333' : color;
  const morning = document.getElementById('brief-morning');
  const evening = document.getElementById('brief-evening');
  if (morning) morning.innerHTML = `Priorité : ${escapeHtml(top)}. <br> ${escapeHtml(rain)} · ${escapeHtml(soil)}. <br> À contrôler : stations en hausse et bassins avec score > 45.`;
  if (evening) evening.innerHTML = `Bilan : ${nAlert} station(s) en vigilance, ${nMontee} en hausse. <br> ${escapeHtml(rain)}. <br> Préparer surveillance nuit si pluie + sols humides.`;
  ['brief-morning-score','brief-evening-score'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = score; el.style.color = scoreTextColor; }
  });
}

function renderWatchStations(watchStations) {
  const body  = document.getElementById('watch-body');
  const count = document.getElementById('watch-count');
  const ts    = document.getElementById('watch-ts');
  if (!body) return;

  if (!watchStations.length) {
    body.innerHTML = '<div class="watch-empty">✅ Aucune station sous surveillance — situation normale</div>';
    if (count) count.textContent = '';
    if (ts) ts.textContent = new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    return;
  }

  if (count) count.textContent = `(${watchStations.length})`;
  if (ts) ts.textContent = new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});

  const vLabels = {'-1':'—', '0':'Normal', '1':'Jaune', '2':'Orange', '3':'Rouge'};
  const vColors = {'-1':'#9ea7ad', '0':'#00A000', '1':'#e6c600', '2':'#FF7F00', '3':'#FF2200'};

  body.innerHTML = `<table class="watch-table">
    <thead><tr>
      <th>Station</th><th>H (m)</th><th>% S1</th><th>Tend.</th><th>Vitesse</th><th>Vigilance</th>
    </tr></thead>
    <tbody>${watchStations.map(({code, v, speed}) => {
      const st  = ST[code]; if (!st) return '';
      const hm  = OBS[code]?.H ? OBS[code].H.val / 1000 : null;
      const s1  = refValue(code, 's1');
      const pct = hm != null && s1 ? Math.round(hm / s1 * 100) : null;
      const tr  = trendInfo(code);
      const col = vColors[String(v)] || vColors['-1'];
      const nom = st.n.replace(' ★','').split('[')[0].trim();
      return `<tr onclick="openMod('${escapeHtml(code)}')" style="cursor:pointer">
        <td><div class="wt-station">${escapeHtml(nom)}</div><div class="wt-cours">${escapeHtml(st.c)}</div></td>
        <td class="wt-h">${hm != null ? hm.toFixed(3) : '—'}</td>
        <td><span class="wt-pct">${pct != null ? pct + '%' : '—'}</span></td>
        <td class="wt-tend" style="color:${tr.cls==='trend-up'?'#c0392b':tr.cls==='trend-down'?'#27ae60':'var(--text3)'}">${tr.icon}</td>
        <td class="wt-speed" style="color:${speed>=2?'#c0392b':speed>=1?'#e67e22':'var(--text3)'}">${formatSpeed(speed)}</td>
        <td><span style="font-size:11px;font-weight:700;color:${col}">${vLabels[String(v)]}</span></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function renderConvergence(env, nAlert, nMontee, watchStations) {
  const list = document.getElementById('conv-list');
  if (!list) return;

  const items = [];

  // 1. Sols saturés + Précipitations prévues
  if (env.maxSat >= 75 && env.maxFut24 >= 10) {
    const cls = env.maxSat >= 90 && env.maxFut24 >= 20 ? 'ci-high' : 'ci-danger';
    items.push({cls, icon:'🌧️', text:`<strong>Ruissellement fort probable</strong> — sols à ${Math.round(env.maxSat)}% (${escapeHtml(env.maxSatNom)}) + ${env.maxFut24.toFixed(0)} mm prévus en 24h. Les cours d'eau peuvent monter rapidement.`});
  } else if (env.maxSat >= 60 && env.maxFut24 >= 15) {
    items.push({cls:'ci-warn', icon:'🌱', text:`<strong>Sols moyennement saturés</strong> (${Math.round(env.maxSat)}%) avec ${env.maxFut24.toFixed(0)} mm prévus — surveiller les bassins versants.`});
  }

  // 2. Plusieurs stations en montée rapide
  const rapidRise = watchStations.filter(ws => (ws.speed || 0) >= 2);
  if (rapidRise.length >= 2) {
    const noms = rapidRise.slice(0,3).map(ws => ST[ws.code]?.n?.replace(' ★','').split('[')[0].trim()).join(', ');
    items.push({cls:'ci-danger', icon:'📈', text:`<strong>Montées rapides simultanées</strong> sur ${rapidRise.length} stations : ${escapeHtml(noms)}. Risque de franchissement de seuils dans les prochaines heures.`});
  } else if (nMontee >= 3) {
    items.push({cls:'ci-warn', icon:'↗', text:`<strong>${nMontee} stations en hausse</strong> simultanément — possible épisode en développement.`});
  }

  // 3. Propagation active (arcs oust confiance 1.0)
  const activeArcs = window.PROP_ACTIVE_ARCS || [];
  if (activeArcs.length > 0) {
    const arcTxt = activeArcs.map(a => `${escapeHtml(a.riviere)} : front attendu à l'aval dans ~${a.transit_h}h`).join(' · ');
    items.push({cls:'ci-danger', icon:'⬇', text:`<strong>Propagation amont→aval détectée</strong> — ${arcTxt}.`});
  }

  // 4. Situation calme
  if (!items.length) {
    items.push({cls:'ci-ok', icon:'✅', text:`<strong>Aucune convergence détectée</strong> — les facteurs de risque (hydro, météo, sols) ne se cumulent pas actuellement.`});
  }

  list.innerHTML = items.map(({cls, icon, text}) =>
    `<div class="conv-item ${cls}"><span class="conv-icon">${icon}</span><span class="conv-text">${text}</span></div>`
  ).join('');
}

function renderFavorites() {
  const grid = document.getElementById('fav-grid');
  if (!grid) return;
  const favs = [...FAVORITES].filter(code => ST[code]);
  if (!favs.length) {
    grid.innerHTML = '<div class="watch-empty">Aucune station favorite pour cette session. Utilise les étoiles dans le tableau Stations.</div>';
    return;
  }
  grid.innerHTML = favs.map(code => {
    const st = ST[code];
    const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null;
    const v = vigi(code, hm);
    const tr = trendInfo(code);
    const pctS1 = hm != null ? Math.round(hm / refValue(code,'s1') * 100) : null;
    const nom = st.n.replace(' ★','').split('[')[0].trim();
    return `<div class="fav-card" onclick="openMod('${code}')">
      <div class="fav-title"><span>${escapeHtml(nom)}</span>${badge(v,false)}</div>
      <div class="fav-lines">
        <strong>${hm!=null?hm.toFixed(3)+' m':'—'}</strong> · ${refBadge(code,'s1',true)} ${pctS1!=null?pctS1+'%':'—'}<br>
        <span class="${tr.cls}">${tr.icon} ${formatSpeed(tr.speed)}</span> · ${escapeHtml(st.c)}
      </div>
      <div class="fav-meta">${code}</div>
    </div>`;
  }).join('');
}

function environmentStats() {
  const stats = {maxPast24:0, maxFut6:0, maxFut24:0, maxSat:0, maxSatNom:''};
  if (METEO_DATA) {
    const nowStr = nowStrParis();
    METEO_DATA.forEach(d => {
      const h = d.hourly;
      if (!h?.time) return;
      const ni = h.time.findIndex(t => t >= nowStr);
      if (ni < 0) return;
      stats.maxPast24 = Math.max(stats.maxPast24, h.precipitation.slice(Math.max(0,ni-24), ni).reduce((a,b)=>a+(b||0),0));
      stats.maxFut6 = Math.max(stats.maxFut6, h.precipitation.slice(ni, ni+6).reduce((a,b)=>a+(b||0),0));
      stats.maxFut24 = Math.max(stats.maxFut24, h.precipitation.slice(ni, ni+24).reduce((a,b)=>a+(b||0),0));
    });
  }
  if (SOL_DATA) {
    const nowStr = nowStrParis();
    SOL_DATA.forEach((d, i) => {
      const h = d.hourly;
      if (!h?.time) return;
      const ni = h.time.findIndex(t => t >= nowStr);
      const idx = ni >= 0 ? ni : h.time.length - 1;
      const pct = solComposite(h, idx);
      if (pct > stats.maxSat) { stats.maxSat = pct; stats.maxSatNom = SOL_POINTS[i].nom; }
    });
  }
  return stats;
}

// Exposer renderSynthese sur window
window.renderSynthese = renderSynthese;
window.synthMapInit = synthMapInit;
