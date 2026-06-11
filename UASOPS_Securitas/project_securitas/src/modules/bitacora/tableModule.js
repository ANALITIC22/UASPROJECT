/**
 * tableModule.js — Módulo Bitácora de Vuelo
 */

const BitacoraModule = (() => {

  let _sortCol = 'fecha';
  let _sortAsc  = false;
  let _textQuery = '';

  function init() {
    EventBus.on('data:updated', render);
  }

  function render() {
    const data     = State.get('data');
    const piloto   = State.get('filter_piloto')  || '';
    const cliente  = State.get('filter_cliente') || '';
    const fechaDesde = State.get('filter_fecha_desde') || '';
    const fechaHasta = State.get('filter_fecha_hasta') || '';

    let records = (data.bitacora || []).slice();

    if (piloto)  records = records.filter(r => r.piloto === piloto);
    if (cliente) records = records.filter(r => r.cuenta === cliente);
    if (fechaDesde) records = records.filter(r => {
      const d = (r.fecha || '').split(' ')[0];
      return d >= fechaDesde;
    });
    if (fechaHasta) records = records.filter(r => {
      const d = (r.fecha || '').split(' ')[0];
      return d <= fechaHasta;
    });
    if (_textQuery) {
      const q = _textQuery.toLowerCase();
      records = records.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    }

    records = Sorter.sort(records, _sortCol, _sortAsc);

    const tbody = document.getElementById('tbl-bitacora');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text2);padding:32px">
        ${piloto || cliente ? `Sin registros para los filtros aplicados` : 'Sin registros de bitácora'}
      </td></tr>`;
      _updateStats([], data);
      return;
    }

    tbody.innerHTML = records.map((r, i) => {
      const horas    = ((parseInt(r.minutos) || 0) / 35).toFixed(2);
      const colorIdx = (State.get('pilots') || []).findIndex(p => p.name === r.piloto);
      const color    = Formatter.pilotColor(colorIdx >= 0 ? colorIdx : i);

      return `<tr class="animate-fade-in">
        <td class="id-cell">${r.id || '—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:${color}22;
              border:1px solid ${color}55;display:flex;align-items:center;justify-content:center;
              font-size:9px;font-weight:700;color:${color};flex-shrink:0">
              ${_initials(r.piloto)}
            </div>
            <span style="color:#fff;font-size:12px">${Formatter.shortName(r.piloto || '—')}</span>
          </div>
        </td>
        <td class="text-sm">${Formatter.date(r.fecha)}</td>
        <td style="font-size:11px;color:var(--text2);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.cuenta || ''}">${r.cuenta || '—'}</td>
        <td style="text-align:center;font-weight:700;color:var(--yellow)">${r.minutos || 0} min</td>
        <td style="text-align:center">${Formatter.hoursCell(horas)}</td>
        <td>${Formatter.badge(r.tipo_mision || '—', 'blue')}</td>
        <td>${Formatter.badge(r.tipo_vuelo || '—', r.tipo_vuelo === 'Vuelo Nocturno' ? 'purple' : 'cyan')}</td>
        <td style="font-size:11px;color:var(--text2)">${r.hora_despegue || '—'} → ${r.hora_aterrizaje || '—'}</td>
        <td style="font-size:11px;color:var(--text2)">${r.aeronave ? r.aeronave.replace('DRONE ','') : '—'}</td>
        <td style="font-size:10px;color:var(--text3)">${r.contacto_visual || '—'}</td>
      </tr>`;
    }).join('');

    _updateStats(records, data);
    _bindSortHeaders();
  }

  function _updateStats(records, data) {
    const totalMin   = records.reduce((s, r) => s + (parseInt(r.minutos) || 0), 0);
    const totalHoras = (totalMin / 35).toFixed(2);
    const pilotos    = new Set(records.map(r => r.piloto)).size;
    _setText('bit-total-vuelos',  records.length);
    _setText('bit-total-horas',   totalHoras + ' h');
    _setText('bit-total-pilotos', pilotos);
    _setText('bit-total-minutos', totalMin + ' min');
  }

  function _bindSortHeaders() {
    document.querySelectorAll('[data-sort-bit]').forEach(th => {
      th.onclick = () => {
        const col = th.dataset.sortBit;
        if (_sortCol === col) { _sortAsc = !_sortAsc; }
        else { _sortCol = col; _sortAsc = true; }
        render();
      };
    });
  }

  function _initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function search(query) {
    _textQuery = query;
    render();
  }

  function filterByPilot(name) {
    State.set('filter_piloto', name);
    render();
  }

  return { init, render, search, filterByPilot };

})();
