# ➕ Cómo Agregar un Nuevo Módulo

Esta guía muestra paso a paso cómo agregar un módulo nuevo, por ejemplo **"REPORTES DE INCIDENTE"**.

---

## Paso 1 — Crear la carpeta y archivos del módulo

```
src/modules/incidentes/
├── incidentes.js    ← Lógica del módulo
└── incidentes.css   ← Estilos específicos (si los necesita)
```

---

## Paso 2 — Registrar el tipo de formulario en config

En `config/app.config.js`, agregar a `formTypes`:

```js
incidentes: {
  key:   'incidentes',
  match: 'INCIDENTE',       // fragmento del campo "Type" en el CSV
  label: 'Reporte de Incidente',
  icon:  '🚨',
  color: '#ff3d3d',
},
```

---

## Paso 3 — Inicializar el estado en State

En `src/app.js`, dentro de `SAMPLE_DATA`:

```js
const SAMPLE_DATA = {
  // ... módulos existentes ...
  incidentes: [],   // ← agregar aquí
};
```

---

## Paso 4 — Crear el módulo usando TableModule.create()

En `src/modules/incidentes/incidentes.js`:

```js
const IncidentesModule = TableModule.create({
  dataKey: 'incidentes',
  tbodyId: 'tbl-incidentes',
  rowRenderer(r) {
    return `
      <tr data-pilot="${r.piloto}">
        <td class="id-cell">${r.id}</td>
        <td><strong style="color:#fff">${r.piloto}</strong></td>
        <td>${Formatter.date(r.fecha)}</td>
        <td>${Formatter.badge('🚨 INCIDENTE', 'red')}</td>
        <td><span class="text-muted">${r.puesto || '—'}</span></td>
      </tr>`;
  },
});
```

---

## Paso 5 — Agregar la sección HTML en index.html

```html
<!-- ── INCIDENTES ──────────────────────────── -->
<div id="incidentes" class="section">
  <div class="section-header">
    <div class="section-header__title">🚨 Reportes de Incidente</div>
    <div class="section-header__controls table-controls">
      <input class="input" placeholder="🔍 Buscar..."
             oninput="IncidentesModule.search(this.value)">
      <select class="select" onchange="IncidentesModule.filterByPilot(this.value)" id="filter-incidentes"></select>
    </div>
  </div>
  <div class="table-wrap">
    <table class="table">
      <thead><tr>
        <th onclick="IncidentesModule.sortBy(0)">ID</th>
        <th onclick="IncidentesModule.sortBy(1)">Piloto</th>
        <th onclick="IncidentesModule.sortBy(2)">Fecha</th>
        <th onclick="IncidentesModule.sortBy(3)">Tipo</th>
        <th onclick="IncidentesModule.sortBy(4)">Puesto</th>
      </tr></thead>
      <tbody id="tbl-incidentes"></tbody>
    </table>
  </div>
</div>
```

---

## Paso 6 — Agregar a la navegación en config

```js
// config/app.config.js → navigation
{ id: 'incidentes', label: 'Incidentes', icon: '🚨' },
```

---

## Paso 7 — Registrar el script en index.html

```html
<link rel="stylesheet" href="src/modules/incidentes/incidentes.css">
...
<script src="src/modules/incidentes/incidentes.js"></script>
```

---

## Paso 8 — Inicializar en app.js

```js
// En la función boot()
IncidentesModule.init();
IncidentesModule.render();
```

---

## ✅ Listo

El módulo ahora:
- Aparece en la barra de navegación
- Se renderiza con los datos del estado global
- Se actualiza automáticamente cuando se cargan nuevos archivos
- Soporta búsqueda, filtro por piloto y ordenamiento

**Tiempo estimado: 15-20 minutos por módulo nuevo.**
