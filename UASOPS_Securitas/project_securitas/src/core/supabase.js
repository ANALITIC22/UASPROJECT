/**
 * supabase.js — Inicialización y API de Supabase
 * ================================================
 * Reemplaza firebase.js completamente.
 * Proyecto: rtxibbdpkmnqmpscbuyn (Supabase)
 *
 * API pública idéntica a FirebaseDB:
 *   SupabaseDB.loadAll()
 *   SupabaseDB.saveRecords(records, onProgress)
 *   SupabaseDB.savePilots(pilots)
 *   SupabaseDB.loadClients()
 *   SupabaseDB.listenAll(onUpdate)
 *   SupabaseDB.deleteRecord(formKey, id)
 *   SupabaseDB.deleteAllCollections()
 *   SupabaseDB.ping()
 *   SupabaseDB.getClient()
 */

// ── Configuración del proyecto ────────────────────────────────
const SUPABASE_URL  = 'https://rtxibbdpkmnqmpscbuyn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0eGliYmRwa21ucW1wc2NidXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODkwNjQsImV4cCI6MjA5Njc2NTA2NH0.IPe-YOuGyYuDTwdisIYiTXjpmLIV99lZ30TGZFqfeYE';

// ── Inicialización ───────────────────────────────────────────
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Nombres de tablas ────────────────────────────────────────
const TABLES = {
  bitacora:      'bitacora',
  misiones:      'misiones',
  planeamiento:  'planeamiento',
  riesgo:        'riesgo',
  mantenimiento: 'mantenimiento',
};
const DATA_KEYS     = Object.keys(TABLES);
const PILOTS_TABLE  = 'pilots';
const CLIENTS_TABLE = 'clientes';

// ── Módulo público SupabaseDB ────────────────────────────────
const SupabaseDB = (() => {

  /**
   * Carga todos los datos y pilotos en paralelo.
   * Retorna { data: { bitacora: [...], ... }, pilots: [...] }
   */
  async function loadAll() {
    try {
      const [dataResults, pilotsResult] = await Promise.all([
        Promise.all(DATA_KEYS.map(async key => {
          try {
            const { data, error } = await _sb
              .from(TABLES[key])
              .select('*')
              .order('fecha', { ascending: false });
            if (error) throw error;
            return { key, records: data || [] };
          } catch (_) {
            return { key, records: [] };
          }
        })),
        _sb.from(PILOTS_TABLE).select('*'),
      ]);

      const data = {};
      dataResults.forEach(({ key, records }) => { data[key] = records; });
      const pilots = pilotsResult.data || [];

      const total = Object.values(data).reduce((s, a) => s + a.length, 0);
      console.info(`[Supabase] Cargados: ${total} registros, ${pilots.length} pilotos`);
      return { data, pilots };

    } catch (err) {
      console.error('[Supabase] Error al cargar datos:', err);
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // saveRecords — Persistencia 100% idempotente (UPSERT)
  // ══════════════════════════════════════════════════════════════
  /**
   * Guarda o actualiza registros usando UPSERT atómico.
   * Garantías:
   *  ✅ Re-subir el mismo archivo → 0 duplicados, solo sobreescritura.
   *  ✅ UPSERT por clave primaria (id).
   *
   * @param {Array}  records   - Registros parseados con campo `id` determinístico
   * @param {Function} onProgress - Callback de progreso ({ saved, total, formKey })
   * @returns {number} Total de documentos escritos/actualizados
   */
  async function saveRecords(records, onProgress) {
    if (!records || records.length === 0) return 0;

    let totalSaved = 0;
    const totalRecords = records.length;

    // ── Agrupar por formKey ──────────────────────────────────
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.formKey]) grouped[r.formKey] = [];
      grouped[r.formKey].push(r);
    });

    for (const [key, recs] of Object.entries(grouped)) {
      if (!TABLES[key]) {
        console.warn(`[Supabase] formKey desconocido: "${key}" — ignorado`);
        continue;
      }

      // ── Limpiar payload ────────────────────────────────────
      const payload = recs.map(r => {
        const clean = { ...r };
        delete clean._docId;
        delete clean._source;
        delete clean.formKey;

        // Convertir marcadores { _isTs, iso } → ISO string
        for (const [k, v] of Object.entries(clean)) {
          if (v && typeof v === 'object' && v._isTs === true && v.iso) {
            clean[k] = v.iso; // Supabase acepta ISO strings para TIMESTAMPTZ
          }
        }

        // Asegurar que id existe
        if (!clean.id) {
          clean.id = _generateId(key, clean);
        }

        return clean;
      });

      // ── UPSERT en lotes de 500 ─────────────────────────────
      const BATCH = 500;
      for (let i = 0; i < payload.length; i += BATCH) {
        const chunk = payload.slice(i, i + BATCH);
        const { error } = await _sb
          .from(TABLES[key])
          .upsert(chunk);

        if (error) {
          console.error(`[Supabase] Error upsert "${key}":`, error);
          throw error;
        }

        totalSaved += chunk.length;

        if (typeof onProgress === 'function') {
          onProgress({ saved: totalSaved, total: totalRecords, formKey: key });
        }

        console.info(
          `[Supabase] Lote ${Math.floor(i / BATCH) + 1} de "${key}":` +
          ` ${chunk.length} docs upserted (total acum: ${totalSaved}/${totalRecords})`
        );
      }

      // ── Registrar clientes únicos ──────────────────────────
      const uniqueClients = [...new Set(recs.map(r => r.cuenta).filter(Boolean))];
      await Promise.all(uniqueClients.map(c => _upsertCliente(c)));
    }

    console.info(`[Supabase] saveRecords completo — ${totalSaved} registros upserted`);
    return totalSaved;
  }

  /**
   * Genera un ID determinístico para registros sin ID.
   */
  function _generateId(formKey, record) {
    const prefix = { bitacora: 'BIT', misiones: 'MIS', planeamiento: 'PLA', riesgo: 'RIE', mantenimiento: 'MNT' }[formKey] || 'REC';
    const cuenta = (record.cuenta || 'UNKNOWN').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const fecha  = (record.fecha || '').replace(/[^0-9]/g, '').substring(0, 8);
    const ts     = Date.now().toString(36);
    return `${prefix}_${cuenta}_${fecha}_${ts}`;
  }

  /**
   * Guarda o actualiza pilotos.
   */
  async function savePilots(pilots) {
    if (!pilots || pilots.length === 0) return;

    const payload = pilots
      .filter(p => p.name)
      .map(p => ({
        id: p.id || p.name
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .replace(/_{2,}/g, '_')
          .replace(/^_|_$/g, '')
          .substring(0, 200),
        name: p.name,
        initials: p.initials || '',
      }));

    const { error } = await _sb
      .from(PILOTS_TABLE)
      .upsert(payload);

    if (error) throw error;
    console.info(`[Supabase] ${payload.length} pilotos sincronizados`);
  }

  // ══════════════════════════════════════════════════════════════
  // listenAll — Suscripción en tiempo real a todas las tablas
  // ══════════════════════════════════════════════════════════════
  /**
   * Escucha cambios en tiempo real en todas las tablas operacionales + pilotos.
   * Llama a onUpdate({ data, pilots }) en cada cambio.
   *
   * @param {Function} onUpdate - Callback({ data, pilots })
   * @returns {Function} unsubscribe - Función para cancelar suscripciones
   */
  function listenAll(onUpdate) {
    let latestData   = {};
    let latestPilots = [];
    DATA_KEYS.forEach(k => { latestData[k] = []; });

    // ── Cargar datos iniciales ───────────────────────────────
    loadAll().then(result => {
      latestData   = result.data;
      latestPilots = result.pilots;
      onUpdate({ data: { ...latestData }, pilots: latestPilots });
    }).catch(err => {
      console.error('[Supabase] Error carga inicial:', err);
    });

    // ── Suscribirse a cambios en tiempo real ──────────────────
    const channels = [];

    DATA_KEYS.forEach(key => {
      const channel = _sb
        .channel(`db-${key}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: TABLES[key] },
          async (payload) => {
            // Recargar la tabla completa cuando haya cambios
            try {
              const { data } = await _sb
                .from(TABLES[key])
                .select('*')
                .order('fecha', { ascending: false });
              latestData[key] = data || [];
            } catch (_) {
              // Mantener datos anteriores si falla la recarga
            }
            onUpdate({ data: { ...latestData }, pilots: latestPilots });
          }
        )
        .subscribe();
      channels.push(channel);
    });

    // Suscripción a pilotos
    const pilotChannel = _sb
      .channel('db-pilots')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: PILOTS_TABLE },
        async () => {
          try {
            const { data } = await _sb.from(PILOTS_TABLE).select('*');
            latestPilots = data || [];
          } catch (_) {}
          onUpdate({ data: { ...latestData }, pilots: latestPilots });
        }
      )
      .subscribe();
    channels.push(pilotChannel);

    // ── Retornar función para cancelar suscripciones ──────────
    return () => {
      channels.forEach(ch => _sb.removeChannel(ch));
      console.info('[Supabase] Listeners cancelados');
    };
  }

  /**
   * Elimina un registro por su ID y formKey.
   */
  async function deleteRecord(formKey, id) {
    if (!TABLES[formKey]) throw new Error(`formKey inválido: ${formKey}`);
    const { error } = await _sb
      .from(TABLES[formKey])
      .delete()
      .eq('id', id);
    if (error) throw error;
    console.info(`[Supabase] Eliminado: ${TABLES[formKey]}/${id}`);
  }

  /**
   * REQ A — Registra dinámicamente un cliente si no existe.
   */
  async function _upsertCliente(nombre) {
    if (!nombre) return;
    const id = nombre
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 200);
    if (!id) return;

    const { error } = await _sb
      .from(CLIENTS_TABLE)
      .upsert({ id, nombre });
    if (error) console.warn('[Supabase] Error upsert cliente:', error.message);
  }

  /**
   * Carga todos los clientes registrados.
   */
  async function loadClients() {
    try {
      const { data, error } = await _sb
        .from(CLIENTS_TABLE)
        .select('nombre')
        .order('nombre');
      if (error) throw error;
      return (data || []).map(d => d.nombre).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  /**
   * Elimina TODOS los documentos de todas las tablas.
   */
  async function deleteAllCollections() {
    let totalDeleted = 0;
    const ALL_TABLES = [...DATA_KEYS.map(k => TABLES[k]), PILOTS_TABLE, CLIENTS_TABLE];

    for (const table of ALL_TABLES) {
      try {
        const { count, error } = await _sb
          .from(table)
          .delete()
          .neq('id', '');
        if (!error) totalDeleted += count || 0;
      } catch (_) {}
    }

    console.info(`[Supabase] Limpieza completa — ${totalDeleted} registros eliminados`);
    return totalDeleted;
  }

  /**
   * Health check — escribe y borra un registro de prueba.
   */
  async function ping() {
    try {
      const { error: err1 } = await _sb
        .from('_ping')
        .upsert({ id: 'test', ts: Date.now() });
      if (err1) throw err1;
      await _sb.from('_ping').delete().eq('id', 'test');
      console.info('[Supabase] Ping OK');
      return true;
    } catch (err) {
      console.error('[Supabase] Ping falló:', err.message);
      return false;
    }
  }

  /**
   * Retorna el cliente Supabase para uso externo.
   */
  function getClient() { return _sb; }

  return {
    loadAll, saveRecords, savePilots,
    loadClients, listenAll, deleteRecord,
    deleteAllCollections, ping, getClient,
  };

})();

// ── Alias global para borrar todo desde consola ──────────────
window._uasDeleteAll = () => SupabaseDB.deleteAllCollections();
console.info('[Supabase] Para borrar todos los datos: await window._uasDeleteAll()');
