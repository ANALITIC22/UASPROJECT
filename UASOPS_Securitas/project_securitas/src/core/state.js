/**
 * state.js — Estado Global Centralizado (Store)
 * ===============================================
 * Patrón: Store simple reactivo sin dependencias externas.
 * Para escalar: reemplazar con Redux, Zustand o Pinia.
 */

const State = (() => {

  // ── Estado inicial ────────────────────────────────────────────
  let _state = {
    // Datos de cada módulo
    data: {
      bitacora:      [],
      misiones:      [],
      planeamiento:  [],
      riesgo:        [],
      mantenimiento: [],
    },

    // Lista de pilotos conocidos
    pilots: [],

    // Sección activa de la navegación
    activeSection: 'dashboard',

    // Estado del uploader
    uploader: {
      pendingRecords: [],
      uploadedFiles:  [],
    },

    // UI
    ui: {
      searchQuery:    '',
      selectedPilot:  null,
      sortColumn:     null,
      sortAsc:        true,
    },
  };

  // ── Suscriptores (para reactividad simple) ────────────────────
  const _subscribers = {};

  // ── API pública ───────────────────────────────────────────────
  return {

    /**
     * Obtiene el estado completo o una ruta específica.
     * @param {string} [path] - Ruta con puntos: 'data.bitacora'
     */
    get(path) {
      if (!path) return _state;
      return path.split('.').reduce((obj, key) => obj?.[key], _state);
    },

    /**
     * Actualiza el estado y notifica a los suscriptores.
     * @param {string} path - Ruta a actualizar: 'data.bitacora'
     * @param {*} value     - Nuevo valor
     */
    set(path, value) {
      const keys = path.split('.');
      let obj = _state;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      this._notify(path, value);
    },

    /**
     * Agrega elementos a un array en el estado.
     * @param {string} path - Ruta del array: 'data.bitacora'
     * @param {Array|*} items - Elementos a agregar
     */
    push(path, items) {
      const arr = this.get(path);
      if (!Array.isArray(arr)) {
        console.error(`[State] "${path}" no es un array`);
        return;
      }
      const newItems = Array.isArray(items) ? items : [items];
      this.set(path, [...arr, ...newItems]);
    },

    /**
     * Resetea el estado de datos al inicial (útil para limpiar).
     */
    reset() {
      this.set('data', {
        bitacora: [], misiones: [], planeamiento: [],
        riesgo: [], mantenimiento: [],
      });
      this.set('pilots', []);
    },

    /**
     * Suscribe una función a cambios en una ruta.
     * @param {string} path - Ruta a observar (o '*' para todos)
     * @param {Function} fn - Callback(value, path)
     * @returns {Function} Función para cancelar la suscripción
     */
    subscribe(path, fn) {
      if (!_subscribers[path]) _subscribers[path] = [];
      _subscribers[path].push(fn);
      return () => {
        _subscribers[path] = _subscribers[path].filter(f => f !== fn);
      };
    },

    /** Notifica internamente (uso interno del store). */
    _notify(path, value) {
      (_subscribers[path] || []).forEach(fn => fn(value, path));
      (_subscribers['*'] || []).forEach(fn => fn(value, path));
    },
  };

})();
