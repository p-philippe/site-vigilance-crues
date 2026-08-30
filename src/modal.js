// ── MODAL — Modale station ────────────────────────────────────────────────

import { ST, API, REF_COLORS, REF_TEXT, VC, VT } from './config.js';
import { OBS } from './state.js';
import { vigi, refCrues, refValue, refLabel, vigiSourceLabel } from './vigi.js';
import { escapeHtml, fmtTime, fmtDateTime, fmtDate } from './utils.js';

let chartInst = null;
let chartQInst = null;
let chartPrevInst = null;

export function openMod(code) {
  const st = ST[code], o = OBS[code];
  const hm = o?.H ? o.H.val/1000 : null;
  const v = vigi(code, hm);
  const nom = st.n.replace(' ★','');

  // Bannière propagation amont-aval
  if (window.PROP_ACTIVE_ARCS) {
    const arcsVersIci = window.PROP_ACTIVE_ARCS.filter(a => a.to === code);
    if (arcsVersIci.length > 0) {
      const banniere = arcsVersIci.map(a => {
        const stars = '★'.repeat(Math.round(a.confiance * 5)) + '☆'.repeat(5 - Math.round(a.confiance * 5));
        return `<div style="background:#e67e22;color:#fff;padding:8px 12px;border-radius:6px;margin-bottom:8px;font-size:13px;">
          ⬆ <strong>${a.riviere}</strong> en hausse à <strong>${a.from_nom}</strong> — front attendu dans <strong>~${a.transit_h}h</strong> <span style="font-size:11px;">(confiance ${stars})</span>
        </div>`;
      }).join('');
      const elVigi = document.getElementById('m-vigi');
      if (elVigi) { elVigi.insertAdjacentHTML('beforebegin', banniere); }
    }
  }

  document.getElementById('m-title').textContent = nom;
  document.getElementById('m-sub').textContent = st.c + ' · ' + code;
  const schapiEl = document.getElementById('m-schapi-badge');
  if (schapiEl) {
    if (st.p) {
      schapiEl.innerHTML = '<span style="background:#2980b9;color:#fff;border-radius:3px;padding:1px 6px;font-size:11px;">SCHAPI — prévisions 48h</span>';
      schapiEl.style.display = 'block';
    } else {
      schapiEl.innerHTML = '';
      schapiEl.style.display = 'none';
    }
  }

  const brd = v===1 ? ';border:1px solid #bbb' : '';
  const lbadge = ['Vert — normal','Jaune — vigilance','Orange — important','Rouge — majeur'][v] || 'N/A';
  document.getElementById('m-vigi').innerHTML =
    `<span class="vbadge" style="background:${VC[v]||'#888'};color:${VT[v]||'#fff'}${brd}">${lbadge}</span>`;

  const chips = [];
  if (hm != null) chips.push(`<span class="chip">H : ${hm.toFixed(3)} m</span>`);
  if (o?.Q) chips.push(`<span class="chip">Q : ${(o.Q.val/1000).toFixed(2)} m³/s</span>`);
  if (o?.H?.date) chips.push(`<span class="chip">${fmtDateTime(o.H.date)}</span>`);
  chips.push(`<span class="chip">${escapeHtml(vigiSourceLabel(code))}</span>`);
  chips.push(`<span class="chip">${st.p ? '✅ Prévisions activées' : '— Pas de prévision'}</span>`);
  if (code === 'J540212001') chips.push(`<span class="chip" style="color:#854F0B;background:#FAEEDA;border-color:#f0c080">★ Zéro fictif ≈ 1.35m</span>`);
  document.getElementById('m-chips').innerHTML = chips.join('');

  document.getElementById('m-seuils').innerHTML =
    `<div class="sli" style="background:${REF_COLORS.s1};color:${REF_TEXT.s1}">Crue historique basse<br><strong>${refValue(code,'s1').toFixed(2)} m</strong><br><span style="font-weight:400;font-size:10px">${escapeHtml(refLabel(code,'s1'))}</span></div>` +
    `<div class="sli" style="background:${REF_COLORS.s2};color:${REF_TEXT.s2}">Crue historique médiane<br><strong>${refValue(code,'s2').toFixed(2)} m</strong><br><span style="font-weight:400;font-size:10px">${escapeHtml(refLabel(code,'s2'))}</span></div>` +
    `<div class="sli" style="background:${REF_COLORS.s3};color:${REF_TEXT.s3}">Crue historique haute<br><strong>${refValue(code,'s3').toFixed(2)} m</strong><br><span style="font-weight:400;font-size:10px">${escapeHtml(refLabel(code,'s3'))}</span></div>`;

  document.getElementById('m-crues').innerHTML = st.h.map((c,i) =>
    `<div class="crue-row"><span><span class="crk">#${i+1}</span>${escapeHtml(c.l)}</span><strong style="font-family:var(--mono)">${c.v.toFixed(2)} m</strong></div>`
  ).join('');

  const psect = document.getElementById('m-prev-sect');
  const mprev = document.getElementById('m-prev');
  psect.style.display = 'block';
  mprev.innerHTML = '<div id="m-prev-loading" style="font-size:11px;color:var(--text3);font-style:italic">Chargement des prévisions…</div>';
  loadVigicruesPrevisions(code);

  document.getElementById('m-links').innerHTML =
    `<a class="mlink" href="https://www.vigicrues.gouv.fr/station/${code}" target="_blank">↗ Vigicrues</a>` +
    `<a class="mlink" href="https://hydro.eaufrance.fr/stationhydro/${code}/synthese" target="_blank">↗ HydroPortail</a>` +
    `<a class="mlink" href="https://www.vigicrues.gouv.fr/services/observations.json/index.php?CdStationHydro=${code}&FormatDate=iso" target="_blank">↗ API obs.</a>`;

  document.getElementById('m-chart-loading').style.display = 'block';
  document.getElementById('m-chart-wrap').style.display = 'none';
  document.getElementById('m-trend-val').textContent = hm!=null ? hm.toFixed(3)+' m' : '—';
  document.getElementById('m-trend-speed').textContent = '…';
  document.getElementById('m-trend-delta').textContent = '…';
  document.getElementById('m-trend-dir').textContent = '…';
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  document.getElementById('m-debit-sect').style.display = 'none';
  document.getElementById('m-q-chart-loading').style.display = 'none';
  document.getElementById('m-q-chart-wrap').style.display = 'none';
  if (chartQInst) { chartQInst.destroy(); chartQInst = null; }
  document.getElementById('m-prev-graph-sect').style.display = 'none';
  document.getElementById('m-prev-chart-wrap').style.display = 'none';
  if (chartPrevInst) { chartPrevInst.destroy(); chartPrevInst = null; }

  document.getElementById('mbg').classList.add('open');
  loadTrendChart(code, refCrues(code));
}

export function openRessources() {
  document.getElementById('ressources-bg')?.classList.add('open');
}

export function closeRessources() {
  document.getElementById('ressources-bg')?.classList.remove('open');
}

export function closeMod() {
  document.getElementById('mbg').classList.remove('open');
}

export async function loadTrendChart(code, s) {
  try {
    const from6h = new Date(Date.now() - 6*3600000).toISOString().replace(/\.\d+Z$/, 'Z');
    const [rH, rQ] = await Promise.all([
      fetch(`${API}/observations_tr?code_entite=${code}&grandeur_hydro=H&size=200&sort=asc&date_debut_obs=${encodeURIComponent(from6h)}&fields=date_obs,resultat_obs`),
      fetch(`${API}/observations_tr?code_entite=${code}&grandeur_hydro=Q&size=200&sort=asc&date_debut_obs=${encodeURIComponent(from6h)}&fields=date_obs,resultat_obs`)
    ]);
    const dH = await rH.json();
    const dQ = await rQ.json();
    const pts = dH.data || [];
    const ptsQ = dQ.data || [];
    if (!pts.length) throw new Error('Pas de données');

    const labels = pts.map(p => fmtTime(p.date_obs));
    const vals = pts.map(p => +(p.resultat_obs/1000).toFixed(3));

    const first = vals[0], last = vals[vals.length-1];
    const deltaH = last - first;
    const deltaT = (new Date(pts[pts.length-1].date_obs) - new Date(pts[0].date_obs)) / 3600000;
    const speedCmH = deltaT > 0 ? deltaH/deltaT*100 : 0;
    const dir = Math.abs(speedCmH) < 0.3
      ? {icon:'→', color:'#5a6b5a'}
      : speedCmH > 0 ? {icon:'↑', color:'#c0392b'} : {icon:'↓', color:'#27ae60'};

    document.getElementById('m-trend-val').textContent = last.toFixed(3) + ' m';
    document.getElementById('m-trend-speed').textContent = (speedCmH>=0?'+':'') + speedCmH.toFixed(1) + ' cm/h';
    document.getElementById('m-trend-speed').style.color = dir.color;
    document.getElementById('m-trend-delta').textContent = (deltaH>=0?'+':'') + (deltaH*100).toFixed(1) + ' cm';
    document.getElementById('m-trend-delta').style.color = dir.color;
    document.getElementById('m-trend-dir').textContent = dir.icon;
    document.getElementById('m-trend-dir').style.color = dir.color;

    document.getElementById('m-chart-loading').style.display = 'none';
    document.getElementById('m-chart-wrap').style.display = 'block';

    const tc = '#8a9b8a';
    const gc = matchMedia('(prefers-color-scheme:dark)').matches ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)';
    const skip = Math.max(1, Math.floor(labels.length / 10));
    const displayLabels = labels.map((l,i) => i%skip===0 ? l : '');

    const datasets = [{
      label:'Hauteur (m)', data:vals,
      borderColor:'#1a5c2a', backgroundColor:'rgba(26,92,42,.07)',
      fill:true, pointRadius:0, tension:0.3, borderWidth:2, order:1
    }];
    [{k:'s1',c:REF_COLORS.s1,l:'Crue basse'},{k:'s2',c:REF_COLORS.s2,l:'Crue médiane'},{k:'s3',c:REF_COLORS.s3,l:'Crue haute'}].forEach(({k,c,l}) => {
      datasets.push({
        label:l, data:Array(vals.length).fill(s[k].v),
        borderColor:c, borderWidth:1.5, borderDash:[5,3],
        pointRadius:0, fill:false, order:0
      });
    });

    const Chart = window.Chart;
    chartInst = new Chart(document.getElementById('m-chart'), {
      type:'line',
      data:{labels:displayLabels, datasets},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:true, position:'top', labels:{boxWidth:10,font:{size:10},color:tc, filter:i=>i.text!=='Hauteur (m)'}},
          tooltip:{callbacks:{
            title: items => labels[items[0].dataIndex]+' UTC',
            label: ctx => ctx.dataset.label==='Hauteur (m)' ? `H : ${ctx.raw.toFixed(3)} m` : `${ctx.dataset.label} : ${ctx.raw.toFixed(2)} m`
          }}
        },
        scales:{
          x:{ticks:{color:tc,font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:10},grid:{color:gc}},
          y:{ticks:{color:tc,font:{size:10},callback:v=>v.toFixed(2)+'m'},grid:{color:gc}}
        }
      }
    });

    if (ptsQ.length) {
      const tsH = pts.map(p => new Date(p.date_obs).getTime());
      const tsQ = ptsQ.map(p => new Date(p.date_obs).getTime());
      const valsQ = ptsQ.map(p => +(p.resultat_obs/1000).toFixed(3));
      const valsQmapped = tsH.map(t => {
        let best = null, bestDelta = Infinity;
        for (let i = 0; i < tsQ.length; i++) {
          const d = Math.abs(tsQ[i] - t);
          if (d < bestDelta) { bestDelta = d; best = valsQ[i]; }
        }
        return bestDelta < 1800000 ? best : null;
      });
      const lastQ = valsQ[valsQ.length - 1];
      document.getElementById('m-debit-sect').style.display = 'block';
      document.getElementById('m-debit-sect').innerHTML =
        `Débit Q (m³/s) — 6 heures <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:#185FA5;margin-left:8px">${lastQ.toFixed(3)} m³/s</span>`;
      document.getElementById('m-q-chart-wrap').style.display = 'block';

      chartQInst = new Chart(document.getElementById('m-q-chart'), {
        type:'line',
        data:{
          labels: displayLabels,
          datasets:[{
            label:'Débit (m³/s)', data: valsQmapped,
            borderColor:'#185FA5', backgroundColor:'rgba(24,95,165,.08)',
            fill:true, pointRadius:0, tension:0.3, borderWidth:2, spanGaps:true
          }]
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            tooltip:{callbacks:{
              title: items => labels[items[0].dataIndex]+' UTC',
              label: ctx => `Q : ${ctx.raw != null ? ctx.raw.toFixed(3) : '—'} m³/s`
            }}
          },
          scales:{
            x:{ticks:{color:tc,font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:10},grid:{color:gc}},
            y:{ticks:{color:tc,font:{size:10},callback:v=>v.toFixed(2)+' m³/s'},grid:{color:gc},beginAtZero:false}
          }
        }
      });
    }
  } catch(e) {
    document.getElementById('m-chart-loading').textContent = 'Graphique indisponible : ' + e.message;
  }
}

export async function loadVigicruesPrevisions(code) {
  const el = document.getElementById('m-prev');
  if (!el) return;
  try {
    const url = `https://www.vigicrues.gouv.fr/services/previsions.json?CdStationHydro=${code}&FormatDate=iso`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {signal: ctrl.signal});
    clearTimeout(tid);
    const d = await r.json();
    const prevs = d?.Simul?.Prevs || [];
    const noPrevsHtml = `<div style="background:#f0f0f0;padding:10px;border-radius:6px;font-size:13px;color:#555;">
  ℹ️ Les prévisions SCHAPI pour cette station sont publiées uniquement lors des épisodes de vigilance orange ou rouge.<br>
  <small>Horizon prévu : jusqu'à 48h — bande Min/Moy/Max disponible en crue.</small>
</div>
<a class="mlink" href="https://www.vigicrues.gouv.fr/station/${code}" target="_blank">↗ Vigicrues</a>`;

    if (!prevs.length) { el.innerHTML = noPrevsHtml; return; }

    const now = Date.now();
    const dtProd = d?.Simul?.DtProd ? new Date(d.Simul.DtProd).getTime() : now;
    const allPts = prevs
      .map(p => ({
        t: new Date(p.DtPrev),
        v:   p.ResMoyPrev != null ? p.ResMoyPrev : null,
        vMin: p.ResMinPrev != null ? p.ResMinPrev : null,
        vMax: p.ResMaxPrev != null ? p.ResMaxPrev : null
      }))
      .filter(p => p.v != null)
      .sort((a, b) => a.t - b.t);

    if (!allPts.length) { el.innerHTML = noPrevsHtml; return; }

    function getPrevAt(offsetMs) {
      const target = dtProd + offsetMs;
      let best = null, bestDelta = Infinity;
      for (const p of allPts) {
        const delta = Math.abs(p.t.getTime() - target);
        if (delta < bestDelta) { bestDelta = delta; best = p; }
      }
      return best && bestDelta < 3600000 * 2 ? best : null;
    }

    function kpiHtml(label, p) {
      if (!p) return `<div style="background:var(--bg);border-radius:8px;padding:8px 10px;text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">${label}</div><div style="font-size:16px;font-weight:700;color:var(--text3)">—</div></div>`;
      const v = p.v;
      const bg = '#e8f2ea';
      const txt = '#1a1f1a';
      const brd = '';
      const rangeHtml = (p.vMin != null && p.vMax != null)
        ? `<div style="font-size:9px;color:${txt};opacity:.6;margin-top:1px">${p.vMin.toFixed(2)}–${p.vMax.toFixed(2)} m</div>`
        : '';
      return `<div style="background:${bg};${brd}border-radius:8px;padding:8px 10px;text-align:center">
        <div style="font-size:10px;color:${txt};opacity:.8;margin-bottom:4px">${label}</div>
        <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:${txt}">${v.toFixed(2)}m</div>
        <div style="font-size:9px;color:${txt};opacity:.7;margin-top:2px">${fmtTime(p.t)}</div>
        ${rangeHtml}
      </div>`;
    }

    const futurePts = allPts.filter(p => p.t.getTime() > now + 30*60000);
    const step = Math.max(1, Math.floor(futurePts.length / 10));
    const sampled = futurePts.filter((_, i) => i % step === 0).slice(0, 12);
    const rows = sampled.map(p => {
      const hLabel = fmtDate(p.t,{day:'2-digit',month:'2-digit'}) + ' ' + fmtTime(p.t);
      const bc = 'transparent';
      const bt = 'inherit';
      const brd2 = '';
      const rangeStr = (p.vMin != null && p.vMax != null)
        ? ` <span style="font-size:9px;opacity:.7">[${p.vMin.toFixed(2)}–${p.vMax.toFixed(2)}]</span>` : '';
      return `<tr>
        <td style="font-family:monospace;font-size:10px;color:var(--text3);padding:4px 8px">${hLabel}</td>
        <td style="font-family:monospace;font-size:11px;font-weight:600;text-align:right;padding:4px 8px">
          <span style="background:${bc};${brd2}color:${bt};border-radius:4px;padding:1px 6px">${p.v.toFixed(3)} m</span>${rangeStr}
        </td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">📈 SCHAPI — ${allPts.length} points de prévision (bande Min/Moy/Max)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px">
        ${kpiHtml('+3h', getPrevAt(3*3600000))}${kpiHtml('+6h', getPrevAt(6*3600000))}${kpiHtml('+12h', getPrevAt(12*3600000))}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
        ${kpiHtml('+24h', getPrevAt(24*3600000))}${kpiHtml('+36h', getPrevAt(36*3600000))}${kpiHtml('+48h', getPrevAt(48*3600000))}
      </div>
      ${rows ? `<div style="overflow-x:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg3);margin-bottom:8px">
        <table style="border-collapse:collapse;width:100%;font-size:11px">
          <thead><tr>
            <th style="padding:4px 8px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text3);text-align:left;background:var(--bg)">Date / Heure</th>
            <th style="padding:4px 8px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text3);text-align:right;background:var(--bg)">Hauteur prévue [Min–Max]</th>
          </tr></thead><tbody>${rows}</tbody></table></div>` : ''}
      <a class="mlink" href="https://www.vigicrues.gouv.fr/station/${code}" target="_blank">↗ Vigicrues</a>`;

    // Graphique prévisions
    if (allPts.length >= 2) {
      const prevGraphSect = document.getElementById('m-prev-graph-sect');
      const prevChartWrap = document.getElementById('m-prev-chart-wrap');
      if (prevGraphSect && prevChartWrap) {
        prevGraphSect.style.display = 'block';
        prevChartWrap.style.display = 'block';
        if (chartPrevInst) { chartPrevInst.destroy(); chartPrevInst = null; }
        const tc = '#8a9b8a', gc = 'rgba(0,0,0,.06)';
        const labelsP = allPts.map(p => fmtTime(p.t));
        const isPast = allPts.map(p => p.t.getTime() <= now);
        const valsPast   = allPts.map((p, i) => isPast[i]  ? p.v : null);
        const valsFuture = allPts.map((p, i) => !isPast[i] ? p.v : null);
        const junctionIdx = isPast.lastIndexOf(true);
        if (junctionIdx >= 0 && junctionIdx < allPts.length - 1) valsFuture[junctionIdx] = allPts[junctionIdx].v;
        const valsMin = allPts.map((p, i) => !isPast[i] && p.vMin != null ? p.vMin : null);
        const valsMax = allPts.map((p, i) => !isPast[i] && p.vMax != null ? p.vMax : null);
        if (junctionIdx >= 0 && junctionIdx < allPts.length - 1) {
          if (allPts[junctionIdx].vMin != null) valsMin[junctionIdx] = allPts[junctionIdx].vMin;
          if (allPts[junctionIdx].vMax != null) valsMax[junctionIdx] = allPts[junctionIdx].vMax;
        }
        const skip = Math.max(1, Math.floor(labelsP.length / 12));
        const displayLabelsP = labelsP.map((l, i) => i % skip === 0 ? l : '');
        const refS = refCrues(code);
        const hasBand = valsMin.some(v => v != null);
        const datasetsP = [
          { label:'Observé', data: valsPast, borderColor:'#1a5c2a', backgroundColor:'rgba(26,92,42,.08)', fill:true, pointRadius:0, tension:0.3, borderWidth:2, spanGaps:false },
          { label:'Prévision Moy', data: valsFuture, borderColor:'#e67e22', backgroundColor:'rgba(230,126,34,.08)', fill:!hasBand, pointRadius:0, tension:0.3, borderWidth:2, borderDash:[6,4], spanGaps:false }
        ];
        if (hasBand) {
          datasetsP.push({label:'Prévi Min',data:valsMin,borderColor:'rgba(230,126,34,0.3)',backgroundColor:'rgba(230,126,34,0.1)',borderDash:[2,4],borderWidth:1,fill:false,pointRadius:0,tension:0.3,spanGaps:false});
          datasetsP.push({label:'Prévi Max',data:valsMax,borderColor:'rgba(230,126,34,0.3)',backgroundColor:'rgba(230,126,34,0.1)',borderDash:[2,4],borderWidth:1,fill:'-1',pointRadius:0,tension:0.3,spanGaps:false});
        }
        [{k:'s1',c:REF_COLORS.s1,l:'Crue basse'},{k:'s2',c:REF_COLORS.s2,l:'Crue médiane'},{k:'s3',c:REF_COLORS.s3,l:'Crue haute'}].forEach(({k,c,l}) => {
          datasetsP.push({ label:l, data:Array(allPts.length).fill(refS[k].v), borderColor:c, borderWidth:1.5, borderDash:[5,3], pointRadius:0, fill:false });
        });
        const Chart = window.Chart;
        chartPrevInst = new Chart(document.getElementById('m-prev-chart'), {
          type:'line',
          data:{ labels: displayLabelsP, datasets: datasetsP },
          options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{
              legend:{ display:true, position:'top', labels:{ boxWidth:10, font:{size:10}, color:tc, filter: i => ['Observé','Prévision Moy','Prévi Min','Prévi Max'].includes(i.text) }},
              tooltip:{ callbacks:{ title: items => labelsP[items[0].dataIndex]+' UTC', label: ctx => ctx.raw != null ? `${ctx.dataset.label} : ${ctx.raw.toFixed(3)} m` : null }}
            },
            scales:{
              x:{ ticks:{color:tc,font:{size:9},maxRotation:0,autoSkip:true,maxTicksLimit:12}, grid:{color:gc} },
              y:{ ticks:{color:tc,font:{size:10},callback:v=>v.toFixed(2)+'m'}, grid:{color:gc} }
            }
          }
        });
      }
    }
  } catch(e) {
    el.innerHTML = `<div style="background:#f0f0f0;padding:10px;border-radius:6px;font-size:13px;color:#555;">
  ℹ️ Les prévisions SCHAPI pour cette station sont publiées uniquement lors des épisodes de vigilance orange ou rouge.<br>
  <small>Horizon prévu : jusqu'à 48h — bande Min/Moy/Max disponible en crue.</small>
</div>
<a class="mlink" href="https://www.vigicrues.gouv.fr/station/${code}" target="_blank">↗ Vigicrues</a>`;
  }
}
