/**
 * parser.test.js — Tests del Parser CSV
 */

function runParserTests() {

  Test.group('Parser.getInitials()', () => {
    Test.assertEqual('FP para FRANCISCO PERDIGON',  Parser.getInitials('FRANCISCO JAVIER PERDIGON GARCIA'), 'FP');
    Test.assertEqual('HP para HENRY PRIETO',        Parser.getInitials('HENRY RODRIGO PRIETO GONZALEZ'),    'HP');
    Test.assertEqual('JM para JOSE MONTOYA',        Parser.getInitials('JOSE JUAN ANTONIO MONTOYA'),        'JM');
    Test.assertEqual('Nombre vacío → ""',           Parser.getInitials(''), '');
    Test.assertEqual('Una sola palabra',            Parser.getInitials('JOSE'), 'J');
  });

  Test.group('Parser.parse() — CSV básico', () => {
    const csvText = `Id,Type,Date,Reported By,Account,Post
#001,BITACORA DE VUELO DIARIO,2026-06-01 10:00am,JOSE MONTOYA,CLIENTE A,Zona 1
#002,INFORME MISION CUMPLIDA,2026-06-01 11:00am,HENRY PRIETO,CLIENTE A,Zona 1
#003,TIPO DESCONOCIDO,2026-06-01 12:00pm,JOSE MONTOYA,CLIENTE A,Zona 1`;

    const result = Parser.parse(csvText, 'test.csv');

    Test.assertEqual('3 registros parseados',     result.records.length,        3);
    Test.assertEqual('2 pilotos detectados',      result.pilots.length,         2);
    Test.assertEqual('0 errores',                 result.errors.length,         0);
    Test.assertEqual('1 registro de bitácora',    result.grouped.bitacora.length, 1);
    Test.assertEqual('1 registro de misiones',    result.grouped.misiones.length, 1);
    Test.assertEqual('1 registro desconocido',    result.grouped.unknown.length,  1);
    Test.assertEqual('Source del registro = test.csv', result.records[0]._source, 'test.csv');
  });

  Test.group('Parser.parse() — Columnas faltantes', () => {
    const csvBad = `Name,Value\nJose,123`;
    const result = Parser.parse(csvBad, 'bad.csv');
    Test.assert('Detecta columnas faltantes', result.errors.length > 0);
  });

  Test.group('Parser.parse() — CSV vacío', () => {
    const result = Parser.parse('', 'empty.csv');
    Test.assertEqual('0 registros en CSV vacío', result.records.length, 0);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('\n🧪 Ejecutando tests de Parser...\n');
  runParserTests();
});
