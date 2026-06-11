/**
 * formatter.js — UASOPS v7
 * Aligned with v7 design tokens. No hardcoded hex from v6.
 */

const Formatter = (() => {

  // v7 palette — matches CSS design tokens
  const PILOT_COLORS = [
    '#22d3ee', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6',
    '#ef4444', '#06b6d4', '#34d399', '#fbbf24', '#a78bfa',
    '#67e8f9', '#f472b6', '#60a5fa', '#6ee7b7', '#fcd34d',
    '#c084fc'
  ];

  function pilotColor(index) {
    return PILOT_COLORS[index % PILOT_COLORS.length];
  }

  function hours(h) {
    if (typeof h === 'string') return h;
    return parseFloat(h).toFixed(APP_CONFIG.flight.HOURS_PRECISION) + ' h';
  }

  function hoursCell(h) {
    const val = parseFloat(h).toFixed(2);
    const color = parseFloat(h) >= 4  ? 'var(--green)'
                : parseFloat(h) >= 2  ? 'var(--accent)'
                : 'var(--yellow)';
    return `<span class="hours-display" style="color:${color}">${val} h</span>`;
  }

  function date(str) {
    if (!str || str === 'NaN' || str === 'nan') return '—';
    const s = String(str).trim();
    if (s.length >= 10) return s.substring(0, 10);
    return s || '—';
  }

  function dateTime(str) {
    if (!str) return '—';
    const s = String(str).trim();
    return s.length > 10 ? s.substring(0, 16) : s;
  }

  // Uses CSS badge classes (not inline hex) — v7 aligned
  function badge(text, color = 'blue') {
    return `<span class="badge badge--${color}">${text}</span>`;
  }

  function misionBadge(cumplida) {
    const s = String(cumplida).toUpperCase().trim();
    if (s === 'SI')  return badge('✓ CUMPLIDA', 'green');
    if (s === 'NO')  return badge('✗ NO CUMPLIDA', 'red');
    return badge(s || '—', 'yellow');
  }

  function shortName(fullName) {
    if (!fullName) return '—';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length-1]}`;
    return fullName;
  }

  function fileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(1)} MB`;
  }

  function minutes(min) {
    const m = parseInt(min) || 0;
    if (m === 0) return '—';
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return h > 0 ? `${h}h ${rem}m` : `${m} min`;
  }

  return {
    pilotColor, hours, hoursCell, date, dateTime,
    badge, misionBadge, shortName, fileSize, minutes,
  };

})();
