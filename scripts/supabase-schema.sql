-- ═══════════════════════════════════════════════════════════
-- UASOPS v8 — Schema completo para Supabase
-- Ejecutar en: SQL Editor del Dashboard de Supabase
-- ═══════════════════════════════════════════════════════════

-- Tabla: bitacora (GMB-F15 — registros de vuelo)
CREATE TABLE IF NOT EXISTS bitacora (
  id TEXT PRIMARY KEY,
  piloto TEXT,
  cuenta TEXT,
  sitio TEXT,
  fecha TEXT,
  fecha_ts TIMESTAMPTZ,
  minutos INTEGER,
  horas NUMERIC(5,2),
  hora_despegue TEXT,
  hora_aterrizaje TEXT,
  vuelo_num TEXT,
  num_vuelo_dia TEXT,
  aeronave TEXT,
  matricula TEXT,
  tipo_mision TEXT,
  contacto_visual TEXT,
  tipo_vuelo TEXT,
  cipu TEXT,
  proceso_uas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: misiones (GMB-F16 — informes de misión cumplida)
CREATE TABLE IF NOT EXISTS misiones (
  id TEXT PRIMARY KEY,
  piloto TEXT,
  cuenta TEXT,
  sitio TEXT,
  fecha TEXT,
  fecha_ts TIMESTAMPTZ,
  minutos INTEGER,
  horas NUMERIC(5,2),
  mision_cumplida TEXT,
  area_volada TEXT,
  detalle_mision TEXT,
  ruta_vuelo TEXT,
  ruta_efectuada TEXT,
  razon_no_cumplida TEXT,
  hora_despegue TEXT,
  hora_aterrizaje TEXT,
  aeronave TEXT,
  matricula TEXT,
  tipo_mision TEXT,
  cipu TEXT,
  vuelo_num TEXT,
  proceso_uas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: planeamiento (GMB-F08 — planeamiento de la misión)
CREATE TABLE IF NOT EXISTS planeamiento (
  id TEXT PRIMARY KEY,
  piloto TEXT,
  cuenta TEXT,
  cliente TEXT,
  sitio TEXT,
  fecha TEXT,
  fecha_ts TIMESTAMPTZ,
  formulario TEXT DEFAULT 'GMB-F08',
  aeronave TEXT,
  matricula TEXT,
  altitud_maxima TEXT,
  contacto_visual TEXT,
  advertencia_bateria TEXT,
  bateria_advertencia TEXT,
  hora_despegue TEXT,
  vuelo_num TEXT,
  area_maniobra TEXT,
  meteorologia TEXT,
  obstaculos TEXT,
  observaciones TEXT,
  proceso_uas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: riesgo (GMB-F10 — análisis y evaluación del riesgo)
CREATE TABLE IF NOT EXISTS riesgo (
  id TEXT PRIMARY KEY,
  piloto TEXT,
  cuenta TEXT,
  sitio TEXT,
  fecha TEXT,
  fecha_ts TIMESTAMPTZ,
  formulario TEXT DEFAULT 'GMB-F10',
  nivel_riesgo TEXT,
  observaciones TEXT,
  aeronave TEXT,
  matricula TEXT,
  zona_vuelo TEXT,
  hora_despegue TEXT,
  vuelo_num TEXT,
  proceso_uas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: mantenimiento (GMB-F11 — mantenimiento preventivo UAS)
CREATE TABLE IF NOT EXISTS mantenimiento (
  id TEXT PRIMARY KEY,
  piloto TEXT,
  cuenta TEXT,
  cliente TEXT,
  sitio TEXT,
  fecha TEXT,
  fecha_ts TIMESTAMPTZ,
  aeronave TEXT,
  matricula TEXT,
  observaciones TEXT,
  tipo TEXT DEFAULT 'Preventivo UAS',
  tecnico TEXT,
  horas_vuelo_acum TEXT,
  proximo_mant TEXT,
  formulario TEXT DEFAULT 'GMB-F11',
  nombre_piloto_registro TEXT,
  proceso_uas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: pilots (registro de pilotos)
CREATE TABLE IF NOT EXISTS pilots (
  id TEXT PRIMARY KEY,
  name TEXT,
  initials TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: clientes (registro dinámico de clientes)
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: _ping (health check)
CREATE TABLE IF NOT EXISTS _ping (
  id TEXT PRIMARY KEY,
  ts BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- ÍNDICES para queries frecuentes
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON bitacora(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_cuenta ON bitacora(cuenta);
CREATE INDEX IF NOT EXISTS idx_bitacora_piloto ON bitacora(piloto);

CREATE INDEX IF NOT EXISTS idx_misiones_fecha ON misiones(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_misiones_cuenta ON misiones(cuenta);

CREATE INDEX IF NOT EXISTS idx_planeamiento_fecha ON planeamiento(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_planeamiento_cuenta ON planeamiento(cuenta);
CREATE INDEX IF NOT EXISTS idx_planeamiento_cliente ON planeamiento(cliente);

CREATE INDEX IF NOT EXISTS idx_riesgo_fecha ON riesgo(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_riesgo_cuenta ON riesgo(cuenta);

CREATE INDEX IF NOT EXISTS idx_mantenimiento_fecha ON mantenimiento(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_cuenta ON mantenimiento(cuenta);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_cliente ON mantenimiento(cliente);

CREATE INDEX IF NOT EXISTS idx_pilots_name ON pilots(name);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);

-- ═══════════════════════════════════════════════════════════
-- HABILITAR REALTIME (ejecutar en Dashboard → Database → Publications)
-- O ejecutar estos comandos SQL:
-- ═══════════════════════════════════════════════════════════

-- NOTA: En el Dashboard ve a Database → Replication y activa
-- la publicación "supabase_realtime" para las tablas:
-- bitacora, misiones, planeamiento, riesgo, mantenimiento, pilots
