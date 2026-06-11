/**
 * charts.js — Motor de Gráficas del Sistema
 * ===========================================
 * Renderiza gráficas sin dependencias externas.
 * Para escalar: integrar Chart.js o D3.js manteniendo esta API.
 */

const Charts = (() => {

  /**
   * Renderiza una gráfica de barras horizontales en un contenedor.
   *
   * @param {string} containerId - ID del elemento contenedor
   * @param {Array}  data        - [{ label, value, color?, sublabel? }]
   * @param {Object} [opts]      - Opciones adicionales
   */
  function renderBarChart(containerId, data, opts = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const {
      suffix     = '',
      animated   = true,
      showValues = true,
    } = opts;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">DASH</div><div class="empty-state__desc">Sin datos disponibles</div></div>`;
      return;
    }

    const maxVal = Math.max(...data.map(d => d.value), 1);

    container.innerHTML = data.map((item, i) => {
      const pct   = (item.value / maxVal) * 100;
      const color = item.color || Formatter.pilotColor(i);
      const delay = animated ? `animation-delay:${i * 0.08}s` : '';

      return `
        <div class="bar-row animate-fade-in" style="${delay}">
          <div class="bar-name" title="${item.label}">${item.label}</div>
          <div class="bar-bg">
            <div class="bar-fill ${animated ? 'bar-animate' : ''}"
                 style="width:${pct}%;background:linear-gradient(90deg,${color}99,${color})">
              ${pct > 25 ? `<span style="color:#fff;font-size:10px;font-family:var(--font-display);padding-left:8px">${item.value}${suffix}</span>` : ''}
            </div>
          </div>
          ${showValues ? `<div class="bar-val" style="color:${color}">${item.value}${suffix}</div>` : ''}
        </div>
        ${item.sublabel ? `<div style="font-size:10px;color:var(--text2);padding-left:var(--bar-name-width,200px);margin-top:-10px;margin-bottom:4px">${item.sublabel}</div>` : ''}
      `;
    }).join('');
  }

  /**
   * Renderiza una gráfica de línea de tiempo (timeline vertical).
   *
   * @param {string} containerId
   * @param {Array}  events - [{ tipo, piloto, fecha, id, color }]
   * @param {number} [limit=15]
   */
  function renderTimeline(containerId, events, limit = 15) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const items = events.slice(0, limit);

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📅</div><div class="empty-state__desc">Sin eventos registrados</div></div>`;
      return;
    }

    container.innerHTML = items.map((ev, i) => {
      const isLast = i === items.length - 1;
      const color  = ev.color || 'var(--accent)';
      const pilot  = Formatter.shortName(ev.piloto);

      return `
        <div class="tl-item animate-fade-in" style="animation-delay:${i * 0.04}s">
          <div class="tl-dot-wrap">
            <div class="tl-dot" style="background:${color};box-shadow:0 0 8px ${color}"></div>
            ${!isLast ? '<div class="tl-line"></div>' : ''}
          </div>
          <div class="tl-content">
            <div class="tl-type">${ev.tipo} — ${pilot}</div>
            <div class="tl-meta">${ev.id} · ${Formatter.date(ev.fecha)}</div>
          </div>
        </div>`;
    }).join('');
  }

  /**
   * Renderiza un mini-gráfico de dona SVG inline (para tarjetas).
   *
   * @param {number} value   - Valor actual
   * @param {number} max     - Valor máximo
   * @param {string} color   - Color del arco
   * @returns {string}       - HTML del SVG
   */
  function donutSVG(value, max, color = 'var(--accent)') {
    const pct    = max > 0 ? Math.min(value / max, 1) : 0;
    const r      = 18;
    const circ   = 2 * Math.PI * r;
    const dash   = pct * circ;
    const gap    = circ - dash;

    return `
      <svg width="48" height="48" viewBox="0 0 48 48" style="transform:rotate(-90deg)">
        <circle cx="24" cy="24" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5"/>
        <circle cx="24" cy="24" r="${r}" fill="none" stroke="${color}" stroke-width="5"
                stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
                stroke-linecap="round"
                style="transition:stroke-dasharray 1s cubic-bezier(.4,0,.2,1)"/>
      </svg>`;
  }

  /**
   * Renderiza una distribución por tipo de formulario (mini barras horizontales).
   * @param {string} containerId
   * @param {Object} data  - { bitacora: 7, misiones: 13, ... }
   */
  function renderFormDistribution(containerId, data) {
    const items = Object.entries(APP_CONFIG.formTypes).map(([key, cfg]) => ({
      label: cfg.label,
      value: (data[key] || []).length,
      color: cfg.color,
    }));

    renderBarChart(containerId, items);
  }

  return {
    renderBarChart,
    renderTimeline,
    renderFormDistribution,
    donutSVG,
  };

})();
