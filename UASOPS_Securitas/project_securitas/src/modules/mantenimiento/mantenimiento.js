/**
 * mantenimiento.js — Módulo Mantenimiento Preventivo UAS
 * ========================================================
 * Muestra registros de MANTENIMIENTO_PREVENTIVO.xls (GMB-F11).
 * Campos: piloto, aeronave, cliente, observaciones.
 */

const MantenimientoModule = (() => {

  let _sortCol = 'piloto';
  let _sortAsc = true;
  let _search  = '';

  function init() { EventBus.on('data:updated', render); }

  function render() {
    const data    = State.get('data');
    const cliente = State.get('filter_cliente') || '';
    const fechaDesde = State.get('filter_fecha_desde') || '';
    const fechaHasta = State.get('filter_fecha_hasta') || '';
    let records   = (data.mantenimiento || []).slice();

    if (cliente)  records = records.filter(r => r.cuenta === cliente);
    if (fechaDesde) records = records.filter(r => { const d = (r.fecha || '').split(' ')[0]; return d >= fechaDesde; });
    if (fechaHasta) records = records.filter(r => { const d = (r.fecha || '').split(' ')[0]; return d <= fechaHasta; });
    if (_search)  records = records.filter(r =>
      JSON.stringify(r).toLowerCase().includes(_search.toLowerCase())
    );
    records = Sorter.sort(records, _sortCol, _sortAsc);

    const tbody = document.getElementById('tbl-mant');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:32px">
        Sin registros de mantenimiento
      </td></tr>`;
      _setText('mant-total', 0);
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
            <div>
              <div style="color:#fff;font-size:12px">${Formatter.shortName(r.piloto || '—')}</div>
              <div style="color:var(--text3);font-size:10px">${r.nombre_piloto_registro || ''}</div>
            </div>
          </div>
        </td>
        <td style="font-size:11px;color:var(--text2)">${r.cliente || r.cuenta || '—'}</td>
        <td>${Formatter.badge(r.aeronave || '—', 'cyan')}</td>
        <td>${Formatter.badge(r.tipo || 'Preventivo UAS', 'green')}</td>
        <td style="font-size:11px;color:var(--text2);max-width:200px">${r.observaciones || 'Sin observaciones'}</td>
      </tr>`;
    }).join('');

    _setText('mant-total', records.length);
    _bindSortHeaders();
  }

  function _bindSortHeaders() {
    document.querySelectorAll('[data-sort-mant]').forEach(th => {
      th.onclick = () => {
        const col = th.dataset.sortMant;
        if (_sortCol === col) _sortAsc = !_sortAsc;
        else { _sortCol = col; _sortAsc = true; }
        render();
      };
    });
  }

  function search(query) { _search = query; render(); }
  function sortBy(colIdx) {
    const cols = ['id','piloto','cliente','aeronave','tipo','observaciones'];
    if (_sortCol === cols[colIdx]) _sortAsc = !_sortAsc;
    else { _sortCol = cols[colIdx] || 'piloto'; _sortAsc = true; }
    render();
  }

  function _initials(name) {
    if (!name) return '?';
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
  }
  function _setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

  return { init, render, search, sortBy };
})();
