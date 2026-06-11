/**
 * MetricaOpsParser — Parser para formato Nueva_metrica.xls (v2)
 * =======================================================
 * Detecta y procesa el Excel columnar único de Metrica_Ops / Nueva_metrica.
 * Fuente de clientes: Columna A (Account) — NO PROCESO UAS.
 * Fuente de horas:    Col 29 (TIEMPO TOTAL DE VUELO) ÷ 35.
 *
 * CAMBIO v2 (Nueva_metrica): columna REACCION (antigua col 22) fue eliminada.
 * Total columnas: 30 (antes 31). Todo desde col 22 se desplazó -1.
 *
 * Integración:
 *   - Llamado automáticamente por parser.js cuando detecta el formato.
 *   - También puede usarse standalone: MetricaOpsParser.parse(rows)
 */

const MetricaOpsParser = (() => {

  // ── Mapa de columnas (índice 0-based) — Nueva_metrica v2 ───
  // REACCION (antes col 22) eliminada; AREA_VOLADA pasó de 23 → 22,
  // Mantenimiento de 24-26 → 23-25, Bitácora de 27-30 → 26-29.
  const COL = {
    ACCOUNT:  0, ADDRESS: 1, REPORTER: 2,
    // PLANEAMIENTO (GMB-F08)
    PLAN_PROC: 3, PLAN_VUELO: 4, PLAN_AERO: 5, PLAN_MAT: 6,
    PLAN_DEP: 7, PLAN_ALT: 8, PLAN_CONT: 9,
    // ANÁLISIS Y EVALUACIÓN DEL RIESGO (GMB-F10)
    ANALISIS_PROC: 10, ANALISIS_VUELO: 11, ANALISIS_NIVEL: 12,
    // INFORME DE MISIÓN CUMPLIDA (GMB-F16)
    MIS_PROC: 13, MIS_FECHA: 14, MIS_DEP: 15, MIS_ATR: 16,
    MIS_CUM: 17, MIS_NO: 18, MIS_DET: 19, MIS_AERO: 20,
    MIS_VUELO: 21, MIS_AREA: 22,             // ← REACCION eliminada; AREA_VOLADA desplazada
    // MANTENIMIENTO PREVENTIVO UAS
    MANT_PILOTO: 23, MANT_OBS: 24, MANT_AERO: 25,
    // BITÁCORA DE VUELO DIARIO (GMB-F15)
    BIT_FECHA: 26, BIT_DEP: 27, BIT_ATR: 28,
    BIT_MINUTOS: 29,  // ← LLAVE DE HORAS: minutos_totales / 35
  };

  // ── Normalización de nombres ────────────────────────────────
  const ACCENT = { Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U',Ü:'U',Ñ:'N',
                   á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n' };

  const CANONICAL_NAMES = {
    'ANDRES  ALBERTO BONILLA GONZALEZ':    'ANDRES ALBERTO BONILLA GONZALEZ',
    'GERMAN ANDRES TORRES RIVERO':         'GERMAN ANDRES TORRES RIVEROS',
    'ESNEYDER JOHAN HERRERA URBANO':       'ESNAIDER JOHAN HERRERA URBANO',
    'JUAN  SEBASTIAN MANCERA ZUNIGA':      'JUAN SEBASTIAN MANCERA ZUNIGA',
    'WILLIAN GUILLERMO CARMONA RODRIGUEZ': 'WILLIAM GUILLERMO CARMONA RODRIGUEZ',
    'LINDA LUCIA MUNOZ GONZALES':          'LINDA LUCIA MUNOZ GONZALEZ',
    'HENRY RODRIGO PRIETO GONZALES':       'HENRY RODRIGO PRIETO GONZALEZ',
  };

  // Normalizar nombre de Account (cliente) — sin acentos, sin punto final, trimmed
  function _normalizeAccount(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let n = raw.trim();
    n = n.split('').map(c => ACCENT[c] || c).join('').toUpperCase();
    n = n.replace(/\s+/g, ' ').replace(/\.$/, '').trim();
    return n;
  }

  function _normalizePilot(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let n = raw.trim();
    n = n.replace(/[-'"]{3,}.*?[-'"]{3,}\s*/gs, '');
    n = n.split('\n')[0].trim();
    n = n.split('').map(c => ACCENT[c] || c).join('').toUpperCase();
    n = n.replace(/\s+/g, ' ').trim();
    n = n.replace(/\s+SUPERVISOR(\s+PILOTO.*)?$/, '')
         .replace(/\s+PILOTO DE DRONES.*$/, '');
    const clean = n.trim();
    return CANONICAL_NAMES[clean] || clean || null;
  }

  function _hasValue(v) {
    return v !== null && v !== undefined && v !== '';
  }

  function _str(v) {
    return (v === null || v === undefined) ? '' : String(v).trim();
  }

  function _detectSection(row) {
    if (_hasValue(row[COL.BIT_MINUTOS]))   return 'bitacora';
    if (_hasValue(row[COL.PLAN_PROC]))     return 'planeamiento';
    if (_hasValue(row[COL.ANALISIS_PROC])) return 'riesgo';      // riesgo = analisis en el store
    if (_hasValue(row[COL.MIS_PROC]))      return 'misiones';
    if (_hasValue(row[COL.MANT_PILOTO]))   return 'mantenimiento';
    return null;
  }

  /**
   * Parsea las rows del Excel Metrica_Ops y devuelve mapa por piloto.
   * @param {Array<Array>} rows — incluye fila 0 (headers)
   * @returns {{ [pilotoCanónico]: PilotoData }}
   */
  function parse(rows) {
    const result = {};

    function getPiloto(name) {
      if (!result[name]) {
        result[name] = {
          nombre: name,
          resumen: {
            minutos_totales: 0, horas_reales: 0,
            registros_bitacora: 0, registros_planeamiento: 0,
            registros_analisis_riesgo: 0, registros_mision: 0,
            registros_mantenimiento: 0,
          },
          bitacora: [], planeamiento: [], riesgo: [], misiones: [], mantenimiento: [],
        };
      }
      return result[name];
    }

    for (const row of rows.slice(1)) {
      const section = _detectSection(row);
      if (!section) continue;

      // Cuenta: SIEMPRE de columna A (Account) — llave real del cliente
      const cuenta = _normalizeAccount(_str(row[COL.ACCOUNT]));

      // Piloto: col 2 para todo excepto MANTENIMIENTO (col 24)
      const rawName = section === 'mantenimiento'
        ? row[COL.MANT_PILOTO]
        : row[COL.REPORTER];
      const piloto = _normalizePilot(_str(rawName));
      if (!piloto) continue;

      const p = getPiloto(piloto);

      if (section === 'bitacora') {
        const minutos = parseFloat(row[COL.BIT_MINUTOS]) || 0;
        p.bitacora.push({
          piloto, cuenta,
          fecha: _str(row[COL.BIT_FECHA]),
          hora_despegue: _str(row[COL.BIT_DEP]),
          hora_aterrizaje: _str(row[COL.BIT_ATR]),
          minutos,
          horas: Math.round((minutos / 35) * 100) / 100,
          formKey: 'bitacora',
        });
        p.resumen.minutos_totales    += minutos;
        p.resumen.registros_bitacora += 1;

      } else if (section === 'planeamiento') {
        p.planeamiento.push({
          piloto, cuenta,
          proceso_uas:    _str(row[COL.PLAN_PROC]),
          vuelo_num:      _str(row[COL.PLAN_VUELO]),
          aeronave:       _str(row[COL.PLAN_AERO]),
          matricula:      _str(row[COL.PLAN_MAT]),
          hora_despegue:  _str(row[COL.PLAN_DEP]),
          altitud_maxima: _str(row[COL.PLAN_ALT]),
          contacto_visual:_str(row[COL.PLAN_CONT]),
          formKey: 'planeamiento',
        });
        p.resumen.registros_planeamiento += 1;

      } else if (section === 'riesgo') {
        p.riesgo.push({
          piloto, cuenta,
          proceso_uas:  _str(row[COL.ANALISIS_PROC]),
          vuelo_num:    _str(row[COL.ANALISIS_VUELO]),
          nivel_riesgo: _str(row[COL.ANALISIS_NIVEL]),
          formKey: 'riesgo',
        });
        p.resumen.registros_analisis_riesgo += 1;

      } else if (section === 'misiones') {
        p.misiones.push({
          piloto, cuenta,
          proceso_uas:     _str(row[COL.MIS_PROC]),
          fecha:           _str(row[COL.MIS_FECHA]),
          hora_despegue:   _str(row[COL.MIS_DEP]),
          hora_aterrizaje: _str(row[COL.MIS_ATR]),
          mision_cumplida: _str(row[COL.MIS_CUM]),
          detalle_mision:  _str(row[COL.MIS_DET]),
          aeronave:        _str(row[COL.MIS_AERO]),
          vuelo_num:       _str(row[COL.MIS_VUELO]),
          area_volada:     _str(row[COL.MIS_AREA]),
          formKey: 'misiones',
        });
        p.resumen.registros_mision += 1;

      } else if (section === 'mantenimiento') {
        p.mantenimiento.push({
          piloto, cuenta,
          observaciones: _str(row[COL.MANT_OBS]),
          aeronave:      _str(row[COL.MANT_AERO]),
          formKey: 'mantenimiento',
        });
        p.resumen.registros_mantenimiento += 1;
      }
    }

    // Calcular horas finales (÷ 35)
    for (const p of Object.values(result)) {
      p.resumen.horas_reales =
        Math.round((p.resumen.minutos_totales / 35) * 100) / 100;
    }

    return result;
  }

  /**
   * Convierte el mapa de pilotos en arrays planos compatibles con
   * el store de UASOPS (State.get('data')).
   * Genera IDs determinísticos para deduplicación.
   */
  function toFlatRecords(pilotos) {
    const records = [];
    const _seg = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 20);
    let counters = { bitacora:1, misiones:1, planeamiento:1, riesgo:1, mantenimiento:1 };
    const PREFIX = { bitacora:'BIT', misiones:'MIS', planeamiento:'PLA', riesgo:'RIE', mantenimiento:'MNT' };

    for (const [pname, pdata] of Object.entries(pilotos)) {
      for (const section of ['bitacora','planeamiento','riesgo','misiones','mantenimiento']) {
        for (const rec of pdata[section]) {
          const fk  = rec.formKey;
          const pfx = PREFIX[fk] || 'REC';
          rec.id    = `${pfx}_${_seg(rec.cuenta)}_${_seg(pname)}_${String(counters[fk]||1).padStart(4,'0')}`;
          counters[fk] = (counters[fk] || 1) + 1;
          records.push(rec);
        }
      }
    }
    return records;
  }

  /** Busca un piloto por nombre (exacto o parcial, normalizado). */
  function buscarPiloto(pilotos, nombre) {
    const norm = _normalizePilot(nombre);
    if (!norm) return null;
    if (pilotos[norm]) return pilotos[norm];
    const match = Object.keys(pilotos).find(k => k.includes(norm));
    return match ? pilotos[match] : null;
  }

  return { parse, toFlatRecords, buscarPiloto };

})();
