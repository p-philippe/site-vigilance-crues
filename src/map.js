// ── MAP — Carte Leaflet principale ────────────────────────────────────────

import { ST, CODES, VC } from './config.js';
import { OBS, mapInst, mapMarkers, setMapInst, addMapMarker } from './state.js';
import { vigi } from './vigi.js';
import { fetchJson, toast } from './utils.js';

export function initMap() {
  const L = window.L;
  const mapInst = L.map('map').setView([48.42, -2.95], 9);
  setMapInst(mapInst);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom:18
  }).addTo(mapInst);

  for (const code of CODES) {
    const st = ST[code];
    const marker = L.marker([st.lat, st.lon], {icon: makeIcon(code)}).addTo(mapInst);
    marker.on('click', () => window.openMod(code));
    addMapMarker(code, marker);
  }

  // Contrôle radar Rainviewer
  const radarCtrl = L.control({position:'topleft'});
  radarCtrl.onAdd = () => {
    const d = L.DomUtil.create('div');
    d.style.cssText = 'background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #d0d5d0;font-family:DM Sans,sans-serif;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12);user-select:none';
    d.innerHTML = '<span id="radar-btn-icon">🌧️</span> <span id="radar-btn-label">Radar pluie</span>';
    d.title = 'Afficher/masquer le radar précipitations Rainviewer';
    d.onclick = window.toggleRadar;
    L.DomEvent.disableClickPropagation(d);
    return d;
  };
  radarCtrl.addTo(mapInst);

  const leg = L.control({position:'bottomright'});
  leg.onAdd = () => {
    const d = L.DomUtil.create('div');
    d.style.cssText = 'background:#fff;padding:10px 14px;border-radius:8px;border:1px solid #d0d5d0;font-family:DM Sans,sans-serif;font-size:11px;line-height:1.9;box-shadow:0 2px 8px rgba(0,0,0,.1)';
    d.innerHTML = '<strong style="font-size:12px">Vigilance crues</strong><br>🟢 Vert — normal<br>🟡 Jaune — vigilance<br>🟠 Orange — crue importante<br>🔴 Rouge — crue majeure';
    return d;
  };
  leg.addTo(mapInst);

  return mapInst;
}

export function makeIcon(code) {
  const L = window.L;
  const o = OBS[code];
  const hm = o?.H ? o.H.val/1000 : null;
  const v = vigi(code, hm);
  const color = VC[v]||'#888';
  const border = v===1 ? '#bbb' : 'rgba(0,0,0,.3)';
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
    iconSize:[14,14], iconAnchor:[7,7], className:''
  });
}

export function updateMap() {
  for (const code of CODES) {
    if (mapMarkers[code]) {
      mapMarkers[code].setIcon(makeIcon(code));
    }
  }
}

// ── Radar pluie animé (RainViewer, fenêtre glissante d'1 heure) ──
const RADAR_FRAME_MS   = 700;             // vitesse de l'animation
const RADAR_REFRESH_MS = 5 * 60 * 1000;   // recharge des frames toutes les 5 min
const RADAR_WINDOW_MIN = 60;              // ne garder que la dernière heure de relevés

let radarFrames  = [];   // [{time, path}] triés du plus ancien au plus récent, dernière heure seulement
let radarHost    = '';
let radarIdx     = 0;
let radarTileLayer   = null;
let radarCtrl        = null;
let radarPlayTimer   = null;
let radarRefreshTimer = null;
let radarTileErrorStreak = 0;
let radarErrorShown  = false;
let radarErrorTimer  = null;

function radarShowError() {
  if (radarErrorShown) return;
  radarErrorShown = true;
  const el = document.getElementById('radar-error-msg');
  if (el) el.style.display = 'block';
  toast('⚠️ Radar pluie indisponible — service RainViewer hors ligne', 5000);
}

function radarHideError() {
  if (!radarErrorShown) return;
  radarErrorShown = false;
  const el = document.getElementById('radar-error-msg');
  if (el) el.style.display = 'none';
}

function radarTileUrl(frame) {
  return `${radarHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}

async function radarFetchFrames() {
  const d = await fetchJson('https://api.rainviewer.com/public/weather-maps.json', { timeout: 8000 });
  radarHost = d.host || 'https://tilecache.rainviewer.com';
  const past = d.radar?.past || [];
  const cutoff = Date.now() / 1000 - RADAR_WINDOW_MIN * 60;
  radarFrames = past.filter(f => f.time >= cutoff);
  if (!radarFrames.length) radarFrames = past.slice(-6);
}

function radarFmtTime(t) {
  return new Date(t * 1000).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}

function radarUpdateLabel() {
  const label = document.getElementById('radar-anim-label');
  const f = radarFrames[radarIdx];
  if (!label || !f) return;
  label.textContent = radarFmtTime(f.time);
}

function radarUpdateTimeline() {
  if (!radarFrames.length) return;
  const total = radarFrames.length;
  const pct = total > 1 ? (radarIdx / (total - 1)) * 100 : 100;
  const cursor = document.getElementById('radar-timeline-cursor');
  const fill = document.getElementById('radar-timeline-fill');
  if (cursor) cursor.style.left = pct + '%';
  if (fill) fill.style.width = pct + '%';
  const startEl = document.getElementById('radar-timeline-start');
  const endEl = document.getElementById('radar-timeline-end');
  if (startEl && radarFrames[0]) startEl.textContent = radarFmtTime(radarFrames[0].time);
  if (endEl && radarFrames[total-1]) endEl.textContent = radarFmtTime(radarFrames[total-1].time);
}

function radarShowFrame(i) {
  if (!radarTileLayer || !radarFrames.length) return;
  radarIdx = ((i % radarFrames.length) + radarFrames.length) % radarFrames.length;
  radarTileLayer.setUrl(radarTileUrl(radarFrames[radarIdx]));
  radarUpdateLabel();
  radarUpdateTimeline();
}

function radarSeekFromEvent(e) {
  const track = document.getElementById('radar-timeline');
  if (!track || !radarFrames.length) return;
  const rect = track.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  radarStopPlay();
  radarShowFrame(Math.round(ratio * (radarFrames.length - 1)));
}

function radarStopPlay() {
  if (radarPlayTimer) { clearInterval(radarPlayTimer); radarPlayTimer = null; }
  const btn = document.getElementById('radar-anim-toggle');
  if (btn) btn.textContent = '▶';
}

function radarPlay() {
  radarStopPlay();
  radarPlayTimer = setInterval(() => radarShowFrame(radarIdx + 1), RADAR_FRAME_MS);
  const btn = document.getElementById('radar-anim-toggle');
  if (btn) btn.textContent = '⏸';
}

function radarTogglePlay() {
  if (radarPlayTimer) radarStopPlay(); else radarPlay();
}

function radarAddControl(map) {
  const L = window.L;
  radarCtrl = L.control({position:'bottomright'});
  radarCtrl.onAdd = () => {
    const d = L.DomUtil.create('div');
    d.style.cssText = 'background:#fff;padding:6px 10px;border-radius:8px;border:1px solid #d0d5d0;font-family:DM Sans,sans-serif;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.12);user-select:none';
    d.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <button id="radar-anim-toggle" style="border:none;background:#eef2ee;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:13px;line-height:1.4">⏸</button>
        <span id="radar-anim-label" style="min-width:78px;display:inline-block">--:--</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:5px;font-size:10px;color:#6b7a6b">
        <span id="radar-timeline-start">--:--</span>
        <div id="radar-timeline" style="position:relative;width:120px;height:16px;cursor:pointer">
          <div style="position:absolute;top:6px;left:0;right:0;height:3px;background:#dfe6df;border-radius:2px"></div>
          <div id="radar-timeline-fill" style="position:absolute;top:6px;left:0;height:3px;background:#2980b9;border-radius:2px;width:0%"></div>
          <div id="radar-timeline-cursor" style="position:absolute;top:1px;width:9px;height:9px;border-radius:50%;background:#2980b9;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transform:translateX(-50%);left:0%"></div>
        </div>
        <span id="radar-timeline-end">--:--</span>
      </div>
      <div id="radar-error-msg" style="display:none;color:#c0392b;font-size:10px;font-weight:600;margin-top:5px">⚠️ Radar indisponible</div>`;
    L.DomEvent.disableClickPropagation(d);
    d.querySelector('#radar-anim-toggle').onclick = radarTogglePlay;
    d.querySelector('#radar-timeline').addEventListener('click', radarSeekFromEvent);
    return d;
  };
  radarCtrl.addTo(map);
}

async function radarRefresh() {
  const wasPlaying = !!radarPlayTimer;
  try {
    await radarFetchFrames();
    if (!radarFrames.length) return;
    radarIdx = 0;
    radarShowFrame(0);
    if (wasPlaying) radarPlay();
  } catch(e) { /* on garde les frames précédentes si le refresh échoue */ }
}

export async function toggleRadar() {
  const L = window.L;
  const map = window.emMap;
  if (!map) return;
  const btn = document.getElementById('em-btn-radar');
  if (radarTileLayer) {
    radarStopPlay();
    if (radarRefreshTimer) { clearInterval(radarRefreshTimer); radarRefreshTimer = null; }
    if (radarErrorTimer) { clearTimeout(radarErrorTimer); radarErrorTimer = null; }
    map.removeLayer(radarTileLayer);
    radarTileLayer = null;
    if (radarCtrl) { map.removeControl(radarCtrl); radarCtrl = null; }
    if (btn) { btn.classList.remove('active'); btn.title = 'Radar pluie (off)'; }
    return;
  }
  if (btn) btn.title = 'Chargement…';
  try {
    await radarFetchFrames();
    if (!radarFrames.length) throw new Error('Pas de frames radar');
    // Pane dédié, toujours sous tronconsPane (550) et markerPane (600) — le radar ne doit jamais couvrir les stations
    if (!map.getPane('radarPane')) {
      map.createPane('radarPane');
      map.getPane('radarPane').style.zIndex = 250;
    }
    radarIdx = 0;
    radarTileErrorStreak = 0;
    radarErrorShown = false;
    if (radarErrorTimer) { clearTimeout(radarErrorTimer); radarErrorTimer = null; }
    radarTileLayer = L.tileLayer(
      radarTileUrl(radarFrames[0]),
      { opacity: 0.6, pane: 'radarPane', maxNativeZoom: 7, maxZoom: 18, attribution: '© <a href="https://rainviewer.com" target="_blank">RainViewer</a>' }
    ).addTo(map);
    radarTileLayer.on('tileerror', () => {
      radarTileErrorStreak++;
      if (!radarErrorTimer) {
        radarErrorTimer = setTimeout(() => {
          radarErrorTimer = null;
          if (radarTileErrorStreak > 0) radarShowError();
        }, 1500);
      }
    });
    radarTileLayer.on('tileload', () => {
      radarTileErrorStreak = 0;
      if (radarErrorTimer) { clearTimeout(radarErrorTimer); radarErrorTimer = null; }
      radarHideError();
    });
    radarAddControl(map);
    radarUpdateLabel();
    radarUpdateTimeline();
    radarPlay();
    radarRefreshTimer = setInterval(radarRefresh, RADAR_REFRESH_MS);
    if (btn) { btn.classList.add('active'); btn.title = 'Radar pluie animé (actif)'; }
  } catch(e) {
    if (btn) { btn.title = 'Radar indisponible'; setTimeout(() => { btn.title = 'Radar pluie'; }, 3000); }
  }
}
