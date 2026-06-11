# UASOPS v8 — Sistema de Reporte Operacional de Drones

Plataforma de gestion y analisis operacional para pilotos de sistemas aereos no tripulados (UAS/Drones).

---

## Estructura del Proyecto

```
UASOPS_v8/
├── index.html                  ← Punto de entrada principal
├── README.md                   ← Este archivo
├── .gitignore                  ← Archivos excluidos de git
├── config/
│   └── app.config.js           ← Configuracion global (credenciales Supabase, constantes)
├── assets/
│   ├── css/
│   │   ├── base.css            ← Reset, variables CSS, tipografia
│   │   ├── components.css      ← Componentes reutilizables
│   │   ├── layout.css          ← Header, nav, grid, responsive
│   │   └── animations.css      ← Keyframes, transiciones
│   └── Logo/
│       └── Securitas.png       ← Logo de Securitas
├── src/
│   ├── core/
│   │   ├── state.js            ← Estado global (store centralizado)
│   │   ├── router.js           ← Navegacion entre secciones
│   │   ├── eventBus.js         ← Sistema de eventos
│   │   └── supabase.js         ← API de Supabase (load, save, delete, realtime)
│   ├── modules/
│   │   ├── dashboard/          ← Dashboard principal con estadisticas
│   │   ├── pilotos/            ← Gestion de pilotos y horas
│   │   ├── bitacora/           ← Bitacora de vuelo
│   │   ├── misiones/           ← Informes de mision cumplida
│   │   ├── planeamiento/       ← Planeamiento de misiones
│   │   ├── riesgo/             ← Analisis de riesgo
│   │   ├── mantenimiento/      ← Mantenimiento preventivo
│   │   ├── uploader/           ← Cargador de archivos Excel/CSV
│   │   └── cliente/            ← Portal corporativo de clientes
│   └── utils/
│       ├── parser.js           ← Parser Excel/CSV universal
│       ├── metrica_ops_parser.js ← Parser formato columnar
│       ├── calculator.js       ← Calculos de horas de vuelo
│       ├── formatter.js        ← Formateo de fechas, nombres
│       ├── sorter.js           ← Ordenamiento de tablas
│       ├── charts.js           ← Motor de graficas
│       └── storage.js          ← Persistencia (Supabase)
├── clients/
│   ├── client.js               ← Bootstrap del portal de clientes
│   ├── client.css              ← Estilos del portal
│   ├── penalisa.html           ← Portal Corporacion Club Puerto Penalisa
│   ├── casa-de-campo-restrepo.html ← Portal Casa de Campo Restrepo
│   ├── casa-de-campo-la-calera.html ← Portal Casa de Campo La Calera
│   ├── mesa-de-yeguas.html     ← Portal Mesa de Yeguas
│   ├── mobile-bogota.html      ← Portal Aviacion No Tripulada
│   ├── la-gran-reserva.html    ← Portal La Gran Reserva
│   ├── grupo-exito.html        ← Portal Grupo Exito
│   ├── cc-santafe.html         ← Portal Centro Comercial Santa Fe
│   └── club-la-pradera-de-potosi.html ← Portal Club La Pradera
├── scripts/
│   └── supabase-schema.sql     ← SQL para crear tablas en Supabase
└── docs/
    ├── ARQUITECTURA.md         ← Documentacion tecnica
    ├── CALCULO_HORAS.md        ← Formula de calculo de horas
    └── COMO_AGREGAR_MODULO.md  ← Guia para escalar
```

---

## Inicio Rapido

1. Clona el repositorio
2. Abre `index.html` en tu navegador
3. Ve a **"Cargar Archivos"** y arrastra tus archivos Excel

## Base de Datos (Supabase)

El sistema usa **Supabase** como base de datos en tiempo real.

- **Proyecto:** `rtxibbdpkmnqmpscbuyn`
- **URL:** `https://rtxibbdpkmnqmpscbuyn.supabase.co`
- **Credenciales:** En `config/app.config.js`

### Tablas
| Tabla | Descripcion |
|-------|-------------|
| `bitacora` | Registros de vuelo (GMB-F15) |
| `misiones` | Informes de mision cumplida (GMB-F16) |
| `planeamiento` | Planeamiento de la mision (GMB-F08) |
| `riesgo` | Analisis de riesgo (GMB-F10) |
| `mantenimiento` | Mantenimiento preventivo (GMB-F11) |
| `pilots` | Registro de pilotos |
| `clientes` | Registro dinamico de clientes |

### Crear tablas
Ejecuta el script `scripts/supabase-schema.sql` en el SQL Editor de Supabase.

## Portales de Clientes

Cada cliente tiene su propio portal con datos filtrados:

| Cliente | Archivo |
|---------|---------|
| Corporacion Club Puerto Penalisa | `clients/penalisa.html` |
| Casa de Campo Restrepo Meta | `clients/casa-de-campo-restrepo.html` |
| Conjunto Cerrado Casa de Campo PH | `clients/casa-de-campo-la-calera.html` |
| Corporacion Mesa de Yeguas CC | `clients/mesa-de-yeguas.html` |
| Aviacion No Tripulada (UAS) | `clients/mobile-bogota.html` |
| C B Hoteles y Resorts S.A. | `clients/la-gran-reserva.html` |
| Centro Comercial Santa Fe | `clients/cc-santafe.html` |
| Club La Pradera de Potosi | `clients/club-la-pradera-de-potosi.html` |

## Configuracion

Edita `config/app.config.js` para cambiar:
- Formula de calculo de horas (minutos / 35)
- Tipos de formulario
- Colores del tema
- Credenciales de Supabase

## Funcionalidades

- Dashboard con estadisticas generales
- Carga masiva de archivos Excel/CSV
- 5 modulos: Bitacora, Misiones, Planeamiento, Riesgo, Mantenimiento
- Graficas interactivas con Chart.js
- Filtros por cliente, piloto, fecha y aeronave
- Portales de clientes con datos filtrados
- Seccion de Portales de Clientes con acceso directo
- Boton "BORRAR TODO" para limpiar la base de datos
- Sincronizacion en tiempo real con Supabase
- Logo de Securitas integrado en el sidebar y loader
- Diseno profesional sin emojis
