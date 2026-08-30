// ── UTILS — Fonctions pures ───────────────────────────────────────────────

import { USE_LOCAL_TZ, TZ_LOCAL, setUSE_LOCAL_TZ, setLoading_ } from './state.js';
import { VC, VT, VL } from './config.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeErrorMessage(error) {
  return escapeHtml(error?.message || 'Erreur inconnue');
}

/**
 * Requête JSON bornée et relancée une fois pour les erreurs transitoires.
 * Les appels de données publiques ne doivent pas bloquer l'interface
 * indéfiniment ni tenter de parser une réponse HTTP en erreur comme du JSON.
 */
export async function fetchJson(url, { timeout = 10000, retries = 1, ...options } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: ctrl.signal });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      const retryable = error.name === 'AbortError' || error.retryable || error instanceof TypeError;
      if (!retryable || attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Formate une date ISO en heure selon le fuseau actif */
export function fmtTime(isoOrDate) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const tz = USE_LOCAL_TZ ? TZ_LOCAL : 'UTC';
  const suffix = USE_LOCAL_TZ ? '' : ' UTC';
  return d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit', timeZone: tz}) + suffix;
}

/** Formate une date ISO en date+heure selon le fuseau actif */
export function fmtDateTime(isoOrDate) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const tz = USE_LOCAL_TZ ? TZ_LOCAL : 'UTC';
  const suffix = USE_LOCAL_TZ ? '' : ' UTC';
  return d.toLocaleString('fr-FR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', timeZone: tz}) + suffix;
}

/** Formate une date ISO en date seule (jour de semaine optionnel) selon le fuseau actif */
export function fmtDate(isoOrDate, opts = {}) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const tz = USE_LOCAL_TZ ? TZ_LOCAL : 'UTC';
  return d.toLocaleDateString('fr-FR', {...opts, timeZone: tz});
}

export function toast(msg, dur = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), dur);
}

export function setLoading(on) {
  setLoading_(on);
  document.getElementById('spin').classList.toggle('active', on);
  document.getElementById('btnRefresh').disabled = on;
}

export function badge(v, full) {
  const c = VC[v]||'#888', t = VT[v]||'#fff';
  const l = full ? (VL[v]||'N/A') : (['Vert','Jaune','Orange','Rouge'][v]||'N/A');
  const brd = v===1 ? ';border:1px solid #bbb' : '';
  return `<span class="vbadge" style="background:${c};color:${t}${brd}">${l}</span>`;
}

export function toggleTz() {
  setUSE_LOCAL_TZ(!USE_LOCAL_TZ);
  const btn = document.getElementById('btnTz');
  if (btn) btn.textContent = USE_LOCAL_TZ ? '🕐 Heure Paris' : '🕐 UTC';
  // Ces fonctions seront disponibles via window après globals.js
  if (typeof window.renderHist === 'function') window.renderHist();
  if (document.getElementById('panel4')?.classList.contains('active'))
    if (typeof window.renderJournal === 'function') window.renderJournal();
  if (document.getElementById('panel5')?.classList.contains('active'))
    if (typeof window.renderBassins === 'function') window.renderBassins();
  toast(USE_LOCAL_TZ ? `Heure Paris (${TZ_LOCAL})` : 'Heure UTC');
}

export function updateOnlineStatus() {
  const indicator = document.getElementById('online-indicator');
  if (!indicator) return;
  if (navigator.onLine) {
    indicator.textContent = '🟢';
    indicator.title = 'En ligne';
  } else {
    indicator.textContent = '🔴';
    indicator.title = 'Hors ligne — données en cache';
  }
}
