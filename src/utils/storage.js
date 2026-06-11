/**
 * storage.js — Capa de Persistencia (Supabase como driver principal)
 * ===================================================================
 * Mantiene la API original (saveData, loadData, etc.) pero ahora
 * delega a SupabaseDB.
 *
 * Driver actual: Supabase PostgreSQL
 */

const Storage = (() => {

  // ── API pública compatible con el código existente ────────────

  /**
   * Guarda datos completos en Supabase.
   * @param {Object} data - State.get('data')
   */
  async function saveData(data) {
    const allRecords = Object.entries(data).flatMap(([formKey, records]) =>
      records.map(r => ({ ...r, formKey }))
    );
    return SupabaseDB.saveRecords(allRecords);
  }

  /**
   * Carga datos desde Supabase.
   * Retorna null si no hay datos (primer uso).
   */
  async function loadData() {
    const result = await SupabaseDB.loadAll();
    if (!result) return null;
    const totalRecords = Object.values(result.data).reduce((s, a) => s + a.length, 0);
    return totalRecords > 0 ? result.data : null;
  }

  /**
   * Guarda pilotos en Supabase.
   */
  async function savePilots(pilots) {
    return SupabaseDB.savePilots(pilots);
  }

  /**
   * Carga pilotos desde Supabase.
   */
  async function loadPilots() {
    const result = await SupabaseDB.loadAll();
    return result && result.pilots.length > 0 ? result.pilots : null;
  }

  /**
   * Limpia claves localStorage de UASOPS (legacy).
   */
  function clearLocalStorage() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('uasops_'))
      .forEach(k => localStorage.removeItem(k));
  }

  // Stubs para mantener compatibilidad con código legacy
  function save(name, value)  { /* No-op: Supabase maneja persistencia */ }
  function load(name)         { return null; }
  function remove(name)       { /* No-op */ }
  function clear()            { clearLocalStorage(); }
  function listKeys()         { return []; }

  return {
    save, load, remove, clear, listKeys,
    saveData, loadData,
    savePilots, loadPilots,
    clearLocalStorage,
  };

})();
