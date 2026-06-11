/**
 * parser.js — Parser de Excel (.xls/.xlsx) y CSV para UASOPS
 * ============================================================
 * v4.0 — UPSERT Idempotente implementado:
 *
 *  [UPSERT] ID determinístico por fila construido con la fórmula:
 *           PREFIX_[Cuenta]_[FechaVuelo]_[HoraDespegue]_[NumVuelo]
 *           Garantiza que re-subir el mismo Excel produce exactamente
 *           los mismos docIds → batch.set(ref, data, { merge:true })
 *           sobreescribe en lugar de duplicar.
 *
 *  [A] Sin clientes fijos: _extractCuenta() produce siempre valor normalizado
 *      para registro relacional. El registro dinámico en Firestore ocurre en
 *      firebase.js → saveRecords() → _upsertCliente().
 *  [B] cellDates:true CONFIRMADO en _parseExcelFile. _parseDate() maneja
 *      Date nativo, serial, ISO y formato latino. Los registros exponen
 *      `fecha` como string ISO "YYYY-MM-DD" y `fechaTs` como objeto { _isTs: true, iso: "..." }
 *      para que firebase.js lo convierta a firebase.firestore.Timestamp.
 *  [C] Planeamiento (GMB-F08): extrae los 7 parámetros técnicos críticos con
 *      claves exactas de encabezado del formulario.
 *  [D] Misiones (GMB-F16), Bitácora y Mantenimiento: mapeo completo sin campos
 *      flotantes. Todos los registros incluyen `cuenta` normalizado.
 *
 * REGLA DE HORAS: minutos_reales / 35 = horas de vuelo
 *
 * FÓRMULA DE DOCID (UPSERT):
 *   PREFIX_[CUENTA_NORM]_[FECHA_YYYYMMDD]_[HORA_HHMM]_[NUM_VUELO]
 *   Ejemplo: BIT_UAS_-_CC_SANTAFE_20260601_2350_5
 *   - Todos los caracteres prohibidos por Firestore son reemplazados
 *   - Máximo 500 chars (Firestore limit), en la práctica <80
 */

const Parser = (() => {

  // ── Detectores de tipo de formulario ────────────────────────
  const FORM_DETECTORS = [
    {
      key: 'mantenimiento',
      match: ['MANTENIMIENTO PREVENTIVO', 'GMB-F11', 'MANTENIMIENTO UAS'],
    },
    {
      key: 'misiones',
      match: ['MISION CUMPLIDA', 'GMB-F16', 'AREA VOLADA', 'INFORME DE MISION'],
    },
    {
      key: 'planeamiento',
      match: ['PLANEAMIENTO', 'GMB-F08', 'ZONA DE VUELO', 'PLANEAMIENTO DE LA MISION'],
    },
    {
      key: 'riesgo',
      match: ['NIVEL DE RIESGO', 'GMB-F10', 'ANALISIS Y EVALUACION', 'ANALISIS DEL RIESGO'],
    },
    {
      key: 'bitacora',
      match: ['BITACORA', 'GMB-F15', 'TIEMPO TOTAL DE VUELO', 'HORA DE DESPEGUE', 'HORA DESPEGUE'],
    },
  ];

  // ══════════════════════════════════════════════════════════════
  // TABLA DE ALIASES DE CLIENTE
  // Corrige variantes/typos del nombre de cliente que provienen de
  // distintos formularios o errores históricos de digitación.
  // Clave: string NORMALIZADO (mayúsculas, sin acentos, sin espacios extra).
  // Valor: string CANÓNICO normalizado al que debe mapearse.
  // ══════════════════════════════════════════════════════════════
  const CLIENT_ALIASES = {
    // Mesa de Yeguas: "UAS - MESA DE YEGUASUAS" es typo del mismo cliente
    'UAS - MESA DE YEGUASUAS':    'UAS - MESA DE YEGUAS',
    'UAS MESA DE YEGUASUAS':      'UAS - MESA DE YEGUAS',
    'UAS MESA DE YEGUAS':         'UAS - MESA DE YEGUAS',
    // Mobile Bogotá: variantes con/sin guión
    'UAS MOBILE / BOGOTA':        'UAS - MOBILE / BOGOTA',
    'UAS MOBILE/BOGOTA':          'UAS - MOBILE / BOGOTA',
    'UAS - MOBILE/BOGOTA':        'UAS - MOBILE / BOGOTA',
    'UAS MOBILE BOGOTA':          'UAS - MOBILE / BOGOTA',
    'UAS - MOBILE BOGOTA':        'UAS - MOBILE / BOGOTA',
    // Peñalisa: variantes con/sin tilde (ya se normalizan sin acentos, pero por si acaso)
    'UAS - PENALISA':             'UAS - PENALISA',
    'UAS PENALISA':               'UAS - PENALISA',
  };

  /**
   * Aplica la tabla de aliases a un nombre de cliente ya normalizado.
   * Si el nombre tiene un alias conocido, devuelve el canónico.
   * De lo contrario, devuelve el mismo valor sin cambios.
   */
  function _applyClientAlias(normalized) {
    if (!normalized) return normalized;
    return CLIENT_ALIASES[normalized] || normalized;
  }

  // ── Normalización de texto ────────────────────────────────────
  /**
   * MAYÚSCULAS + sin acentos + trim + colapso de espacios.
   * REQ A: garantiza que el ID de cliente sea determinístico e idempotente.
   */
  function _normalizeText(val) {
    if (val === null || val === undefined) return '';
    let s = String(val).trim();
    if (!s || s === 'nan' || s === 'NaN' || s === 'undefined' || s === 'null') return '';
    if (s.startsWith("'---")) return '';
    if (s.includes('\n')) {
      const clean = s.split('\n').map(p => p.trim()).find(p => p && !p.startsWith('---'));
      s = clean || '';
    }
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.toUpperCase().replace(/\s+/g, ' ').trim();
  }

  /** Limpieza suave: preserva capitalización original. */
  function _cleanStr(val) {
    if (val === null || val === undefined) return '';
    let s = String(val).trim();
    if (!s || s === 'nan' || s === 'NaN' || s === 'undefined' || s === 'null') return '';
    if (s.startsWith("'---")) return '';
    if (s.includes('\n')) {
      const clean = s.split('\n').map(p => p.trim()).find(p => p && !p.startsWith('---'));
      return clean || '';
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  // ── CANONICAL PILOT MAP — fullstack-pro-engineer RCA fix ──────
  // Root cause: _normalizeText() removes accents+uppercases but does NOT
  // unify typos, missing letters, job-title suffixes, or multi-pilot cells.
  // This canonical map + _canonicalizePilot() is the single authoritative
  // correction layer. Applied to every piloto field extracted by this parser.
  const _PILOT_CANONICAL = {
    // Typo: ESNEYDER → ESNAIDER (different first name)
    'ESNEYDER JOHAN HERRERA URBANO':  'ESNAIDER JOHAN HERRERA URBANO',
    // Missing S: RIVERO → RIVEROS
    'GERMAN ANDRES TORRES RIVERO':    'GERMAN ANDRES TORRES RIVEROS',
    // Typo: CARDONA → CARMONA
    'WILLIAN GUILLERMO CARDONA RODRIGUEZ': 'WILLIAN GUILLERMO CARMONA RODRIGUEZ',
    // Extra spaces
    'ANDRES  ALBERTO BONILLA GONZALEZ': 'ANDRES ALBERTO BONILLA GONZALEZ',
    'JUAN  SEBASTIAN MANCERA ZUNIGA':   'JUAN SEBASTIAN MANCERA ZUNIGA',
    'FRANCISCO JAVIER  PERDIGON GARCIA':'FRANCISCO JAVIER PERDIGON GARCIA',
    // Job title suffix
    'LUIS EDUARDO TOBON RUIZ SUPERVISOR PILOTO DE DRONES': 'LUIS EDUARDO TOBON RUIZ',
    // Incomplete name
    'SERGIO DAVID ACERO':              'SERGIO DAVID ACERO BAEZ',
    // GONZALES/GONZALEZ variant
    'HENRY RODRIGO PRIETO GONZALES':   'HENRY RODRIGO PRIETO GONZALEZ',
    'ANDRES ALBERTO BONILLA GONZALES': 'ANDRES ALBERTO BONILLA GONZALEZ',
    'LINDA LUCIA MUNOZ GONZALES':      'LINDA LUCIA MUNOZ GONZALEZ',
  };

  /**
   * Applies canonical pilot normalization on top of _normalizeText().
   * Handles: typos, missing letters, job titles, multi-pilot cells.
   * @param {string} raw - raw pilot name from Excel cell
   * @returns {string} - canonical uppercase pilot name
   */
  function _canonicalizePilot(raw) {
    if (!raw && raw !== 0) return '';
    let s = String(raw).trim();

    // 1. Strip site-prefix garbage: '---Location---\nName' → 'Name'
    s = s.replace(/^['"\s]*[-–—]+[^'"\n]*[-–—]+\s*\n?/g, '').trim().replace(/^['"]/, '');

    // 2. Multi-pilot cell: take first name only
    if (s.includes('\n')) {
      s = s.split('\n').map(p => p.trim()).find(p => p && !p.startsWith('---') && !p.startsWith('-')) || '';
    }

    // 3. Strip job title
    s = s.replace(/\s*SUPERVISOR\s*PILOTO\s*DE\s*DRONES/gi, '').trim();

    // 4. Normalize accents → uppercase → collapse spaces
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

    if (!s || s.startsWith('-') || s.startsWith("'")) return '';

    // 5. Apply canonical correction map
    return _PILOT_CANONICAL[s] || s;
  }



  // ── Parseo robusto de fechas — REQ B ─────────────────────────
  /**
   * Convierte cualquier variante de fecha a string ISO "YYYY-MM-DD".
   * Con cellDates:true SheetJS entrega Date nativos; también maneja
   * seriales numéricos, ISO strings y formato latino.
   */
  function _parseDate(val) {
    if (!val && val !== 0) return '';

    // Caso 1: Date nativo JS (cellDates:true activo)
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      return val.toISOString().substring(0, 10);
    }

    // Caso 2: Serial numérico de Excel
    if (typeof val === 'number') {
      if (val < 1000) return '';
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date       = new Date(excelEpoch.getTime() + val * 86400000);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().substring(0, 10);
    }

    const s = String(val).trim();
    if (!s) return '';

    // Caso 3: ISO "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);

    // Caso 4: Latino "DD/MM/YYYY" o "DD-MM-YYYY"
    const latinMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (latinMatch) {
      const [, dd, mm, yyyy] = latinMatch;
      const d = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd)));
      if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
    }

    // Caso 5: Fallback Date.parse
    const parsed = Date.parse(s);
    if (!isNaN(parsed)) return new Date(parsed).toISOString().substring(0, 10);

    return '';
  }

  /**
   * REQ B: Convierte string ISO o Date a marcador de Timestamp para firebase.js.
   * El objeto { _isTs:true, iso } será interceptado en saveRecords() y
   * convertido a firebase.firestore.Timestamp.fromDate().
   */
  function _toTimestampMarker(val) {
    const iso = _parseDate(val);
    if (!iso) return null;
    return { _isTs: true, iso };
  }

  // ── Extracción segura de minutos ──────────────────────────────
  function _parseMinutes(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return Math.round(Math.abs(val));
    const str    = String(val).replace(/[^\d.]/g, '');
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : Math.round(parsed);
  }

  // ── Búsqueda fuzzy de columna ──────────────────────────────────
  function _findColFuzzy(row, keyword) {
    const needle = _normalizeText(keyword);
    const key = Object.keys(row).find(k => _normalizeText(k).includes(needle));
    return key !== undefined ? row[key] : null;
  }

  /**
   * _findColGMBF08 — extractor para encabezados compuestos GMB-F08.
   * SheetJS aplana encabezados de dos filas con ":" como separador, produciendo
   * claves del tipo: "2. PLANEAMIENTO DE LA MISION (GMB-F08):TIPO DE AERONAVE".
   * Esta funcion compara SOLO el sufijo (parte despues de ":") para ser inmune
   * a variaciones de acento o puntuacion en el prefijo entre versiones del XLS.
   */
  function _findColGMBF08(row, suffix) {
    const needle = _normalizeText(suffix);
    const key = Object.keys(row).find(k => {
      const parts = k.split(':');
      const target = _normalizeText(parts.length > 1 ? parts.slice(1).join(':') : k);
      return target.includes(needle);
    });
    return key !== undefined ? row[key] : null;
  }

  // ════════════════════════════════════════════════════════════════
  // [UPSERT] ID DETERMINÍSTICO — Fórmula: PREFIX_CUENTA_FECHA_HORA_NUMVUELO
  // ════════════════════════════════════════════════════════════════
  /**
   * Construye el docId único y reproducible para cada registro.
   *
   * Fórmula final:
   *   {PREFIX}_{cuenta_sanitizada}_{fecha_YYYYMMDD}_{hora_HHMM}_{numVuelo}
   *
   * Reglas de sanitización (Firestore prohíbe: / \ . # $ [ ] y segmentos vacíos):
   *   1. NFD + strip diacríticos → sin acentos
   *   2. Mayúsculas
   *   3. Chars prohibidos ( / \ . # $ [ ] : ) → guión
   *   4. Espacios → guión bajo
   *   5. Colapso de guiones múltiples → uno solo
   *   6. Trim de extremos
   *   7. Truncado a 80 chars por segmento para evitar IDs monstruosos
   *
   * @param {string} formKey   - 'bitacora' | 'misiones' | 'planeamiento' | 'riesgo' | 'mantenimiento'
   * @param {string} cuenta    - Nombre normalizado del cliente (ya viene en MAYÚSCULAS)
   * @param {string} fecha     - ISO "YYYY-MM-DD" o vacío
   * @param {string} hora      - "HH:MM" o similar (hora de despegue)
   * @param {string|number} numVuelo - Número de vuelo del día o extra discriminador
   * @returns {string}         - docId listo para Firestore, ej: "BIT_UAS_-_CC_SANTAFE_20260601_2350_5"
   */
  function _buildDocId(formKey, cuenta, fecha, hora, numVuelo) {
    const PREFIX = {
      bitacora:      'BIT',
      misiones:      'MIS',
      planeamiento:  'PLA',
      riesgo:        'RIE',
      mantenimiento: 'MNT',
    }[formKey] || 'REC';

    /**
     * Sanitiza un segmento para uso como parte de docId de Firestore.
     * Elimina/reemplaza todos los caracteres prohibidos.
     */
    const _seg = (raw, maxLen = 40) => {
      if (!raw && raw !== 0) return '';
      return String(raw)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // acentos
        .toUpperCase()
        .replace(/[\/\\\.#\$\[\]:]/g, '-')               // chars prohibidos → guión
        .replace(/\s+/g, '_')                             // espacios → guión bajo
        .replace(/-{2,}/g, '-')                           // colapsar guiones
        .replace(/_{2,}/g, '_')                           // colapsar guiones bajos
        .replace(/^[-_]+|[-_]+$/g, '')                    // trim extremos
        .substring(0, maxLen);
    };

    // Fecha compacta: "2026-06-01" → "20260601"
    const fechaCompact = (fecha || '').replace(/-/g, '').substring(0, 8);

    // Hora compacta: "23:50" → "2350", "03:15" → "0315"
    const horaCompact = (hora || '').replace(/[^0-9]/g, '').substring(0, 4);

    // Número de vuelo: puede ser 0, string, número
    const numStr = (numVuelo !== null && numVuelo !== undefined && String(numVuelo).trim())
      ? _seg(String(numVuelo), 10)
      : '';

    const parts = [
      PREFIX,
      _seg(cuenta, 40),
      fechaCompact,
      horaCompact,
      numStr,
    ].filter(Boolean);

    const docId = parts.join('_');

    // Firestore max docId = 1500 bytes; usamos 200 como límite práctico seguro
    return docId.substring(0, 200);
  }

  // ── REQ A: Extracción unificada del cliente — SIN fallback a lista fija ──
  /**
   * Detecta el cliente con cascada de prioridad.
   * Siempre devuelve string NORMALIZADO (MAYÚSCULAS, sin acentos).
   * El registro dinámico en Firestore (colección `ops_clientes`) se
   * delega a firebase.js para no hacer round-trips aquí.
   */
  function _extractCuenta(row, formKey) {
    // ══════════════════════════════════════════════════════════════
    // FUENTE PRIMARIA: columna A (Account) del Excel Metrica_Ops.
    // Esta columna contiene el nombre real del cliente (persona jurídica)
    // y es la llave canónica para filtrar la información por cliente.
    //
    // ANTES usaba PROCESO UAS como cliente → INCORRECTO (era nombre interno).
    // AHORA usa Account → CORRECTO (nombre real del cliente).
    //
    // Cascada de prioridad:
    //   1. Account (col A)    ← FUENTE PRIMARIA — nombre real del cliente
    //   2. Cuenta / Cliente   ← alias genéricos
    //   3. PROCESO UAS        ← fallback legacy (solo si Account no existe)
    //   4. Site Name / Sitio  ← último recurso
    // ══════════════════════════════════════════════════════════════

    let raw = null;

    // 1. FUENTE PRIMARIA: Account (col A) — aplica a TODOS los tipos de formulario
    raw = _findColFuzzy(row, 'Account');

    // 2. Si no hay Account, buscar alias genéricos
    if (!raw || !_cleanStr(raw)) {
      raw = _findColFuzzy(row, 'Cuenta')  ||
            _findColFuzzy(row, 'Cliente') ||
            _findColFuzzy(row, 'CLIENTE');
    }

    // 3. Fallback legacy: PROCESO UAS (nombre interno — solo si no hay Account)
    if (!raw || !_cleanStr(raw)) {
      raw = _findColGMBF08(row, 'PROCESO UAS') ||
            _findColFuzzy(row,  'PROCESO UAS') ||
            _findColFuzzy(row,  'NOMBRE CLIENTE O RAZON SOCIAL') ||
            _findColFuzzy(row,  'NOMBRE CLIENTE') ||
            _findColFuzzy(row,  'RAZON SOCIAL');
    }

    // 4. Último recurso: Site Name
    if (!raw || !_cleanStr(raw)) {
      raw = _findColFuzzy(row, 'Site Name') ||
            _findColFuzzy(row, 'Sitio')     ||
            _findColFuzzy(row, 'Puesto');
    }

    // Normalizar y aplicar tabla de aliases para unificar variantes
    return _applyClientAlias(_normalizeText(raw));
  }

  // ── Detección de tipo de formulario ──────────────────────────
  function _detectFormKey(columns) {
    const colStr = columns.map(c => _normalizeText(c)).join(' ');
    for (const { key, match } of FORM_DETECTORS) {
      if (match.some(m => colStr.includes(_normalizeText(m)))) return key;
    }
    return null;
  }

  function _hasSheetJS() {
    return typeof XLSX !== 'undefined';
  }

  // ── Parser principal ──────────────────────────────────────────
  async function readFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      if (!_hasSheetJS()) throw new Error('Librería Excel no disponible. Recarga la página.');
      return _parseExcelFile(file);
    }
    if (name.endsWith('.csv')) return _parseCSVFile(file);
    throw new Error(`Formato no soportado: ${file.name}. Use .xlsx, .xls o .csv`);
  }

  // ── REQ B: Parser Excel — cellDates:true OBLIGATORIO ─────────
  async function _parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          // REQ B: cellDates:true convierte seriales Excel a Date JS nativos
          const wb   = XLSX.read(data, { type: 'array', cellDates: true });
          const allRecords = [];
          const allErrors  = [];

          // ── DETECCIÓN AUTOMÁTICA: FORMATO METRICA_OPS / NUEVA_METRICA ─
          // Una sola hoja "Worksheet", col 2 = Reporter Employee Name,
          // col 29 = TIEMPO TOTAL DE VUELO (Nueva_metrica v2: 30 cols).
          // col 30 también aceptado por retrocompatibilidad (Metrica_Ops v1: 31 cols).
          if (wb.SheetNames.length === 1 && wb.SheetNames[0] === 'Worksheet' &&
              typeof MetricaOpsParser !== 'undefined') {
            const wsChk  = wb.Sheets['Worksheet'];
            const rowsAll = XLSX.utils.sheet_to_json(wsChk, { header: 1, defval: '' });
            if (rowsAll.length > 1) {
              const hdr = rowsAll[0];
              const isMetricaOps =
                String(hdr[2]  || '').includes('Reporter') &&
                (String(hdr[29] || '').toUpperCase().includes('TIEMPO TOTAL') ||
                 String(hdr[30] || '').toUpperCase().includes('TIEMPO TOTAL'));
              if (isMetricaOps) {
                try {
                  const pilotos = MetricaOpsParser.parse(rowsAll);
                  const flat    = MetricaOpsParser.toFlatRecords(pilotos);
                  flat.forEach(r => { if (!r._source) r._source = 'metrica_ops'; });
                  const pilots  = [...new Set(flat.map(r => r.piloto).filter(Boolean))];
                  const grouped = flat.reduce((acc, r) => {
                    acc[r.formKey] = (acc[r.formKey] || 0) + 1; return acc;
                  }, {});
                  resolve({
                    records: flat, errors: [], totalRows: flat.length,
                    pilots, grouped, _source_format: 'metrica_ops',
                  });
                  return;
                } catch (err) {
                  allErrors.push('[MetricaOps] ' + err.message + ' — usando parser estándar');
                }
              }
            }
          }
          // ────────────────────────────────────────────────────────────

          for (const sheetName of wb.SheetNames) {
            const ws   = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            if (rows.length < 2) continue;

            const headers = rows[0].map(h => _cleanStr(h));
            const formKey = _detectFormKey(headers);

            for (let i = 1; i < rows.length; i++) {
              const row = {};
              headers.forEach((h, idx) => { if (h) row[h] = rows[i][idx] ?? ''; });

              if (Object.values(row).filter(v => v !== '' && v !== null).length < 3) continue;

              try {
                const record = _parseRow(row, formKey, file.name, i);
                if (record) allRecords.push(record);
              } catch (err) {
                allErrors.push(`Hoja "${sheetName}" fila ${i + 1}: ${err.message}`);
              }
            }
          }

          const pilots  = [...new Set(allRecords.map(r => r.piloto).filter(Boolean))];
          const grouped = {};
          allRecords.forEach(r => { grouped[r.formKey] = (grouped[r.formKey] || 0) + 1; });

          resolve({ records: allRecords, errors: allErrors, totalRows: allRecords.length, pilots, grouped });
        } catch (err) {
          reject(new Error(`Error al leer Excel: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ── Parser de fila unificado ──────────────────────────────────
  function _parseRow(row, formKey, source, rowIndex) {
    if (!formKey) {
      const rowStr = Object.values(row).map(v => _normalizeText(v)).join(' ');
      for (const { key, match } of FORM_DETECTORS) {
        if (match.some(m => rowStr.includes(_normalizeText(m)))) { formKey = key; break; }
      }
      if (!formKey) return null;
    }

    // ── Piloto ────────────────────────────────────────────────
    const rawPilot =
      _findColFuzzy(row, 'Reporter Employee Name') ||
      _findColFuzzy(row, 'NOMBRE DEL PILOTO')       ||
      _findColFuzzy(row, 'Reporter')                ||
      _findColFuzzy(row, 'Reported By')             ||
      _findColFuzzy(row, 'Piloto');

    const pilot = _canonicalizePilot(rawPilot);
    if (!pilot) return null;

    // ── REQ A: Cliente dinámico — siempre normalizado ─────────
    const cuenta = _extractCuenta(row, formKey);

    // ── Sitio ─────────────────────────────────────────────────
    const sitio = _normalizeText(
      _findColFuzzy(row, 'Site Name') ||
      _findColFuzzy(row, 'Sitio')     ||
      _findColFuzzy(row, 'Puesto')    ||
      ''
    );

    const base = {
      piloto:  pilot,
      cuenta,           // REQ A: string normalizado, ID del cliente
      sitio,
      formKey,
      _source: source,
    };

    // ════════════════════════════════════════════════════════════
    // ── BITÁCORA (GMB-F15) — REQ D + [UPSERT] ────────────────
    // docId: BIT_{cuenta}_{fecha}_{hora_despegue}_{num_vuelo}
    // ════════════════════════════════════════════════════════════
    if (formKey === 'bitacora') {
      const rawFecha  = _findColGMBF08(row, 'FECHA DEL VUELO')         ||
                        _findColFuzzy(row, 'FECHA DEL VUELO')           ||
                        _findColFuzzy(row, 'FECHA');
      const rawMin    = _findColGMBF08(row, 'TIEMPO TOTAL DE VUELO')    ||
                        _findColFuzzy(row, 'TIEMPO TOTAL DE VUELO');
      const rawDesp   = _findColGMBF08(row, 'HORA DE DESPEGUE')         ||
                        _findColFuzzy(row, 'HORA DE DESPEGUE')           ||
                        _findColFuzzy(row, 'HORA DESPEGUE');
      const rawAter   = _findColGMBF08(row, 'HORA DE ATERRIZAJE')        ||
                        _findColFuzzy(row, 'HORA DE ATERRIZAJE')          ||
                        _findColFuzzy(row, 'HORA ATERRIZAJE');
      const rawAero   = _findColGMBF08(row, 'TIPO DE AERONAVE')          ||
                        _findColFuzzy(row, 'TIPO DE AERONAVE')            ||
                        _findColFuzzy(row, 'AERONAVE');
      const rawMision = _findColGMBF08(row, 'MISIONES PRINCIPALES SECURITAS') ||
                        _findColFuzzy(row, 'MISIONES PRINCIPALES')        ||
                        _findColFuzzy(row, 'MISION');
      const rawVision = _findColGMBF08(row, 'TIPO DE CONTACTO VISUAL')   ||
                        _findColFuzzy(row, 'TIPO DE CONTACTO VISUAL')     ||
                        _findColFuzzy(row, 'CONTACTO VISUAL');
      const rawTipoV  = _findColGMBF08(row, 'VUELOS ESPECIALES')          ||
                        _findColFuzzy(row, 'VUELOS ESPECIALES');
      const rawCipu   = _findColGMBF08(row, 'NUMERO DE CERTIFICADO DE IDONEIDAD') ||
                        _findColFuzzy(row, 'CERTIFICADO DE IDONEIDAD')    ||
                        _findColFuzzy(row, 'CIPU');
      const rawMatric = _findColGMBF08(row, 'MATRICULA DE LA AERONAVE')   ||
                        _findColFuzzy(row, 'MATRICULA');
      const rawNumV   = _findColGMBF08(row, '# DE VUELO DEL DIA')         ||
                        _findColGMBF08(row, '# DE VUELOS REALIZADOS')     ||
                        _findColFuzzy(row, 'DE VUELO DEL DIA')            ||
                        _findColFuzzy(row, 'VUELO DEL DIA');
      // GMB-F15: piloto en col "NOMBRE DEL PILOTO" (con acento o sin él)
      const rawPilotBit = _findColGMBF08(row, 'NOMBRE DEL PILOTO')       ||
                          _findColFuzzy(row, 'NOMBRE DEL PILOTO');
      const pilotBit = _canonicalizePilot(rawPilotBit) || base.piloto;

      const fecha   = _parseDate(rawFecha);
      const fechaTs = _toTimestampMarker(rawFecha); // REQ B: Timestamp para Firestore
      const desp    = _cleanStr(rawDesp);
      const numVuelo = _cleanStr(rawNumV);
      const minutos = _parseMinutes(rawMin);
      const horas   = parseFloat((minutos / APP_CONFIG.flight.MINUTES_PER_RECORD).toFixed(2));

      const rec = {
        ...base,
        piloto:          pilotBit,       // override: col específica GMB-F15
        fecha:           fecha && desp ? `${fecha} ${desp}` : fecha,
        fechaTs,         // REQ B: campo Timestamp
        minutos,
        horas,
        vuelo_num:       numVuelo,
        hora_despegue:   desp,
        hora_aterrizaje: _cleanStr(rawAter),
        aeronave:        _cleanStr(rawAero),
        matricula:       _cleanStr(rawMatric),
        tipo_mision:     _cleanStr(rawMision),
        contacto_visual: _cleanStr(rawVision),
        tipo_vuelo:      _cleanStr(rawTipoV),
        cipu:            _cleanStr(rawCipu),
      };

      // [UPSERT] ID determinístico: PREFIX_CUENTA_FECHA_HORA_NUMVUELO
      rec.id = _buildDocId('bitacora', cuenta, fecha, desp, numVuelo);
      return rec;
    }

    // ════════════════════════════════════════════════════════════
    // ── MISIONES (GMB-F16) — REQ D + [UPSERT] ────────────────
    // docId: MIS_{cuenta}_{fecha}_{hora_despegue}_{num_vuelo}
    // ════════════════════════════════════════════════════════════
    if (formKey === 'misiones') {
      const rawFecha      = _findColGMBF08(row, 'FECHA DE VUELO')                    ||
                            _findColFuzzy(row, 'FECHA DE VUELO')                    ||
                            _findColFuzzy(row, 'FECHA');
      const rawDesp       = _findColGMBF08(row, 'HORA DE DESPEGUE')                  ||
                            _findColFuzzy(row, 'HORA DE DESPEGUE')                   ||
                            _findColFuzzy(row, 'HORA INICIO DE NOVEDAD')             ||
                            _findColFuzzy(row, 'HORA DESPEGUE');
      const rawAter       = _findColGMBF08(row, 'HORA DE ATERRIZAJE')                ||
                            _findColFuzzy(row, 'HORA DE ATERRIZAJE')                 ||
                            _findColFuzzy(row, 'HORA FINAL DE NOVEDAD')              ||
                            _findColFuzzy(row, 'HORA ATERRIZAJE');
      const rawCumplida   = _findColGMBF08(row, 'MISION CUMPLIDA')                   ||
                            _findColFuzzy(row, 'MISION CUMPLIDA')                    ||
                            _findColFuzzy(row, 'CUMPLIDA');
      const rawArea       = _findColGMBF08(row, 'AREA VOLADA')                       ||
                            _findColGMBF08(row, 'ZONA INTERVENIDA')                  ||
                            _findColFuzzy(row, 'AREA VOLADA')                        ||
                            _findColFuzzy(row, 'AREA');
      const rawDetalle    = _findColGMBF08(row, '(SEA SI O NO, SU RESPUESTA, DESCRIBA AL DETALLE LA MISION)') ||
                            _findColGMBF08(row, 'DESCRIPCION')                       ||
                            _findColFuzzy(row, 'SEA SI O NO')                        ||
                            _findColFuzzy(row, 'DETALLE')                            ||
                            _findColFuzzy(row, 'OBSERVACIONES');
      const rawRutaVuelo  = _findColGMBF08(row, 'RUTA DE VUELO EFECTUADA')           ||
                            _findColFuzzy(row, 'RUTA DE VUELO')                      ||
                            _findColFuzzy(row, 'RUTA');
      const rawNoCumplida = _findColGMBF08(row, 'INFORME DE MISION NO CUMPLIDA')     ||
                            _findColFuzzy(row, 'RAZON POR LA CUAL NO SE REALIZA')    ||
                            _findColFuzzy(row, 'RAZON NO CUMPLIDA');
      const rawAero       = _findColGMBF08(row, 'TIPO DE AERONAVE')                  ||
                            _findColFuzzy(row, 'TIPO DE AERONAVE')                   ||
                            _findColFuzzy(row, 'AERONAVE');
      const rawNumV       = _findColGMBF08(row, '# DE VUELO DEL DIA')               ||
                            _findColGMBF08(row, '# DE VUELOS REALIZADOS')            ||
                            _findColFuzzy(row, 'DE VUELO DEL DIA')                   ||
                            _findColFuzzy(row, 'DE VUELO')                           ||
                            _findColFuzzy(row, 'VUELOS REALIZADOS')                  ||
                            _findColFuzzy(row, 'VUELO NUM');
      const rawMin        = _findColGMBF08(row, 'TIEMPO TOTAL DE VUELO')             ||
                            _findColFuzzy(row, 'TIEMPO TOTAL DE VUELO')              ||
                            _findColFuzzy(row, 'MINUTOS');
      const rawMatric     = _findColGMBF08(row, 'MATRICULA DE LA AERONAVE')          ||
                            _findColFuzzy(row, 'MATRICULA');
      const rawTipoMision = _findColFuzzy(row, 'TIPO DE MISION') || _findColFuzzy(row, 'MISIONES PRINCIPALES');
      const rawCipu       = _findColFuzzy(row, 'CERTIFICADO DE IDONEIDAD') || _findColFuzzy(row, 'CIPU');

      const fecha   = _parseDate(rawFecha);
      const fechaTs = _toTimestampMarker(rawFecha); // REQ B
      const desp    = _cleanStr(rawDesp);
      const numVuelo = _cleanStr(rawNumV);
      const minutos = _parseMinutes(rawMin);
      const horas   = parseFloat((minutos / APP_CONFIG.flight.MINUTES_PER_RECORD).toFixed(2));

      // GMB-F16: piloto viene en la columna compuesta
      // "6. INFORME DE MISION CUMPLIDA (GMB-F16):PILOTO ASIGNADO"
      // _findColGMBF08 extrae solo el sufijo tras ":", con fallback al piloto genérico del base.
      const rawPilotMis = _findColGMBF08(row, 'PILOTO ASIGNADO') ||
                          _findColFuzzy(row, 'PILOTO ASIGNADO')   ||
                          _findColFuzzy(row, 'PILOTO');
      const pilotMis = _canonicalizePilot(rawPilotMis) || base.piloto;

      const rec = {
        ...base,
        piloto:          pilotMis,          // override: columna específica GMB-F16
        fecha:           fecha && desp ? `${fecha} ${desp}` : fecha,
        fechaTs,
        vuelo_num:       numVuelo,
        mision_cumplida:  _normalizeText(rawCumplida).substring(0, 3),
        area_volada:      _cleanStr(rawArea).substring(0, 100),
        detalle_mision:   _cleanStr(rawDetalle).substring(0, 300),
        ruta_vuelo:       _cleanStr(rawRutaVuelo).substring(0, 200),
        ruta_efectuada:   _cleanStr(rawRutaVuelo).substring(0, 200), // alias
        razon_no_cumplida: _cleanStr(rawNoCumplida).substring(0, 300),
        hora_despegue:    desp,
        hora_aterrizaje:  _cleanStr(rawAter),
        aeronave:         _cleanStr(rawAero),
        matricula:        _cleanStr(rawMatric),
        tipo_mision:      _cleanStr(rawTipoMision),
        cipu:             _cleanStr(rawCipu),
        minutos,
        horas,
      };

      // [UPSERT] ID determinístico: PREFIX_CUENTA_FECHA_HORA_NUMVUELO
      rec.id = _buildDocId('misiones', cuenta, fecha, desp, numVuelo);
      return rec;
    }

    // ════════════════════════════════════════════════════════════
    // ── PLANEAMIENTO (GMB-F08) — [UPSERT] ────────────────────
    // docId: PLA_{cuenta}_{fecha}_{hora_despegue}_{num_vuelo}
    // ════════════════════════════════════════════════════════════
    if (formKey === 'planeamiento') {
      const rawFecha = _findColFuzzy(row, 'FECHA');

      const rawAero    = _findColGMBF08(row, 'TIPO DE AERONAVE')
                      || _findColFuzzy(row, 'TIPO DE AERONAVE')
                      || _findColFuzzy(row, 'AERONAVE');

      const rawMatric  = _findColGMBF08(row, 'MATRICULA DE LA AERONAVE')
                      || _findColFuzzy(row, 'MATRICULA DE LA AERONAVE')
                      || _findColFuzzy(row, 'MATRICULA');

      const rawAltitud = _findColGMBF08(row, 'MAXIMA ALTITUD DE VUELO')
                      || _findColFuzzy(row, 'MAXIMA ALTITUD DE VUELO')
                      || _findColFuzzy(row, 'ALTITUD MAXIMA')
                      || _findColFuzzy(row, 'ALTITUD');

      const rawVision  = _findColGMBF08(row, 'TIPO DE CONTACTO VISUAL')
                      || _findColFuzzy(row, 'TIPO DE CONTACTO VISUAL')
                      || _findColFuzzy(row, 'CONTACTO VISUAL');

      const rawBateria = _findColGMBF08(row, '% ADVERTENCIA BATERIA BAJA')
                      || _findColGMBF08(row, 'ADVERTENCIA BATERIA BAJA')
                      || _findColFuzzy(row, 'ADVERTENCIA BATERIA BAJA')
                      || _findColFuzzy(row, 'BATERIA BAJA')
                      || _findColFuzzy(row, 'BATERIA');

      const rawHoraD   = _findColGMBF08(row, 'HORA DE DESPEGUE')
                      || _findColFuzzy(row, 'HORA DE DESPEGUE')
                      || _findColFuzzy(row, 'HORA DESPEGUE');

      const rawArea    = _findColGMBF08(row, 'AREA  DE MANIOBRA')
                      || _findColGMBF08(row, 'AREA DE MANIOBRA')
                      || _findColGMBF08(row, 'FOTO AREA DE DESPEGUE')
                      || _findColFuzzy(row, 'AREA DE MANIOBRA')
                      || _findColFuzzy(row, 'ZONA DE VUELO')
                      || _findColFuzzy(row, 'ZONA');

      const rawMeteo   = _findColGMBF08(row, 'METEOROLOGIA')
                      || _findColFuzzy(row, 'METEOROLOGIA')
                      || _findColFuzzy(row, 'METEO')
                      || _findColFuzzy(row, 'CONDICIONES METEOROLOGICAS');

      const rawObs     = _findColGMBF08(row, 'OBSTACULOS A CONSIDERAR')
                      || _findColGMBF08(row, 'FOTO DE LOS OBSTACULOS')
                      || _findColFuzzy(row, 'OBSTACULOS A CONSIDERAR')
                      || _findColFuzzy(row, 'OBSTACULOS');

      const rawNumV    = _findColGMBF08(row, '# DE VUELO DEL DIA')
                      || _findColFuzzy(row, 'DE VUELO DEL DIA')
                      || _findColFuzzy(row, 'VUELO DEL DIA');

      const rawPilotoP = _findColFuzzy(row, 'Reporter Employee Name')
                      || _findColFuzzy(row, 'NOMBRE DEL PILOTO')
                      || _findColFuzzy(row, 'Reporter')
                      || _findColFuzzy(row, 'Reported By')
                      || _findColFuzzy(row, 'Piloto');

      const fecha   = _parseDate(rawFecha);
      const fechaTs = _toTimestampMarker(rawFecha);
      const horaD   = _cleanStr(rawHoraD) || 'Pendiente';
      const numVuelo = _cleanStr(rawNumV);

      const safeStr = (v, def) => { const s = _cleanStr(v); return s || (def !== undefined ? def : 'No Especificado'); };

      const rec = {
        ...base,
        piloto:              _canonicalizePilot(rawPilotoP || base.piloto || 'No Especificado'),
        fecha,
        fechaTs,
        formulario:          'GMB-F08',
        aeronave:            safeStr(rawAero),
        matricula:           safeStr(rawMatric),
        altitud_maxima:      safeStr(rawAltitud),
        contacto_visual:     safeStr(rawVision),
        advertencia_bateria: safeStr(rawBateria),
        bateria_advertencia: safeStr(rawBateria),   // alias de compatibilidad
        hora_despegue:       horaD,
        vuelo_num:           numVuelo,
        area_maniobra:       safeStr(rawArea),
        meteorologia:        safeStr(rawMeteo),
        obstaculos:          safeStr(rawObs),
        observaciones:       safeStr(rawObs).substring(0, 300),
      };

      // [UPSERT] ID determinístico: PREFIX_CUENTA_FECHA_HORA_NUMVUELO
      rec.id = _buildDocId('planeamiento', cuenta, fecha, horaD, numVuelo);
      return rec;
    }

    // ════════════════════════════════════════════════════════════
    // ── RIESGO (GMB-F10) — REQ B + [UPSERT] ──────────────────
    // docId: RIE_{cuenta}_{fecha}_{hora}_{num_vuelo}
    // ════════════════════════════════════════════════════════════
    if (formKey === 'riesgo') {
      const rawFecha  = _findColFuzzy(row, 'FECHA');
      const rawNivel  = _findColGMBF08(row, 'NIVEL DE RIESGO (%)') ||
                        _findColFuzzy(row, 'NIVEL DE RIESGO')       ||
                        _findColFuzzy(row, 'PORCENTAJE')            ||
                        _findColFuzzy(row, 'RIESGO');
      const rawObs    = _findColGMBF08(row, 'ANALISIS Y EVALUACION DEL RIESGO') ||
                        _findColFuzzy(row, 'OBSERVACIONES')         ||
                        _findColFuzzy(row, 'OBS');
      const rawAero   = _findColFuzzy(row, 'TIPO DE AERONAVE') || _findColFuzzy(row, 'AERONAVE');
      const rawMatric = _findColFuzzy(row, 'MATRICULA');
      const rawZona   = _findColFuzzy(row, 'ZONA DE VUELO') || _findColFuzzy(row, 'ZONA');
      const rawNumV   = _findColGMBF08(row, '# DE VUELO DEL DIA') ||
                        _findColFuzzy(row, 'DE VUELO DEL DIA')     ||
                        _findColFuzzy(row, 'VUELO DEL DIA')        ||
                        _findColFuzzy(row, 'VUELO NUM');
      const rawHora   = _findColFuzzy(row, 'HORA DE DESPEGUE') || _findColFuzzy(row, 'HORA');

      // GMB-F10: piloto en col[7] "NOMBRE DEL PILOTO"
      const rawPilotRie = _findColGMBF08(row, 'NOMBRE DEL PILOTO') ||
                          _findColFuzzy(row, 'NOMBRE DEL PILOTO');
      const pilotRie = _canonicalizePilot(rawPilotRie) || base.piloto;

      const fecha   = _parseDate(rawFecha);  // REQ B
      const fechaTs = _toTimestampMarker(rawFecha); // REQ B: Timestamp Firestore
      const hora    = _cleanStr(rawHora);
      const numVuelo = _cleanStr(rawNumV);

      const rec = {
        ...base,
        piloto:          pilotRie,       // override: col específica GMB-F10
        fecha,
        fechaTs,         // REQ B
        formulario:      'GMB-F10',
        nivel_riesgo:    _cleanStr(rawNivel),
        observaciones:   _cleanStr(rawObs).substring(0, 300),
        aeronave:        _cleanStr(rawAero),
        matricula:       _cleanStr(rawMatric),
        zona_vuelo:      _cleanStr(rawZona),
        hora_despegue:   hora,
        vuelo_num:       numVuelo,
      };

      // [UPSERT] ID determinístico: PREFIX_CUENTA_FECHA_HORA_NUMVUELO
      rec.id = _buildDocId('riesgo', cuenta, fecha, hora, numVuelo);
      return rec;
    }

    // ════════════════════════════════════════════════════════════
    // ── MANTENIMIENTO (GMB-F11) — REQ D + [UPSERT] ───────────
    // docId: MNT_{cuenta}_{fecha}_{aeronave_matricula}
    // Nota: Mantenimiento no tiene hora de despegue ni num de vuelo,
    //       se usa matricula como discriminador final.
    // ════════════════════════════════════════════════════════════
    if (formKey === 'mantenimiento') {
      const rawAero   = _findColGMBF08(row, 'Tipo Aeronave')        ||
                        _findColFuzzy(row, 'TIPO AERONAVE')          ||
                        _findColFuzzy(row, 'TIPO DE AERONAVE')       ||
                        _findColFuzzy(row, 'AERONAVE');
      const rawObs    = _findColGMBF08(row, 'Observaciones')        ||
                        _findColFuzzy(row, 'OBSERVACIONES')          ||
                        _findColFuzzy(row, 'OBS');
      const rawFecha  = _findColFuzzy(row, 'FECHA');
      const rawMatric = _findColFuzzy(row, 'MATRICULA') || _findColFuzzy(row, 'SERIAL');
      const rawTipo   = _findColFuzzy(row, 'TIPO DE MANTENIMIENTO') || _findColFuzzy(row, 'TIPO MANTENIMIENTO');
      const rawTecn   = _findColFuzzy(row, 'TECNICO') || _findColFuzzy(row, 'RESPONSABLE');
      const rawHoras  = _findColFuzzy(row, 'HORAS DE VUELO') || _findColFuzzy(row, 'HORAS TOTALES');
      const rawProx   = _findColFuzzy(row, 'PROXIMO MANTENIMIENTO') || _findColFuzzy(row, 'PROXIMA REVISION');

      // GMB-F11: piloto en "7. MANTENIMIENTO PREVENTIVO UAS:Nombre Piloto " (sin "DEL")
      // _findColFuzzy('NOMBRE DEL PILOTO') NO lo detecta → _findColGMBF08 con sufijo exacto
      const rawPilotMnt = _findColGMBF08(row, 'Nombre Piloto')    ||
                          _findColFuzzy(row, 'NOMBRE PILOTO')      ||
                          _findColFuzzy(row, 'NOMBRE DEL PILOTO');
      // Extraer solo el primer nombre si hay multilinea (ej: "Harold\nAndres")
      const pilotMntRaw = _cleanStr(rawPilotMnt) || '';
      const pilotMnt = _canonicalizePilot(pilotMntRaw) || base.piloto;

      const fecha   = _parseDate(rawFecha);
      const fechaTs = _toTimestampMarker(rawFecha); // REQ B
      const aero    = _cleanStr(rawAero);
      const matric  = _cleanStr(rawMatric);

      const rec = {
        ...base,
        piloto:            pilotMnt,          // override: col específica GMB-F11
        fecha,
        fechaTs,
        aeronave:          aero,
        matricula:         matric,
        observaciones:     _cleanStr(rawObs).substring(0, 300),
        tipo:              _cleanStr(rawTipo) || 'Preventivo UAS',
        tecnico:           _cleanStr(rawTecn),
        horas_vuelo_acum:  _cleanStr(rawHoras),
        proximo_mant:      _cleanStr(rawProx),
        formulario:        'GMB-F11',
      };

      // [UPSERT] Mantenimiento: usa aeronave+matricula como discriminador
      // (no hay hora ni num_vuelo en este formulario)
      const extraDiscriminator = matric || aero;
      rec.id = _buildDocId('mantenimiento', cuenta, fecha, pilot, extraDiscriminator);
      return rec;
    }

    // Formulario no reconocido con piloto válido
    base.id   = _buildDocId(formKey || 'REC', cuenta, '', pilot, source);
    base.fecha = '';
    return base;
  }

  // ── Parser CSV ────────────────────────────────────────────────
  async function _parseCSVFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try { resolve(_parseCSVContent(e.target.result, file.name)); }
        catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  function _parseCSVContent(text, filename) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      return { records: [], errors: ['Archivo vacío o sin datos'], totalRows: 0, pilots: [], grouped: {} };
    }

    const headers  = _parseCSVLine(lines[0]);
    const isLegacy = headers.includes('Id') && headers.includes('Type') && headers.includes('Date');
    const formKey  = isLegacy ? null : _detectFormKey(headers);

    const records = [];
    const errors  = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = _parseCSVLine(line);
      const row    = {};
      headers.forEach((h, idx) => { if (h) row[h] = values[idx] || ''; });

      try {
        const record = isLegacy
          ? _parseLegacyRow(row, filename)
          : _parseRow(row, formKey, filename, i);
        if (record) records.push(record);
      } catch (err) {
        errors.push(`Fila ${i + 1}: ${err.message}`);
      }
    }

    const pilots  = [...new Set(records.map(r => r.piloto).filter(Boolean))];
    const grouped = {};
    records.forEach(r => { grouped[r.formKey] = (grouped[r.formKey] || 0) + 1; });

    return { records, errors, totalRows: records.length, pilots, grouped };
  }

  function _parseLegacyRow(row, source) {
    const typeStr = _normalizeText(row['Type'] || '');
    let formKey   = null;

    for (const [key, cfg] of Object.entries(APP_CONFIG.formTypes)) {
      if (typeStr.includes(_normalizeText(cfg.match))) { formKey = key; break; }
    }
    if (!formKey) return null;

    const pilot    = _canonicalizePilot(row['Reported By'] || row['Reporter'] || '');
    const rawFecha = row['Date'] || '';
    const fecha    = _parseDate(rawFecha) || _cleanStr(rawFecha).substring(0, 10);
    const cuenta   = _normalizeText(row['Account'] || '');

    return {
      id:      _cleanStr(row['Id'] || '') || _buildDocId(formKey, cuenta, fecha, '', ''),
      piloto:  pilot,
      fecha,
      fechaTs: _toTimestampMarker(rawFecha),
      cuenta,            // REQ A: normalizado
      sitio:   _normalizeText(row['Post'] || ''),
      formKey,
      _source: source,
    };
  }

  function _parseCSVLine(line) {
    const result = [];
    let current  = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  function getInitials(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return String(name).substring(0, 2).toUpperCase();
  }

  return { readFile, getInitials };

})();
