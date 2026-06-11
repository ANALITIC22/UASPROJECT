# ⏱ Documentación: Cálculo de Horas de Vuelo

## Regla de negocio

Cada registro en la **Bitácora de Vuelo Diario** representa una operación de vuelo. La duración estándar de cada operación es de **35 minutos**.

### Fórmula

```
Minutos totales  = Número de registros × 35
Horas de vuelo   = Minutos totales ÷ 35
```

### Ejemplos

| Piloto                   | Registros | Minutos | Horas |
|--------------------------|-----------|---------|-------|
| HENRY R. PRIETO          | 3         | 105     | 3.00  |
| FRANCISCO J. PERDIGON    | 2         | 70      | 2.00  |
| JOSE J. MONTOYA          | 2         | 70      | 2.00  |

### Verificación

```
3 vuelos × 35 min = 105 min → 105 ÷ 35 = 3.00 h  ✓
2 vuelos × 35 min = 70  min → 70  ÷ 35 = 2.00 h  ✓
```

---

## Dónde vive esta lógica en el código

**Archivo:** `src/utils/calculator.js`

```js
// Constante principal (se lee desde config)
const MINUTES_PER_RECORD = APP_CONFIG.flight.MINUTES_PER_RECORD; // 35

// Función central
minutesToHours(minutes) {
  return minutes / MINUTES_PER_RECORD;
}

// Atajo directo desde número de registros
recordsToHours(numRecords) {
  return this.minutesToHours(this.totalMinutes(numRecords));
}
```

---

## Cómo cambiar la duración estándar

1. Abrir `config/app.config.js`
2. Cambiar el valor de `MINUTES_PER_RECORD`:

```js
flight: {
  MINUTES_PER_RECORD: 35,   // ← cambiar a 30, 45, 60, etc.
  HOURS_PRECISION:    2,
}
```

3. **No se requiere ningún otro cambio.** Todo el sistema lee desde la config.

---

## Casos especiales a implementar en el futuro

- **Vuelos con duración variable**: agregar columna `duracion_minutos` al CSV y sumar los valores reales en lugar de usar el fijo de 35.
- **Pausas dentro de una operación**: restar tiempo de pausa de la duración total.
- **Operaciones nocturnas**: multiplicar por un factor de conversión si aplica reglamentación aeronáutica.
