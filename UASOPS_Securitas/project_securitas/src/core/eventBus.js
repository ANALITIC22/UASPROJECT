/**
 * eventBus.js — Sistema de Eventos Desacoplado
 * ==============================================
 * Permite que los módulos se comuniquen sin conocerse entre sí.
 *
 * Uso:
 *   EventBus.on('data:updated', (payload) => { ... });
 *   EventBus.emit('data:updated', { source: 'uploader', count: 5 });
 *   EventBus.off('data:updated', handler);
 */

const EventBus = (() => {

  const _events = {};

  return {

    /**
     * Suscribe una función a un evento.
     * @param {string}   event - Nombre del evento (ej: 'data:updated')
     * @param {Function} fn    - Handler
     * @returns {Function}     - Función para cancelar la suscripción
     */
    on(event, fn) {
      if (!_events[event]) _events[event] = [];
      _events[event].push(fn);
      return () => this.off(event, fn);
    },

    /**
     * Suscribe una función que solo se ejecuta UNA vez.
     */
    once(event, fn) {
      const wrapper = (payload) => {
        fn(payload);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    },

    /**
     * Cancela la suscripción de un handler.
     */
    off(event, fn) {
      if (!_events[event]) return;
      _events[event] = _events[event].filter(f => f !== fn);
    },

    /**
     * Emite un evento a todos los suscriptores.
     * @param {string} event   - Nombre del evento
     * @param {*}      payload - Datos adjuntos
     */
    emit(event, payload) {
      if (!_events[event]) return;
      _events[event].forEach(fn => {
        try { fn(payload); }
        catch(e) { console.error(`[EventBus] Error en handler de "${event}":`, e); }
      });
    },

    /** Lista todos los eventos registrados (útil para debugging). */
    debug() {
      console.table(Object.keys(_events).map(e => ({
        event: e,
        handlers: _events[e].length,
      })));
    },
  };

})();

/*
 * EVENTOS ESTÁNDAR DEL SISTEMA:
 * ─────────────────────────────────────────────────────────────────
 * 'data:loaded'        → Los datos iniciales fueron cargados
 * 'data:updated'       → Algún módulo agregó/modificó datos
 * 'pilot:selected'     → Se seleccionó un piloto para filtrar
 * 'pilot:cleared'      → Se limpió el filtro de piloto
 * 'upload:complete'    → El uploader terminó de procesar archivos
 * 'upload:integrated'  → Los datos del uploader se integraron al store
 * 'section:changed'    → Se cambió de sección (emitido por Router)
 * 'toast:show'         → Solicitud de mostrar un toast
 */
