// ── INIT — Point d'entrée de l'application ────────────────────────────────

import './globals.js';

import { loadAll } from './data.js';
import { cacheRestore } from './cache.js';
import { journalLoad } from './journal.js';
import { emSetColor } from './em-map.js';
import { initMap } from './map.js';
import { restoreTab, initTabKeyboard } from './tabs.js';
import { updateOnlineStatus } from './utils.js';
import { renderBassins, renderHist } from './render.js';

// ── AUTO-REFRESH 30 min ──
const AUTO_REFRESH_MS = 30 * 60 * 1000;
let autoRefreshNextAt = null;
let autoRefreshTimer = null;

export function scheduleAutoRefresh() {
  if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
  autoRefreshNextAt = Date.now() + AUTO_REFRESH_MS;
  autoRefreshTimer = setTimeout(() => { loadAll(); scheduleAutoRefresh(); }, AUTO_REFRESH_MS);
}

function updateCountdown() {
  const el = document.getElementById('refresh-countdown');
  if (!el || !autoRefreshNextAt) return;
  const rem = Math.max(0, Math.round((autoRefreshNextAt - Date.now()) / 1000));
  const m = Math.floor(rem / 60), s = rem % 60;
  el.textContent = `↻ ${m}:${String(s).padStart(2,'0')}`;
}
setInterval(updateCountdown, 1000);

// Exposer pour data.js
window.scheduleAutoRefresh = scheduleAutoRefresh;

// ── PROPAGATION DATA (statique) ──
window.PROP_DATA = [
  {"id":"trieux_1","riviere":"Trieux","bassin":"trieux","from":"J171171001","to":"J172172001","dist_km":22,"from_nom":"St-Péver","to_nom":"St-Clet","calibre":false,"statut":"trop_peu_de_points","transit_h":5.0,"attenuation":1.0,"confiance":0.0},
  {"id":"leff_1","riviere":"Leff","bassin":"trieux","from":"J180301001","to":"J181301001","dist_km":27,"from_nom":"Boqueho","to_nom":"Quemper-Guézennec","calibre":false,"statut":"trop_peu_de_points","transit_h":6.0,"attenuation":1.0,"confiance":0.0},
  {"id":"blavet_1","riviere":"Blavet","bassin":"blavet","from":"J520211001","to":"J521212001","dist_km":15,"from_nom":"Kerien [Kerlouët]","to_nom":"Lanrivain","calibre":true,"transit_h":3.0,"attenuation":1.848,"confiance":0.3},
  {"id":"blavet_2","riviere":"Blavet","bassin":"blavet","from":"J521212001","to":"J540212001","dist_km":28,"from_nom":"Lanrivain","to_nom":"Plélauff [Bon-Repos]","calibre":true,"transit_h":5.0,"attenuation":3.0,"confiance":0.3},
  {"id":"oust_1","riviere":"Oust","bassin":"oust","from":"J800231002","to":"J802231003","dist_km":35,"from_nom":"St-Martin-des-Prés","to_nom":"Hémonstoir","calibre":true,"transit_h":6.0,"attenuation":0.952,"confiance":1.0},
  {"id":"legueur_1","riviere":"Léguer","bassin":"jaudy","from":"J223301001","to":"J223302001","dist_km":14,"from_nom":"Belle-Isle-en-Terre","to_nom":"Pluzunet","calibre":false,"transit_h":3.0,"attenuation":1.0,"confiance":0.0},
  {"id":"gouessant_1","riviere":"Urne / Gouessant","bassin":"gouessant","from":"J140531001","to":"J131301001","dist_km":20,"from_nom":"Plédran","to_nom":"Andel","calibre":true,"transit_h":4.5,"attenuation":0.903,"confiance":0.3},
  {"id":"arguenon_1","riviere":"Quiloury / Arguenon","bassin":"fremur","from":"J110581001","to":"J110301001","dist_km":12,"from_nom":"Plénée-Jugon","to_nom":"Jugon-les-Lacs","calibre":true,"transit_h":3.0,"attenuation":0.841,"confiance":0.3}
];

// ── DÉMARRAGE ──
(async function main() {
  try {
  // 1. Journal d'événements
  journalLoad();

  // 3. Carte principale (optionnelle — le div#map n'existe pas dans tous les layouts)
  try { initMap(); } catch(e) { console.warn('[map] initMap ignorée:', e.message); }

  // 4. Carte EM — couleur par défaut
  emSetColor('#e63946');

  // 6. Restaurer le cache si hors-ligne
  if (!navigator.onLine) {
    const restored = await cacheRestore();
    if (restored) {
      renderBassins();
      renderHist();
      const tsEl = document.getElementById('ts');
      if (tsEl) tsEl.textContent = '📦 Cache hors-ligne';
    }
  }

  // 7. Charger les données
  loadAll();

  // 8. Auto-refresh
  scheduleAutoRefresh();

  // 9. Notifications
  if ('Notification' in window && Notification.permission === 'default') {
    document.addEventListener('click', function askNotifOnce() {
      Notification.requestPermission();
      document.removeEventListener('click', askNotifOnce);
    }, { once: true });
  }

  // 10. Bouton notif
  (function initNotifBtn() {
    const btn = document.getElementById('btn-notif');
    if (!btn) return;
    if (!('Notification' in window)) { btn.style.display = 'none'; return; }
    btn.textContent = (Notification.permission !== 'granted' || localStorage.getItem('notif_disabled') === '1') ? '🔕' : '🔔';
  })();

  // 11. Restaurer le dernier onglet
  restoreTab();

  // 12. Navigation clavier onglets
  initTabKeyboard();

  // 13. Connectivité
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // 14. Défilement onglets
  (function() {
    const wrap = document.querySelector('.tabs-bar-wrap');
    const bar  = document.querySelector('.tabs-bar');
    if (!wrap || !bar) return;
    function checkScroll() {
      const atEnd = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 4;
      wrap.classList.toggle('at-end', atEnd);
    }
    bar.addEventListener('scroll', checkScroll, {passive: true});
    window.addEventListener('resize', checkScroll, {passive: true});
    checkScroll();
  })();

  // 15. Touch-action sur les boutons
  document.querySelectorAll('button,.tab,.btn,.mlink').forEach(el => {
    el.style.touchAction = 'manipulation';
  });

  // 16. SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // 17. Raccourcis clavier EM
  document.addEventListener('keydown', e => {
    const onEM = document.getElementById('panel9')?.classList.contains('active');
    if (!onEM || !window.emMap) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
    if (typing) return;
    if (window._emDrawing) {
      if (e.key === 'Enter') { e.preventDefault(); window.emFinishDraw && window.emFinishDraw(); }
      else if (e.key === 'Escape') { e.preventDefault(); window.emCancelDraw && window.emCancelDraw(); }
    }
  });

  // 18. Fermer recherche EM si clic ailleurs
  document.addEventListener('click', e => {
    const wrap = document.getElementById('em-search-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('em-search-results')?.classList.remove('open');
    }
  });

  } catch(e) { console.error('[init] Erreur fatale dans main():', e); }
})();
