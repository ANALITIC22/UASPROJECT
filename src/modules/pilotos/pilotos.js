/**
 * pilotos.js — Módulo de Pilotos y Horas de Vuelo
 * =================================================
 * v2.0 — Filtro de cliente estricto y persistente.
 *
 * FIXES aplicados:
 *  1. render() ya NO consume data crudo. Aplica filtro de cliente
 *     ANTES de calcular stats, rankings y tarjetas.
 *  2. Escucha el evento 'filter:cliente_changed' para re-renderizarse
 *     de forma reactiva cuando el filtro global cambia.
 *  3. El ranking de horas de vuelo por piloto es 100% consistente
 *     con el filtro activo en el dashboard.
 *  4. El banner de cliente activo es visible en la sección de pilotos.
 */

const PilotosModule = (() => {

  let _initialized  = false;
  let _currentSearch = '';
  let _currentPilot  = '';

  // ─── Inicialización (una sola vez) ───────────────────────────
  function init() {
    if (_initialized) return;

    EventBus.on('data:updated',           () => render());
    EventBus.on('upload:integrated',      () => render());
    // CRÍTICO: re-renderizar cuando el filtro global de cliente cambia
    EventBus.on('filter:cliente_changed', () => render());

    _initialized = true;
  }

  // ─── Render principal ─────────────────────────────────────────
  function render() {
    const rawData = State.get('data');
    const pilots  = State.get('pilots');
    const cliente = State.get('filter_cliente') || '';

    // ── Filtrado estricto por cliente ──────────────────────────
    // NUNCA se pasa rawData directamente a Calculator.
    const filteredData = _applyClientFilter(rawData, cliente);

    // Pilotos activos bajo el filtro actual
    const activePilots = _getActivePilots(pilots, filteredData, cliente);

    // Stats calculadas SOBRE filteredData
    const stats  = Calculator.allPilotsStats(activePilots, filteredData);
    const maxH   = Math.max(...stats.map(p => p.flightHours), 1);

    // ── Actualizar banner de cliente activo ────────────────────
    _updateClientBanner(cliente);

    // ── Renderizar UI ──────────────────────────────────────────
    _renderCards(stats, maxH);
    _renderTable(stats);

    // Resetear filtros de búsqueda local al cambiar de cliente
    _currentSearch = '';
    _currentPilot  = '';
    const searchInput = document.getElementById('search-pilotos');
    if (searchInput) searchInput.value = '';
    const pilotSelect = document.getElementById('pilot-filter-select');
    if (pilotSelect) pilotSelect.value = '';
  }

  // ─── Aplicar filtro estricto de cliente ───────────────────────
  function _applyClientFilter(data, cliente) {
    if (!cliente) return data; // "Todos" → sin modificación

    const filtered = {};
    const keys = ['bitacora', 'misiones', 'planeamiento', 'riesgo', 'mantenimiento'];
    keys.forEach(key => {
      filtered[key] = (data[key] || []).filter(r => r.cuenta === cliente);
    });
    return filtered;
  }

  // ─── Pilotos activos según filteredData ───────────────────────
  function _getActivePilots(pilots, filteredData, cliente) {
    if (!cliente) return pilots;

    const activePilotNames = new Set(
      Object.values(filteredData)
        .flat()
        .map(r => r.piloto)
        .filter(Boolean)
    );

    return pilots.filter(p => activePilotNames.has(p.name));
  }

  // ─── Banner de cliente activo ─────────────────────────────────
  function _updateClientBanner(cliente) {
    // Banner en la sección de pilotos (si existe en el HTML)
    const banner = document.getElementById('pilotos-client-label');
    if (!banner) return;

    if (cliente) {
      const displayName = cliente.length > 40 ? cliente.substring(0, 40) + '...' : cliente;
      banner.textContent = `Mostrando datos de: ${displayName}`;
      banner.style.display = '';
      banner.title = cliente;
    } else {
      banner.textContent = 'Todos los clientes';
      banner.style.display = '';
      banner.title = '';
    }
  }

  // ── Tarjetas de pilotos ───────────────────────────────────────
  function _renderCards(stats, maxH) {
    const grid = document.getElementById('pilots-grid');
    if (!grid) return;

    if (stats.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text2)">
          <div style="font-size:48px;margin-bottom:16px">PILOT</div>
          <div style="font-size:16px">Sin pilotos registrados para el cliente seleccionado</div>
        </div>`;
      return;
    }

    grid.innerHTML = stats.map((p, i) => {
      const color = Formatter.pilotColor(i);
      const pct   = Calculator.percent(p.flightHours, maxH);

      return `
        <div class="pilot-card hover-lift hover-glow animate-fade-in stagger-${i + 1}"
             data-pilot="${p.name}"
             onclick="PilotosModule.selectPilot('${p.name}')">

          <div class="pilot-card__header">
            <div class="avatar avatar--md" style="background:linear-gradient(135deg,${color}66,${color});box-shadow:0 0 16px ${color}44">
              ${p.initials}
            </div>
            <div>
              <div class="pilot-card__name">${p.name}</div>
              <div class="pilot-card__role">🛸 PILOTO UAS · OPERADOR</div>
            </div>
          </div>

          <div class="pilot-card__hours" style="color:${color};text-shadow:0 0 20px ${color}66">
            ${p.flightHoursStr}
          </div>
          <div class="pilot-card__hours-label">
            HORAS DE VUELO &nbsp;·&nbsp; ${p.numFlights} vuelos | ${p.totalMinutes} min ÷ 35
          </div>

          <div class="progress-wrap" style="margin-bottom:var(--space-md)">
            <div class="progress-fill bar-animate"
                 style="width:${pct}%;background:linear-gradient(90deg,${color}88,${color});box-shadow:0 0 8px ${color}66">
            </div>
          </div>

          <div class="pilot-card__mini-stats">
            <div class="mini-stat">
              <div class="mini-stat__val" style="color:${color}">${p.numMisiones}</div>
              <div class="mini-stat__lbl">Misiones</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat__val" style="color:${color}">${p.numPlaneamiento}</div>
              <div class="mini-stat__lbl">Planes</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat__val" style="color:${color}">${p.numRiesgo}</div>
              <div class="mini-stat__lbl">Análisis</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Tabla detallada de ranking ────────────────────────────────
  function _renderTable(stats) {
    const tbody = document.getElementById('tbl-pilotos');
    if (!tbody) return;

    if (stats.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:32px;color:var(--text2)">
            Sin registros para el cliente seleccionado
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = stats.map((p, i) => {
      const color = Formatter.pilotColor(i);
      return `
        <tr data-pilot="${p.name}">
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="avatar avatar--sm" style="background:${color};box-shadow:0 0 8px ${color}44;font-size:10px">${p.initials}</div>
              <strong style="color:#fff">${p.name}</strong>
            </div>
          </td>
          <td>${Formatter.badge(p.numFlights, 'blue')}</td>
          <td><span class="text-muted">${p.totalMinutes} min</span></td>
          <td>${Formatter.hoursCell(p.flightHours)}</td>
          <td>${p.numMisiones}</td>
          <td>${p.numPlaneamiento}</td>
          <td>${p.numRiesgo}</td>
          <td>${p.numMantenimiento}</td>
          <td>${Formatter.badge(p.totalRecords, 'cyan')}</td>
        </tr>`;
    }).join('');
  }

  // ── Filtro de búsqueda local ──────────────────────────────────
  function search(query) {
    _currentSearch = query;
    _applyLocalFilters();
  }

  function filterByPilot(pilotName) {
    _currentPilot = pilotName;
    _applyLocalFilters();
    document.querySelectorAll('.pilot-card').forEach(card => {
      card.classList.toggle('pilot-card--selected', card.dataset.pilot === pilotName);
    });
  }

  function _applyLocalFilters() {
    Sorter.filterCombined('tbl-pilotos', _currentSearch, _currentPilot);
    document.querySelectorAll('#pilots-grid .pilot-card').forEach(card => {
      const match      = card.textContent.toLowerCase().includes(_currentSearch.toLowerCase());
      const pilotMatch = !_currentPilot || card.dataset.pilot === _currentPilot;
      card.style.display = match && pilotMatch ? '' : 'none';
    });
  }

  function selectPilot(name) {
    if (_currentPilot === name) {
      filterByPilot('');
      const sel = document.getElementById('pilot-filter-select');
      if (sel) sel.value = '';
    } else {
      filterByPilot(name);
    }
    EventBus.emit('pilot:selected', name);
  }

  return { init, render, search, filterByPilot, selectPilot };

})();
