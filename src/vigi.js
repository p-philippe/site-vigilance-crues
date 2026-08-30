// ── VIGI — Logique de vigilance ───────────────────────────────────────────

import { ST, CODES, VIGICRUES_GEOJSON, VIGICRUES_TRONCON_BY_STATION } from './config.js';
import { HIST, VIGI_OFFICIAL, setVIGI_OFFICIAL, setVIGI_SOURCE_STATUS, VIGI_SOURCE_STATUS } from './state.js';

export function officialVigiLevel(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 4) return n - 1;
  if (n >= 0 && n <= 3) return n;
  return null;
}

export function vigi(code, hm) {
  if (hm == null) return -1;
  const official = VIGI_OFFICIAL[code];
  if (official && official.level != null) return official.level;
  return -1;
}

export function vigiSourceLabel(code) {
  const official = VIGI_OFFICIAL[code];
  if (official && official.level != null) return `Vigicrues officiel · ${official.label || official.troncon}`;
  return 'Niveau officiel Vigicrues indisponible';
}

export async function loadOfficialVigilance() {
  setVIGI_SOURCE_STATUS('loading');
  try {
    const r = await fetch(VIGICRUES_GEOJSON);
    if (!r.ok) throw new Error(`Vigicrues ${r.status}`);
    const geo = await r.json();
    const byTroncon = {};
    for (const f of geo.features || []) {
      const p = f.properties || {};
      const troncon = p.CdEntCru || p.acroentcru;
      const level = officialVigiLevel(p.NivInfViCr);
      if (troncon && level != null) {
        byTroncon[troncon] = {
          level, raw: p.NivInfViCr, troncon,
          label: p.lbentcru || troncon,
          updated: p.dhmentcru || p.dhcentcru || ''
        };
      }
    }
    const newVigi = {};
    for (const code of CODES) {
      const troncon = VIGICRUES_TRONCON_BY_STATION[code];
      if (troncon && byTroncon[troncon]) newVigi[code] = byTroncon[troncon];
    }
    setVIGI_OFFICIAL(newVigi);
    setVIGI_SOURCE_STATUS(Object.keys(newVigi).length ? 'official' : 'fallback');
  } catch(e) {
    console.warn('Vigicrues officiel indisponible — niveaux non affichés', e);
    setVIGI_OFFICIAL({});
    setVIGI_SOURCE_STATUS('fallback');
  }
  renderVigiSourceStatus();
}

export function renderVigiSourceStatus() {
  const el = document.getElementById('vigi-source-status');
  if (!el) return;
  if (VIGI_SOURCE_STATUS === 'official') {
    el.innerHTML = `Couleurs vigilance : <strong>flux officiel Vigicrues</strong> · ${Object.keys(VIGI_OFFICIAL).length}/27 stations reliées`;
  } else if (VIGI_SOURCE_STATUS === 'loading') {
    el.textContent = 'Couleurs vigilance : chargement du flux officiel Vigicrues…';
  } else {
    el.innerHTML = 'Couleurs vigilance : <strong>flux officiel Vigicrues indisponible</strong> — niveaux non affichés';
  }
}

export function refCrues(code) {
  const st = ST[code];
  const hist = (st?.h || []).slice().sort((a,b) => a.v - b.v);
  const fallback = [
    {l:'Repère historique bas', v:st?.s?.s1 || 0},
    {l:'Repère historique médian', v:st?.s?.s2 || 0},
    {l:'Repère historique haut', v:st?.s?.s3 || 0}
  ];
  const refs = hist.length >= 3 ? hist.slice(0,3) : fallback;
  return { s1: refs[0], s2: refs[1] || refs[0], s3: refs[2] || refs[1] || refs[0] };
}

export function refValue(code, key) {
  return refCrues(code)[key]?.v || ST[code]?.s?.[key] || 1;
}

export function refLabel(code, key) {
  const r = refCrues(code)[key];
  return r ? r.l : key.toUpperCase();
}

export function trendInfo(code) {
  const histVals = Object.values(HIST[code] || {}).filter(v => v != null);
  if (histVals.length < 2) return {speed:null, icon:'→', cls:'trend-flat', label:'stable'};
  const speed = (histVals[histVals.length - 1] - histVals[0]) / (histVals.length - 1) * 100;
  if (!Number.isFinite(speed)) return {speed:null, icon:'→', cls:'trend-flat', label:'stable'};
  if (speed > 1) return {speed, icon:'↗', cls:'trend-up', label:'hausse'};
  if (speed < -1) return {speed, icon:'↘', cls:'trend-down', label:'baisse'};
  return {speed, icon:'→', cls:'trend-flat', label:'stable'};
}

export function formatSpeed(speed) {
  return speed == null ? '—' : `${speed >= 0 ? '+' : ''}${speed.toFixed(1)} cm/h`;
}
