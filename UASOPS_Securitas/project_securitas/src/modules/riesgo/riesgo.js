/**
 * riesgo.js — Módulo Análisis y Evaluación del Riesgo
 * =====================================================
 * Muestra registros de ANALISIS_OPS.xls (GMB-F10).
 */

const RiesgoModule = (() => {

  let _sortCol = 'fecha';
  let _sortAsc = false;
  let _search  = '';
  let _filter  = '';

  function init() { EventBus.on('data:updated', render); }

  function render() {
    const data  = State.get('data');
    let records = (data.riesgo || []).slice();

    const cliente = State.get('filter_cliente') || '';
    const fechaDesde = State.get('filter_fecha_desde') || '';
    const fechaHasta = State.get('filter_fecha_hasta') || '';
    if (_filter) records = records.filter(r => r.piloto === _filter);
    if (cliente) records = records.filter(r => r.cuenta === cliente);
    if (fechaDesde) records = records.filter(r => { const d = (r.fecha || '').split(' ')[0]; return d >= fechaDesde; });
    if (fechaHasta) records = records.filter(r => { const d = (r.fecha || '').split(' ')[0]; return d <= fechaHasta; });
    if (_search) records = records.filter(r =>
      JSON.stringify(r).toLowerCase().includes(_search.toLowerCase())
    );
    records = Sorter.sort(records, _sortCol, _sortAsc);

    const tbody = document.getElementById('tbl-riesgo');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:32px">
        ${_filter ? `Sin registros para ${Formatter.shortName(_filter)}` : 'Sin registros de análisis de riesgo'}
      </td></tr>`;
      _setText('rie-total', 0);
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
        <td class="text-sm">${Formatter.date(r.fecha) || '—'}</td>
        <td style="font-size:11px;color:var(--text2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.cuenta || '—'}</td>
        <td style="font-size:11px;color:var(--text2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.sitio || '—'}</td>
        <td style="text-align:center">${Formatter.badge(r.formulario || 'GMB-F10', 'orange')}</td>
      </tr>`;
    }).join('');

    _setText('rie-total', records.length);
    _bindSortHeaders();
  }

  function _bindSortHeaders() {
    document.querySelectorAll('[data-sort-rie]').forEach(th => {
      th.onclick = () => {
        const col = th.dataset.sortRie;
        if (_sortCol === col) _sortAsc = !_sortAsc;
        else { _sortCol = col; _sortAsc = true; }
        render();
      };
    });
  }

  function search(query)       { _search = query; render(); }
  function filterByPilot(name) { _filter = name;  render(); }
  function sortBy(colIdx) {
    const cols = ['id','piloto','fecha','cuenta','sitio','formulario'];
    if (_sortCol === cols[colIdx]) _sortAsc = !_sortAsc;
    else { _sortCol = cols[colIdx] || 'fecha'; _sortAsc = true; }
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
