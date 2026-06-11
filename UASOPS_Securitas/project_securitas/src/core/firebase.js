/**
 * firebase.js — Inicialización y API de Firebase
 * ================================================
 * Proyecto: uasproject-95985
 * SDK: Firebase Compat v9.23.0 (CDN en index.html)
 *
 * Estructura de colecciones en Firestore (rutas PLANAS):
 *   ops_bitacora/{docId}
 *   ops_misiones/{docId}
 *   ops_planeamiento/{docId}
 *   ops_riesgo/{docId}
 *   ops_mantenimiento/{docId}
 *   ops_pilots/{pilotId}
 *   ops_clientes/{clienteId}
 *   _ping/{docId}
 *
 * ════════════════════════════════════════════════════════════════
 * [UPSERT] MECANISMO ANTI-DUPLICADOS — GARANTÍA DE IDEMPOTENCIA
 * ════════════════════════════════════════════════════════════════
 * 1. parser.js genera un `id` determinístico por cada fila:
 *      PREFIX_[CUENTA]_[FECHA_YYYYMMDD]_[HORA_HHMM]_[NUM_VUELO]
 *    → Re-subir el mismo Excel produce EXACTAMENTE los mismos IDs.
 *
 * 2. saveRecords() usa batch.set(ref, data, { merge: true }):
 *    → Si el documento existe: solo ACTUALIZA campos cambiados.
 *    → Si no existe: lo CREA.
 *    → NUNCA duplica. Operación completamente idempotente.
 *
 * 3. Sin pre-consulta de existencia (no .get() previo):
 *    → 0 lecturas extra de Firestore = mínimo costo y máxima velocidad.
 *
 * NOTA: Se usan rutas planas (1 segmento) porque el SDK compat
 * de Firebase requiere segmentos impares para colecciones.
 */

// ── Configuración del proyecto ───────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAOgVDwJRtIsEjVxZhM-DeFwIPfSC3lP9U",
  authDomain:        "uasproject-95985.firebaseapp.com",
  projectId:         "uasproject-95985",
  storageBucket:     "uasproject-95985.firebasestorage.app",
  messagingSenderId: "461738122543",
  appId:             "1:461738122543:web:19c72347b744c2bb7595da",
  measurementId:     "G-618F3DT9G5"
};

// ── Inicialización segura ────────────────────────────────────────
let _fbApp;
try {
  _fbApp = firebase.app();
} catch (_) {
  _fbApp = firebase.initializeApp(firebaseConfig);
}

const _db = firebase.firestore();

// ── Rutas de colecciones (PLANAS — 1 segmento) ──────────────────
const DATA_KEYS    = ['bitacora', 'misiones', 'planeamiento', 'riesgo', 'mantenimiento'];
const COL          = (key) => `ops_${key}`;   // ops_bitacora, ops_misiones, etc.
const PILOTS_COL   = 'ops_pilots';
const CLIENTS_COL  = 'ops_clientes';  // REQ A: registro dinámico relacional de clientes
const PING_COL     = '_ping';

// ── Módulo público FirebaseDB ────────────────────────────────────
const FirebaseDB = (() => {

  /**
   * Carga todos los datos y pilotos desde Firestore en paralelo.
   */
  async function loadAll() {
    try {
      const [dataResults, pilotsSnap] = await Promise.all([
        Promise.all(DATA_KEYS.map(key =>
          _db.collection(COL(key))
            .orderBy('fecha', 'desc')
            .get()
            .then(snap => ({
              key,
              records: snap.docs.map(d => ({ ...d.data(), _docId: d.id }))
            }))
            .catch(() => ({ key, records: [] }))  // si la colección no existe aún
        )),
        _db.collection(PILOTS_COL).get().catch(() => ({ docs: [] })),
      ]);

      const data = {};
      dataResults.forEach(({ key, records }) => { data[key] = records; });
      const pilots = pilotsSnap.docs.map(d => d.data());

      const total = Object.values(data).reduce((s, a) => s + a.length, 0);
      console.info(`[Firebase] ✅ Cargados: ${total} registros, ${pilots.length} pilotos`);
      return { data, pilots };

    } catch (err) {
      console.error('[Firebase] ❌ Error al cargar datos:', err);
      throw err;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // [UPSERT] SANITIZADOR DE DOCID — Elimina todos los caracteres
  // prohibidos por Firestore en IDs de documento.
  // Chars prohibidos: / \ . # $ [ ] y segmentos que sean solo '.'
  // ════════════════════════════════════════════════════════════════
  function _sanitizeDocId(raw) {
    if (!raw) return '';
    return String(raw)
      .trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
      .toUpperCase()
      .replace(/[\/\\\.#\$\[\]:]/g, '-')               // chars prohibidos → guión
      .replace(/\s+/g, '_')                             // espacios → guión bajo
      .replace(/-{2,}/g, '-')                           // colapsar guiones dobles
      .replace(/_{2,}/g, '_')                           // colapsar guiones bajos dobles
      .replace(/^[-_]+|[-_]+$/g, '')                    // limpiar extremos
      .substring(0, 200);                               // Firestore: max 1500 bytes; 200 es seguro
  }

  /**
   * REQ A — Registra dinámicamente un cliente en ops_clientes si no existe.
   * Idempotente: usa set() con merge:true → si ya existe no lo duplica.
   *
   * @param {string} nombre  Nombre normalizado del cliente (ya viene de parser.js)
   */
  async function _upsertCliente(nombre) {
    if (!nombre) return;
    const docId = _sanitizeDocId(nombre);
    if (!docId) return;
    const ref = _db.collection(CLIENTS_COL).doc(docId);
    // merge:true → si el doc existe no lo sobreescribe, solo añade campos faltantes
    await ref.set({
      nombre,
      id:       docId,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  /**
   * REQ B — Convierte los marcadores { _isTs:true, iso } generados por parser.js
   * en objetos firebase.firestore.Timestamp reales antes de persistir.
   */
  function _resolveTimestamps(payload) {
    const resolved = { ...payload };
    for (const [key, val] of Object.entries(resolved)) {
      if (val && typeof val === 'object' && val._isTs === true && val.iso) {
        try {
          resolved[key] = firebase.firestore.Timestamp.fromDate(new Date(val.iso));
        } catch (_) {
          resolved[key] = null; // si la fecha es inválida, null es seguro
        }
      }
    }
    return resolved;
  }

  // ════════════════════════════════════════════════════════════════
  // [UPSERT] saveRecords — Persistencia 100% idempotente
  // ════════════════════════════════════════════════════════════════
  /**
   * Guarda o actualiza registros en Firestore usando UPSERT atómico.
   *
   * Garantías:
   *  ✅ Re-subir el mismo archivo → 0 duplicados, solo sobreescritura.
   *  ✅ Archivos con registros mixtos (nuevos + ya existentes) → correctos.
   *  ✅ Sin pre-consulta de existencia → 0 lecturas extra de Firestore.
   *  ✅ Atómico por lote de 490 ops (límite Firestore = 500).
   *  ✅ merge:true preserva campos existentes en actualizaciones parciales.
   *
   * Lógica por documento:
   *   1. Si r.id existe (determinístico del parser) → usa ese docId.
   *   2. Si r.id vacío (CSV legacy sin id) → genera auto-id de Firestore.
   *   3. En ambos casos: batch.set(ref, payload, { merge: true })
   *      → INSERT si no existe, UPDATE si existe. NUNCA duplica.
   *
   * @param {Array} records - Registros parseados con campo `id` determinístico
   * @returns {number}      - Total de documentos escritos/actualizados
   */
  async function saveRecords(records, onProgress) {
    if (!records || records.length === 0) return 0;

    const BATCH_SIZE = 490;
    // Para volúmenes masivos, limitar concurrencia entre formKeys
    // procesando secuencialmente para no saturar Firestore ni memoria.
    let totalSaved = 0;
    const totalRecords = records.length;

    // ── Agrupar por formKey ──────────────────────────────────────
    const grouped = {};
    records.forEach(r => {
      if (!grouped[r.formKey]) grouped[r.formKey] = [];
      grouped[r.formKey].push(r);
    });

    for (const [key, recs] of Object.entries(grouped)) {
      if (!DATA_KEYS.includes(key)) {
        console.warn(`[Firebase] formKey desconocido: "${key}" — ignorado`);
        continue;
      }

      // ── Escribir en lotes atómicos ─────────────────────────────
      for (let i = 0; i < recs.length; i += BATCH_SIZE) {
        const batch = _db.batch();
        const chunk = recs.slice(i, i + BATCH_SIZE);

        chunk.forEach(r => {
          // ── Clonar sin campos internos que no van a Firestore ──
          let payload = { ...r };
          delete payload._docId;    // campo interno de lectura
          delete payload._source;   // nombre del archivo origen

          // ── REQ B: convertir { _isTs, iso } → Timestamp real ──
          payload = _resolveTimestamps(payload);

          // ── [UPSERT] Resolución del docRef ─────────────────────
          // Si el parser generó un id determinístico → docId fijo.
          // Mismo Excel subido N veces → mismo docId → UPSERT, no INSERT.
          let ref;
          if (r.id && String(r.id).trim()) {
            // Sanitizar por seguridad (parser ya lo hace, doble garantía)
            const safeId = _sanitizeDocId(String(r.id));
            ref = safeId
              ? _db.collection(COL(key)).doc(safeId)
              : _db.collection(COL(key)).doc(); // fallback auto-id
          } else {
            // CSV legacy sin id: auto-id de Firestore (comportamiento anterior)
            ref = _db.collection(COL(key)).doc();
          }

          // ── [UPSERT] set con merge:true — NUNCA duplica ────────
          // • Documento nuevo    → lo CREA con todos los campos.
          // • Documento existente → ACTUALIZA solo los campos del payload,
          //   preservando campos que hubiera tenido previamente.
          batch.set(ref, payload, { merge: true });
        });

        await batch.commit();
        totalSaved += chunk.length;

        // Notificar progreso si se proveyó callback (para UI de grandes volúmenes)
        if (typeof onProgress === 'function') {
          onProgress({ saved: totalSaved, total: totalRecords, formKey: key });
        }

        console.info(
          `[Firebase] ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1} de "${key}":` +
          ` ${chunk.length} docs upserted (total acum: ${totalSaved}/${totalRecords})`
        );
      }

      // ── REQ A: upsert de clientes únicos del lote ─────────────
      const uniqueClients = [...new Set(recs.map(r => r.cuenta).filter(Boolean))];
      await Promise.all(uniqueClients.map(c => _upsertCliente(c)));
    }

    console.info(`[Firebase] ✅ saveRecords completo — ${totalSaved} docs upserted`);
    return totalSaved;
  }

  /**
   * Guarda o actualiza pilotos en Firestore.
   * También usa merge:true para ser idempotente.
   */
  async function savePilots(pilots) {
    if (!pilots || pilots.length === 0) return;
    const batch = _db.batch();
    pilots.forEach(p => {
      if (!p.name) return;
      const id  = _sanitizeDocId(p.name);
      if (!id) return;
      const ref = _db.collection(PILOTS_COL).doc(id);
      batch.set(ref, { ...p, id }, { merge: true });
    });
    await batch.commit();
    console.info(`[Firebase] ✅ ${pilots.length} pilotos sincronizados`);
  }

  /**
   * Listeners en tiempo real de todas las colecciones.
   * Llama a onUpdate({ data, pilots }) en cada cambio.
   */
  function listenAll(onUpdate) {
    let latestData   = {};
    let latestPilots = [];
    DATA_KEYS.forEach(k => { latestData[k] = []; });
    const unsubs = [];

    DATA_KEYS.forEach(key => {
      const unsub = _db.collection(COL(key))
        .orderBy('fecha', 'desc')
        .onSnapshot(
          snap => {
            latestData[key] = snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
            onUpdate({ data: { ...latestData }, pilots: latestPilots });
          },
          err => {
            console.error(`[Firebase] ❌ Listener "${key}":`, err.message);
            onUpdate({ data: { ...latestData }, pilots: latestPilots });
          }
        );
      unsubs.push(unsub);
    });

    const pilotUnsub = _db.collection(PILOTS_COL)
      .onSnapshot(
        snap => {
          latestPilots = snap.docs.map(d => d.data());
          onUpdate({ data: { ...latestData }, pilots: latestPilots });
        },
        err => {
          console.error('[Firebase] ❌ Listener pilotos:', err.message);
          onUpdate({ data: { ...latestData }, pilots: latestPilots });
        }
      );
    unsubs.push(pilotUnsub);

    return () => {
      unsubs.forEach(u => u());
      console.info('[Firebase] Listeners cancelados');
    };
  }

  /**
   * Elimina un registro por su _docId y formKey.
   */
  async function deleteRecord(formKey, docId) {
    if (!DATA_KEYS.includes(formKey)) throw new Error(`formKey inválido: ${formKey}`);
    await _db.collection(COL(formKey)).doc(docId).delete();
    console.info(`[Firebase] Eliminado: ${COL(formKey)}/${docId}`);
  }

  /**
   * Health check — escribe y borra un doc de prueba.
   */
  async function ping() {
    try {
      await _db.collection(PING_COL).doc('test').set({ ts: Date.now() });
      await _db.collection(PING_COL).doc('test').delete();
      console.info('[Firebase] ✅ Ping OK');
      return true;
    } catch (err) {
      console.error('[Firebase] ❌ Ping falló:', err.message);
      return false;
    }
  }

  function getDb() { return _db; }

  /**
   * REQ A — Carga todos los clientes registrados dinámicamente desde ops_clientes.
   * Usado por populateClientSelects() en app.js para poblar los selectores.
   */
  async function loadClients() {
    try {
      const snap = await _db.collection(CLIENTS_COL).orderBy('nombre').get();
      return snap.docs.map(d => d.data().nombre).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  return { loadAll, saveRecords, savePilots, loadClients, listenAll, deleteRecord, ping, getDb };

})();

// ── FUNCIÓN DE LIMPIEZA TOTAL ────────────────────────────────────
/**
 * deleteAllCollections()
 * Borra TODOS los documentos de ops_bitacora, ops_misiones,
 * ops_planeamiento, ops_riesgo, ops_mantenimiento y ops_pilots.
 * Llamar desde consola: await FirebaseDB.deleteAllCollections()
 */
const _deleteAllCollections = async function() {
  const ALL_COLS = [...DATA_KEYS.map(k => COL(k)), PILOTS_COL, CLIENTS_COL];
  let totalDeleted = 0;
  for (const colName of ALL_COLS) {
    let snap;
    do {
      snap = await _db.collection(colName).limit(400).get();
      if (snap.empty) break;
      const batch = _db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalDeleted += snap.docs.length;
      console.info(`[Firebase] 🗑️  Eliminados ${snap.docs.length} docs de "${colName}" (total: ${totalDeleted})`);
    } while (!snap.empty);
  }
  console.info(`[Firebase] ✅ Limpieza completa — ${totalDeleted} documentos eliminados`);
  return totalDeleted;
};

// Exponer en FirebaseDB y globalmente para facilitar llamada desde consola
FirebaseDB.deleteAllCollections = _deleteAllCollections;
window._uasDeleteAll = _deleteAllCollections;
console.info('[Firebase] 💡 Para borrar todos los datos: await window._uasDeleteAll()');
