// ── TABS — Navigation onglets ─────────────────────────────────────────────

import { METEO_DATA, SOL_DATA, NAPPES_DATA } from './state.js';

export const TAB_KEY = 'vig22_active_tab';

export function switchTab(n) {
  document.querySelectorAll('.tab').forEach(t => {
    const on = +t.dataset.tab === n;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.setAttribute('tabindex', on ? '0' : '-1');
  });
  try { localStorage.setItem(TAB_KEY, String(n)); } catch(e) {}
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('active', p.id === 'panel'+n);
  });
  if (n===4) window.renderJournal && window.renderJournal();
  // Onglet 5 « Stations » : bassins + historique 12 h (ex-onglet 3)
  if (n===5) {
    window.renderBassins && window.renderBassins();
    window.renderHist && window.renderHist();
  }
  // Onglet 6 « Contexte » : météo + sols + nappes (ex-onglets 6, 7 et 11)
  if (n===6) {
    if (!METEO_DATA) window.loadMeteo && window.loadMeteo();
    else window.renderMeteo && window.renderMeteo();
    if (!SOL_DATA) window.loadSol && window.loadSol();
    else window.renderSol && window.renderSol();
    if (!NAPPES_DATA) window.loadNappes && window.loadNappes();
    else window.renderNappes && window.renderNappes();
  }
  if (n===9) {
    if (!window.emMap) {
      window.emInitMap && window.emInitMap();
    } else {
      window.emRefreshStations && window.emRefreshStations();
    }
    setTimeout(() => window.emMap?.invalidateSize(), 200);
  }
}

export function restoreTab() {
  try {
    const saved = parseInt(localStorage.getItem(TAB_KEY), 10);
    if (Number.isInteger(saved) && saved !== 0 && document.getElementById('panel'+saved)) {
      switchTab(saved);
    } else {
      switchTab(9);
    }
  } catch(e) { switchTab(9); }
}

// Navigation : clic délégué + clavier, un seul gestionnaire sur la barre
export function initTabs() {
  const bar = document.querySelector('.tabs-bar');
  if (!bar) return;
  const onglets = () => [...bar.querySelectorAll('.tab')];

  bar.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (tab) switchTab(+tab.dataset.tab);
  });

  bar.addEventListener('keydown', e => {
    const liste = onglets();
    const i = liste.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      switchTab(+liste[i].dataset.tab);
      return;
    }
    let j;
    if (e.key === 'ArrowRight')     j = (i + 1) % liste.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + liste.length) % liste.length;
    else if (e.key === 'Home')      j = 0;
    else if (e.key === 'End')       j = liste.length - 1;
    else return;
    e.preventDefault();
    liste[j].focus();
    switchTab(+liste[j].dataset.tab);
  });
}
