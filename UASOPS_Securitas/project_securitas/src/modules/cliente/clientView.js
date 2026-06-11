/**
 * clientView.js — Portal Corporativo de Cliente · Dashboard de Analítica Avanzada
 * ==================================================================================
 * Módulo de solo lectura para la presentación ejecutiva del cliente.
 *
 * RESTRICCIÓN DE SEGURIDAD: Todas las consultas están filtradas
 * por .eq(field, CLIENT_ID). Inmutable y hardcodeado.
 *
 * TABLAS (Supabase):
 *   bitacora      → GMB-F15 — historial de vuelos
 *   misiones      → GMB-F16 — informes de misión cumplida
 *   planeamiento  → GMB-F08 — parámetros técnicos
 *   riesgo        → GMB-F10 — análisis de riesgo
 *   mantenimiento → GMB-F11 — mantenimiento preventivo
 */

const ClientView = (() => {

  // ══════════════════════════════════════════════════════════════
  // CONSTANTES DE SEGURIDAD — INMUTABLES — NO MODIFICAR
  // ══════════════════════════════════════════════════════════════
  const CLIENT_ID      = (typeof window !== 'undefined' && window.UASOPS_CLIENT_ID)
                           ? window.UASOPS_CLIENT_ID
                           : 'UAS - CASA DE CAMPO LA CALERA';
  const MINUTES_FACTOR = 35;

  // ── Configuración Supabase ──────────────────────────────────
  const SUPABASE_URL  = 'https://rtxibbdpkmnqmpscbuyn.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0eGliYmRwa21ucW1wc2NidXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODkwNjQsImV4cCI6MjA5Njc2NTA2NH0.IPe-YOuGyYuDTwdisIYiTXjpmLIV99lZ30TGZFqfeYE';

  // ── Mapeo CLIENT_ID (nombre corto) → nombre completo de cuenta ──
  const CLIENT_ACCOUNT_MAP = {
    'UAS - PENALISA':              'CORPORACION CLUB PUERTO PENALISA',
    'UAS - CASA DE CAMPO RESTREPO':'CASA DE CAMPO RESTREPO META',
    'UAS - CASA DE CAMPO LA CALERA':'CONJUNTO CERRADO CASA DE CAMPO PH',
    'UAS - MESA DE YEGUAS':        'CORPORACION MESA DE YEGUAS COUNTRY CLUB',
    'UAS - MOBILE / BOGOTA':       'AVIACION NO TRIPULADA (UAS)',
    'UAS - LA GRAN RESERVA':       'C B HOTELES Y RESORTS S A',
    'UAS - GRUPO EXITO':           'C B HOTELES Y RESORTS S A',
    'UAS - CC SANTAFE':            'CENTRO COMERCIAL SANTA FE',
  };

  // ── Estado interno ──────────────────────────────────────────
  let _sb = null;
  let _allData = { bitacoras: [], misiones: [], planeamientos: [], riesgos: [], mantenimientos: [] };
  let _charts  = { linea: null, riesgo: null };

  // ══════════════════════════════════════════════════════════════
  // INICIALIZACIÓN PÚBLICA
  // ══════════════════════════════════════════════════════════════

  async function init() {
    _setDate();
    _showSkeleton();
    _bindFilterListeners();

    if (typeof supabase === 'undefined') {
      _renderError('Supabase SDK no disponible. Recargue la página.');
      return;
    }

    try { _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
    catch (e) { _renderError('No se pudo conectar a la base de datos: ' + e.message); return; }

    try {
      const [bitacoras, misiones, planeamientos, riesgos, mantenimientos] = await Promise.all([
        _queryCollection('bitacora'),
        _queryCollection('misiones'),
        _queryCollection('planeamiento'),
        _queryCollection('riesgo'),
        _queryCollection('mantenimiento'),
      ]);

      _allData = { bitacoras, misiones, planeamientos, riesgos, mantenimientos };

      _populateDateBanner();
      _populatePilotFilter();
      _populateMatriculaFilter();
      _applyFiltersAndRender();

    } catch (err) {
      console.error('[ClientView] Error al cargar datos:', err);
      _renderError('Error al recuperar datos operacionales: ' + err.message);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CONSULTAS BLINDADAS POR CLIENTE
  // ══════════════════════════════════════════════════════════════

  async function _queryCollection(tableName) {
    const fullAccountName = CLIENT_ACCOUNT_MAP[CLIENT_ID] || CLIENT_ID;
    const seenIds = new Set();
    const allResults = [];

    // 1. Buscar por "cuenta" con el nombre completo del cliente
    await _queryField(tableName, 'cuenta', fullAccountName, seenIds, allResults);

    // 2. Buscar por "proceso_uas" con el nombre corto (CLIENT_ID)
    await _queryField(tableName, 'proceso_uas', CLIENT_ID, seenIds, allResults);

    // 3. Buscar por "proceso_uas" con el nombre completo (bitacora lo usa completo)
    if (fullAccountName !== CLIENT_ID) {
      await _queryField(tableName, 'proceso_uas', fullAccountName, seenIds, allResults);
    }

    return allResults;
  }

  async function _queryField(tableName, field, value, seenIds, results) {
    try {
      const { data, error } = await _sb
        .from(tableName)
        .select('*')
        .eq(field, value)
        .order('fecha', { ascending: false });

      if (error) {
        console.warn(`[ClientView] "${tableName}".${field} = "${value}":`, error.message);
        return;
      }
      if (data && data.length > 0) {
        data.forEach(r => {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            results.push(r);
          }
        });
      }
    } catch (err) {
      console.error(`[ClientView] Fallo en "${tableName}".${field}:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // BANNER DE COBERTURA TEMPORAL
  // ══════════════════════════════════════════════════════════════

  function _populateDateBanner() {
    const allDates = [
      ..._allData.bitacoras,
      ..._allData.misiones,
      ..._allData.riesgos,
    ]
      .map(r => _isoDate(r.fecha))
      .filter(Boolean)
      .sort();

    const el = document.getElementById('coverage-banner');
    if (!el) return;

    if (allDates.length === 0) {
      el.textContent = 'Ventana de Control Operativo: Sin datos registrados en el sistema.';
      return;
    }

    const fechaMin = allDates[0];
    const fechaMax = allDates[allDates.length - 1];
    el.textContent = `Ventana de Control Operativo Activa: Desde ${fechaMin} hasta ${fechaMax}`;
    el.classList.add('banner-loaded');
  }

  // ══════════════════════════════════════════════════════════════
  // POBLAR FILTROS DINÁMICOS
  // ══════════════════════════════════════════════════════════════

  function _populatePilotFilter() {
    const sel = document.getElementById('filter-pilot');
    if (!sel) return;
    const pilots = [...new Set(
      _allData.bitacoras.map(r => _cleanDisplay(r.piloto)).filter(Boolean)
    )].sort();
    sel.innerHTML = '<option value="">Todos los pilotos</option>' +
      pilots.map(p => `<option value="${_esc(p)}">${_esc(p)}</option>`).join('');
  }

  function _populateMatriculaFilter() {
    const sel = document.getElementById('filter-matricula');
    if (!sel) return;
    const mats = [...new Set(
      _allData.bitacoras.map(r => _cleanDisplay(r.matricula)).filter(Boolean)
    )].sort();
    sel.innerHTML = '<option value="">Todas las aeronaves</option>' +
      mats.map(m => `<option value="${_esc(m)}">${_esc(m)}</option>`).join('');
  }

  // ══════════════════════════════════════════════════════════════
  // LISTENERS DE FILTROS + MOTOR REACTIVO
  // ══════════════════════════════════════════════════════════════

  function _bindFilterListeners() {
    ['filter-desde', 'filter-hasta', 'filter-pilot', 'filter-matricula'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', _applyFiltersAndRender);
    });
    const btnClear = document.getElementById('btn-clear-filters');
    if (btnClear) btnClear.addEventListener('click', _clearFilters);

    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh && !btnRefresh.getAttribute('onclick')) {
      btnRefresh.addEventListener('click', () => ClientView.refresh());
    }
  }

  function _clearFilters() {
    ['filter-desde', 'filter-hasta'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['filter-pilot', 'filter-matricula'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    _applyFiltersAndRender();
  }

  function _getActiveFilters() {
    return {
      desde:     (document.getElementById('filter-desde')    || {}).value || '',
      hasta:     (document.getElementById('filter-hasta')    || {}).value || '',
      pilot:     (document.getElementById('filter-pilot')    || {}).value || '',
      matricula: (document.getElementById('filter-matricula') || {}).value || '',
    };
  }

  function _applyFiltersAndRender() {
    const f = _getActiveFilters();

    const filterRecord = (r) => {
      const d = _isoDate(r.fecha);
      if (f.desde && d && d < f.desde) return false;
      if (f.hasta && d && d > f.hasta) return false;
      return true;
    };

    const bitFilt  = _allData.bitacoras.filter(r => {
      if (!filterRecord(r)) return false;
      if (f.pilot     && _cleanDisplay(r.piloto)    !== f.pilot)     return false;
      if (f.matricula && _cleanDisplay(r.matricula) !== f.matricula) return false;
      return true;
    });
    const misFilt  = _allData.misiones.filter(filterRecord);
    const riskFilt = _allData.riesgos.filter(filterRecord);
    const planFilt = _allData.planeamientos.filter(filterRecord);
    const mantFilt = _allData.mantenimientos.filter(filterRecord);

    _renderKPIs(bitFilt, misFilt, riskFilt);
    _renderBitacora(bitFilt);
    _renderPlaneamiento(planFilt);
    _renderMisiones(misFilt);
    _renderMantenimiento(mantFilt);
    _renderChartLinea(bitFilt);
    _renderChartRiesgo(riskFilt);
  }

  // ══════════════════════════════════════════════════════════════
  // PARTE 2 — MATRIZ ESTADÍSTICA DE ALTO IMPACTO
  // ══════════════════════════════════════════════════════════════

  function _renderKPIs(bitacoras, misiones, riesgos) {
    const totalMinutos = bitacoras.reduce((acc, r) => acc + (_parseNum(r.minutos) || 0), 0);
    const horasTotales = (totalMinutos / MINUTES_FACTOR).toFixed(2);
    _animateNumber('kpi-hours', horasTotales);

    const numVuelos = bitacoras.length;
    const promedio  = numVuelos > 0 ? (totalMinutos / numVuelos).toFixed(1) : '—';
    _animateNumber('kpi-avg-flight', promedio, ' min');

    const horaModal = _modaHoraria(bitacoras);
    _setText('kpi-hora-modal', horaModal || '—');

    const pilotoModal = _modaPiloto(bitacoras);
    _setText('kpi-pilot-modal', pilotoModal || '—');

    const totalMis  = misiones.length;
    const cumplidas = misiones.filter(r => String(r.mision_cumplida || '').toUpperCase().trim() === 'SI').length;
    const eficiencia = totalMis > 0 ? ((cumplidas / totalMis) * 100).toFixed(1) + '%' : '—';
    _setText('kpi-efficiency', eficiencia);
    _setText('kpi-efficiency-sub', totalMis > 0 ? `${cumplidas} cumplidas de ${totalMis} registradas` : 'Sin datos de misiones');

    _animateNumber('kpi-missions', misiones.length);

    const riskVals = riesgos.map(r => _extractRiskPercent(r.nivel_riesgo)).filter(v => v !== null);
    if (riskVals.length > 0) {
      const avg = (riskVals.reduce((a, b) => a + b, 0) / riskVals.length).toFixed(1);
      _setText('kpi-risk-avg', avg + '%');
    } else {
      _setText('kpi-risk-avg', '—');
    }
  }

  function _modaHoraria(records) {
    const freq = {};
    records.forEach(r => {
      const hora = _cleanDisplay(r.hora_despegue);
      if (!hora) return;
      const match = hora.match(/^(\d{1,2}):/);
      if (!match) return;
      const h = parseInt(match[1], 10);
      const bloque = `${String(h).padStart(2,'0')}:00 - ${String(h).padStart(2,'0')}:59`;
      freq[bloque] = (freq[bloque] || 0) + 1;
    });
    if (Object.keys(freq).length === 0) return null;
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }

  function _modaPiloto(records) {
    const freq = {};
    records.forEach(r => {
      const p = _cleanDisplay(r.piloto);
      if (!p) return;
      freq[p] = (freq[p] || 0) + 1;
    });
    if (Object.keys(freq).length === 0) return null;
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }

  // ══════════════════════════════════════════════════════════════
  // GRÁFICOS ANALÍTICOS CON CHART.JS
  // ══════════════════════════════════════════════════════════════

  function _renderChartLinea(bitacoras) {
    const ctx = document.getElementById('chart-linea');
    if (!ctx) return;

    const byDate = {};
    bitacoras.forEach(r => {
      const d = _isoDate(r.fecha);
      if (!d) return;
      byDate[d] = (byDate[d] || 0) + (_parseNum(r.minutos) || 0);
    });
    const labels = Object.keys(byDate).sort();
    const values = labels.map(l => byDate[l]);

    if (_charts.linea) { _charts.linea.destroy(); }

    if (labels.length === 0) {
      _showChartEmpty('chart-linea-container', 'Sin datos de bitácora para el período seleccionado.');
      return;
    }
    _hideChartEmpty('chart-linea-container');

    _charts.linea = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Minutos Volados',
          data: values,
          borderColor: '#000000',
          backgroundColor: 'rgba(0,0,0,0.05)',
          borderWidth: 2,
          pointBackgroundColor: '#000000',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1d20',
            titleColor: '#ffffff',
            bodyColor: '#adb5bd',
            borderColor: '#343a40',
            borderWidth: 1,
            callbacks: {
              label: ctx => `${ctx.parsed.y} min (${(ctx.parsed.y / MINUTES_FACTOR).toFixed(2)} h)`,
            },
          },
        },
        scales: {
          x: { grid: { color: '#e9ecef' }, ticks: { color: '#6c757d', font: { size: 11 }, maxRotation: 45 } },
          y: {
            grid: { color: '#e9ecef' },
            ticks: { color: '#6c757d', font: { size: 11 } },
            title: { display: true, text: 'Minutos Volados', color: '#6c757d', font: { size: 11 } },
          },
        },
      },
    });
  }

  function _renderChartRiesgo(riesgos) {
    const ctx = document.getElementById('chart-riesgo');
    if (!ctx) return;

    const byDate = {};
    const counts = {};
    riesgos.forEach(r => {
      const d = _isoDate(r.fecha);
      const v = _extractRiskPercent(r.nivel_riesgo);
      if (!d || v === null) return;
      byDate[d]  = (byDate[d]  || 0) + v;
      counts[d]  = (counts[d]  || 0) + 1;
    });
    const labels = Object.keys(byDate).sort();
    const values = labels.map(l => parseFloat((byDate[l] / counts[l]).toFixed(1)));

    if (_charts.riesgo) { _charts.riesgo.destroy(); }

    if (labels.length === 0) {
      _showChartEmpty('chart-riesgo-container', 'Sin datos de riesgo para el período seleccionado.');
      return;
    }
    _hideChartEmpty('chart-riesgo-container');

    _charts.riesgo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Nivel de Riesgo (%)',
          data: values,
          backgroundColor: values.map(v =>
            v >= 75 ? 'rgba(0,0,0,0.85)' :
            v >= 50 ? 'rgba(52,58,64,0.75)' :
            v >= 25 ? 'rgba(108,117,125,0.65)' : 'rgba(173,181,189,0.55)'
          ),
          borderColor: '#1a1d20',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1d20',
            titleColor: '#ffffff',
            bodyColor: '#adb5bd',
            borderColor: '#343a40',
            borderWidth: 1,
            callbacks: { label: ctx => `Riesgo: ${ctx.parsed.y}%` },
          },
        },
        scales: {
          x: { grid: { color: '#e9ecef' }, ticks: { color: '#6c757d', font: { size: 11 }, maxRotation: 45 } },
          y: {
            min: 0, max: 100,
            grid: { color: '#e9ecef' },
            ticks: { color: '#6c757d', font: { size: 11 }, callback: v => v + '%' },
            title: { display: true, text: 'Nivel de Riesgo (%)', color: '#6c757d', font: { size: 11 } },
          },
        },
      },
    });
  }

  function _showChartEmpty(containerId, msg) {
    const c = document.getElementById(containerId);
    if (!c) return;
    let emp = c.querySelector('.chart-empty');
    if (!emp) { emp = document.createElement('div'); emp.className = 'chart-empty'; c.appendChild(emp); }
    emp.textContent = msg;
    emp.style.display = 'flex';
    const canvas = c.querySelector('canvas');
    if (canvas) canvas.style.display = 'none';
  }

  function _hideChartEmpty(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const emp = c.querySelector('.chart-empty');
    if (emp) emp.style.display = 'none';
    const canvas = c.querySelector('canvas');
    if (canvas) canvas.style.display = 'block';
  }

  // ══════════════════════════════════════════════════════════════
  // TABLAS
  // ══════════════════════════════════════════════════════════════

  function _renderBitacora(records) {
    const tbody = document.getElementById('bitacora-table-body');
    if (!tbody) return;
    if (records.length === 0) {
      tbody.innerHTML = _emptyRow(8, 'Sin registros de bitácora para los filtros aplicados.');
      return;
    }
    tbody.innerHTML = records.map(r => {
      const mins = _parseNum(r.minutos) || 0;
      const horas = mins > 0 ? (mins / MINUTES_FACTOR).toFixed(2) + ' h' : '—';
      return `<tr>
        <td>${_formatDate(r.fecha)}</td>
        <td>${_esc(_cleanDisplay(r.piloto)) || '—'}</td>
        <td>${_esc(_cleanDisplay(r.matricula)) || '—'}</td>
        <td>${_esc(_cleanDisplay(r.aeronave)) || '—'}</td>
        <td>${_esc(_cleanDisplay(r.contacto_visual || r.tipo_contacto)) || '—'}</td>
        <td>${_esc(_cleanDisplay(r.hora_despegue)) || '—'}</td>
        <td>${_esc(_cleanDisplay(r.hora_aterrizaje)) || '—'}</td>
        <td>${mins > 0 ? mins + ' min / ' + horas : '—'}</td>
      </tr>`;
    }).join('');
  }

  function _renderPlaneamiento(records) {
    const tbody = document.getElementById('planeamiento-table-body');
    if (!tbody) return;
    if (records.length === 0) {
      tbody.innerHTML = _emptyRow(6, 'Sin registros de planeamiento para los filtros aplicados.');
      return;
    }
    tbody.innerHTML = records.map(r => `<tr>
      <td>${_formatDate(r.fecha)}</td>
      <td>${_esc(_cleanDisplay(r.altitud_maxima)) || '—'}</td>
      <td>${_esc(_cleanDisplay(r.advertencia_bateria || r.bateria_advertencia)) || '—'}</td>
      <td>${_esc(_cleanDisplay(r.meteorologia || r.reporte_meteorologico)) || '—'}</td>
      <td>${_esc(_cleanDisplay(r.obstaculos)) || '—'}</td>
      <td>${_esc(_cleanDisplay(r.piloto)) || '—'}</td>
    </tr>`).join('');

    const last = records[0];
    if (last) {
      _setElText('p-altitud',  last.altitud_maxima);
      _setElText('p-contacto', last.contacto_visual);
      _setElText('p-bateria',  last.advertencia_bateria || last.bateria_advertencia);
      _setElText('p-despegue', last.hora_despegue);
    }
  }

  function _setElText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = _cleanDisplay(val) || '—';
  }

  function _renderMisiones(records) {
    const tbody = document.getElementById('misiones-table-body');
    if (!tbody) return;
    if (records.length === 0) {
      tbody.innerHTML = _emptyRow(6, 'Sin informes de misión para los filtros aplicados.');
      return;
    }
    tbody.innerHTML = records.map(r => {
      const detalle = _cleanDisplay(r.detalle_mision) || _cleanDisplay(r.observaciones) || _cleanDisplay(r.razon_no_cumplida) || '';
      const ruta    = _cleanDisplay(r.ruta_vuelo || r.ruta_efectuada) || '—';
      return `<tr>
        <td>${_formatDate(r.fecha)}</td>
        <td>${_esc(_cleanDisplay(r.area_volada)) || '—'}</td>
        <td>${_esc(ruta)}</td>
        <td style="text-align:center">${_misionBadge(r.mision_cumplida)}</td>
        <td class="cell-detail">${_esc(detalle) || '—'}</td>
        <td>${_esc(_cleanDisplay(r.piloto)) || '—'}</td>
      </tr>`;
    }).join('');
  }

  function _renderMantenimiento(records) {
    const tbody = document.getElementById('mantenimiento-table-body');
    if (!tbody) return;
    if (records.length === 0) {
      tbody.innerHTML = _emptyRow(5, 'Sin registros de mantenimiento para los filtros aplicados.');
      return;
    }
    tbody.innerHTML = records.map(r => `<tr>
      <td>${_formatDate(r.fecha)}</td>
      <td>${_esc(_cleanDisplay(r.aeronave || r.matricula)) || '—'}</td>
      <td>${_esc(_cleanDisplay(r.piloto)) || '—'}</td>
      <td>${_esc(_cleanDisplay(r.tipo_mantenimiento || r.proceso_uas)) || '—'}</td>
      <td class="cell-detail">${_esc(_cleanDisplay(r.observaciones || r.detalle)) || '—'}</td>
    </tr>`).join('');
  }

  // ══════════════════════════════════════════════════════════════
  // UTILIDADES PRIVADAS
  // ══════════════════════════════════════════════════════════════

  function _misionBadge(val) {
    const s = String(val || '').toUpperCase().trim();
    if (s === 'SI' || s === 'CUM' || s === 'CUMPLIDA') return '<span class="status-badge badge-ok">CUMPLIDA</span>';
    if (s === 'NO' || s === 'NO CUMPLIDA')             return '<span class="status-badge badge-no">NO CUMPLIDA</span>';
    return '<span class="status-badge badge-nd">—</span>';
  }

  function _extractRiskPercent(val) {
    if (val === null || val === undefined || val === '') return null;
    const n = parseFloat(String(val).replace('%', '').trim());
    return isNaN(n) ? null : n;
  }

  function _isoDate(val) {
    if (!val) return '';
    const s = String(val).trim();
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    return '';
  }

  function _formatDate(val) {
    const d = _isoDate(val);
    return d || (val ? String(val).substring(0, 10) : '—');
  }

  function _cleanDisplay(val) {
    if (val === null || val === undefined) return '';
    const s = String(val).trim();
    if (!s || s === 'nan' || s === 'NaN' || s === 'undefined' || s === 'null' || s === '—') return '';
    return s;
  }

  function _parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _emptyRow(cols, msg) {
    return `<tr><td colspan="${cols}" class="empty-row">${msg}</td></tr>`;
  }

  function _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function _setDate() {
    const el = document.getElementById('current-date');
    if (el) el.textContent = new Date().toISOString().substring(0, 10);
  }

  function _showSkeleton() {
    ['kpi-hours','kpi-avg-flight','kpi-hora-modal','kpi-pilot-modal','kpi-efficiency','kpi-missions','kpi-risk-avg']
      .forEach(id => _setText(id, '...'));
  }

  function _animateNumber(id, targetVal, suffix) {
    const el = document.getElementById(id);
    if (!el) return;
    const target = parseFloat(targetVal);
    if (isNaN(target)) { el.textContent = targetVal + (suffix || ''); return; }
    const start = 0;
    const duration = 800;
    const step = (timestamp) => {
      if (!el._startTime) el._startTime = timestamp;
      const progress = Math.min((timestamp - el._startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * ease;
      el.textContent = Number.isInteger(target) ? Math.round(current) + (suffix || '') : current.toFixed(2) + (suffix || '');
      if (progress < 1) requestAnimationFrame(step);
      else { el._startTime = null; el.textContent = targetVal + (suffix || ''); }
    };
    el._startTime = null;
    requestAnimationFrame(step);
  }

  function _renderError(msg) {
    ['kpi-hours','kpi-avg-flight','kpi-hora-modal','kpi-pilot-modal','kpi-efficiency','kpi-missions','kpi-risk-avg']
      .forEach(id => _setText(id, 'ERR'));
    const errRow = cols => `<tr><td colspan="${cols}" class="empty-row" style="color:#dc3545">Error: ${_esc(msg)}</td></tr>`;
    const ids = {
      'bitacora-table-body': 8,
      'misiones-table-body': 6,
      'planeamiento-table-body': 6,
      'mantenimiento-table-body': 5,
    };
    Object.entries(ids).forEach(([id, cols]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = errRow(cols);
    });
    const banner = document.getElementById('coverage-banner');
    if (banner) banner.textContent = 'Error de conexión al sistema de datos. Verifique la configuración de Supabase.';
    console.error('[ClientView]', msg);
  }

  // ══════════════════════════════════════════════════════════════
  // FUNCIÓN PÚBLICA: refresh — recarga forzada desde Supabase
  // ══════════════════════════════════════════════════════════════
  let _isRefreshing = false;

  async function refresh() {
    if (_isRefreshing) return;
    _isRefreshing = true;

    const btn = document.getElementById('btn-refresh');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="refresh-spinner">↻</span> Actualizando…';
    }

    _allData = { bitacoras: [], misiones: [], planeamientos: [], riesgos: [], mantenimientos: [] };
    if (_charts.linea)  { _charts.linea.destroy();  _charts.linea  = null; }
    if (_charts.riesgo) { _charts.riesgo.destroy(); _charts.riesgo = null; }

    _showSkeleton();

    if (!_sb) {
      try { _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
      catch (e) { _renderError('No se pudo conectar: ' + e.message); _isRefreshing = false; return; }
    }

    try {
      const [bitacoras, misiones, planeamientos, riesgos, mantenimientos] = await Promise.all([
        _queryCollection('bitacora'),
        _queryCollection('misiones'),
        _queryCollection('planeamiento'),
        _queryCollection('riesgo'),
        _queryCollection('mantenimiento'),
      ]);

      _allData = { bitacoras, misiones, planeamientos, riesgos, mantenimientos };
      _populateDateBanner();
      _populatePilotFilter();
      _populateMatriculaFilter();
      _applyFiltersAndRender();

      if (btn) { btn.innerHTML = '✓ Actualizado'; }
      setTimeout(() => { if (btn) { btn.disabled = false; btn.innerHTML = '↻ Actualizar'; } }, 1500);

    } catch (err) {
      console.error('[ClientView] Error al refrescar datos:', err);
      _renderError('Error al refrescar: ' + err.message);
      if (btn) { btn.disabled = false; btn.innerHTML = '↻ Actualizar'; }
    } finally {
      _isRefreshing = false;
    }
  }

  return { init, refresh };

})();
