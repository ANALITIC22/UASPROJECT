/**
 * formatter.test.js — Tests del Formateador
 */

function runFormatterTests() {

  Test.group('Formatter.hours()', () => {
    Test.assertEqual('3 h formateado',   Formatter.hours(3),     '3.00 h');
    Test.assertEqual('2 h formateado',   Formatter.hours(2),     '2.00 h');
    Test.assertEqual('0 h formateado',   Formatter.hours(0),     '0.00 h');
    Test.assertEqual('1.5 h formateado', Formatter.hours(1.5),   '1.50 h');
  });

  Test.group('Formatter.shortName()', () => {
    Test.assertEqual('Abrevia nombre largo',
      Formatter.shortName('FRANCISCO JAVIER PERDIGON GARCIA'), 'F. GARCIA');
    Test.assertEqual('Nombre con una palabra',
      Formatter.shortName('MONTOYA'), 'MONTOYA');
    Test.assertEqual('Nombre vacío → —',
      Formatter.shortName(''), '—');
    Test.assertEqual('Nombre nulo → —',
      Formatter.shortName(null), '—');
  });

  Test.group('Formatter.fileSize()', () => {
    Test.assertEqual('Bytes',      Formatter.fileSize(512),        '512 B');
    Test.assertEqual('Kilobytes',  Formatter.fileSize(2048),       '2.0 KB');
    Test.assertEqual('Megabytes',  Formatter.fileSize(1048576),    '1.00 MB');
  });

  Test.group('Formatter.minutesToHM()', () => {
    Test.assertEqual('35 min',  Formatter.minutesToHM(35),  '35m');
    Test.assertEqual('60 min',  Formatter.minutesToHM(60),  '1h 00m');
    Test.assertEqual('75 min',  Formatter.minutesToHM(75),  '1h 15m');
    Test.assertEqual('0 min',   Formatter.minutesToHM(0),   '0m');
  });

  Test.group('Formatter.pilotColor()', () => {
    Test.assert('Índice 0 devuelve string color',  typeof Formatter.pilotColor(0) === 'string');
    Test.assert('Color empieza con #',             Formatter.pilotColor(0).startsWith('#'));
    Test.assert('Índice > paleta no falla',        !!Formatter.pilotColor(999));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('\n🧪 Ejecutando tests de Formatter...\n');
  runFormatterTests();
  Test.summary();
});
