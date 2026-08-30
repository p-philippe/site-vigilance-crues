// ── TABS — Navigation onglets ─────────────────────────────────────────────

import { METEO_DATA, SOL_DATA, NAPPES_DATA } from './state.js';

export const TAB_KEY = 'vig22_active_tab';

export function switchTab(n) {
  document.querySelectorAll('.tab').forEach(t => {
    const m = (t.getAttribute('onclick')||'').match(/switchTab\((\d+)\)/);
    const on = m && +m[1]===n;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.setAttribute('tabindex', on ? '0' : '-1');
  });
  try { localStorage.setItem(TAB_KEY, String(n)); } catch(e) {}
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('active', p.id === 'panel'+n);
  });
  if (n===4) window.renderJournal && window.renderJournal();
  if (n===5) window.renderBassins && window.renderBassins();
  if (n===6 && !METEO_DATA) window.loadMeteo && window.loadMeteo();
  else if (n===6) window.renderMeteo && window.renderMeteo();
  if (n===7 && !SOL_DATA) window.loadSol && window.loadSol();
  else if (n===7) window.renderSol && window.renderSol();
  if (n===9) {
    if (!window.emMap) {
      window.emInitMap && window.emInitMap();
    } else {
      window.emRefreshStations && window.emRefreshStations();
    }
    setTimeout(() => window.emMap?.invalidateSize(), 200);
  }
  if (n===11 && !NAPPES_DATA) window.loadNappes && window.loadNappes();
  else if (n===11) window.renderNappes && window.renderNappes();
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

// Navigation clavier dans les onglets
export function initTabKeyboard() {
  const bar = document.querySelector('.tabs-bar');
  if (!bar) return;
  const tabs = [...bar.querySelectorAll('.tab')];
  const tabNum = t => { const m=(t.getAttribute('onclick')||'').match(/switchTab\((\d+)\)/); return m?+m[1]:null; };
  bar.addEventListener('keydown', e => {
    const cur = document.activeElement;
    let i = tabs.indexOf(cur);
    if (i < 0) return;
    let j = i;
    if (e.key === 'ArrowRight') j = (i+1) % tabs.length;
    else if (e.key === 'ArrowLeft') j = (i-1+tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length-1;
    else if (e.key === 'Enter' || e.key === ' ') { switchTab(tabNum(cur)); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    tabs[j].focus();
    switchTab(tabNum(tabs[j]));
  });

  const tablist = document.querySelector('[role="tablist"]');
  if (tablist) {
    tablist.addEventListener('keydown', function(e) {
      const tabs2 = [...document.querySelectorAll('[role="tab"]')];
      const idx = tabs2.indexOf(document.activeElement);
      if (idx < 0) return;
      let next = -1;
      if (e.key === 'ArrowRight') next = (idx + 1) % tabs2.length;
      if (e.key === 'ArrowLeft')  next = (idx - 1 + tabs2.length) % tabs2.length;
      if (e.key === 'Home')       next = 0;
      if (e.key === 'End')        next = tabs2.length - 1;
      if (next < 0) return;
      e.preventDefault();
      const m = (tabs2[next].getAttribute('onclick') || '').match(/switchTab\((\d+)\)/);
      if (m) { switchTab(+m[1]); tabs2[next].focus(); }
    });
  }
}
