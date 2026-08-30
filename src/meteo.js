// ── METEO — Météo et saturation des sols ──────────────────────────────────

import { POINTS_22, SOL_POINTS, SOL_LAYERS, SOL_THETA_WP, SOL_THETA_SAT, SOL_THETA_FC, WEATHER_ICONS } from './config.js';
import { METEO_DATA, SOL_DATA } from './state.js';

import { escapeHtml, fmtDate } from './utils.js';

let meteoCharts = [];
let solCharts = [];

/** "Maintenant" formaté comme les séries horaires Open-Meteo (timezone=Europe/Paris, ex: "2026-08-20T20") */
export function nowStrParis() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}`;
}

/**
 * Dépression atmosphérique en cours sur le département — signal qualitatif de risque de
 * surcote côtière (effet baromètre inverse : basse pression = niveau de la mer plus élevé).
 * Ne calcule pas de cote chiffrée (voir historique v6.4/v6.5 — jugé peu fiable), seulement
 * un niveau de vigilance à croiser avec le coefficient de marée.
 */
export function pressureAlert() {
  if (!METEO_DATA) return { min: null, nom: '', level: 'none' };
  const nowStr = nowStrParis();
  let min = null, nom = '';
  METEO_DATA.forEach((d, i) => {
    const h = d.hourly;
    if (!h?.time || !h.pressure_msl) return;
    const idx = h.time.findIndex(t => t >= nowStr);
    const p = idx >= 0 ? h.pressure_msl[idx] : null;
    if (p != null && (min == null || p < min)) { min = p; nom = POINTS_22[i]?.nom || ''; }
  });
  const level = min == null ? 'none' : min < 990 ? 'strong' : min < 1000 ? 'moderate' : 'none';
  return { min, nom, level };
}

// Trait vertical marquant l'heure actuelle sur les graphiques météo (remplace l'ancien ▼ dans les ticks)
const nowLinePlugin = {
  id: 'nowLine',
  afterDraw(chart) {
    const idx = chart.$nowIdx;
    if (idx == null) return;
    const xScale = chart.scales.x, yScale = chart.scales.y;
    const x = xScale.getPixelForValue(idx);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(192,57,43,0.85)';
    ctx.setLineDash([4,3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, yScale.top);
    ctx.lineTo(x, yScale.bottom);
    ctx.stroke();
    ctx.restore();
  }
};

// ── HELPERS PLUIE ──
export function rainClass(mm) {
  if (mm == null || mm === 0) return '';
  if (mm >= 20) return 'alert';
  if (mm >= 10) return 'warn';
  return 'rain';
}

// ── RENDER MÉTÉO ──
export function renderMeteo() {
  if (!METEO_DATA) return;
  meteoCharts.forEach(c => { try { c.destroy(); } catch(e){} });
  meteoCharts = [];

  const nowStr = nowStrParis();

  let maxCumul48 = 0, alertPoint = '';
  METEO_DATA.forEach((d, i) => {
    const h = d.hourly;
    if (!h?.time) return;
    const future = h.time.map((t,j) => t >= nowStr ? h.precipitation[j] : 0);
    const sum48 = future.slice(0, 48).reduce((a,b) => a + (b||0), 0);
    if (sum48 > maxCumul48) { maxCumul48 = sum48; alertPoint = POINTS_22[i].nom; }
  });
  const alertBox = document.getElementById('meteo-alert');
  const alertText = document.getElementById('meteo-alert-text');
  if (alertBox && alertText) {
    if (maxCumul48 >= 30) {
      alertBox.classList.add('visible');
      alertText.innerHTML = `<strong>Cumul important prévu sur 48h :</strong> jusqu'à <strong>${maxCumul48.toFixed(0)} mm</strong> attendus près de ${escapeHtml(alertPoint)}. Surveiller l'évolution des hauteurs d'eau.`;
    } else {
      alertBox.classList.remove('visible');
    }
  }

  const grid = document.getElementById('meteo-grid');
  if (!grid) return;
  grid.innerHTML = '';

  METEO_DATA.forEach((d, i) => {
    const pt = POINTS_22[i];
    const h = d.hourly;
    if (!h?.time) return;
    const nowIdx = h.time.findIndex(t => t >= nowStr);
    const safeNow = nowIdx >= 0 ? nowIdx : h.time.length - 1;
    const past12 = h.precipitation.slice(Math.max(0, safeNow - 12), safeNow).reduce((a, b) => a + (b || 0), 0);
    const fut24 = h.precipitation.slice(safeNow, safeNow+24).reduce((a,b)=>a+(b||0),0);
    const currRain = h.precipitation[safeNow] || 0;
    const currWc = h.weather_code ? (h.weather_code[safeNow] || 0) : 0;
    const currIcon = WEATHER_ICONS[currWc] || '🌡️';
    const chartSlice = h.time.slice(Math.max(0, safeNow-12), safeNow+25);
    const chartPrecip = h.precipitation.slice(Math.max(0, safeNow-12), safeNow+25);
    const chartProb = (h.precipitation_probability || []).slice(Math.max(0, safeNow-12), safeNow+25);
    const nowChartIdx = Math.min(12, safeNow);
    const chartLabels = chartSlice.map(t => t.slice(11,13)+'h');
    const skip = Math.max(1, Math.floor(chartLabels.length/8));
    const displayLabels = chartLabels.map((l,j)=>j%skip===0?l:'');
    const barColors = chartSlice.map((t,j) =>
      t < nowStr ? 'rgba(150,180,200,0.6)' :
      (chartPrecip[j]||0) >= 10 ? 'rgba(231,76,60,0.8)' :
      (chartPrecip[j]||0) >= 5  ? 'rgba(230,126,34,0.8)' :
      'rgba(41,128,185,0.75)'
    );
    const cardId = `mc-${pt.id}`;
    const div = document.createElement('div');
    div.className = 'meteo-card';
    div.innerHTML = `
      <div class="meteo-card-hdr">
        <span class="mc-icon">${currIcon}</span>
        <div><div class="mc-title">${pt.nom}</div><div class="mc-sub">${pt.zone}</div></div>
      </div>
      <div class="meteo-summary">
        <div class="meteo-kpi">
          <div class="meteo-kpi-l">Pluie actuelle</div>
          <div class="meteo-kpi-v ${rainClass(currRain)}">${currRain.toFixed(1)}<span style="font-size:12px;font-weight:400"> mm/h</span></div>
        </div>
        <div class="meteo-kpi">
          <div class="meteo-kpi-l">Cumul 12h passées</div>
          <div class="meteo-kpi-v ${rainClass(past12)}">${past12.toFixed(1)}<span style="font-size:12px;font-weight:400"> mm</span></div>
        </div>
      </div>
      <div class="meteo-summary" style="border-bottom:none">
        <div class="meteo-kpi">
          <div class="meteo-kpi-l">Prévu 24h</div>
          <div class="meteo-kpi-v ${rainClass(fut24)}">${fut24.toFixed(1)}<span style="font-size:12px;font-weight:400"> mm</span></div>
        </div>
        <div class="meteo-kpi">
          <div class="meteo-kpi-l">Lat / Lon</div>
          <div style="font-size:11px;font-family:var(--mono);color:var(--text3);margin-top:4px">${pt.lat}°N ${Math.abs(pt.lon)}°O</div>
        </div>
      </div>
      <div class="meteo-chart-wrap">
        <div class="meteo-chart-title">Précipitations horaires — 12h passées + 24h prévisions (mm/h)</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 6px;font-size:10px;color:var(--text3)">
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(150,180,200,0.6)"></span>Passé mesuré</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(41,128,185,0.75)"></span>Prévu faible (&lt;5 mm/h)</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(230,126,34,0.8)"></span>Prévu modéré (≥5 mm/h)</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:rgba(231,76,60,0.8)"></span>Prévu fort (≥10 mm/h)</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:28px;height:2px;background:rgba(155,89,182,0.7);border-radius:1px"></span>Probabilité de pluie</span>
        </div>
        <div class="meteo-chart-container"><canvas id="${cardId}"></canvas></div>
      </div>`;
    grid.appendChild(div);

    const ctx = document.getElementById(cardId);
    if (ctx) {
      const gc = matchMedia('(prefers-color-scheme:dark)').matches ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
      const chart = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: displayLabels,
          datasets: [
            { label:'Précip (mm/h)', data:chartPrecip.map(v=>v||0), backgroundColor:barColors, borderRadius:2, order:1 },
            ...(chartProb.some(v=>v!=null) ? [{
              label:'Prob (%)', data:chartProb.map(v => v!=null ? v/100*Math.max(...chartPrecip.map(v=>v||0), 1) : null),
              type:'line', borderColor:'rgba(155,89,182,0.7)', borderWidth:1.5, pointRadius:0, fill:false, tension:0.3, order:0, yAxisID:'y'
            }] : [])
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins: {
            legend:{display:false},
            tooltip:{callbacks:{
              title:items=>chartSlice[items[0].dataIndex]+' UTC',
              label:ctx2=>`${ctx2.dataset.label}: ${ctx2.raw!=null?(typeof ctx2.raw==='number'?ctx2.raw.toFixed(1):ctx2.raw):'—'}`
            }}
          },
          scales: {
            x:{ticks:{color:'#8a9b8a',font:{size:8},maxRotation:0}, grid:{color:gc}},
            y:{ticks:{color:'#8a9b8a',font:{size:9},callback:v=>v.toFixed(1)}, grid:{color:gc}, beginAtZero:true}
          }
        },
        plugins: [nowLinePlugin]
      });
      chart.$nowIdx = nowChartIdx;
      chart.update('none');
      meteoCharts.push(chart);
    }
  });

  renderDailyMeteo();
}

export function renderDailyMeteo() {
  if (!METEO_DATA) return;
  const dgrid = document.getElementById('daily-grid');
  if (!dgrid) return;

  const days = METEO_DATA[0]?.daily?.time || [];
  if (!days.length) { dgrid.innerHTML = '<div class="meteo-loading">Données journalières indisponibles</div>'; return; }

  dgrid.innerHTML = '';
  days.forEach((day, di) => {
    let maxRain = 0, maxProb = 0;
    METEO_DATA.forEach(d => {
      const rain = d.daily?.precipitation_sum?.[di] || 0;
      const prob = d.daily?.precipitation_probability_max?.[di] || 0;
      if (rain > maxRain) maxRain = rain;
      if (prob > maxProb) maxProb = prob;
    });
    const dateObj = new Date(day + 'T12:00:00Z');
    const dayLabel = fmtDate(dateObj,{weekday:'short',day:'2-digit',month:'short'});
    const rc = rainClass(maxRain);
    const icon = maxRain >= 20 ? '⛈️' : maxRain >= 10 ? '🌧️' : maxRain >= 3 ? '🌦️' : maxRain > 0 ? '🌤️' : '☀️';
    const card = document.createElement('div');
    card.className = 'daily-card';
    card.innerHTML = `
      <div class="daily-date">${dayLabel}</div>
      <div class="daily-icon">${icon}</div>
      <div class="daily-rain ${rc}">${maxRain.toFixed(1)} mm</div>
      <div class="daily-prob">☔ ${maxProb}% de pluie</div>`;
    dgrid.appendChild(card);
  });

  const cumul48 = days.slice(0,2).reduce((acc, _, di) => {
    const max = Math.max(...METEO_DATA.map(d => d.daily.precipitation_sum?.[di] || 0));
    return acc + max;
  }, 0);

  const impactDiv = document.createElement('div');
  impactDiv.style.cssText = 'grid-column:1/-1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text2)';
  let impactText = '';
  if (cumul48 >= 50) impactText = `⚠️ Cumul 48h estimé <strong>${cumul48.toFixed(0)} mm</strong> — risque de crue significatif. Surveiller toutes les stations.`;
  else if (cumul48 >= 25) impactText = `🟡 Cumul 48h estimé <strong>${cumul48.toFixed(0)} mm</strong> — montée possible sur les petits cours d'eau. Surveillance accrue recommandée.`;
  else if (cumul48 >= 10) impactText = `🟢 Cumul 48h estimé <strong>${cumul48.toFixed(0)} mm</strong> — impact limité sur les cours d'eau dans les conditions actuelles.`;
  else impactText = `🔵 Cumul 48h estimé <strong>${cumul48.toFixed(0)} mm</strong> — aucun impact attendu sur les cours d'eau.`;
  impactDiv.innerHTML = `<strong>Analyse de risque</strong> : ${impactText}`;
  dgrid.appendChild(impactDiv);
}

// ── SATURATION SOLS ──
export function solSatIndex(theta) {
  return Math.min(1, Math.max(0, (theta - SOL_THETA_WP) / (SOL_THETA_SAT - SOL_THETA_WP)));
}

export function solComposite(hourlyData, idx) {
  if (!hourlyData) return 45;
  let comp = 0;
  for (const {key, weight} of SOL_LAYERS) {
    const v = hourlyData[key]?.[idx];
    const theta = v != null ? v : SOL_THETA_FC;
    comp += solSatIndex(theta) * weight;
  }
  return Math.min(100, Math.max(0, comp * 100));
}

export function solColor(pct) {
  if (pct >= 90) return '#c0392b';
  if (pct >= 75) return '#e67e22';
  if (pct >= 60) return '#f0c040';
  if (pct >= 40) return '#b8d460';
  return '#7ec87e';
}

export function solColorClass(pct) {
  if (pct >= 90) return 'sat-sature';
  if (pct >= 75) return 'sat-tres-humide';
  if (pct >= 60) return 'sat-humide';
  if (pct >= 40) return 'sat-normal';
  return 'sat-sec';
}

export function solLabel(pct) {
  if (pct >= 90) return 'Sol saturé — risque de ruissellement maximal';
  if (pct >= 75) return 'Sol très humide — réponse hydrologique rapide';
  if (pct >= 60) return 'Sol humide — susceptible aux crues';
  if (pct >= 40) return 'Sol en bon état hydrique';
  return 'Sol sec — faible risque à court terme';
}

export function renderSol() {
  if (!SOL_DATA) return;
  solCharts.forEach(c => { try { c.destroy(); } catch(e){} });
  solCharts = [];

  const nowStr = nowStrParis();

  const rgrid = document.getElementById('sol-risk-grid');
  if (rgrid) {
    rgrid.innerHTML = SOL_DATA.map((d, i) => {
      const pt = SOL_POINTS[i];
      const h = d.hourly;
      if (!h?.time) return '';
      const nowIdx = h.time.findIndex(t => t >= nowStr);
      const idx = nowIdx >= 0 ? nowIdx : h.time.length-1;
      const pct = solComposite(h, idx);
      const col = solColor(pct);
      const lbl = pct >= 90 ? 'Saturé' : pct >= 75 ? 'Très humide' : pct >= 60 ? 'Humide' : pct >= 40 ? 'Normal' : 'Sec';
      return `<div class="sol-risk-item">
        <div class="sol-risk-nom">${pt.nom}</div>
        <div class="sol-risk-val" style="color:${col}">${Math.round(pct)}%</div>
        <div class="sol-risk-label" style="color:${col};font-size:9px">${lbl}</div>
      </div>`;
    }).join('');
  }

  const grid = document.getElementById('sol-grid');
  if (!grid) return;
  grid.innerHTML = '';

  SOL_DATA.forEach((d, i) => {
    const pt = SOL_POINTS[i];
    const h = d.hourly;
    const daily = d.daily;
    if (!h?.time) return;
    const nowIdx = h.time.findIndex(t => t >= nowStr);
    const idx = nowIdx >= 0 ? nowIdx : h.time.length-1;
    const pct = solComposite(h, idx);
    const col = solColor(pct);
    const cls = solColorClass(pct);
    const lbl = solLabel(pct);
    const pctLight = pct > 50;
    const precip7  = (daily?.precipitation_sum || []).slice(-7).reduce((a,b)=>a+(b||0),0);
    const precip30 = (daily?.precipitation_sum || []).slice(-30).reduce((a,b)=>a+(b||0),0);
    const layerRows = SOL_LAYERS.map(({key, label, weight}) => {
      const v = h[key]?.[idx];
      const theta = v != null ? v : SOL_THETA_FC;
      const layerPct = Math.round(solSatIndex(theta)*100);
      const layerCol = solColor(layerPct);
      return `<div class="sol-layer-row">
        <span class="sol-layer-label">${label}</span>
        <div class="sol-layer-bar"><div class="sol-layer-fill" style="width:${layerPct}%;background:${layerCol}"></div></div>
        <span class="sol-layer-val">${layerPct}%</span>
      </div>`;
    }).join('');

    const dailyIdxs = [];
    let lastDay = '';
    h.time.forEach((t, j) => {
      const day = t.slice(0,10);
      if (day !== lastDay && t.slice(11,13) === '12') { dailyIdxs.push(j); lastDay = day; }
    });
    const chartLabels = dailyIdxs.map(j => h.time[j].slice(5,10));
    const chartVals   = dailyIdxs.map(j => +solComposite(h, j).toFixed(1));
    const chartColors = chartVals.map(v => solColor(v));
    const skip = Math.max(1, Math.floor(chartLabels.length/8));
    const displayLabels = chartLabels.map((l,j)=>j%skip===0?l:'');

    const chartId = `sol-chart-${pt.id}`;
    const div = document.createElement('div');
    div.className = 'sol-card';
    div.innerHTML = `
      <div class="sol-card-hdr">
        <span style="font-size:20px">🌱</span>
        <div><div class="sol-card-nom">${pt.nom}</div><div class="sol-card-zone">${pt.zone} · Bassins : ${pt.bassins.join(', ')}</div></div>
      </div>
      <div class="sol-gauge-wrap">
        <div class="sol-gauge-label">
          <span>Indice de saturation composite</span>
          <span style="font-weight:600;color:${col}">${lbl}</span>
        </div>
        <div class="sol-gauge">
          <div class="sol-gauge-fill ${cls}" style="width:${pct}%">
            <span class="sol-gauge-pct ${pctLight?'light':''}">${Math.round(pct)}%</span>
          </div>
        </div>
        <div class="sol-thresholds">
          <span>0%</span><span>40% sec</span><span>60% normal</span><span>75% humide</span><span>90% saturé</span><span>100%</span>
        </div>
        <div style="font-size:11px;font-weight:600;margin-bottom:8px">Humidité par couche</div>
        <div class="sol-layers">${layerRows}</div>
      </div>
      <div class="sol-kpis">
        <div class="sol-kpi"><div class="sol-kpi-l">Précip. 7 derniers jours</div><div class="sol-kpi-v">${precip7.toFixed(1)}<span style="font-size:11px;font-weight:400"> mm</span></div></div>
        <div class="sol-kpi"><div class="sol-kpi-l">Précip. 30 derniers jours</div><div class="sol-kpi-v">${precip30.toFixed(1)}<span style="font-size:11px;font-weight:400"> mm</span></div></div>
      </div>
      <div class="sol-chart-wrap">
        <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Évolution saturation 30 jours</div>
        <div class="sol-chart-container"><canvas id="${chartId}" role="img" aria-label="Évolution saturation 30j"></canvas></div>
      </div>`;
    grid.appendChild(div);

    const ctx = document.getElementById(chartId);
    if (ctx) {
      const tc = '#8a9b8a';
      const gc = matchMedia('(prefers-color-scheme:dark)').matches ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
      const chart = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: displayLabels,
          datasets: [
            {label:'Saturation (%)', data:chartVals, borderColor:col, backgroundColor:`${col}15`, fill:true, pointRadius:0, tension:0.3, borderWidth:2},
            {label:'Humide 60%', data:Array(chartVals.length).fill(60), borderColor:'#f0c040', borderWidth:1, borderDash:[4,3], pointRadius:0, fill:false},
            {label:'Très humide 75%', data:Array(chartVals.length).fill(75), borderColor:'#e67e22', borderWidth:1, borderDash:[4,3], pointRadius:0, fill:false},
            {label:'Saturé 90%', data:Array(chartVals.length).fill(90), borderColor:'#c0392b', borderWidth:1, borderDash:[4,3], pointRadius:0, fill:false},
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{display:true, position:'top', labels:{boxWidth:10,font:{size:9},color:tc, filter:i=>i.text!=='Saturation (%)'}},
            tooltip:{callbacks:{title:items=>chartLabels[items[0].dataIndex], label:ctx2=>`${ctx2.dataset.label}: ${typeof ctx2.raw==='number'?ctx2.raw.toFixed(1)+'%':ctx2.raw}`}}
          },
          scales:{
            x:{ticks:{color:tc,font:{size:8},maxRotation:0}, grid:{color:gc}},
            y:{min:0, max:100, ticks:{color:tc,font:{size:9},callback:v=>v+'%'}, grid:{color:gc}}
          }
        }
      });
      solCharts.push(chart);
    }
  });
}

// ── NAPPES ──
// Seul reliquat du chapitre nappes (retiré de l'onglet Contexte : signal de
// sécheresse plus que d'inondation) — sert encore à colorer la couche
// piézomètres de la carte état-major.
// Classes calquées sur le vocabulaire des bulletins BRGM : pour le risque crue,
// une nappe haute est le signal d'alerte (rouge/orange), une nappe basse est bleue.
export function nappePctClass(pct) {
  if (pct == null) return { label:'N/D',       color:'#95a5a6', bg:'var(--bg2)' };
  if (pct >= 90)   return { label:'Très haut', color:'#c0392b', bg:'#fdecea' };
  if (pct >= 75)   return { label:'Haut',      color:'#e67e22', bg:'#fff3e6' };
  if (pct >= 25)   return { label:'Normal',    color:'#27ae60', bg:'#f0faf0' };
  if (pct >= 10)   return { label:'Bas',       color:'#5dade2', bg:'#eaf3fb' };
  return             { label:'Très bas',  color:'#2980b9', bg:'#eaf3fb' };
}
