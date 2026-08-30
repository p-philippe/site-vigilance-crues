// ── NOTIF — Notifications navigateur ─────────────────────────────────────

import { OBS } from './state.js';
import { NOTIF_BATCH, setNOTIF_BATCHING, setNOTIF_BATCH } from './state.js';

export function sendNotif(titre, corps, opts = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (localStorage.getItem('notif_disabled') === '1') return;
  const n = new Notification(titre, {
    body: corps,
    icon: opts.icon || '💧',
    tag: opts.tag || 'vigicrues-alerte',
    renotify: opts.renotify !== undefined ? opts.renotify : false,
    ...opts
  });
  n.onclick = () => { window.focus(); n.close(); };
}

export function toggleNotif() {
  if (!('Notification' in window)) { alert('Notifications non supportées par ce navigateur.'); return; }
  const btn = document.getElementById('btn-notif');
  if (Notification.permission === 'granted') {
    const disabled = localStorage.getItem('notif_disabled') === '1' ? '0' : '1';
    localStorage.setItem('notif_disabled', disabled);
    if (btn) btn.textContent = disabled === '1' ? '🔕' : '🔔';
  } else {
    Notification.requestPermission().then(p => {
      if (p === 'granted') {
        localStorage.removeItem('notif_disabled');
        if (btn) btn.textContent = '🔔';
      }
    });
  }
}

export function flushNotifBatch() {
  setNOTIF_BATCHING(false);
  if (!NOTIF_BATCH.length) { setNOTIF_BATCH([]); return; }
  if (NOTIF_BATCH.length === 1) {
    const {titre, corps, opts} = NOTIF_BATCH[0];
    sendNotif(titre, corps, opts);
  } else {
    const stations = [...new Set(NOTIF_BATCH.map(n => n.ev?.nom || n.ev?.code || '?'))];
    const liste = stations.slice(0,3).join(', ') + (stations.length > 3 ? ` + ${stations.length-3} autre(s)` : '');
    sendNotif(
      `🔴 ${NOTIF_BATCH.length} alertes — Vigilance 22`,
      liste,
      { tag: 'vigicrues-batch', renotify: true }
    );
  }
  setNOTIF_BATCH([]);
}

// Vérification toutes les 15 min : données périmées > 45 min
export function checkStaleData() {
  if (!navigator.onLine) return;
  if (!OBS || !Object.keys(OBS).length) return;
  let latest = null;
  for (const code of Object.keys(OBS)) {
    const d = OBS[code]?.H?.date;
    if (d) { const dt = new Date(d); if (!latest || dt > latest) latest = dt; }
  }
  if (!latest) return;
  const ageMin = Math.round((Date.now() - latest.getTime()) / 60000);
  if (ageMin > 45) {
    sendNotif(
      '⚠️ Données périmées — Vigilance 22',
      `Dernière mesure il y a ${ageMin} min. Vérifier la connexion.`,
      { tag: 'vigicrues-stale', renotify: false }
    );
  }
}

setInterval(checkStaleData, 15 * 60 * 1000);
