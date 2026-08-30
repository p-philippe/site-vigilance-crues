// ── RENDER — Fonctions de rendu DOM ──────────────────────────────────────

import { ST, CODES, VC, VT, VL, REF_COLORS, REF_TEXT, BASSINS } from './config.js';
import { OBS, HIST, HOURS, HOUR_SLOTS, FAVORITES, METEO_DATA, SOL_DATA, COEFF_DATA } from './state.js';
import { vigi, refCrues, refValue, refLabel, trendInfo } from './vigi.js';
import { fmtTime, fmtDateTime, escapeHtml } from './utils.js';

// ── TABLEAU HISTORIQUE 12H ──
export function renderHist() {
  if (!HOURS.length) return;
  const displayLabels = HOUR_SLOTS.length === HOURS.length
    ? HOUR_SLOTS.map(t => fmtTime(t))
    : HOURS;
  let html = '<thead><tr><th class="th-st">Station / Cours d\'eau</th>';
  for (let i = 0; i < HOURS.length; i++) {
    const isLast = i === HOURS.length - 1;
    html += `<th class="${isLast ? 'th-last' : ''}">${displayLabels[i]}</th>`;
  }
  html += '</tr></thead><tbody>';
  const sorted = CODES.slice().sort((a,b) => ST[a].n.localeCompare(ST[b].n));
  for (const code of sorted) {
    const st = ST[code];
    const nom = st.n.replace(' ★','');
    html += `<tr><td class="td-st"><span class="sn2">${nom}</span><span class="ce2">${st.c}</span></td>`;
    const lastHour = HOURS[HOURS.length - 1];
    const hmCurrent = OBS[code]?.H ? OBS[code].H.val/1000 : null;
    const vCurrent = vigi(code, hmCurrent);
    const clsCurrent = vCurrent===3?'vc3':vCurrent===2?'vc2':vCurrent===1?'vc1':vCurrent===0?'vc0':'';
    for (const h of HOURS) {
      const val = HIST[code]?.[h];
      const isLast = (h === lastHour);
      if (val == null) {
        html += `<td class="null${isLast ? ' last-col' : ''}">—</td>`;
      } else {
        const cls = isLast ? clsCurrent : (vigi(code,val)===3?'vc3':vigi(code,val)===2?'vc2':vigi(code,val)===1?'vc1':vigi(code,val)===0?'vc0':'');
        const style = isLast ? ' style="font-weight:600"' : '';
        html += `<td class="${cls}"${style}>${val.toFixed(3)}</td>`;
      }
    }
    html += '</tr>';
  }
  html += '</tbody>';
  document.getElementById('t12').innerHTML = html;
}

// ── TABLE (alias) ──
export function renderTable() {
  renderBassins();
}

// ── BASSINS VERSANTS ──
export function toggleFav(code) {
  if (FAVORITES.has(code)) FAVORITES.delete(code);
  else FAVORITES.add(code);
  renderBassins();
}

export function toggleFavorite(code) { toggleFav(code); }

export function bvWorstVigi(bassin) {
  let worst = -1;
  for (const {code} of bassin.stations) {
    const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null;
    const v = vigi(code, hm);
    if (v > worst) worst = v;
  }
  return worst;
}

export function bvSpeedColor(speedCmH) {
  if (speedCmH == null) return {text:'—', color:'var(--text3)', bg:'var(--bg)'};
  if (speedCmH >= 3)   return {text:'+'+speedCmH.toFixed(1)+' cm/h ↑↑', color:'#fff', bg:'#c0392b'};
  if (speedCmH >= 1)   return {text:'+'+speedCmH.toFixed(1)+' cm/h ↑',  color:'#333', bg:'#FFFF00'};
  if (speedCmH >= 0.3) return {text:'+'+speedCmH.toFixed(1)+' cm/h',    color:'var(--text2)', bg:'var(--bg)'};
  if (speedCmH <= -1)  return {text:speedCmH.toFixed(1)+' cm/h ↓',      color:'#27ae60', bg:'var(--bg)'};
  return {text:'stable', color:'var(--text3)', bg:'var(--bg)'};
}

const BV_OPEN = new Set();
window.BV_OPEN = BV_OPEN;

export function toggleBV(id) {
  if (BV_OPEN.has(id)) BV_OPEN.delete(id);
  else BV_OPEN.add(id);
  renderBassins();
}

export function renderBassins() {
  const grid = document.getElementById('bv-grid');
  if (!grid) return;

  let nData = 0, nR = 0, nO = 0, nJ = 0;
  for (const code of CODES) {
    const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null;
    if (hm != null) nData++;
    const v = vigi(code, hm);
    if (v === 3)      nR++;
    else if (v === 2) nO++;
    else if (v === 1) nJ++;
  }
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('m-data', nData + ' / ' + CODES.length);
  el('m-r', nR || '—');
  el('m-o', nO || '—');
  el('m-j', nJ || '—');

  let html = '';
  for (const bv of BASSINS) {
    const worst = bvWorstVigi(bv);
    const wc = VC[worst] || '#ccc';
    const wt = VT[worst] || '#333';
    const wl = worst === -1 ? 'N/A' : ['Vert','Jaune','Orange','Rouge'][worst];
    const wBrd = worst === 1 ? 'border:1px solid #bbb;' : '';
    const isOpen = BV_OPEN.has(bv.id);
    const enAlerte = bv.stations.filter(({code}) => {
      const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null;
      return vigi(code, hm) > 0;
    }).length;

    html += `<div class="bv-card">
      <div class="bv-header" onclick="toggleBV('${bv.id}')">
        <div class="bv-color" style="background:${bv.couleur}"></div>
        <div style="flex:1;min-width:0">
          <div class="bv-title">${bv.nom}</div>
          <div class="bv-desc">${bv.desc} · ${bv.stations.length} station${bv.stations.length>1?'s':''}</div>
        </div>
        <div class="bv-summary">
          ${enAlerte > 0 ? `<span style="font-size:11px;color:var(--text3)">${enAlerte} en alerte</span>` : ''}
          <span class="bv-worst" style="background:${wc};color:${wt};${wBrd}">${wl}</span>
        </div>
        <span class="bv-toggle${isOpen?' open':''}">▾</span>
      </div>
      <div class="bv-body${isOpen?' open':''}">`;

    const byCours = {};
    for (const {code, pos} of bv.stations) {
      const cours = ST[code].c;
      if (!byCours[cours]) byCours[cours] = [];
      byCours[cours].push({code, pos});
    }

    for (const [cours, sts] of Object.entries(byCours)) {
      html += `<div class="bv-river">↝ ${cours}</div>`;
      for (const {code, pos} of sts) {
        const st = ST[code];
        const o = OBS[code];
        const hm = o?.H ? o.H.val/1000 : null;
        const v = vigi(code, hm);
        const nom = st.n.replace(' ★','');
        const color = VC[v] || '#ccc';
        const brd = v===1 ? 'border:1px solid #bbb;' : '';
        const obsAgeMin = o?.H?.date ? Math.round((Date.now() - new Date(o.H.date)) / 60000) : null;
        const obsAgeStr = obsAgeMin != null
          ? (obsAgeMin < 60 ? obsAgeMin + ' min' : Math.round(obsAgeMin/60) + 'h' + (obsAgeMin%60 ? String(obsAgeMin%60).padStart(2,'0') : ''))
          : null;
        const obsStale = obsAgeMin != null && obsAgeMin > 120;
        const s3Hist = refValue(code, 's3');
        const pct = hm!=null ? Math.min(100, Math.round(hm/s3Hist*100)) : 0;
        const pctDisplay = hm!=null ? (hm>=s3Hist?'≥100':pct)+'%' : '—';
        let speedCmH = null;
        const histVals = Object.values(HIST[code]||{}).filter(v=>v!=null);
        if (histVals.length >= 2) {
          const oldest = histVals[0], newest = histVals[histVals.length-1];
          const dtH = histVals.length - 1;
          speedCmH = dtH > 0 ? (newest - oldest)/dtH*100 : 0;
        }
        const sp = bvSpeedColor(speedCmH);
        const posLabel = {amont:'AM', milieu:'MI', aval:'AV'}[pos] || pos;
        const posColor = {amont:'#e8f4fd', milieu:'#fef9e7', aval:'#e8f8f5'}[pos] || '#f5f5f5';
        const posText = {amont:'#2980b9', milieu:'#d35400', aval:'#16a085'}[pos] || '#666';

        html += `<div class="bv-station-row" onclick="openMod('${code}')">
          <div class="bv-dot" style="background:${color};${brd}box-shadow:0 0 0 1px rgba(0,0,0,.1)"></div>
          <span class="bv-pos" style="background:${posColor};color:${posText};border-color:${posText}40">${posLabel}</span>
          <div class="bv-sname" title="${nom}${obsAgeStr ? ' · obs. il y a ' + obsAgeStr : ''}">${nom}</div>
          <div class="bv-cours-tag">${st.c}</div>
          ${obsStale ? `<span title="Dernière observation il y a ${obsAgeStr}" style="font-size:9px;color:#e67e22;font-family:var(--mono);flex-shrink:0">⚠${obsAgeStr}</span>` : ''}
          <div class="bv-h" style="color:${color}">${hm!=null?hm.toFixed(3)+' m':'—'}</div>
          <div class="bv-bar-wrap">
            <div class="bv-bar"><div class="bv-bar-fill" style="width:${pct}%;background:linear-gradient(90deg, ${REF_COLORS.s1}, ${REF_COLORS.s2}, ${REF_COLORS.s3})"></div></div>
            <div class="bv-pct" style="color:${pct>=100?REF_COLORS.s3:'var(--text3)'}">${pctDisplay}</div>
          </div>
          <span class="bv-speed-badge" style="background:${sp.bg};color:${sp.text.includes('↑')?sp.color:sp.color}">${sp.text}</span>
        </div>`;
      }

      if (sts.length > 1) {
        const times = sts.map(({code}) => {
          const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null;
          return {code, hm};
        });
        const rising = times.filter(t => t.hm != null && vigi(t.code, t.hm) > 0);
        if (rising.length > 0 && rising.length < sts.length) {
          html += `<div class="bv-prop-line">
            <span class="bv-prop-icon">↓</span>
            Front de crue : ${rising.length}/${sts.length} station${rising.length>1?'s':''} en alerte — surveiller la propagation vers l'aval
          </div>`;
        }
      }
    }
    html += `</div></div>`;
  }
  grid.innerHTML = html;
}

