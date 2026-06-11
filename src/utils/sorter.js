/**
 * sorter.js — Ordenamiento y Filtrado de Tablas
 * ===============================================
 * Lógica reutilizable para ordenar y buscar en cualquier tabla del sistema.
 */

const Sorter = (() => {

  // Guarda el estado de ordenamiento por tabla
  const _sortStates = {};

  return {

    /**
     * Ordena un array de objetos por una clave dada.
     * Usado por los módulos de render (BitacoraModule, etc.)
     *
     * @param {Array}   records  - Array de objetos a ordenar
     * @param {string}  col      - Nombre del campo por el cual ordenar
     * @param {boolean} asc      - true = ascendente, false = descendente
     * @returns {Array} Nuevo array ordenado
     */
    sort(records, col, asc) {
      if (!records || !col) return records || [];
      return records.slice().sort((a, b) => {
        const va = (a[col] ?? '').toString().trim();
        const vb = (b[col] ?? '').toString().trim();
        const na = parseFloat(va.replace(/[^\d.-]/g, ''));
        const nb = parseFloat(vb.replace(/[^\d.-]/g, ''));
        if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    },

    /**
     * Ordena las filas de un <tbody> por una columna dada.
     * Alterna asc/desc en cada llamada.
     *
     * @param {string} tbodyId   - ID del elemento <tbody>
     * @param {number} colIndex  - Índice de la columna (0-based)
     */
    sortTable(tbodyId, colIndex) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;

      const key = `${tbodyId}__${colIndex}`;
      _sortStates[key] = !_sortStates[key]; // toggle asc/desc
      const asc = _sortStates[key];

      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        const va = (a.cells[colIndex]?.textContent || '').trim();
        const vb = (b.cells[colIndex]?.textContent || '').trim();

        // Si ambos son numéricos, ordenar numéricamente
        const na = parseFloat(va.replace(/[^\d.-]/g, ''));
        const nb = parseFloat(vb.replace(/[^\d.-]/g, ''));

        if (!isNaN(na) && !isNaN(nb)) {
          return asc ? na - nb : nb - na;
        }

        // Ordenar como texto
        return asc ? va.localeCompare(vb, APP_CONFIG.app.locale) : vb.localeCompare(va, APP_CONFIG.app.locale);
      });

      rows.forEach(r => tbody.appendChild(r));

      // Actualizar indicadores visuales en <th>
      this._updateSortIndicators(tbodyId, colIndex, asc);
    },

    /**
     * Filtra las filas de un <tbody> por texto libre.
     * Busca en TODOS los campos de la fila.
     *
     * @param {string} tbodyId - ID del <tbody>
     * @param {string} query   - Texto a buscar
     */
    filterByText(tbodyId, query) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;

      const q = query.toLowerCase().trim();

      tbody.querySelectorAll('tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = q === '' || text.includes(q) ? '' : 'none';
      });

      this._updateEmptyState(tbody);
    },

    /**
     * Filtra las filas por el valor de data-pilot del tr.
     *
     * @param {string} tbodyId    - ID del <tbody>
     * @param {string} pilotName  - Nombre exacto del piloto ('' = todos)
     */
    filterByPilot(tbodyId, pilotName) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;

      tbody.querySelectorAll('tr').forEach(row => {
        if (!pilotName) {
          row.style.display = '';
        } else {
          row.style.display = row.dataset.pilot === pilotName ? '' : 'none';
        }
      });

      this._updateEmptyState(tbody);
    },

    /**
     * Combina filtro de texto Y piloto.
     */
    filterCombined(tbodyId, query, pilotName) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;

      const q = query.toLowerCase().trim();

      tbody.querySelectorAll('tr').forEach(row => {
        const textMatch  = q === '' || row.textContent.toLowerCase().includes(q);
        const pilotMatch = !pilotName || row.dataset.pilot === pilotName;
        row.style.display = textMatch && pilotMatch ? '' : 'none';
      });

      this._updateEmptyState(tbody);
    },

    /**
     * Actualiza los íconos de ordenamiento en los <th>.
     * Requiere que el <thead> esté en el mismo <table> que el <tbody>.
     */
    _updateSortIndicators(tbodyId, activeCol, asc) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      const ths = tbody.closest('table')?.querySelectorAll('th') || [];
      ths.forEach((th, i) => {
        th.dataset.sortIndicator = '';
        if (i === activeCol) {
          th.dataset.sortIndicator = asc ? '↑' : '↓';
        }
      });
    },

    /**
     * Si no hay filas visibles, muestra un mensaje de "sin resultados".
     */
    _updateEmptyState(tbody) {
      const visibleRows = Array.from(tbody.querySelectorAll('tr')).filter(r => r.style.display !== 'none');
      let emptyRow = tbody.querySelector('.empty-row');

      if (visibleRows.length === 0) {
        if (!emptyRow) {
          emptyRow = document.createElement('tr');
          emptyRow.className = 'empty-row';
          const cols = tbody.closest('table')?.querySelectorAll('th').length || 4;
          emptyRow.innerHTML = `
            <td colspan="${cols}" style="text-align:center;padding:32px;color:var(--text2);font-size:13px">
              🔍 Sin resultados para este filtro
            </td>`;
          tbody.appendChild(emptyRow);
        }
      } else {
        emptyRow?.remove();
      }
    },
  };

})();
