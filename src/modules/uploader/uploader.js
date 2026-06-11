/**
 * uploader.js — Módulo de Carga e Integración de Archivos
 * =========================================================
 * Soporta: .xlsx, .xls, .csv
 * Usa SheetJS (XLSX) para leer archivos Excel nativos.
 *
 * ════════════════════════════════════════════════════════════════
 * AGRUPACIÓN DE ARCHIVOS PARTICIONADOS (_1_2, _1_3, etc.)
 * ════════════════════════════════════════════════════════════════
 * Algunos archivos son continuaciones de otros:
 *   BITACORAS_OPS.xls        → base
 *   BITACORA_1_2_OPS.xls     → continuación (se agrupa con el base)
 *   INFORME_DE_MISION_CUMPLIDA_OPS.xls     → base
 *   INFORME_DE_MISION_CUMPLIDA_OPS_1_2.xls → continuación
 *   INFORME_DE_MISION_CUMPLIDA_OPS_1_3.xls → continuación
 *
 * El uploader detecta el patrón, agrupa los archivos y concatena
 * sus filas antes de deduplicar → un único bloque limpio por grupo.
 *
 * ════════════════════════════════════════════════════════════════
 * [UPSERT] DEDUPLICACIÓN EN MEMORIA — CAPA DE DEFENSA ADICIONAL
 * ════════════════════════════════════════════════════════════════
 * Antes de acumular registros en _pendingRecords, se verifica que
 * el `id` determinístico no exista ya en el buffer de la sesión.
 *   → Primera carga: 135 registros añadidos.
 *   → Segunda carga del mismo archivo: 0 añadidos, 135 skipped.
 *
 * La deduplicación en Supabase (server-side) es garantizada por
 * supabase.js mediante upsert con IDs determinísticos generados por parser.js.
 */
const UploaderModule = (() => {

  let _pendingRecords = [];
  let _uploadedFiles  = [];
  let _pendingIds     = new Set();

  function init() {
    _bindDropZone();
    _bindFileInput();
  }

  function _bindDropZone() {
    const zone = document.getElementById('dropZone');
    if (!zone) return;
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('uploader__zone--hover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('uploader__zone--hover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('uploader__zone--hover');
      _processFiles(Array.from(e.dataTransfer.files));
    });
    zone.addEventListener('click', () => document.getElementById('fileInput')?.click());
  }

  function _bindFileInput() {
    const input = document.getElementById('fileInput');
    if (!input) return;
    input.addEventListener('change', e => {
      _processFiles(Array.from(e.target.files));
      e.target.value = '';
    });
  }

  // ════════════════════════════════════════════════════════════════
  // _extractBaseName — extrae el nombre base normalizando sufijos
  // ════════════════════════════════════════════════════════════════
  /**
   * Estrategia: eliminar segmentos numéricos de CONTINUACIÓN del nombre.
   * Los patrones de continuación son sufijos como _1_2, _1_3, _2 al final.
   *
   * Ejemplos:
   *   "BITACORA_1_2_OPS.xls"                   → "BITACORAS_OPS"  (ver nota)
   *   "BITACORAS_OPS.xls"                       → "BITACORAS_OPS"
   *   "INFORME_DE_MISION_CUMPLIDA_OPS_1_2.xls" → "INFORME_DE_MISION_CUMPLIDA_OPS"
   *   "INFORME_DE_MISION_CUMPLIDA_OPS.xls"     → "INFORME_DE_MISION_CUMPLIDA_OPS"
   *   "PLANEAMIENTO_OPS.xls"                    → "PLANEAMIENTO_OPS"
   *
   * NOTA sobre BITACORA_1_2_OPS: el patrón _1_2 está en medio del nombre,
   * no al final. El algoritmo elimina segmentos de dígitos aislados por
   * guión bajo de cualquier posición y luego colapsa guiones dobles.
   */
  // ════════════════════════════════════════════════════════════════
  // MAPA DE ALIASES DE NOMBRE BASE
  // Archivos cuyo nombre base calculado difiere del nombre real del
  // archivo principal (por diferencias ortográficas, plurales, etc.)
  // Clave: baseName calculado → Valor: baseName canónico del grupo.
  // ════════════════════════════════════════════════════════════════
  const BASE_NAME_ALIASES = {
    // BITACORA_1_2_OPS → base calculado "BITACORA_OPS" debe pertenecer a "BITACORAS_OPS"
    'BITACORA_OPS': 'BITACORAS_OPS',
  };

  function _extractBaseName(filename) {
    const noExt = filename.replace(/\.[^.]+$/, '').toUpperCase().trim();

    // Eliminar TODOS los segmentos puramente numéricos (grupos de _N o _N_N en cualquier posición)
    let base = noExt.replace(/(_\d+)+/g, '');

    // Colapsar guiones bajos múltiples y limpiar bordes
    base = base.replace(/__+/g, '_').replace(/^_|_$/g, '');

    // Aplicar alias si el baseName tiene un alias canónico conocido
    return BASE_NAME_ALIASES[base] || base;
  }

  // ════════════════════════════════════════════════════════════════
  // _isContinuation — detecta si un archivo es continuación
  // ════════════════════════════════════════════════════════════════
  /**
   * Un archivo es continuación si su nombre normalizado difiere del baseName.
   * Se calcula comparando el nombre sin extensión con su propio baseName extraído.
   *
   *   "BITACORA_1_2_OPS.xls"                   → true
   *   "BITACORAS_OPS.xls"                       → false (es el base)
   *   "INFORME_DE_MISION_CUMPLIDA_OPS_1_2.xls" → true
   *   "INFORME_DE_MISION_CUMPLIDA_OPS.xls"     → false
   */
  function _isContinuation(filename) {
    const noExt  = filename.replace(/\.[^.]+$/, '').toUpperCase().trim();
    const base   = _extractBaseName(filename);
    return noExt !== base;
  }

  // ════════════════════════════════════════════════════════════════
  // _groupFilesByBase — agrupa archivos por nombre base compartido
  // ════════════════════════════════════════════════════════════════
  /**
   * Recibe el array de File objects y los agrupa por nombre base.
   *
   * Retorna array de grupos:
   * [
   *   {
   *     baseName: "BITACORAS_OPS",
   *     primary: File,          // el archivo sin sufijo numérico
   *     continuations: [File],  // archivos con sufijo _1_2, _1_3, etc.
   *     allFiles: [File, ...]   // primary + continuations, en orden
   *   },
   * ]
   *
   * Si un archivo no tiene base compartida con nadie, forma su propio
   * grupo con continuations vacío.
   */
  function _groupFilesByBase(files) {
    const groups = new Map(); // baseName → { primary, continuations }

    for (const file of files) {
      const baseName = _extractBaseName(file.name);
      const isCont   = _isContinuation(file.name);

      if (!groups.has(baseName)) {
        groups.set(baseName, { baseName, primary: null, continuations: [] });
      }

      const group = groups.get(baseName);
      if (isCont) {
        group.continuations.push(file);
      } else {
        // Si ya hay un primary, el segundo pasa a continuación para no perder datos
        if (group.primary) {
          group.continuations.push(file);
        } else {
          group.primary = file;
        }
      }
    }

    // Normalizar: si solo hay continuaciones y ningún primary, el primero es el primary
    for (const group of groups.values()) {
      if (!group.primary && group.continuations.length > 0) {
        group.primary = group.continuations.shift();
      }
      // Ordenar continuaciones por nombre para garantizar orden lógico
      group.continuations.sort((a, b) => a.name.localeCompare(b.name));
      group.allFiles = [group.primary, ...group.continuations];
    }

    return Array.from(groups.values());
  }

  // ════════════════════════════════════════════════════════════════
  // _processFiles — opera por grupos de archivos
  // ════════════════════════════════════════════════════════════════
  async function _processFiles(files) {
    const supported = files.filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls');
    });

    if (supported.length === 0) {
      _toast('⚠ Solo se soportan archivos .xlsx, .xls o .csv', 'warning');
      return;
    }

    if (supported.length < files.length) {
      _toast(`⚠ ${files.length - supported.length} archivo(s) ignorado(s) (formato no soportado)`, 'warning');
    }

    // Agrupar archivos por nombre base ANTES de procesar
    const groups = _groupFilesByBase(supported);

    for (const group of groups) {
      try {
        // Leer todos los archivos del grupo y fusionar sus registros
        const result = await _readGroup(group);

        if (result.errors.length) {
          _toast(`⚠ ${group.baseName}: ${result.errors[0]}`, 'warning');
        }

        const { added, skipped } = _mergeRecords(result.records);

        _uploadedFiles.push({
          name:      group.baseName,
          size:      group.allFiles.reduce((s, f) => s + f.size, 0),
          rows:      result.totalRows,
          added,
          skipped,
          pilots:    result.pilots,
          grouped:   result.grouped,
          fileNames: group.allFiles.map(f => f.name),
        });

        // Renderizar como grupo visual
        _renderGroupItem(group, result, added, skipped);

        if (skipped > 0 && added === 0) {
          _toast(`♻ ${group.baseName} — ya cargado (${skipped} registros duplicados omitidos)`, 'warning');
        } else if (group.continuations.length > 0) {
          _toast(`✅ ${group.baseName} — consolidado (${group.allFiles.length} archivos, ${added} registros)`, 'success');
        } else {
          _toast(`✅ ${group.baseName} — ${added} registros listos para integrar`, 'success');
        }

      } catch (err) {
        _toast(`❌ ${group.baseName}: ${err.message}`, 'error');
      }
    }

    _renderPreview();
    EventBus.emit('upload:complete', { count: _pendingRecords.length });
  }

  // ════════════════════════════════════════════════════════════════
  // _readGroup — lee un grupo de archivos y consolida filas
  // ════════════════════════════════════════════════════════════════
  /**
   * Lee el archivo primario y todas sus continuaciones.
   * Concatena (append vertical) los records de continuación DEBAJO del primario.
   * Calcula pilotos y clientes únicos del grupo consolidado.
   */
  async function _readGroup(group) {
    const allRecords = [];
    const allErrors  = [];

    for (const file of group.allFiles) {
      const result = await Parser.readFile(file);
      allRecords.push(...result.records);
      allErrors.push(...result.errors);
    }

    // Calcular pilotos y clientes únicos del grupo consolidado
    const seenPilots   = new Set();
    const seenClientes = new Set();
    const pilots       = [];
    const clientes     = [];

    for (const rec of allRecords) {
      if (rec.piloto && !seenPilots.has(rec.piloto)) {
        seenPilots.add(rec.piloto);
        pilots.push(rec.piloto);
      }
      if (rec.cuenta && !seenClientes.has(rec.cuenta)) {
        seenClientes.add(rec.cuenta);
        clientes.push(rec.cuenta);
      }
    }

    const grouped = {};
    allRecords.forEach(r => { grouped[r.formKey] = (grouped[r.formKey] || 0) + 1; });

    return {
      records:   allRecords,
      errors:    allErrors,
      totalRows: allRecords.length,
      pilots,
      clientes,
      grouped,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // [UPSERT] _mergeRecords — Deduplicación en memoria O(1)
  // ════════════════════════════════════════════════════════════════
  function _mergeRecords(newRecords) {
    let added   = 0;
    let skipped = 0;

    for (const rec of newRecords) {
      const hasId = rec.id && String(rec.id).trim();

      if (hasId && _pendingIds.has(rec.id)) {
        skipped++;
      } else {
        _pendingRecords.push(rec);
        if (hasId) _pendingIds.add(rec.id);
        added++;
      }
    }

    return { added, skipped };
  }

  // ════════════════════════════════════════════════════════════════
  // _renderGroupItem — renderiza el grupo visualmente unificado
  // ════════════════════════════════════════════════════════════════
  function _renderGroupItem(group, result, added, skipped) {
    const list = document.getElementById('uploaded-list');
    if (!list) return;

    const hasCont      = group.continuations.length > 0;
    const groupSummary = Object.entries(result.grouped)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');

    const dupNote = skipped > 0
      ? `<div class="file-item__meta" style="color:var(--warning);font-size:11px">♻ ${skipped} duplicado(s) omitido(s)</div>`
      : '';

    const contItems = hasCont
      ? group.continuations.map(f => `
          <div class="file-group__continuation">
            <span class="file-group__cont-icon">↳</span>
            <span class="file-group__cont-name">${f.name}</span>
            <span class="file-group__cont-badge">continuación</span>
          </div>`).join('')
      : '';

    const consolidatedBadge = hasCont
      ? `<span class="file-group__badge">🔗 ${group.allFiles.length} archivos consolidados</span>`
      : '';

    const item = document.createElement('div');
    item.className = 'file-item file-group animate-fade-in';
    item.dataset.groupName = group.baseName;
    item.dataset.fileNames = JSON.stringify(group.allFiles.map(f => f.name));

    item.innerHTML = `
      <div class="file-item__icon">📊</div>
      <div class="file-item__info">
        <div class="file-item__name">
          ${group.baseName}
          ${consolidatedBadge}
        </div>
        <div class="file-item__meta">
          ${added} nuevos · ${result.totalRows} registros · ${result.pilots.length} piloto(s) único(s)
        </div>
        <div class="file-item__meta" style="color:var(--primary);font-size:11px">${groupSummary || 'Sin datos detectados'}</div>
        ${dupNote}
        ${contItems}
        <div class="file-item__status">✓ Consolidado correctamente</div>
      </div>
      <button class="remove-btn" title="Eliminar grupo"
        onclick="UploaderModule.removeGroup('${group.baseName.replace(/'/g, "\\'")}')">✕</button>`;

    list.appendChild(item);
  }

  // ════════════════════════════════════════════════════════════════
  // _renderPreview — vista previa de registros pendientes
  // ════════════════════════════════════════════════════════════════
  function _renderPreview() {
    const preview = document.getElementById('upload-preview');
    if (!preview) return;

    if (_pendingRecords.length === 0) { preview.style.display = 'none'; return; }
    preview.style.display = 'block';

    const pilots   = [...new Set(_pendingRecords.map(r => r.piloto).filter(Boolean))];
    const clientes = [...new Set(_pendingRecords.map(r => r.cuenta).filter(Boolean))];
    const bitRecs  = _pendingRecords.filter(r => r.formKey === 'bitacora');
    const totalMin = bitRecs.reduce((s, r) => s + (parseInt(r.minutos) || 0), 0);
    const newHours = parseFloat((totalMin / APP_CONFIG.flight.MINUTES_PER_RECORD).toFixed(2));

    _setText('upload-count',    _pendingRecords.length);
    _setText('upload-pilots',   pilots.length);
    _setText('upload-hours',    Formatter.hours(newHours));
    _setText('upload-clientes', clientes.length);

    const tbody = document.getElementById('tbl-upload-preview');
    if (!tbody) return;

    tbody.innerHTML = _pendingRecords.slice(0, 80).map(r => {
      const cfg = APP_CONFIG.formTypes[r.formKey];
      return `
        <tr>
          <td class="id-cell" title="${r.id || ''}">${(r.id || '—').substring(0, 35)}</td>
          <td>${cfg ? Formatter.badge(cfg.icon + ' ' + cfg.label.slice(0, 22), 'blue') : r.formKey}</td>
          <td><strong style="color:#fff">${r.piloto || '—'}</strong></td>
          <td style="font-size:11px;color:var(--text2)">${r.cuenta || '—'}</td>
          <td class="text-sm text-muted">${Formatter.date(r.fecha)}</td>
          <td>${Formatter.badge((r._source || '—').split('/').pop(), 'cyan')}</td>
        </tr>`;
    }).join('');

    if (_pendingRecords.length > 80) {
      tbody.innerHTML += `<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:12px;font-size:12px">… y ${_pendingRecords.length - 80} registros más</td></tr>`;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // removeGroup — elimina todos los archivos de un grupo
  // ════════════════════════════════════════════════════════════════
  function removeGroup(groupName) {
    const groupEl  = document.querySelector(`[data-group-name="${groupName}"]`);
    const fileNames = groupEl
      ? JSON.parse(groupEl.dataset.fileNames || '[]')
      : [];

    const removedIds = _pendingRecords
      .filter(r => fileNames.includes(r._source) && r.id)
      .map(r => r.id);

    removedIds.forEach(id => _pendingIds.delete(id));
    _pendingRecords = _pendingRecords.filter(r => !fileNames.includes(r._source));
    _uploadedFiles  = _uploadedFiles.filter(f => f.name !== groupName);

    groupEl?.remove();
    _renderPreview();
    _toast(`🗑 Grupo "${groupName}" eliminado`);
  }

  // removeFile se mantiene para compatibilidad
  function removeFile(filename) {
    removeGroup(filename);
  }

  // ── Sanitizador para GMB-F08 ─────────────────────────────────
  function _sanitizePlaneamiento(records) {
    const STR_DEFAULTS = {
      cliente:             'No Especificado',
      cuenta:              'No Especificado',
      piloto:              'No Especificado',
      aeronave:            'No Especificado',
      matricula:           'No Especificado',
      altitud_maxima:      'No Especificado',
      contacto_visual:     'No Especificado',
      advertencia_bateria: 'No Especificado',
      bateria_advertencia: 'No Especificado',
      hora_despegue:       'Pendiente',
      area_maniobra:       'No Especificado',
      meteorologia:        'No Especificado',
      obstaculos:          'No Especificado',
      observaciones:       'No Especificado',
    };
    return records.map(r => {
      if (r.formKey !== 'planeamiento') return r;
      const clean = { ...r };
      Object.entries(STR_DEFAULTS).forEach(([field, def]) => {
        const v = clean[field];
        if (v === null || v === undefined || String(v).trim() === '' ||
            String(v).trim().toLowerCase() === 'nan' || String(v).trim() === 'undefined') {
          clean[field] = def;
        }
      });
      return clean;
    });
  }

  async function integrate() {
    if (_pendingRecords.length === 0) {
      _toast('⚠ No hay archivos pendientes de integrar', 'warning');
      return;
    }

    const btn = document.getElementById('btn-integrate');
    const total = _pendingRecords.length;
    const isLargeVolume = total > 200;

    if (btn) {
      btn.disabled = true;
      btn.textContent = isLargeVolume
        ? `⬆ Subiendo ${total} registros… 0%`
        : '⬆ Subiendo a Supabase…';
    }

    try {
      const currentPilots = State.get('pilots');
      const newPilotNames = [...new Set(_pendingRecords.map(r => r.piloto).filter(Boolean))];
      const pilotUpdates  = [];

      newPilotNames.forEach(name => {
        if (!currentPilots.find(p => p.name === name)) {
          pilotUpdates.push({ name, initials: Parser.getInitials(name) });
        }
      });

      const recordsToSave = _sanitizePlaneamiento(_pendingRecords);

      // Callback de progreso — solo activo en volúmenes grandes para no saturar DOM
      const onProgress = isLargeVolume
        ? ({ saved, total: tot }) => {
            const pct = Math.round((saved / tot) * 100);
            if (btn) btn.textContent = `⬆ Subiendo ${tot} registros… ${pct}%`;
          }
        : null;

      const [savedCount] = await Promise.all([
        SupabaseDB.saveRecords(recordsToSave, onProgress),
        pilotUpdates.length > 0 ? SupabaseDB.savePilots([...currentPilots, ...pilotUpdates]) : Promise.resolve(),
      ]);

      const currentData = State.get('data');
      _pendingRecords.forEach(r => {
        if (currentData[r.formKey]) currentData[r.formKey].push(r);
      });
      State.set('data', { ...currentData });

      const addedCount = _pendingRecords.length;

      _pendingRecords = [];
      _uploadedFiles  = [];
      _pendingIds     = new Set();
      document.getElementById('uploaded-list').innerHTML = '';
      document.getElementById('upload-preview').style.display = 'none';

      EventBus.emit('upload:integrated', { count: addedCount });
      EventBus.emit('data:updated', { source: 'upload' });
      _toast(`✅ ${savedCount} registros integrados en Supabase (UPSERT — sin duplicados)`, 'success');

    } catch (err) {
      console.error('[Uploader] Error:', err);
      _toast(`❌ Error al guardar: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✅ Integrar al Sistema'; }
    }
  }

  function clearAll() {
    _pendingRecords = [];
    _uploadedFiles  = [];
    _pendingIds     = new Set();
    document.getElementById('uploaded-list').innerHTML = '';
    document.getElementById('upload-preview').style.display = 'none';
    _toast('🗑 Archivos pendientes eliminados');
  }

  function _setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function _toast(msg, type = '') {
    EventBus.emit('toast:show', { msg, type });
  }

  return { init, removeFile, removeGroup, integrate, clearAll };

})();
ENDOFFILE