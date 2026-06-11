/**
 * UASOPS — Configuración Global de la Aplicación
 * ================================================
 * Centraliza todas las constantes y reglas de negocio.
 * Modifica este archivo para adaptar el sistema sin tocar la lógica.
 */

const APP_CONFIG = {
// ── Reglas para detección de archivos de continuación ─────────────
continuation: {
  // Patrones en el nombre del archivo que indican continuación
  // Se evalúan contra el nombre SIN extensión, en orden
  patterns: [
    // "_1_2", "_1_3", "_2_1" (separadores guion bajo)
    /^(.+?)_(\d+)_(\d+)$/,
    // "1.2", "1.3" (separadores punto)
    /^(.+?)[\s_\-](\d+)\.(\d+)$/,
    // "_part2", "_parte2", "_2"
    /^(.+?)[\s_\-](?:part|parte)?(\d+)$/i,
  ],
  // Palabras clave que, si el nombre base las comparte, confirman continuación
  // (no necesario con regex, pero útil para logging)
  separators: ['_', '-', ' '],
},
  // ── Información general ────────────────────────────────────────
  app: {
    name:        'UASOPS',
    version:     '1.0.0',
    description: 'Sistema de Reporte Operacional UAS',
    organization:'UAS - Casa de Campo La calera',
    locale:      'es-CO',
  },

  // ── Regla de cálculo de horas de vuelo ────────────────────────
  // FÓRMULA: totalMinutos / FLIGHT_MINUTES_PER_RECORD = horas
  flight: {
    MINUTES_PER_RECORD: 35,      // Minutos asignados por cada registro de bitácora
    HOURS_PRECISION:    2,        // Decimales en la visualización de horas
  },

  // ── Tipos de formulario reconocidos ───────────────────────────
  // key: identificador interno  |  match: fragmento del campo "Type" en el CSV
  formTypes: {
    bitacora:      { key: 'bitacora',     match: 'BITACORA',      label: 'Bitácora de Vuelo',         icon: '📋', color: '#22d3ee' },
    misiones:      { key: 'misiones',     match: 'MISION',        label: 'Informe de Misión Cumplida', icon: '🎯', color: '#10b981' },
    planeamiento:  { key: 'planeamiento', match: 'PLANEAMIENTO',  label: 'Planeamiento de la Misión',  icon: '🗺️', color: '#f59e0b' },
    riesgo:        { key: 'riesgo',       match: 'RIESGO',        label: 'Análisis y Evaluación Riesgo',icon: '⚠️', color: '#eab308' },
    mantenimiento: { key: 'mantenimiento',match: 'MANTENIMIENTO', label: 'Mantenimiento Preventivo UAS',icon: '🔧', color: '#8b5cf6' },
  },

  // ── Columnas esperadas en los CSV ─────────────────────────────
  csv: {
    requiredColumns: ['Id', 'Type', 'Date', 'Reported By', 'Account', 'Post'],
    dateFormat:      'YYYY-MM-DD hh:mma',   // Para parsear con moment.js si se integra
    encoding:        'UTF-8',
  },

  // ── Persistencia de datos ─────────────────────────────────────
  storage: {
    driver:    'supabase',      // 'localStorage' | 'indexedDB' | 'supabase'
    keyPrefix: 'uasops_',
    ttlDays:   30,              // Tiempo de vida de los datos cacheados
  },

  // ── UI / Tema ─────────────────────────────────────────────────
  theme: {
    primary:    '#22d3ee',
    secondary:  '#3b82f6',
    accent:     '#f59e0b',
    success:    '#10b981',
    warning:    '#eab308',
    danger:     '#ef4444',
    bg:         '#030712',
    panel:      '#0d1a2e',
  },


  // ── Mapa de clientes reales (columna Account del Excel) ───────
  // Fuente: Metrica_Ops.xls — Columna A (Account)
  // Estos son los 8 clientes reales. El filtro global usa estos valores exactos.
  clients: {
    'AVIACION NO TRIPULADA (UAS)':           { label: 'Aviación No Tripulada (UAS)',        icon: '🛸', color: '#22d3ee' },
    'C B HOTELES Y RESORTS S A':             { label: 'C B Hoteles y Resorts S.A.',          icon: '🏨', color: '#10b981' },
    'CASA DE CAMPO RESTREPO META':           { label: 'Casa de Campo Restrepo Meta',         icon: '🏡', color: '#f59e0b' },
    'CENTRO COMERCIAL SANTA FE':             { label: 'Centro Comercial Santa Fe',           icon: '🏬', color: '#8b5cf6' },
    'CLUB LA PRADERA DE POTOSI':             { label: 'Club La Pradera de Potosí',           icon: '⛳', color: '#ec4899' },
    'CONJUNTO CERRADO CASA DE CAMPO PH':     { label: 'Conjunto Cerrado Casa de Campo PH',  icon: '🏘️', color: '#3b82f6' },
    'CORPORACION CLUB PUERTO PENALISA':      { label: 'Corporación Club Puerto Peñalisa',   icon: '⚓', color: '#ef4444' },
    'CORPORACION MESA DE YEGUAS COUNTRY CLUB':{ label: 'Corporación Mesa de Yeguas CC',    icon: '🐎', color: '#84cc16' },
  },

  // ── Navegación — secciones de la aplicación ───────────────────
  navigation: [
    { id: 'dashboard',     label: 'Dashboard General',       icon: '📊' },
    { id: 'pilotos',       label: 'Pilotos & Horas',         icon: '👨‍✈️' },
    { id: 'bitacora',      label: 'Bitácora de Vuelo',       icon: '📋' },
    { id: 'misiones',      label: 'Informes de Misión',      icon: '🎯' },
    { id: 'planeamiento',  label: 'Planeamiento',            icon: '🗺️' },
    { id: 'riesgo',        label: 'Análisis de Riesgo',      icon: '⚠️' },
    { id: 'mantenimiento', label: 'Mantenimiento',           icon: '🔧' },
    { id: 'uploader',      label: 'Cargar Archivos',         icon: '⬆️' },
  ],

};


// Exporta para uso en módulos (si se usa bundler como Vite/Webpack)
// export default APP_CONFIG;
// Para uso directo en HTML sin bundler, la variable queda global.
