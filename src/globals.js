// ── GLOBALS — Expose les fonctions sur window (onclick HTML) ─────────────

import { switchTab } from './tabs.js';
import { loadAll, loadMeteo, loadSol, loadNappes, loadMaree } from './data.js';
import { renderBassins, renderHist, toggleBV } from './render.js';
import { renderJournal, clearJournal, exportJournalCSV } from './journal.js';
import { renderMeteo, renderDailyMeteo, renderSol, renderNappes } from './meteo.js';
import { openMod, closeMod } from './modal.js';
import { toggleRadar } from './map.js';
import { toggleNotif } from './notif.js';
import { toggleTz } from './utils.js';
import { exportCSV } from './pdf.js';
import {
  emInitMap, emRefreshStations, emSetTool, emSetColor, emSetLayer, emToggleStations,
  emToggleMeteo, emToggleSol, emToggleNappes, emToggleMaree,
  emToggleSensitive, emSearchDebounce, emSearchGo, emApplyFilters,
  emFinishDraw, emCancelDraw, emClearConfirm, emAddTimestamp, emPrint, emExportGeoJSON, emImportGeoJSON,
  emSaveLocal, emUpdateSurgeAlert
} from './em-map.js';

// Onglets
window.switchTab = switchTab;

// Données
window.loadAll = loadAll;
window.loadMeteo = loadMeteo;
window.loadSol = loadSol;
window.loadNappes = loadNappes;
window.loadMaree = loadMaree;

// Rendu
window.renderBassins = renderBassins;
window.renderHist = renderHist;
window.renderJournal = renderJournal;
window.clearJournal = clearJournal;
window.exportJournalCSV = exportJournalCSV;
window.toggleBV = toggleBV;

// Météo
window.renderMeteo = renderMeteo;
window.renderDailyMeteo = renderDailyMeteo;
window.renderSol = renderSol;
window.renderNappes = renderNappes;

// Modale station
window.openMod = openMod;
window.closeMod = closeMod;

// Radar
window.toggleRadar = toggleRadar;

// Notifications / TZ
window.toggleNotif = toggleNotif;
window.toggleTz = toggleTz;

// Export / PDF
window.exportCSV = exportCSV;

// Carte EM
window.emInitMap = emInitMap;
window.emRefreshStations = emRefreshStations;
window.emSetTool = emSetTool;
window.emSetColor = emSetColor;
window.emSetLayer = emSetLayer;
window.emToggleStations = emToggleStations;
window.emToggleMeteo = emToggleMeteo;
window.emToggleSol = emToggleSol;
window.emToggleNappes = emToggleNappes;
window.emToggleMaree = emToggleMaree;
window.emUpdateSurgeAlert = emUpdateSurgeAlert;
window.emToggleSensitive = emToggleSensitive;
window.emSearchDebounce = emSearchDebounce;
window.emSearchGo = emSearchGo;
window.emApplyFilters = emApplyFilters;
window.emFinishDraw = emFinishDraw;
window.emCancelDraw = emCancelDraw;
window.emClearConfirm = emClearConfirm;
window.emAddTimestamp = emAddTimestamp;
window.emPrint = emPrint;
window.emExportGeoJSON = emExportGeoJSON;
window.emImportGeoJSON = emImportGeoJSON;
window.emSaveLocal = emSaveLocal;

