// ── CACHE — IndexedDB hors-ligne ──────────────────────────────────────────

import {
  OBS,
  HIST,
  HOURS,
  VIGI_OFFICIAL,
  METEO_DATA,
  SOL_DATA,
  setOBS,
  setHIST,
  setHOURS,
  setHOUR_SLOTS,
  setVIGI_OFFICIAL,
  setMETEO_DATA,
  setSOL_DATA
} from './state.js';

const IDB_NAME = 'vig22_idb', IDB_VER = 2, IDB_STORE = 'cache';
let _idb = null;

export function idbOpen() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror  = () => rej(req.error);
  });
}

export async function idbPut(key, val) {
  try {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch(e) { console.warn('[IDB] put:', e); }
}

export async function idbGet(key) {
  try {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror  = () => rej(req.error);
    });
  } catch(e) { console.warn('[IDB] get:', e); return null; }
}

export async function cacheSave() {
  try {
    await idbPut('hydro', { ts: Date.now(), OBS, HIST, HOURS, VIGI_OFFICIAL });
    if (METEO_DATA) await idbPut('meteo', { ts: Date.now(), data: METEO_DATA });
    if (SOL_DATA)   await idbPut('sol',   { ts: Date.now(), data: SOL_DATA });
    console.log('[IDB] Cache sauvegardé');
  } catch(e) { console.warn('[IDB] cacheSave:', e); }
}

export async function cacheRestore() {
  try {
    const c = await idbGet('hydro');
    if (!c) return false;
    setOBS(c.OBS || {}); setHIST(c.HIST || {});
    setHOURS(c.HOURS || []); setVIGI_OFFICIAL(c.VIGI_OFFICIAL || {});
    if (c.HOURS && c.HOURS.length) {
      const now = new Date();
      const base = new Date(now);
      base.setMinutes(0,0,0);
      setHOUR_SLOTS(c.HOURS.map((_,i) => new Date(base.getTime() - (c.HOURS.length-1-i)*3600000)));
    }
    const cm = await idbGet('meteo');  if (cm) setMETEO_DATA(cm.data);
    const cs = await idbGet('sol');    if (cs) setSOL_DATA(cs.data);
    const age = Math.round((Date.now() - c.ts) / 60000);
    const tsStr = new Date(c.ts).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const span = document.getElementById('offline-banner-ts');
    if (span) span.textContent = tsStr + (age ? ' — il y a ' + age + ' min' : '');
    document.getElementById('offline-banner')?.classList.add('visible');
    return true;
  } catch(e) { console.warn('[IDB] cacheRestore:', e); return false; }
}
