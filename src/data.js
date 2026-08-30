// ── DATA — Chargement des données hydrologiques ───────────────────────────

import { ST, CODES, API, METEO_API, SOL_API, MAREE_API, POINTS_22, SOL_POINTS, SOL_LAYERS, PORTS_22, VIGICRUES_OBS } from './config.js';
import {
  OBS,
  METEO_DATA,
  SOL_DATA,
  COEFF_DATA,
  loading,
  envLoadingStarted,
  setOBS,
  setHIST,
  setHOURS,
  setHOUR_SLOTS,
  setEnvLoadingStarted,
  setMETEO_DATA,
  setSOL_DATA,
  setNAPPES_DATA,
  setMAREE_DATA,
  setCOEFF_DATA,
  setNOTIF_BATCHING,
  setNOTIF_BATCH
} from './state.js';
import { fetchJson, setLoading, fmtDateTime, toast } from './utils.js';
import { loadOfficialVigilance, refValue } from './vigi.js';
import { cacheSave } from './cache.js';
import { detectEvents, setPREV_OBS, PREV_OBS } from './journal.js';
import { flushNotifBatch } from './notif.js';
import { updateMap } from './map.js';
import { renderBassins, renderHist } from './render.js';

// ── PROPAGATION ──
// Source unique : window.PROP_DATA, injectée par init.js
export function checkPropagation() {
  const PROP_ARCS = window.PROP_DATA || [];
  const arcsActifs = [];
  const arcsPending = [];
  for (const arc of PROP_ARCS) {
    const hmFrom = OBS[arc.from]?.H ? OBS[arc.from].H.val/1000 : null;
    if (hmFrom == null) continue;
    const seuil = refValue(arc.from, 's1');
    if (!seuil || hmFrom < seuil * 0.85) continue;
    const enriched = { ...arc, from_nom: ST[arc.from]?.n.replace(' ★','') || arc.from };
    // confiance=0 : arc non calibré — surveiller mais ne pas alerter
    if (arc.confiance > 0) arcsActifs.push(enriched);
    else arcsPending.push(enriched);
  }
  window.PROP_ACTIVE_ARCS  = arcsActifs;
  window.PROP_PENDING_ARCS = arcsPending;
}

// ── LOAD ALL ──
export async function loadAll() {
  if (loading) return;
  window.scheduleAutoRefresh && window.scheduleAutoRefresh();
  setLoading(true);
  document.getElementById('t12').innerHTML = '<tr><td style="padding:2rem;color:#8a9b8a;font-style:italic">Chargement…</td></tr>';
  const btnCsv = document.getElementById('btnCsv');
  if (btnCsv) btnCsv.disabled = true;
  setOBS({}); setHIST({});
  const officialVigilancePromise = loadOfficialVigilance();

  try {
    // ── 1. Observations actuelles (H et Q) ──
    const allCodes = encodeURIComponent(CODES.join(','));
    const [obsH, obsQ] = await Promise.all([
      fetchJson(`${API}/observations_tr?code_entite=${allCodes}&grandeur_hydro=H&size=300&sort=desc&fields=code_station,date_obs,resultat_obs`),
      fetchJson(`${API}/observations_tr?code_entite=${allCodes}&grandeur_hydro=Q&size=300&sort=desc&fields=code_station,date_obs,resultat_obs`),
    ]);
    const newOBS = {};
    for (const o of obsH.data||[]) {
      if (!newOBS[o.code_station]?.H) { newOBS[o.code_station] = newOBS[o.code_station]||{}; newOBS[o.code_station].H = {val:o.resultat_obs, date:o.date_obs}; }
    }
    for (const o of obsQ.data||[]) {
      if (!newOBS[o.code_station]?.Q) { newOBS[o.code_station] = newOBS[o.code_station]||{}; newOBS[o.code_station].Q = {val:o.resultat_obs}; }
    }
    setOBS(newOBS);

    // ── 1b. Fallback Vigicrues ──
    const VIGICRUES_ONLY = ['J371301001', 'J813301001'];
    await Promise.all(VIGICRUES_ONLY.filter(c => !OBS[c]?.H).map(async code => {
      try {
        const dv = await fetchJson(`${VIGICRUES_OBS}?code=${code}`, { timeout: 8000 });
        const obs = dv?.Serie?.ObssHydro;
        if (obs && obs.length) {
          for (let i = obs.length - 1; i >= 0; i--) {
            if (obs[i].RsObsHydro != null) {
              if (!OBS[code]) { const o2 = {...OBS}; o2[code] = {}; setOBS(o2); }
              OBS[code].H = { val: obs[i].RsObsHydro, date: obs[i].DtObsHydro };
              break;
            }
          }
        }
      } catch(e) { /* CORS ou timeout */ }
    }));

    // ── 2. Historique 12h ──
    const now = new Date();
    const from = new Date(now.getTime() - 13*3600000);
    const fromStr = from.toISOString().replace(/\.\d+Z$/, 'Z');
    const baseH = new Date(now); baseH.setMinutes(0,0,0);
    const newHOURS = [], newHOUR_SLOTS = [];
    for (let i = 12; i >= 0; i--) {
      const t = new Date(baseH.getTime() - i*3600000);
      newHOUR_SLOTS.push(t);
      newHOURS.push(t.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC');
    }
    setHOURS(newHOURS); setHOUR_SLOTS(newHOUR_SLOTS);

    const b1h = CODES.slice(0,14).join(',');
    const b2h = CODES.slice(14).join(',');
    const [h1, h2] = await Promise.all([
      fetchJson(`${API}/observations_tr?code_entite=${encodeURIComponent(b1h)}&grandeur_hydro=H&size=2000&sort=asc&date_debut_obs=${encodeURIComponent(fromStr)}&fields=code_station,date_obs,resultat_obs`),
      fetchJson(`${API}/observations_tr?code_entite=${encodeURIComponent(b2h)}&grandeur_hydro=H&size=2000&sort=asc&date_debut_obs=${encodeURIComponent(fromStr)}&fields=code_station,date_obs,resultat_obs`),
    ]);

    const raw = {};
    for (const d of [h1, h2]) {
      for (const o of d.data||[]) {
        raw[o.code_station] = raw[o.code_station]||[];
        raw[o.code_station].push({t: new Date(o.date_obs), v: o.resultat_obs});
      }
    }

    const slots = newHOURS.map((_, i) => new Date(baseH.getTime() - (12-i)*3600000));
    const newHIST = {};
    for (const code of CODES) {
      newHIST[code] = {};
      const pts = raw[code]||[];
      for (let i = 0; i < slots.length; i++) {
        const target = slots[i];
        let best = null, bestDelta = Infinity;
        for (const p of pts) {
          const delta = Math.abs(p.t - target);
          if (delta < bestDelta && delta < 3600000) { bestDelta = delta; best = p.v/1000; }
        }
        newHIST[code][newHOURS[i]] = best != null ? +best.toFixed(3) : null;
      }
    }
    setHIST(newHIST);

    const ts = fmtDateTime(new Date());
    const tsEl = document.getElementById('ts');
    if (tsEl) tsEl.textContent = ts;
    toast('Données actualisées — ' + ts);
    await officialVigilancePromise;

  } catch(e) {
    console.error('[loadAll] Erreur chargement données :', e);
    toast('⚠️ Erreur chargement : ' + e.message, 10000);
    const tsEl = document.getElementById('ts');
    if (tsEl) tsEl.textContent = '⚠️ Erreur — ' + new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    setLoading(false);
    return;
  }

  // Détecter les événements
  setNOTIF_BATCHING(true); setNOTIF_BATCH([]);
  const nbNew = detectEvents(PREV_OBS, OBS);
  setPREV_OBS(JSON.parse(JSON.stringify(OBS)));
  flushNotifBatch();
  if (nbNew > 0) toast('📋 ' + nbNew + ' nouvel' + (nbNew>1?'s':'') + ' événement' + (nbNew>1?'s':'') + ' enregistré' + (nbNew>1?'s':''));

  setLoading(false);
  renderBassins();
  renderHist();
  ensureEnvData();
  updateMap();
  window.emRefreshStations && window.emRefreshStations();
  checkPropagation();
  if (btnCsv) btnCsv.disabled = false;
  cacheSave();
}

export async function ensureEnvData() {
  if (envLoadingStarted) return;
  setEnvLoadingStarted(true);
  await Promise.allSettled([
    METEO_DATA ? Promise.resolve() : loadMeteo(),
    SOL_DATA ? Promise.resolve() : loadSol(),
    COEFF_DATA ? Promise.resolve() : loadCoefficients()
  ]);
  window.emUpdateSurgeAlert && window.emUpdateSurgeAlert();
}

// ── MÉTÉO ──
export async function loadMeteo() {
  try {
    const params = 'hourly=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,lifted_index,pressure_msl&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max&timezone=Europe/Paris&past_days=1&forecast_days=3';
    const resps = await Promise.all(POINTS_22.map(p =>
      fetchJson(`${METEO_API}?latitude=${p.lat}&longitude=${p.lon}&${params}`)
    ));
    setMETEO_DATA(resps);
    window.renderMeteo && window.renderMeteo();
    window.renderDailyMeteo && window.renderDailyMeteo();
  } catch(e) {
    console.error('[loadMeteo]', e);
  }
}

// ── SOL ──
export async function loadSol() {
  try {
    const depths = SOL_LAYERS.map(l => l.key).join(',');
    const params = `hourly=${depths}&timezone=Europe/Paris&past_days=1&forecast_days=3`;
    const resps = await Promise.all(SOL_POINTS.map(p =>
      fetchJson(`${SOL_API}?latitude=${p.lat}&longitude=${p.lon}&${params}`)
    ));
    setSOL_DATA(resps);
    window.renderSol && window.renderSol();
  } catch(e) {
    console.error('[loadSol]', e);
  }
}

// ── MARÉE ──
export async function loadMaree() {
  try {
    const params = 'hourly=sea_level_height_msl&timezone=UTC&past_days=1&forecast_days=2';
    const resps = await Promise.all(PORTS_22.map(p =>
      fetchJson(`${MAREE_API}?latitude=${p.lat}&longitude=${p.lon}&${params}`)
    ));
    setMAREE_DATA(resps);
  } catch(e) {
    console.error('[loadMaree]', e);
  }
  if (!COEFF_DATA) await loadCoefficients();
}

// Coefficients de marée officiels SHOM — chargés proactivement (ensureEnvData) pour permettre
// le bandeau de risque de surcote sans que l'utilisateur ait à activer la couche marée
export async function loadCoefficients() {
  try {
    const d = await fetchJson('/api/coefficient?days=10');
    setCOEFF_DATA(d.days || null);
  } catch(e) {
    console.error('[loadCoefficients] indisponibles', e);
    setCOEFF_DATA(null);
  }
}

// ── NAPPES ──
// Percentile historique : le niveau actuel est positionné dans la distribution
// des mesures du même mois calendaire sur toute la chronique du piézomètre
// (approche type indicateur piézométrique standardisé BRGM). Les quantiles
// par mois sont mis en cache localStorage 30 jours pour éviter de recharger
// la chronique complète (~4000 mesures) à chaque visite.
const NAPPE_STATS_TTL = 30 * 86400e3;

function nappeQuantiles(values) {
  // 21 quantiles q0, q5, …, q100 — suffisant pour interpoler un percentile
  const s = [...values].sort((a, b) => a - b);
  const q = [];
  for (let i = 0; i <= 20; i++) {
    const pos = (i / 20) * (s.length - 1);
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    q.push(s[lo] + (s[hi] - s[lo]) * (pos - lo));
  }
  return q;
}

async function fetchNappeStats(sta) {
  const key = 'nappeStats:' + sta.code_bss;
  try {
    const c = JSON.parse(localStorage.getItem(key));
    if (c && Date.now() - c.ts < NAPPE_STATS_TTL) return c;
  } catch {}
  try {
    const d = await fetchJson(
      `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques?code_bss=${encodeURIComponent(sta.code_bss)}&size=4000&sort=desc&fields=date_mesure,niveau_nappe_eau`,
      { timeout: 15000 }
    );
    const rows = (d.data || []).filter(m => m.niveau_nappe_eau != null && m.date_mesure);
    const byMonth = {};
    for (const m of rows) {
      const mo = +m.date_mesure.slice(5, 7);
      (byMonth[mo] = byMonth[mo] || []).push(m.niveau_nappe_eau);
    }
    const months = {};
    for (const mo in byMonth) {
      if (byMonth[mo].length >= 20) months[mo] = nappeQuantiles(byMonth[mo]);
    }
    const years = rows.length >= 2
      ? Math.max(1, Math.round((Date.parse(rows[0].date_mesure) - Date.parse(rows[rows.length - 1].date_mesure)) / 31557600e3))
      : 0;
    const stats = { ts: Date.now(), months, years };
    try { localStorage.setItem(key, JSON.stringify(stats)); } catch {}
    return stats;
  } catch { return null; }
}

/** Percentile (0-100) du niveau actuel dans la distribution historique du même mois, null si chronique insuffisante */
function nappePercentile(stats, niveau, dateMesure) {
  if (!stats || niveau == null || !dateMesure) return null;
  const mo = +String(dateMesure).slice(5, 7);
  // mois de la mesure, sinon mois adjacents (chronique lacunaire)
  const q = stats.months[mo] || stats.months[mo % 12 + 1] || stats.months[(mo + 10) % 12 + 1];
  if (!q) return null;
  if (niveau <= q[0]) return 0;
  if (niveau >= q[20]) return 100;
  let i = 0;
  while (niveau > q[i + 1]) i++;
  const frac = q[i + 1] === q[i] ? 0 : (niveau - q[i]) / (q[i + 1] - q[i]);
  return Math.round((i + frac) * 5);
}

// Alimente uniquement la couche « piézomètres » de la carte état-major :
// le chapitre nappes de l'onglet Contexte a été retiré (indicateur de
// sécheresse plus que d'inondation).
export async function loadNappes() {
  try {
    const dSta = await fetchJson('https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations?code_departement=22&format=json&size=400');
    const stations = (dSta.data || []).filter(s => s.code_bss).slice(0, 30);
    if (!stations.length) { setNAPPES_DATA([]); return; }

    async function fetchChronique(sta) {
      try {
        const d = await fetchJson(
          `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques?code_bss=${encodeURIComponent(sta.code_bss)}&size=10&sort=desc&fields=date_mesure,niveau_nappe_eau,profondeur_nappe`,
          { timeout: 8000 }
        );
        return { ...sta, mesures: d.data || [] };
      } catch { return { ...sta, mesures: [] }; }
    }

    // Batch de 8 en parallèle pour respecter le rate-limit Hub'Eau
    const results = [];
    for (let i = 0; i < stations.length; i += 8) {
      const batch = stations.slice(i, i + 8);
      results.push(...await Promise.all(batch.map(fetchChronique)));
    }

    // Percentile vs chronique historique (cache localStorage → réseau seulement 1×/mois)
    for (let i = 0; i < results.length; i += 8) {
      const batch = results.slice(i, i + 8);
      await Promise.all(batch.map(async sta => {
        const stats = await fetchNappeStats(sta);
        const last = (sta.mesures || [])[0];
        sta.pct = nappePercentile(stats, last?.niveau_nappe_eau, last?.date_mesure);
        sta.pctYears = stats?.years || 0;
      }));
    }

    setNAPPES_DATA(results);
  } catch(e) {
    console.error('[loadNappes]', e);
  }
}
