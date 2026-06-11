# 🏗 Arquitectura de UASOPS

## Filosofía de diseño

UASOPS está construido con **Vanilla JS modular** — sin frameworks externos, sin bundlers requeridos. Esto lo hace:
- Abribles directamente en cualquier navegador (doble clic en `index.html`)
- Fácil de entender y modificar sin conocimientos de React/Vue
- Escalable a React, Vue o Svelte cuando el proyecto lo requiera

---

## Capas del sistema

```
┌─────────────────────────────────────────────────────────┐
│                     index.html                          │  ← HTML puro (estructura)
├─────────────────────────────────────────────────────────┤
│                     src/app.js                          │  ← Arranque y cableado
├──────────────┬──────────────────────────────────────────┤
│              │           MÓDULOS                        │
│   CORE       │  dashboard / pilotos / bitacora /        │
│              │  misiones / planeamiento / riesgo /      │
│  state.js    │  mantenimiento / uploader                │
│  router.js   │                                          │
│  eventBus.js │  Cada módulo: {module}.js + {module}.css │
├──────────────┴──────────────────────────────────────────┤
│                     UTILS                               │
│  calculator · formatter · parser · sorter · charts · storage │
├─────────────────────────────────────────────────────────┤
│                    CONFIG                               │
│                 app.config.js                           │
├─────────────────────────────────────────────────────────┤
│                    ASSETS / CSS                         │
│       base · animations · layout · components           │
└─────────────────────────────────────────────────────────┘
```

---

## Flujo de datos

```
CSV File
   │
   ▼
Parser.readFile()          ← Normaliza a formato interno
   │
   ▼
UploaderModule             ← Acumula registros pendientes
   │  (al hacer clic en "Integrar")
   ▼
State.set('data', ...)     ← Store central actualizado
   │
   ▼
EventBus.emit('upload:integrated')
   │
   ├──► DashboardModule.render()
   ├──► PilotosModule.render()
   ├──► BitacoraModule.render()
   └──► (todos los módulos suscritos)
```

---

## Patrón de comunicación entre módulos

Los módulos **NO se llaman entre sí directamente**. Usan el EventBus:

```js
// Módulo A emite
EventBus.emit('pilot:selected', 'FRANCISCO JAVIER...');

// Módulo B escucha (sin importar quién emitió)
EventBus.on('pilot:selected', (name) => { ... });
```

Esto permite agregar o quitar módulos sin romper otros.

---

## Cómo agregar un nuevo módulo

Ver: `docs/COMO_AGREGAR_MODULO.md`

---

## Cómo cambiar la fórmula de horas de vuelo

Editar en `config/app.config.js`:

```js
flight: {
  MINUTES_PER_RECORD: 35,   // ← cambiar este valor
  HOURS_PRECISION:    2,
}
```

La lógica vive en `src/utils/calculator.js → minutesToHours()`.
El resto del sistema usa Calculator y se actualiza automáticamente.

---

## Stack tecnológico

| Capa       | Tecnología        | Razón                              |
|------------|-------------------|------------------------------------|
| UI         | HTML5 + CSS3      | Sin dependencias, máxima velocidad |
| Lógica     | Vanilla JS ES6+   | Universal, sin build step          |
| Fuentes    | Google Fonts CDN  | Orbitron + Exo 2                   |
| Persistencia| localStorage     | Sin servidor requerido             |
| Archivos   | FileReader API    | Nativo en todos los browsers       |

---

## Roadmap para escalar

### Fase 2 — Backend
- [ ] Node.js + Express API REST
- [ ] Base de datos: PostgreSQL o Firebase Firestore
- [ ] Autenticación JWT por piloto

### Fase 3 — Features avanzados
- [ ] Exportar reportes a PDF (usando jsPDF)
- [ ] Exportar a Excel (usando SheetJS)
- [ ] Gráficas avanzadas con Chart.js o D3.js
- [ ] Mapa de operaciones con Leaflet.js + coordenadas GPS
- [ ] Notificaciones de mantenimiento programado
- [ ] Multi-idioma (i18n)

### Fase 4 — App móvil
- [ ] PWA (Progressive Web App) con Service Worker
- [ ] Modo offline con IndexedDB
- [ ] React Native para iOS/Android
