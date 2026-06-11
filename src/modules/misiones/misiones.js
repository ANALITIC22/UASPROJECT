/**
 * misiones.js — Módulo Informes de Misión Cumplida
 * ==================================================
 * Muestra todos los registros de INFORME_DE_MISION_CULPLIDA_OPS.xls
 * Campos: piloto, fecha, área, misión cumplida (SI/NO), detalle, razón no cumplida.
 */

const MisionesModule = (() => {

  let _sortCol = 'fecha';
  let _sortAsc = false;
  let _search  = '';
  let _filter  = '';

  function init() {
    EventBus.on('data:updated', render);
  }

  function render() {
    const data   = State.get('data');
    let records  = (data.misiones || []).slice();

    const cliente  = State.get('filter_cliente') || '';
    const fechaDesde = State.get('filter_fecha_desde') || '';
    const fechaHasta = State.get('filter_fecha_hasta') || '';
    if (_filter)  records = records.filter(r => r.piloto === _filter);
    if (cliente)  records = records.filter(r => r.cuenta === cliente);
    if (fechaDesde) records = records.filter(r => { const d = (r.fecha || '').split(' ')[0]; return d >= fechaDesde; });
    if (fechaHasta) records = records.filter(r => { const d = (r.fecha || '').split(' ')[0]; return d <= fechaHasta; });
    if (_search)  records = records.filter(r =>
      JSON.stringify(r).toLowerCase().includes(_search.toLowerCase())
    );

    records = Sorter.sort(records, _sortCol, _sortAsc);

    const tbody = document.getElementById('tbl-misiones');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:32px">
        ${_filter ? `Sin misiones para ${Formatter.shortName(_filter)}` : 'Sin registros de misiones'}
      </td></tr>`;
      _updateStats([]);
      return;
    }

    tbody.innerHTML = records.map((r, i) => {
      const colorIdx = (State.get('pilots') || []).findIndex(p => p.name === r.piloto);
      const color    = Formatter.pilotColor(colorIdx >= 0 ? colorIdx : i);

      return `<tr class="animate-fade-in">
        <td class="id-cell">${r.id || '—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:26px;height:26px;border-radius:50%;background:${color}22;
              border:1px solid ${color}55;display:flex;align-items:center;justify-content:center;
              font-size:9px;font-weight:700;color:${color};flex-shrink:0">
              ${_initials(r.piloto)}
            </div>
            <span style="color:#fff;font-size:12px">${Formatter.shortName(r.piloto || '—')}</span>
          </div>
        </td>
        <td class="text-sm">${Formatter.date(r.fecha)}</td>
        <td style="font-size:11px;color:var(--text2);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.cuenta || '—'}</td>
        <td style="text-align:center">${Formatter.misionBadge(r.mision_cumplida)}</td>
        <td style="font-size:11px;color:var(--text2);max-width:180px">${r.area_volada || '—'}</td>
        <td style="font-size:11px;color:var(--text2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            title="${(r.detalle_mision || r.razon_no_cumplida || '').replace(/"/g,"'")}">
          ${r.mision_cumplida === 'SI'
            ? (r.detalle_mision     ? r.detalle_mision.substring(0, 60)     + (r.detalle_mision.length     > 60 ? '…' : '') : '—')
            : (r.razon_no_cumplida  ? r.razon_no_cumplida.substring(0, 60)  + (r.razon_no_cumplida.length  > 60 ? '…' : '') : '—')}
        </td>
        <td style="font-size:11px;color:var(--text2)">${r.hora_despegue || '—'} → ${r.hora_aterrizaje || '—'}</td>
      </tr>`;
    }).join('');

    _updateStats(records);
    _bindSortHeaders();
  }

  function _updateStats(records) {
    const cumplidas   = records.filter(r => r.mision_cumplida === 'SI').length;
    const noCumplidas = records.filter(r => r.mision_cumplida === 'NO').length;
    const pct = records.length > 0 ? ((cumplidas / records.length) * 100).toFixed(0) : 0;

    _setText('mis-total',        records.length);
    _setText('mis-cumplidas',    cumplidas);
    _setText('mis-no-cumplidas', noCumplidas);
    _setText('mis-tasa',         pct + '%');
  }

  function _bindSortHeaders() {
    document.querySelectorAll('[data-sort-mis]').forEach(th => {
      th.onclick = () => {
        const col = th.dataset.sortMis;
        _sortCol = _sortCol === col ? _sortCol : col;
        if (_sortCol === col) _sortAsc = !_sortAsc;
        else { _sortCol = col; _sortAsc = true; }
        render();
      };
    });
  }

  function search(query)         { _search = query; render(); }
  function filterByPilot(name)   { _filter = name;  render(); }
  function sortBy(colIdx) {
    const cols = ['id','piloto','fecha','cuenta','mision_cumplida','area_volada'];
    _sortCol = cols[colIdx] || 'fecha';
    _sortAsc = !_sortAsc;
    render();
  }

  function _initials(name) {
    if (!name) return '?';
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
  }
  function _setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

  return { init, render, search, filterByPilot, sortBy };
})();
