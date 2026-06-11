# ✈ UASOPS — Sistema de Reporte Operacional de Drones

> Plataforma de gestión y análisis operacional para pilotos de sistemas aéreos no tripulados (UAS/Drones).

---

## 📁 Estructura del Proyecto

```
uasops/
├── index.html                  ← Punto de entrada principal
├── README.md                   ← Este archivo
├── config/
│   └── app.config.js           ← Configuración global (constantes, rutas, reglas de negocio)
├── assets/
│   ├── css/
│   │   ├── base.css            ← Reset, variables CSS, tipografía global
│   │   ├── components.css      ← Componentes reutilizables (cards, badges, tablas, botones)
│   │   ├── layout.css          ← Header, nav, grid, responsive
│   │   └── animations.css      ← Keyframes, transiciones, efectos
│   ├── js/
│   │   └── (vacío — lógica en src/)
│   ├── fonts/                  ← Fuentes locales si se descargan
│   └── icons/                  ← Íconos SVG del sistema
├── src/
│   ├── core/
│   │   ├── state.js            ← Estado global de la aplicación (store centralizado)
│   │   ├── router.js           ← Navegación entre secciones/vistas
│   │   └── eventBus.js         ← Sistema de eventos desacoplado
│   ├── modules/
│   │   ├── dashboard/
│   │   │   ├── dashboard.js    ← Lógica del dashboard principal
│   │   │   └── dashboard.css   ← Estilos específicos del dashboard
│   │   ├── pilotos/
│   │   │   ├── pilotos.js      ← Gestión y visualización de pilotos
│   │   │   └── pilotos.css
│   │   ├── bitacora/
│   │   │   ├── bitacora.js     ← Módulo bitácora de vuelo
│   │   │   └── bitacora.css
│   │   ├── misiones/
│   │   │   ├── misiones.js     ← Informes de misión cumplida
│   │   │   └── misiones.css
│   │   ├── planeamiento/
│   │   │   ├── planeamiento.js
│   │   │   └── planeamiento.css
│   │   ├── riesgo/
│   │   │   ├── riesgo.js       ← Análisis y evaluación del riesgo
│   │   │   └── riesgo.css
│   │   ├── mantenimiento/
│   │   │   ├── mantenimiento.js
│   │   │   └── mantenimiento.css
│   │   └── uploader/
│   │       ├── uploader.js     ← Cargador y parser de archivos CSV/Excel
│   │       └── uploader.css
│   └── utils/
│       ├── parser.js           ← Parser CSV/Excel universal
│       ├── calculator.js       ← Cálculos de horas de vuelo y estadísticas
│       ├── formatter.js        ← Formateo de fechas, nombres, números
│       ├── sorter.js           ← Ordenamiento y filtrado de tablas
│       ├── charts.js           ← Motor de gráficas (barras, líneas, pie)
│       └── storage.js          ← Persistencia localStorage/IndexedDB
├── data/
│   ├── sample/
│   │   ├── BITACORA_DE_VUELO_DIARIO.csv
│   │   ├── INFORME_DE_MISIÓN_CUMPLIDA.csv
│   │   ├── PLANEAMIENTO_DE_LA_MISIÓN.csv
│   │   ├── ANÁLISIS_Y_EVALUACIÓN_DEL_RIESGO.csv
│   │   └── MANTENIMIENTO_PREVENTIVO.csv
│   └── schemas/
│       └── data.schema.json    ← Esquema de validación de datos
├── docs/
│   ├── ARQUITECTURA.md         ← Explicación de decisiones técnicas
│   ├── MODULOS.md              ← Documentación de cada módulo
│   ├── COMO_AGREGAR_MODULO.md  ← Guía para escalar el proyecto
│   └── CALCULO_HORAS.md        ← Documentación de la fórmula de horas
└── tests/
    ├── calculator.test.js      ← Tests del calculador de horas
    ├── parser.test.js          ← Tests del parser CSV
    └── formatter.test.js       ← Tests del formateador
```

---

## 🚀 Inicio Rápido

1. Clona o descarga el proyecto
2. Abre `index.html` en tu navegador (no requiere servidor para la versión básica)
3. Para cargar datos: ve a la sección **"Cargar Archivos"** y arrastra tus CSV

## ⚙️ Configuración

Edita `config/app.config.js` para cambiar:
- La fórmula de cálculo de horas (por defecto: minutos ÷ 35)
- Los nombres de los tipos de formulario
- Colores del tema
- Configuración de persistencia

## 📐 Regla de Cálculo de Horas

```
Horas de vuelo = (Número de registros en Bitácora × 35 minutos) ÷ 35
```

Documentado en detalle en `docs/CALCULO_HORAS.md`.

## 🔮 Roadmap de Escalabilidad

- [ ] Backend con Node.js / Express o Firebase
- [ ] Autenticación de usuarios por piloto
- [ ] Exportación a PDF y Excel
- [ ] Dashboard con gráficas avanzadas (Chart.js / D3.js)
- [ ] API REST para integración con otros sistemas
- [ ] App móvil (React Native / PWA)
- [ ] Notificaciones de mantenimiento programado
- [ ] Mapa de operaciones con coordenadas GPS

---

## 🔥 Integración Firebase

Este proyecto usa **Firebase Firestore** como base de datos en tiempo real.

### Configuración activa
- **Proyecto:** `uasproject-95985`
- **Firestore:** `uasproject-95985.firebaseapp.com`
- **SDK:** Firebase JS v9 (compat mode — sin bundler)

### Estructura de Firestore
```
uasops/
  data/
    bitacora/        ← registros de bitácora de vuelo
    misiones/        ← informes de misión
    planeamiento/    ← formularios de planeamiento
    riesgo/          ← análisis de riesgo
    mantenimiento/   ← mantenimiento preventivo
  pilots/            ← lista de pilotos (doc ID = nombre normalizado)
```

### Archivos modificados
- `src/core/firebase.js` ← **NUEVO** — API de Firebase
- `src/utils/storage.js` ← Actualizado para delegar a Firebase
- `src/modules/uploader/uploader.js` ← Guarda en Firestore
- `src/app.js` ← Inicializa Firebase, sin datos de muestra
- `index.html` ← SDKs de Firebase + loader visual

### Notas de producción
- Los datos de muestra han sido **eliminados completamente**
- La app inicia vacía y carga datos reales desde Firestore
- Los listeners en tiempo real sincronizan cambios automáticamente
- La persistencia offline está habilitada (funciona sin conexión)
