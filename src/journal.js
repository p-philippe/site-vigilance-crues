// ── JOURNAL — Journal des événements ─────────────────────────────────────

import { CODES, ST, REF_COLORS, REF_TEXT } from './config.js';
import { NOTIF_BATCHING, NOTIF_BATCH, setNOTIF_BATCH } from './state.js';
import { refCrues } from './vigi.js';
import { fmtTime, fmtDate, escapeHtml } from './utils.js';
import { sendNotif } from './notif.js';

const JOURNAL_KEY = 'vigicrues22_journal_v1';

export let JOURNAL = [];
export let PREV_OBS = {};

const SPEED_ALERT   = 2.0;
const SPEED_DESCENTE = -3.0;
const DELTA_MIN     = 0.5;

export function journalLoad() {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    JOURNAL = raw ? JSON.parse(raw) : [];
  } catch(e) { JOURNAL = []; }
  populateJournalStationFilter();
}

export function journalSave() {
  try {
    if (JOURNAL.length > 500) JOURNAL = JOURNAL.slice(-500);
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(JOURNAL));
  } catch(e) {}
}

export function journalAdd(ev) {
  const tenMin = 10 * 60 * 1000;
  const recent = JOURNAL.filter(e =>
    e.code === ev.code && e.type === ev.type && e.seuil === ev.seuil &&
    (new Date(ev.date) - new Date(e.date)) < tenMin
  );
  if (recent.length > 0) return;
  JOURNAL.push(ev);
  journalSave();
  if (ev.type === 'franchissement' || ev.type === 'montee_rapide' || ev.type === 'propagation') {
    const payload = {
      titre: ev.type === 'propagation' ? '⬆ Propagation crue' : '🔴 Alerte hydrométrique',
      corps: ev.msg || ev.message || 'Franchissement de seuil détecté',
      opts: { tag: 'vigicrues-alerte', renotify: true }
    };
    if (NOTIF_BATCHING) {
      setNOTIF_BATCH([...NOTIF_BATCH, { ...payload, ev }]);
    } else {
      sendNotif(payload.titre, payload.corps, payload.opts);
    }
  }
}

export function setPREV_OBS(v) { PREV_OBS = v; }

export function detectEvents(prevObs, newObs) {
  const now = new Date().toISOString();
  let newEvents = 0;

  for (const code of CODES) {
    const st = ST[code];
    const refs = refCrues(code);
    const nom = st.n.replace(' ★','');
    const prev = prevObs[code]?.H;
    const curr = newObs[code]?.H;
    if (!curr || !prev) continue;

    const hPrev = prev.val / 1000;
    const hCurr = curr.val / 1000;
    const deltaH = hCurr - hPrev;

    const dtMs = new Date(curr.date) - new Date(prev.date);
    const dtH  = dtMs > 0 ? dtMs / 3600000 : 1/12;
    const speedCmH = (deltaH / dtH) * 100;

    for (const [key, label] of [
      ['s1','S1 historique'],
      ['s2','S2 historique'],
      ['s3','S3 historique']
    ]) {
      const threshold = refs[key].v;
      if (hPrev < threshold && hCurr >= threshold) {
        journalAdd({
          id: Date.now() + Math.random(), code, nom, cours: st.c,
          type: 'franchissement', seuil: key,
          hauteur: hCurr, vitesse: speedCmH, delta: deltaH * 100,
          date: curr.date, message: `Franchissement ${label} ↑ à ${hCurr.toFixed(3)}m`
        });
        newEvents++;
      }
      if (hPrev >= threshold && hCurr < threshold) {
        journalAdd({
          id: Date.now() + Math.random(), code, nom, cours: st.c,
          type: 'desc', seuil: key,
          hauteur: hCurr, vitesse: speedCmH, delta: deltaH * 100,
          date: curr.date, message: `Retour sous ${label} ↓ à ${hCurr.toFixed(3)}m`
        });
        newEvents++;
      }
    }

    if (speedCmH >= SPEED_ALERT && hCurr < refs.s1.v) {
      journalAdd({
        id: Date.now() + Math.random(), code, nom, cours: st.c,
        type: 'speed', seuil: null,
        hauteur: hCurr, vitesse: speedCmH, delta: deltaH * 100,
        date: curr.date, message: `Montée rapide : +${speedCmH.toFixed(1)} cm/h à ${hCurr.toFixed(3)}m`
      });
      newEvents++;
    }

    if (speedCmH <= SPEED_DESCENTE) {
      journalAdd({
        id: Date.now() + Math.random(), code, nom, cours: st.c,
        type: 'desc', seuil: null,
        hauteur: hCurr, vitesse: speedCmH, delta: deltaH * 100,
        date: curr.date, message: `Baisse significative : ${speedCmH.toFixed(1)} cm/h à ${hCurr.toFixed(3)}m`
      });
      newEvents++;
    }
  }

  if (newEvents > 0) {
    populateJournalStationFilter();
    renderJournal();
  }
  return newEvents;
}

export function populateJournalStationFilter() {
  const sel = document.getElementById('j-fstation');
  if (!sel) return;
  const codes = [...new Set(JOURNAL.map(e => e.code))].sort((a,b) => ST[a]?.n.localeCompare(ST[b]?.n));
  const cur = sel.value;
  sel.innerHTML = '<option value="">Toutes les stations</option>' +
    codes.map(c => `<option value="${c}"${c===cur?' selected':''}>${ST[c]?.n.replace(' ★','') || c}</option>`).join('');
}

export function renderJournal() {
  const ftype    = document.getElementById('j-ftype')?.value || '';
  const fstation = document.getElementById('j-fstation')?.value || '';
  const wrap     = document.getElementById('j-list-wrap');
  if (!wrap) return;

  let items = [...JOURNAL].reverse();
  if (ftype)    items = items.filter(e => e.type === ftype || (ftype==='franchissement' && e.type==='franchissement'));
  if (fstation) items = items.filter(e => e.code === fstation);

  document.getElementById('j-count-badge').textContent =
    JOURNAL.length ? `(${JOURNAL.length} événement${JOURNAL.length>1?'s':''})` : '';

  if (!items.length) {
    wrap.innerHTML = `<div class="j-empty">
      ${JOURNAL.length === 0
        ? 'Aucun événement enregistré.<br>Le journal se remplit automatiquement lors des actualisations.'
        : 'Aucun événement correspondant aux filtres.'}
    </div>`;
    return;
  }

  const typeConf = {
    franchissement: {icon:'⚠️', cls:'ev-s3', label:'Franchissement ↑'},
    desc:           {icon:'📉', cls:'ev-desc', label:'Baisse / Retour'},
    speed:          {icon:'🚨', cls:'ev-speed', label:'Montée rapide'},
    pic:            {icon:'🔔', cls:'ev-pic',   label:'Pic détecté'},
  };

  const seuilColors = {
    s1: {bg:REF_COLORS.s1, text:REF_TEXT.s1, label:'S1 hist.'},
    s2: {bg:REF_COLORS.s2, text:REF_TEXT.s2, label:'S2 hist.'},
    s3: {bg:REF_COLORS.s3, text:REF_TEXT.s3, label:'S3 hist.'},
  };

  const byDay = {};
  for (const ev of items) {
    const day = fmtDate(ev.date,{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(ev);
  }

  let html = '';
  for (const [day, evs] of Object.entries(byDay)) {
    html += `<div class="j-section-title">${day}</div><div class="j-list">`;
    for (const ev of evs) {
      const tc = typeConf[ev.type] || {icon:'ℹ️', cls:'', label:escapeHtml(ev.type)};
      const sc = ev.seuil ? seuilColors[ev.seuil] : null;
      const seuilBadge = sc
        ? `<span class="j-badge" style="background:${sc.bg};color:${sc.text}">${sc.label}</span>`
        : '';
      const speedStr = ev.vitesse != null
        ? `<span style="color:${ev.vitesse>0?'#c0392b':'#27ae60'}">${ev.vitesse>0?'+':''}${ev.vitesse.toFixed(1)} cm/h</span>`
        : '';
      const timeStr = fmtTime(ev.date);

      // Ces champs viennent aujourd'hui de config.js, mais ils transitent par
      // localStorage : les échapper évite qu'un jour une source extérieure
      // fasse exécuter du balisage ici.
      html += `<div class="j-item ${ev.seuil ? 'ev-'+ev.seuil : tc.cls}">
        <div class="j-icon">${tc.icon}</div>
        <div class="j-body">
          <div class="j-title">${escapeHtml(ev.nom)}${seuilBadge}</div>
          <div class="j-meta">${escapeHtml(ev.cours)} · ${escapeHtml(ev.code)}</div>
          <div class="j-detail">
            ${escapeHtml(ev.message)} · H=${ev.hauteur.toFixed(3)}m
            ${speedStr ? '· ' + speedStr : ''}
            ${ev.delta != null ? '· Δ '+(ev.delta>0?'+':'')+ev.delta.toFixed(1)+' cm' : ''}
          </div>
        </div>
        <div class="j-time">${timeStr}</div>
      </div>`;
    }
    html += '</div>';
  }

  wrap.innerHTML = html;
}

export function clearJournal() {
  if (!confirm(`Vider le journal (${JOURNAL.length} événements) ?`)) return;
  JOURNAL = [];
  journalSave();
  renderJournal();
  document.getElementById('j-count-badge').textContent = '';
}

export function exportJournalCSV() {
  if (!JOURNAL.length) { window.toast('Journal vide'); return; }
  const cols = ['Date UTC','Code','Station','Cours eau','Type','Seuil','Hauteur (m)','Vitesse (cm/h)','Variation (cm)','Message'];
  const rows = [...JOURNAL].reverse().map(e => [
    new Date(e.date).toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC'),
    e.code, `"${e.nom}"`, e.cours,
    e.type, e.seuil||'',
    e.hauteur.toFixed(3),
    e.vitesse!=null ? e.vitesse.toFixed(1) : '',
    e.delta!=null ? e.delta.toFixed(1) : '',
    `"${e.message}"`
  ].join(';'));
  const csv = '﻿' + cols.join(';') + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'journal_vigicrues22_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  window.toast('Journal exporté (' + JOURNAL.length + ' événements)');
}
