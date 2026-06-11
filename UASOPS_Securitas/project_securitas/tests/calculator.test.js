/**
 * calculator.test.js — Tests Unitarios del Calculador de Horas
 * =============================================================
 * Ejecutar en navegador: incluir en un HTML de test
 * Ejecutar con Node.js: requiere adaptar las importaciones
 *
 * Para correr:
 *   1. Abrir tests/test-runner.html en el navegador
 *   2. Revisar la consola para ver resultados
 */

// ── Mini framework de testing ─────────────────────────────────
const Test = (() => {
  let passed = 0, failed = 0;

  function assert(description, condition) {
    if (condition) {
      console.log(`  ✅ ${description}`);
      passed++;
    } else {
      console.error(`  ❌ ${description}`);
      failed++;
    }
  }

  function assertEqual(description, actual, expected) {
    const ok = actual === expected;
    if (ok) {
      console.log(`  ✅ ${description} → ${actual}`);
      passed++;
    } else {
      console.error(`  ❌ ${description} → esperado: ${expected}, obtenido: ${actual}`);
      failed++;
    }
  }

  function group(name, fn) {
    console.group(`📋 ${name}`);
    fn();
    console.groupEnd();
  }

  function summary() {
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
    if (failed === 0) console.log('🎉 Todos los tests pasaron');
    else console.error(`⚠ ${failed} test(s) fallaron`);
  }

  return { assert, assertEqual, group, summary };
})();

// ── Tests de Calculator ───────────────────────────────────────
function runCalculatorTests() {

  Test.group('totalMinutes()', () => {
    Test.assertEqual('0 registros = 0 min',       Calculator.totalMinutes(0), 0);
    Test.assertEqual('1 registro  = 35 min',       Calculator.totalMinutes(1), 35);
    Test.assertEqual('3 registros = 105 min',      Calculator.totalMinutes(3), 105);
    Test.assertEqual('7 registros = 245 min',      Calculator.totalMinutes(7), 245);
  });

  Test.group('minutesToHours()', () => {
    Test.assertEqual('0 min   = 0 h',     Calculator.minutesToHours(0),   0);
    Test.assertEqual('35 min  = 1 h',     Calculator.minutesToHours(35),  1);
    Test.assertEqual('105 min = 3 h',     Calculator.minutesToHours(105), 3);
    Test.assertEqual('70 min  = 2 h',     Calculator.minutesToHours(70),  2);
  });

  Test.group('recordsToHours()', () => {
    Test.assertEqual('3 vuelos Henry  = 3 h', Calculator.recordsToHours(3), 3);
    Test.assertEqual('2 vuelos FP     = 2 h', Calculator.recordsToHours(2), 2);
    Test.assertEqual('2 vuelos Montoya= 2 h', Calculator.recordsToHours(2), 2);
  });

  Test.group('percent()', () => {
    Test.assertEqual('50% de 100',   Calculator.percent(50, 100),  50);
    Test.assertEqual('100% de 100',  Calculator.percent(100, 100), 100);
    Test.assertEqual('0% de 100',    Calculator.percent(0, 100),   0);
    Test.assertEqual('max 100%',     Calculator.percent(200, 100), 100);
    Test.assertEqual('0 max = 0%',   Calculator.percent(10, 0),    0);
  });

  Test.group('globalTotals()', () => {
    const mockData = {
      bitacora:      [1,2,3,4,5,6,7].map(i => ({ id: i })),
      misiones:      [1,2,3,4,5,6,7,8,9,10,11,12,13].map(i => ({ id: i })),
      planeamiento:  [1,2,3,4,5,6].map(i => ({ id: i })),
      riesgo:        [1,2,3,4,5,6].map(i => ({ id: i })),
      mantenimiento: [1,2].map(i => ({ id: i })),
    };
    const totals = Calculator.globalTotals(mockData);

    Test.assertEqual('7 vuelos totales',    totals.totalFlights,       7);
    Test.assertEqual('7 h totales',         totals.totalHours,         7);
    Test.assertEqual('13 misiones',         totals.totalMisiones,      13);
    Test.assertEqual('34 registros totales',totals.totalRecords,       34);
  });
}

// ── Ejecutar cuando el documento esté listo ───────────────────
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🧪 Ejecutando tests de Calculator...\n');
    runCalculatorTests();
    Test.summary();
  });
}
