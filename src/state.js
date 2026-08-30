// ── STATE — Variables d'état global ──────────────────────────────────────

export let OBS  = {};        // {code: {H:{val,date}, Q:{val}}}
export let HIST = {};        // {code: {heure_utc: valeur_m}}
export let HOURS = [];       // labels UTC, clés dans HIST
export let HOUR_SLOTS = [];  // timestamps bruts (Date)
export let VIGI_OFFICIAL = {};
export let VIGI_SOURCE_STATUS = 'pending';

export let mapInst    = null;
export let mapMarkers = {};
export let loading    = false;

export let NAPPES_DATA = null;
export let METEO_DATA  = null;
export let SOL_DATA    = null;
export let MAREE_DATA  = null;
export let COEFF_DATA  = null;

export let envLoadingStarted = false;

export let NOTIF_BATCHING = false;
export let NOTIF_BATCH    = [];

export let USE_LOCAL_TZ = true;
export const TZ_LOCAL = 'Europe/Paris';

// Setters (pour mutation depuis d'autres modules)
export function setOBS(v)              { OBS = v; }
export function setHIST(v)             { HIST = v; }
export function setHOURS(v)            { HOURS = v; }
export function setHOUR_SLOTS(v)       { HOUR_SLOTS = v; }
export function setVIGI_OFFICIAL(v)    { VIGI_OFFICIAL = v; }
export function setVIGI_SOURCE_STATUS(v){ VIGI_SOURCE_STATUS = v; }
export function setMapInst(v)          { mapInst = v; }
export function addMapMarker(code, m)  { mapMarkers[code] = m; }
export function setLoading_(v)         { loading = v; }
export function setNAPPES_DATA(v)      { NAPPES_DATA = v; }
export function setMETEO_DATA(v)       { METEO_DATA = v; }
export function setSOL_DATA(v)         { SOL_DATA = v; }
export function setMAREE_DATA(v)       { MAREE_DATA = v; }
export function setCOEFF_DATA(v)       { COEFF_DATA = v; }
export function setEnvLoadingStarted(v){ envLoadingStarted = v; }
export function setNOTIF_BATCHING(v)   { NOTIF_BATCHING = v; }
export function setNOTIF_BATCH(v)      { NOTIF_BATCH = v; }
export function setUSE_LOCAL_TZ(v)     { USE_LOCAL_TZ = v; }
