# UASOPS v8 — Sistema de Reporte Operacional de Drones

Plataforma de gestión y análisis operacional para pilotos de sistemas aéreos no tripulados (UAS/Drones).

---

## Estructura del Proyecto

```
UASOPS_v8/
├── index.html                  ← Punto de entrada principal
├── README.md                   ← Este archivo
├── .gitignore                  ← Archivos excluidos de git
├── config/
│   └── app.config.js           ← Configuración global (credenciales Supabase, constantes)
├── assets/
│   └── css/
│       ├── base.css            ← Reset, variables CSS, tipografía
│       ├── components.css      ← Componentes reutilizables
│       ├── layout.css          ← Header, nav, grid, responsive
│       └── animations.css      ← Keyframes, transiciones
├── src/
│   ├── core/
│   │   ├── state.js            ← Estado global (store centralizado)
│   │   ├── router.js           ← Navegación entre secciones
│   │   ├── eventBus.js         ← Sistema de eventos
│   │   └── supabase.js         ← API de Supabase (load, save, delete, realtime)
│   ├── modules/
│   │   ├── dashboard/          ← Dashboard principal con estadísticas
│   │   ├── pilotos/            ← Gestión de pilotos y horas
│   │   ├── bitacora/           ← Bitácora de vuelo
│   │   ├── misiones/           ← Informes de misión cumplida
│   │   ├── planeamiento/       ← Planeamiento de misiones
│   │   ├── riesgo/             ← Análisis de riesgo
│   │   ├── mantenimiento/      ← Mantenimiento preventivo
│   │   ├── uploader/           ← Cargador de archivos Excel/CSV
│   │   └── cliente/            ← Portal corporativo de clientes
│   └── utils/
│       ├── parser.js           ← Parser Excel/CSV universal
│       ├── metrica_ops_parser.js ← Parser formato columnar
│       ├── calculator.js       ← Cálculos de horas de vuelo
│       ├── formatter.js        ← Formateo de fechas, nombres
│       ├── sorter.js           ← Ordenamiento de tablas
│       ├── charts.js           ← Motor de gráficas
│       └── storage.js          ← Persistencia (Supabase)
├── clients/
│   ├── client.js               ← Bootstrap del portal de clientes
│   ├── client.css              ← Estilos del portal
│   ├── penalisa.html           ← Portal Corporación Club Puerto Peñalisa
│   ├── casa-de-campo-restrepo.html ← Portal Casa de Campo Restrepo
│   ├── casa-de-campo-la-calera.html ← Portal Casa de Campo La Calera
│   ├── mesa-de-yeguas.html     ← Portal Mesa de Yeguas
│   ├── mobile-bogota.html      ← Portal Aviación No Tripulada
│   ├── la-gran-reserva.html    ← Portal La Gran Reserva
│   ├── grupo-exito.html        ← Portal Grupo Éxito
│   ├── cc-santafe.html         ← Portal Centro Comercial Santa Fe
│   └── club-la-pradera-de-potosi.html ← Portal Club La Pradera
├── scripts/
│   └── supabase-schema.sql     ← SQL para crear tablas en Supabase
└── docs/
    ├── ARQUITECTURA.md         ← Documentación técnica
    ├── CALCULO_HORAS.md        ← Fórmula de cálculo de horas
    └── COMO_AGREGAR_MODULO.md  ← Guía para escalar
```

---

## Inicio Rápido

1. Clona el repositorio
2. Abre `index.html` en tu navegador
3. Ve a **"Cargar Archivos"** y arrastra tus archivos Excel

## Base de Datos (Supabase)

El sistema usa **Supabase** como base de datos en tiempo real.

- **Proyecto:** `rtxibbdpkmnqmpscbuyn`
- **URL:** `https://rtxibbdpkmnqmpscbuyn.supabase.co`
- **Credenciales:** En `config/app.config.js`

### Tablas
| Tabla | Descripción |
|-------|-------------|
| `bitacora` | Registros de vuelo (GMB-F15) |
| `misiones` | Informes de misión cumplida (GMB-F16) |
| `planeamiento` | Planeamiento de la misión (GMB-F08) |
| `riesgo` | Análisis de riesgo (GMB-F10) |
| `mantenimiento` | Mantenimiento preventivo (GMB-F11) |
| `pilots` | Registro de pilotos |
| `clientes` | Registro dinámico de clientes |

### Crear tablas
Ejecuta el script `scripts/supabase-schema.sql` en el SQL Editor de Supabase.

## Portales de Clientes

Cada cliente tiene su propio portal con datos filtrados:

| Cliente | Archivo |
|---------|---------|
| Corporación Club Puerto Peñalisa | `clients/penalisa.html` |
| Casa de Campo Restrepo Meta | `clients/casa-de-campo-restrepo.html` |
| Conjunto Cerrado Casa de Campo PH | `clients/casa-de-campo-la-calera.html` |
| Corporación Mesa de Yeguas CC | `clients/mesa-de-yeguas.html` |
| Aviación No Tripulada (UAS) | `clients/mobile-bogota.html` |
| C B Hoteles y Resorts S.A. | `clients/la-gran-reserva.html` |
| Centro Comercial Santa Fe | `clients/cc-santafe.html` |
| Club La Pradera de Potosí | `clients/club-la-pradera-de-potosi.html` |

## Configuración

Edita `config/app.config.js` para cambiar:
- Fórmula de cálculo de horas (minutos ÷ 35)
- Tipos de formulario
- Colores del tema
- Credenciales de Supabase

## Funcionalidades

- Dashboard con estadísticas generales
- Carga masiva de archivos Excel/CSV
- 5 módulos: Bitácora, Misiones, Planeamiento, Riesgo, Mantenimiento
- Gráficas interactivas con Chart.js
- Filtros por cliente, piloto, fecha y aeronave
- Portales de clientes con datos filtrados
- Botón "BORRAR TODO" para limpiar la base de datos
- Sincronización en tiempo real con Supabase
