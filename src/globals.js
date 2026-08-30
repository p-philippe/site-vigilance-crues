// ── GLOBALS — Expose les fonctions sur window (onclick HTML) ─────────────

import { switchTab, restoreTab } from './tabs.js';
import { loadAll, ensureEnvData, loadMeteo, loadSol, loadNappes, loadMaree } from './data.js';
import { renderBassins, renderHist, toggleBV, toggleFav, toggleFavorite } from './render.js';
import { renderJournal, clearJournal, exportJournalCSV } from './journal.js';
import { renderMeteo, renderDailyMeteo, renderSol, renderNappes, nappeFloodHint } from './meteo.js';
import { openMod, closeMod } from './modal.js';
import { toggleRadar } from './map.js';
import { toggleNotif } from './notif.js';
import { toggleTz } from './utils.js';
import { generatePdfReport, exportSituationGeoJSON, exportCSV } from './pdf.js';
import {
  emInitMap, emRefreshStations, emSetTool, emSetColor, emSetLayer, emToggleStations,
  emToggleMeteo, emToggleSol, emToggleNappes, emToggleMaree,
  emToggleSensitive, emSearchDebounce, emSearchGo, emSearchSelect, emApplyFilters,
  emFinishDraw, emCancelDraw, emClearConfirm, emAddTimestamp, emPrint, emExportGeoJSON, emImportGeoJSON,
  emRemoveLayer, emSaveLocal, emUpdateSurgeAlert
} from './em-map.js';
import {
  rpFetchAll, rpRender, rpRenderStats, rpRenderCandidates, rpValidateCandidates,
  rpSelectAllCandidates, rpAddArticle, rpDeleteArticle, rpToggleForm, rpSubmitForm,
  rpExport, rpImport, rpToggleSIG, rpGeocodeForm, rpInitSIG, rpRenderSIG
} from './rp.js';

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
window.toggleFav = toggleFav;
window.toggleFavorite = toggleFavorite;

// Météo
window.renderMeteo = renderMeteo;
window.renderDailyMeteo = renderDailyMeteo;
window.renderSol = renderSol;
window.renderNappes = renderNappes;
window.nappeFloodHint = nappeFloodHint;

// Modale station
window.openMod = openMod;
window.closeMod = closeMod;

// Radar
window.toggleRadar = toggleRadar;

// Notifications / TZ
window.toggleNotif = toggleNotif;
window.toggleTz = toggleTz;

// Export / PDF
window.generatePdfReport = generatePdfReport;
window.exportSituationGeoJSON = exportSituationGeoJSON;
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
window.emSearchSelect = emSearchSelect;
window.emApplyFilters = emApplyFilters;
window.emFinishDraw = emFinishDraw;
window.emCancelDraw = emCancelDraw;
window.emClearConfirm = emClearConfirm;
window.emAddTimestamp = emAddTimestamp;
window.emPrint = emPrint;
window.emExportGeoJSON = emExportGeoJSON;
window.emImportGeoJSON = emImportGeoJSON;
window.emRemoveLayer = emRemoveLayer;
window.emSaveLocal = emSaveLocal;

// Revue de presse
window.rpFetchAll = rpFetchAll;
window.rpRender = rpRender;
window.rpRenderStats = rpRenderStats;
window.rpRenderCandidates = rpRenderCandidates;
window.rpValidateCandidates = rpValidateCandidates;
window.rpSelectAllCandidates = rpSelectAllCandidates;
window.rpAddArticle = rpAddArticle;
window.rpDeleteArticle = rpDeleteArticle;
window.rpToggleForm = rpToggleForm;
window.rpSubmitForm = rpSubmitForm;
window.rpExport = rpExport;
window.rpImport = rpImport;
window.rpToggleSIG = rpToggleSIG;
window.rpGeocodeForm = rpGeocodeForm;
window.rpInitSIG = rpInitSIG;
window.rpRenderSIG = rpRenderSIG;

