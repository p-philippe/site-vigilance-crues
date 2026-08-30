// ── PDF / EXPORT ─────────────────────────────────────────────────────────

import { ST, CODES } from './config.js';
import { HOURS, HIST } from './state.js';

import { toast } from './utils.js';

export function exportCSV() {
  if (!HOURS.length) return;
  let csv = 'Code;Station;Cours d\'eau;' + HOURS.join(';') + '\n';
  const sorted = CODES.slice().sort((a,b) => ST[a].n.localeCompare(ST[b].n));
  for (const code of sorted) {
    const st = ST[code];
    const vals = HOURS.map(h => HIST[code]?.[h]!=null ? HIST[code][h].toFixed(3) : '');
    csv += `${code};"${st.n.replace(' ★','')}";${st.c};${vals.join(';')}\n`;
  }
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vigicrues_22_' + new Date().toISOString().slice(0,16).replace('T','_').replace(':','h') + '.csv';
  a.click();
  toast('CSV exporté');
}
