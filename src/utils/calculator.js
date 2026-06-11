/**
 * calculator.js — Cálculos Operacionales UASOPS
 * ===============================================
 * REGLA DE HORAS: Se usan los MINUTOS REALES del campo "TIEMPO TOTAL DE VUELO"
 * de cada registro de bitácora, divididos entre 35 para obtener horas.
 *
 *   horas = sum(minutos_reales) / 35
 *
 * IMPORTANTE: solo los registros de BITÁCORA tienen minutos de vuelo.
 * Los demás formularios (misiones, plan, riesgo, mtto) son documentación
 * de apoyo — NO se multiplican por 35 ni se cuentan como tiempo adicional.
 */

const Calculator = (() => {

  // ── Constante de cálculo ────────────────────────────────────
  const DIVISOR = APP_CONFIG.flight.MINUTES_PER_RECORD; // 35

  /**
   * Minutos totales de vuelo de un piloto (solo bitácora).
   * Usa el campo 'minutos' (valor real del campo TIEMPO TOTAL DE VUELO).
   */
  function pilotTotalMinutes(pilotName, data) {
    const bitacora = data.bitacora || [];
    return bitacora
      .filter(r => r.piloto === pilotName)
      .reduce((sum, r) => {
        const m = parseInt(r.minutos) || 0;
        return sum + m;
      }, 0);
  }

  /**
   * Horas de vuelo de un piloto = totalMinutos / 35
   */
  function pilotFlightHours(pilotName, data) {
    return pilotTotalMinutes(pilotName, data) / DIVISOR;
  }

  /**
   * Cantidad de vuelos (registros bitácora) de un piloto.
   */
  function pilotFlightCount(pilotName, data) {
    return (data.bitacora || []).filter(r => r.piloto === pilotName).length;
  }

  /**
   * Estadísticas completas de un piloto cruzando todos los módulos.
   */
  function pilotStats(pilot, data) {
    const name         = pilot.name;
    const totalMinutes = pilotTotalMinutes(name, data);
    const flightHours  = totalMinutes / DIVISOR;
    const numFlights   = pilotFlightCount(name, data);

    return {
      name,
      initials:       pilot.initials,
      totalMinutes,
      flightHours,
      flightHoursStr: flightHours.toFixed(APP_CONFIG.flight.HOURS_PRECISION),
      numFlights,
      numMisiones:      (data.misiones      || []).filter(r => r.piloto === name).length,
      numPlaneamiento:  (data.planeamiento  || []).filter(r => r.piloto === name).length,
      numRiesgo:        (data.riesgo        || []).filter(r => r.piloto === name).length,
      numMantenimiento: (data.mantenimiento || []).filter(r => r.piloto === name).length,
      totalRecords:
        numFlights +
        (data.misiones     || []).filter(r => r.piloto === name).length +
        (data.planeamiento || []).filter(r => r.piloto === name).length +
        (data.riesgo       || []).filter(r => r.piloto === name).length +
        (data.mantenimiento|| []).filter(r => r.piloto === name).length,

      // Métricas extras para la UI
      misionCumplida:   (data.misiones || []).filter(r => r.piloto === name && r.mision_cumplida === 'SI').length,
      misionNoCumplida: (data.misiones || []).filter(r => r.piloto === name && r.mision_cumplida === 'NO').length,
    };
  }

  /**
   * Estadísticas de todos los pilotos.
   */
  function allPilotsStats(pilots, data) {
    return pilots.map(p => pilotStats(p, data));
  }

  /**
   * Totales globales del sistema.
   */
  function globalTotals(data) {
    const allBit  = data.bitacora      || [];
    const allMis  = data.misiones      || [];
    const allPla  = data.planeamiento  || [];
    const allRie  = data.riesgo        || [];
    const allMant = data.mantenimiento || [];

    const totalMinutes = allBit.reduce((s, r) => s + (parseInt(r.minutos) || 0), 0);
    const totalHours   = totalMinutes / DIVISOR;

    return {
      totalFlights:       allBit.length,
      totalMisiones:      allMis.length,
      misionesCumplidas:  allMis.filter(r => r.mision_cumplida === 'SI').length,
      misionesNoCumplidas:allMis.filter(r => r.mision_cumplida === 'NO').length,
      totalPlaneamiento:  allPla.length,
      totalRiesgo:        allRie.length,
      totalMantenimiento: allMant.length,
      totalMinutes,
      totalHours,
      totalHoursStr:      totalHours.toFixed(APP_CONFIG.flight.HOURS_PRECISION),
      totalRecords:       allBit.length + allMis.length + allPla.length + allRie.length + allMant.length,
    };
  }

  /**
   * Convierte un conteo de registros a horas (legacy/CSV).
   * Solo se usa cuando NO hay campo 'minutos' en los registros.
   */
  function recordsToHours(count) {
    return (count * DIVISOR) / DIVISOR; // = count horas cuando cada registro = 35 min
  }

  /**
   * Porcentaje relativo.
   */
  function percent(value, max) {
    if (!max) return 0;
    return Math.min(100, Math.round((value / max) * 100));
  }

  /**
   * Distribución de registros por cuenta/sitio.
   */
  function byAccount(data) {
    const counts = {};
    Object.values(data).flat().forEach(r => {
      const key = r.cuenta || r.sitio || 'Sin cuenta';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  return {
    pilotTotalMinutes,
    pilotFlightHours,
    pilotFlightCount,
    pilotStats,
    allPilotsStats,
    globalTotals,
    recordsToHours,
    percent,
    byAccount,
  };

})();
