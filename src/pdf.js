// ── PDF / EXPORT ─────────────────────────────────────────────────────────

import { ST, CODES } from './config.js';
import { OBS, HOURS, HIST } from './state.js';
import { vigi } from './vigi.js';
import { escapeHtml, toast } from './utils.js';
import { JOURNAL } from './journal.js';

export function generatePdfReport() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
  const timeStr = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
  const ts = dateStr + ' · ' + timeStr;

  const agTitre = document.getElementById('ag-titre')?.textContent || '—';
  const agSous  = document.getElementById('ag-sous')?.textContent  || '';

  const kpis = [
    { icon:'🌊', label:'Hydrologie',      val: document.getElementById('sk-hydro-val')?.textContent  || '—', sub: document.getElementById('sk-hydro-sub')?.textContent  || '' },
    { icon:'🌧️', label:'Météo 24h',       val: document.getElementById('sk-meteo-val')?.textContent  || '—', sub: document.getElementById('sk-meteo-sub')?.textContent  || '' },
    { icon:'🌱', label:'Saturation sols', val: document.getElementById('sk-sol-val')?.textContent    || '—', sub: document.getElementById('sk-sol-sub')?.textContent    || '' },
  ];

  const stationsVigi = CODES
    .filter(code => { const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null; return vigi(code,hm) > 0; })
    .map(code => {
      const st = ST[code];
      const hm = OBS[code]?.H ? OBS[code].H.val/1000 : null;
      const v = vigi(code, hm);
      const colors = [null,'#b8960a','#b85a00','#b81010'];
      const labels = [null,'Vigilance','Alerte','Alerte max'];
      return `<tr>
        <td>${escapeHtml(st.n.replace(' ★',''))}</td>
        <td>${escapeHtml(st.c)}</td>
        <td style="font-family:monospace">${hm!=null?hm.toFixed(3)+' m':'—'}</td>
        <td style="font-weight:700;color:${colors[v]||'#333'}">${labels[v]||String(v)}</td>
      </tr>`;
    }).join('');

  const recents = [...JOURNAL].reverse().slice(0, 8).map(e => {
    const d = new Date(e.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    return `<tr><td style="white-space:nowrap">${d}</td><td>${escapeHtml((ST[e.code]?.n||e.code).replace(' ★',''))}</td><td>${escapeHtml(e.message||e.type||'')}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Rapport Vigicrues 22 · ${ts}</title>
<style>
  @page { size:A4; margin:16mm 14mm; }
  * { box-sizing:border-box; margin:0; padding:0; font-family:Arial,sans-serif; }
  body { color:#222; font-size:10pt; }
  .hdr { background:#2c5332; color:#fff; padding:10px 14px; border-radius:6px; margin-bottom:14px; }
  .hdr h1 { font-size:14pt; margin-bottom:3px; }
  .hdr p  { font-size:8pt; opacity:.85; }
  .section { margin-bottom:14px; }
  .section h2 { font-size:10pt; color:#2c5332; border-bottom:1.5px solid #2c5332; padding-bottom:3px; margin-bottom:8px; }
  .alert-box { background:#f4f8f4; border-left:4px solid #2c5332; padding:7px 10px; border-radius:4px; font-size:10pt; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  .kpi { background:#f5f8f5; border:1px solid #d8e4d8; border-radius:6px; padding:8px 10px; }
  .kpi-label { font-size:7.5pt; color:#5a7a5a; margin-bottom:2px; }
  .kpi-val { font-size:12pt; font-weight:700; color:#1e3c1e; }
  .kpi-sub { font-size:7pt; color:#7a9a7a; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:9pt; }
  th { background:#2c5332; color:#fff; padding:5px 7px; text-align:left; }
  td { padding:4px 7px; border-bottom:1px solid #e8ede8; }
  tr:nth-child(even) td { background:#f8faf8; }
  .empty { color:#888; font-style:italic; font-size:9pt; padding:6px 0; }
  .footer { position:fixed; bottom:0; left:0; right:0; font-size:7pt; color:#aaa; text-align:center; border-top:1px solid #e0e0e0; padding:4px 0; }
</style>
</head><body>
<div class="hdr">
  <h1>📊 Rapport de situation — Vigicrues 22</h1>
  <p>Côtes-d'Armor · ${ts}</p>
</div>

<div class="section">
  <h2>Niveau d'alerte global</h2>
  <div class="alert-box">${escapeHtml(agTitre)}${agSous ? ' — ' + escapeHtml(agSous) : ''}</div>
</div>

<div class="section">
  <h2>Indicateurs</h2>
  <div class="kpis">
    ${kpis.map(k=>`<div class="kpi">
      <div class="kpi-label">${k.icon} ${k.label}</div>
      <div class="kpi-val">${k.val}</div>
      <div class="kpi-sub">${escapeHtml(k.sub)}</div>
    </div>`).join('')}
  </div>
</div>

<div class="section">
  <h2>Stations en vigilance (${stationsVigi ? stationsVigi.split('<tr>').length - 1 : 0} / ${CODES.length})</h2>
  ${stationsVigi ? `<table><thead><tr><th>Station</th><th>Cours d'eau</th><th>Hauteur</th><th>Niveau</th></tr></thead><tbody>${stationsVigi}</tbody></table>` : '<p class="empty">Aucune station en vigilance — situation normale.</p>'}
</div>

${recents ? `<div class="section">
  <h2>Derniers événements</h2>
  <table><thead><tr><th>Date</th><th>Station</th><th>Événement</th></tr></thead><tbody>${recents}</tbody></table>
</div>` : ''}

<div class="footer">Vigicrues 22 · ${ts} · Données Hub'Eau &amp; Vigicrues · usage interne</div>
<script>window.onload=()=>{window.print();};<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { toast('⚠️ Autorisez les popups pour générer le rapport'); return; }
  w.document.write(html);
  w.document.close();
  toast('📄 Rapport de situation ouvert — utilisez Ctrl+P pour exporter en PDF');
}

export function exportSituationGeoJSON() {
  const now = new Date();
  const ts = now.toISOString();
  const dateStr = ts.replace(/[:.]/g, '-').slice(0, 19);

  const features = CODES.map(code => {
    const st = ST[code];
    const o = OBS[code] || {};
    const hm = o.H ? o.H.val/1000 : null;
    const v = vigi(code, hm);
    const propArcs = (window.PROP_ACTIVE_ARCS || []).filter(a => a.to === code);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [st.lon, st.lat] },
      properties: {
        code, nom: st.n.replace(' ★',''), riviere: st.c,
        h_m: hm, q_m3s: o.Q ? o.Q.val/1000 : null,
        vigilance: v,
        s1_m: st.s?.s1 ?? null, s2_m: st.s?.s2 ?? null, s3_m: st.s?.s3 ?? null,
        propagation_entrante: propArcs.length > 0 ? propArcs.map(a => `${a.from_nom} (${a.riviere}, +${a.transit_h}h)`).join('; ') : null,
        ts_observation: o.H?.date || null,
        ts_export: ts
      }
    };
  });

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      titre: 'Situation hydrométrique — Côtes-d\'Armor (22)',
      source: 'Vigilance 22 — Hub\'Eau / Vigicrues',
      date_export: ts,
      nb_stations: features.length
    },
    features
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vigicrues22_${dateStr}.geojson`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('GeoJSON exporté');
}

export function exportCSV() {
  if (!HOURS.length) return;
  let csv = 'Code;Station;Cours d\'eau;' + HOURS.join(';') + '\n';
  const sorted = CODES.slice().sort((a,b) => ST[a].n.localeCompare(ST[b].n));
  for (const code of sorted) {
    const st = ST[code];
    const vals = HOURS.map(h => HIST[code]?.[h]!=null ? HIST[code][h].toFixed(3) : '');
    csv += `${code};"${st.n.replace(' ★','')}";${st.c};${vals.join(';')}\n`;
  }
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vigicrues_22_' + new Date().toISOString().slice(0,16).replace('T','_').replace(':','h') + '.csv';
  a.click();
  toast('CSV exporté');
}
