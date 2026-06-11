/**
 * dashboard.js — Módulo Dashboard Principal
 * ==========================================
 * v2.0 — Filtro de cliente estricto y persistente.
 *
 * FIXES aplicados:
 *  1. El filtro de cliente se lee en CADA render() desde State.
 *  2. pilotStats se calcula sobre filteredData (nunca sobre data crudo).
 *  3. El contador de pilotos refleja solo los pilotos activos en el cliente.
 *  4. Se emite el evento 'filter:cliente_changed' para que módulos hijos
 *     puedan reaccionar de forma independiente (incluyendo pilotos.js).
 */

const DashboardModule = (() => {

  let _initialized = false;

  // ─── Inicialización (una sola vez) ───────────────────────────
  function init() {
    if (_initialized) return;

    EventBus.on('data:updated',          () => render());
    EventBus.on('upload:integrated',     () => render());
    // Cuando cambia el filtro de cliente desde app.js, re-renderizar
    EventBus.on('filter:cliente_changed', () => render());

    _initialized = true;
  }

  // ─── Render principal ─────────────────────────────────────────
  function render() {
    const rawData = State.get('data');
    const pilots  = State.get('pilots');
    const cliente = State.get('filter_cliente') || '';

    // ── Filtrado estricto por cliente ──────────────────────────
    // Si hay cliente seleccionado → filtrar cada colección.
    // Si es "Todos" (cliente === '') → usar rawData completo.
    const filteredData = _applyClientFilter(rawData, cliente);

    // ── Indicador visual de cliente activo ─────────────────────
    _updateClientLabel(cliente);

    // ── Calcular estadísticas SOBRE filteredData (nunca raw) ───
    const totals = Calculator.globalTotals(filteredData);

    // Pilotos activos: solo los que tienen registros en filteredData
    const activePilots = _getActivePilots(pilots, filteredData, cliente);
    const pilotStats   = Calculator.allPilotsStats(activePilots, filteredData);
    const maxHours     = Math.max(...pilotStats.map(p => p.flightHours), 1);

    // ── Renderizado de secciones ───────────────────────────────
    _renderStatCards(totals, activePilots.length);
    _renderHoursChart(pilotStats, maxHours);
    _renderFormChart(filteredData);
    _renderTimeline(filteredData);
  }

  // ─── Aplicar filtro estricto de cliente ───────────────────────
  /**
   * Devuelve una copia de data con cada colección filtrada por cliente.
   * Si cliente === '' devuelve data tal cual (sin copiar, para eficiencia).
   * @param {Object} data      - Estado crudo de State.get('data')
   * @param {string} cliente   - Nombre del cliente o '' para todos
   * @returns {Object}         - Datos filtrados
   */
  function _applyClientFilter(data, cliente) {
    if (!cliente) return data; // "Todos" → sin filtro

    const filtered = {};
    const keys = ['bitacora', 'misiones', 'planeamiento', 'riesgo', 'mantenimiento'];
    keys.forEach(key => {
      filtered[key] = (data[key] || []).filter(r => r.cuenta === cliente);
    });
    return filtered;
  }

  // ─── Pilotos activos en el contexto del filtro ────────────────
  /**
   * Cuando hay un cliente seleccionado, devuelve solo los pilotos
   * que tienen al menos UN registro en filteredData.
   * Cuando es "Todos", devuelve la lista completa de pilotos.
   */
  function _getActivePilots(pilots, filteredData, cliente) {
    if (!cliente) return pilots; // Todos → lista completa

    const activePilotNames = new Set(
      Object.values(filteredData)
        .flat()
        .map(r => r.piloto)
        .filter(Boolean)
    );

    return pilots.filter(p => activePilotNames.has(p.name));
  }

  // ─── Actualizar etiqueta de cliente activo ────────────────────
  function _updateClientLabel(cliente) {
    const clientLabel = document.getElementById('dashboard-client-label');
    if (!clientLabel) return;

    if (cliente) {
      // Abreviar nombre largo para UI
      const displayName = cliente.length > 35 ? cliente.substring(0, 35) + '…' : cliente;
      clientLabel.textContent = `📍 ${displayName}`;
      clientLabel.style.color  = 'var(--accent)';
      clientLabel.title        = cliente; // tooltip con nombre completo
    } else {
      clientLabel.textContent = '📊 Todos los clientes';
      clientLabel.style.color  = 'var(--text2)';
      clientLabel.title        = '';
    }
  }

  // ── Tarjetas de estadísticas ──────────────────────────────────
  function _renderStatCards(totals, numPilots) {
    _setCard('stat-total-hours', totals.totalHoursStr,    'accent');
    _setCard('stat-pilots',      numPilots,                'green');
    _setCard('stat-flights',     totals.totalFlights,      'accent');
    _setCard('stat-missions',    totals.totalMisiones,     'orange');
    _setCard('stat-total',       totals.totalRecords,      'accent');
    _setCard('stat-mant',        totals.totalMantenimiento, 'green');
  }

  function _setCard(id, value, _variant) {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.textContent;
    if (String(prev) === String(value)) return; // no change → no animation
    el.textContent = value;
    // Emil: animate number change — occasional (data load) → delight OK
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'numberIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both';
  }

  // ── Gráfica de horas por piloto ───────────────────────────────
  function _renderHoursChart(pilotStats, maxHours) {
    Charts.renderBarChart('chart-hours',
      pilotStats.map((p, i) => ({
        label:    Formatter.shortName(p.name),
        value:    parseFloat(p.flightHoursStr),
        color:    Formatter.pilotColor(i),
        sublabel: `${p.numFlights} vuelo${p.numFlights !== 1 ? 's' : ''} registrados`,
      })),
      { suffix: ' h' }
    );
  }

  // ── Gráfica de distribución de formularios ────────────────────
  function _renderFormChart(data) {
    Charts.renderFormDistribution('chart-forms', data);
  }

  // ── Línea de tiempo ───────────────────────────────────────────
  function _renderTimeline(data) {
    const allEvents = [
      ...(data.bitacora      || []).map(r => ({ ...r, tipo: '✈ Vuelo',       color: APP_CONFIG.formTypes.bitacora.color })),
      ...(data.misiones      || []).map(r => ({ ...r, tipo: '🎯 Misión',      color: APP_CONFIG.formTypes.misiones.color })),
      ...(data.planeamiento  || []).map(r => ({ ...r, tipo: '🗺 Planeamiento', color: APP_CONFIG.formTypes.planeamiento.color })),
      ...(data.riesgo        || []).map(r => ({ ...r, tipo: '⚠ Riesgo',       color: APP_CONFIG.formTypes.riesgo.color })),
      ...(data.mantenimiento || []).map(r => ({ ...r, tipo: '🔧 Mtto',         color: APP_CONFIG.formTypes.mantenimiento.color })),
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    Charts.renderTimeline('timeline-main', allEvents, 15);
  }

  return { init, render };

})();
