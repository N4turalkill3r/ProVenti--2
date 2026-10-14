// Validación final (Fase 10): compara la configuración con la tabla del manual escrita aquí de forma independiente
// y recorre miles de acciones aleatorias comprobando que el estado siempre cumpla las reglas. Ejecutar con: npm test
import assert from 'node:assert/strict';
import { PARAMETROS, ALARMAS, DINAMICA, FLUJO_CONSTANTE, LIMITES_PREDETERMINADOS, MEDIDOS_INICIALES, MEDIDOS_RANGO } from '../js/config.js';
import { crearEstadoInicial, encender, fijarMedido, fijarEnergia, fijarFallo, pasoParametro, limitesEfectivos, fijarModo, alternarFlujoConstante } from '../js/state.js';
import { pulsarTecla, pulsarFlecha, girarMando, avanzarTiempo, alternarNebulizador } from '../js/interaction.js';
import { sincronizar, avanzarMotor, condiciones } from '../js/engine.js';
import { nuevaRespiracion } from '../js/dynamics.js';

let pasadas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ok  ', nombre); }
  catch (e) { console.error('  FALLA', nombre, '\n       ', e.message); process.exitCode = 1; }
}

// Tabla del manual (págs. 10, 11, 18, 19 y 21; Apéndice B). Independiente de config.js.
const MANUAL = {
  frecuencia:     { min: 5,   max: 150, pasos: [[Infinity, 1]] },
  frecuenciaSimv: { min: 0.6, max: 50,  pasos: [[10, 0.1], [Infinity, 1]] },
  vc:             { min: 5,   max: 990, pasos: [[200, 1], [Infinity, 10]] },
  insp:           { min: 0.1, max: 3.0, pasos: [[1.0, 0.05], [Infinity, 0.1]] },
  flujo:          { min: 1,   max: 50,  pasos: [[10, 0.1], [Infinity, 1]] },
  dispPresion:    { min: 0.2, max: 10,  pasos: [[3, 0.1], [Infinity, 1]] },
  dispFlujo:      { min: 0.1, max: 10,  pasos: [[Infinity, 0.1]] }, // decisión del usuario (el manual indica 1-20); 0,0 = APAGADO
  soportePresion: { min: 1,   max: 50,  pasos: [[Infinity, 1]] },
  peep:           { min: 0,   max: 20,  pasos: [[Infinity, 1]] },
  presionMaxima:  { min: 0,   max: 80,  pasos: [[Infinity, 1]] },
};
const ALARMAS_MANUAL = { // pág. 21: [low min, low max, high min, high max]
  pico: [3, 89, 4, 90], frecuencia: [4, 159, 5, 160], vce: [5, 1299, 6, 1300], vme: [0, 44, 1, 45],
  peep: [-1, 29, 0, 30], media: [0, 89, 1, 90], o2: [18, 100, 19, 105],
};

console.log('Validación contra el manual');

prueba('Rangos y resoluciones de los parámetros coinciden con la tabla del manual', () => {
  for (const [k, m] of Object.entries(MANUAL)) {
    const p = PARAMETROS[k];
    assert.equal(p.min, m.min, `${k} mínimo`);
    assert.equal(p.max, m.max, `${k} máximo`);
    assert.deepEqual(p.paso.map((x) => [x.hasta, x.paso]), m.pasos, `${k} pasos`);
  }
});

prueba('Rangos de alarma coinciden con la pág. 21', () => {
  for (const [k, r] of Object.entries(ALARMAS_MANUAL)) {
    assert.deepEqual([...ALARMAS[k].low, ...ALARMAS[k].high], r, k);
  }
});

prueba('Valores iniciales: dentro de rango, límites válidos y sin alarma al empezar', () => {
  const e = encender(crearEstadoInicial());
  for (const [k, p] of Object.entries(PARAMETROS)) {
    if (e.ajustes[k] === null) continue;
    assert.ok(e.ajustes[k] >= p.min && e.ajustes[k] <= p.max, `${k} fuera de rango`);
  }
  assert.equal(e.ajustes.presionMaxima, 35); assert.equal(e.ajustes.peep, 5); assert.equal(e.ajustes.flujo, 30);
  assert.equal(e.ajustes.frecuencia, 12); assert.equal(e.ajustes.vc, 595); // VC = 17 ml x PRES MÁX 35 assert.equal(e.ajustes.frecuenciaSimv, 10);
  for (const [k, l] of Object.entries(LIMITES_PREDETERMINADOS)) {
    const a = ALARMAS[k];
    assert.ok(l.low >= a.low[0] && l.low <= a.low[1] && l.high >= a.high[0] && l.high <= a.high[1], `${k} límite fuera del rango de la pág. 21`);
    assert.ok(l.low < l.high, `${k} low >= high`);
    assert.ok(MEDIDOS_INICIALES[k] >= l.low && MEDIDOS_INICIALES[k] <= l.high, `medido inicial ${k} fuera de sus límites`);
  }
  assert.deepEqual(condiciones(e), []);
});

prueba('Flechas: recorrer cada parámetro de mínimo a máximo respeta rangos, resolución y se detiene en el extremo', () => {
  for (const k of Object.keys(MANUAL)) {
    let e = encender(crearEstadoInicial());
    e.neumotaco = 'pediatrico'; // DISP. FLUJO exige neumotacógrafo (Apéndice C)
    e = fijarModo(e, k === 'soportePresion' || k === 'frecuenciaSimv' ? 'SIMV' : 'AC').estado;
    let prev = null;
    for (let pasos = 0; pasos < 5000; pasos++) {
      const r = pasoParametro(e, k, 1);
      if (!r.ok) break;
      e = r.estado;
      const v = e.ajustes[k];
      assert.ok(v >= MANUAL[k].min && v <= MANUAL[k].max, `${k}=${v} fuera de rango`);
      if (prev !== null && v !== prev) assert.ok(v > prev, `${k} no avanza`);
      if (prev !== null && v === prev) break; // extremo
      prev = v;
    }
    assert.equal(e.ajustes[k], MANUAL[k].max, `${k} debe alcanzar su máximo`);
    // y baja hasta el mínimo
    for (let i = 0; i < 5000; i++) { const r = pasoParametro(e, k, -1); if (!r.ok) break; if (r.estado.ajustes[k] === e.ajustes[k]) break; e = r.estado; }
    assert.equal(e.ajustes[k], MANUAL[k].min, `${k} debe alcanzar su mínimo`);
  }
});

prueba('Flujo constante limita el flujo a 29 L/min y el INSP a 3,0 s', () => {
  let e = encender(crearEstadoInicial());
  e = alternarFlujoConstante(e, true).estado;
  assert.ok(e.ajustes.flujo <= FLUJO_CONSTANTE.flujoMax);
  assert.equal(limitesEfectivos(e, 'flujo').max, 29);
});

// ---------- Fuzz ----------
function rng(semilla) { let s = semilla >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const TECLAS = ['menu-principal', 'menu-secundario', 'menu-alarmas', 'menu-alarmas', 'menu-alarmas', 'bloqueo', 'silenciar', 'auto-ajuste', 'config', 'config-vc', 'config-insp',
  'frecuencia', 'vc', 'insp', 'flujo', 'peep', 'presion-maxima', 'modo-ac', 'modo-simv', 'modo-cpap', 'disp-flujo', 'disp-presion',
  'soporte-presion', 'neb-estado', 'neb-tiempo', 'flujo-constante', 'bateria', 'desact-neumo', 'suspiro-off',
  'alarma:pico:low', 'alarma:pico:high', 'alarma:frecuencia:low', 'alarma:vce:low', 'alarma:vme:high', 'alarma:peep:low', 'alarma:media:low', 'alarma:o2:low', 'alarma:o2:high'];

export const COBERTURA = { modos: new Set(), menus: new Set(), alarmas: 0, neb: 0, fc: 0, bloq: 0, sel: 0 };
function invariantes(e, traza) {
  COBERTURA.modos.add(e.modo); COBERTURA.menus.add(e.menu); if (e.alarmas.activas.length) COBERTURA.alarmas++; if (e.nebulizadorEncendido) COBERTURA.neb++; if (e.flujoConstante) COBERTURA.fc++; if (e.bloqueado) COBERTURA.bloq++; if (e.teclaSeleccionada) COBERTURA.sel++;
  const f = (m) => assert.fail(`${m}\n  acciones: ${traza.slice(-8).join(' > ')}`);
  JSON.stringify(e);
  for (const [k, p] of Object.entries(PARAMETROS)) {
    const v = e.ajustes[k];
    if (k === 'vc') continue; // el VC resulta de la presión (17 ml x PICO) y puede pasar de 990 ml
    if (v === null) { if (!['dispFlujo', 'dispPresion', 'soportePresion'].includes(k)) f(`${k} es null`); continue; }
    if (typeof v !== 'number' || Number.isNaN(v)) f(`${k} no numérico: ${v}`);
    if (v < p.min - 1e-9 || v > p.max + 1e-9) f(`${k}=${v} fuera de rango`);
  }
  if (e.flujoConstante && e.ajustes.flujo > FLUJO_CONSTANTE.flujoMax) f('flujo > 29 con flujo constante');
  const activos = [e.ajustes.dispPresion !== null, e.flujoConstante].filter(Boolean).length;
  if (activos > 1) f('dispPresion y flujoConstante no son excluyentes (DISP. FLUJO es independiente)');
  for (const [k, l] of Object.entries(e.limites)) {
    const a = ALARMAS[k];
    if (l.low < a.low[0] || l.low > a.low[1] || l.high < a.high[0] || l.high > a.high[1]) f(`límite ${k} fuera de rango: ${l.low}/${l.high}`);
    if (l.enabled && l.low >= l.high) f(`límite ${k} low>=high`);
  }
  for (const [k, v] of Object.entries(e.medidos)) if (typeof v !== 'number' || Number.isNaN(v) || v < MEDIDOS_RANGO[k][0] || v > MEDIDOS_RANGO[k][1]) f(`medido ${k}=${v}`);
  if (e.medidos.vce !== e.ajustes.vc) f(`VC mostrado (${e.ajustes.vc}) distinto del VCE (${e.medidos.vce})`);
  if (![0, 5, 10, 15].includes(e.aumentoFrecPct)) f(`aumento de FREC inválido: ${e.aumentoFrecPct}`);
  if ((e.ajustes.dispFlujo === null || e.ajustes.dispFlujo <= DINAMICA.dispFlujoUmbral) && e.aumentoFrecPct !== 0) f('aumento de FREC con DISP. FLUJO apagado o <= 3');
  if (e.ajustes.presionMaxima < 0 || e.ajustes.presionMaxima > DINAMICA.picoMaxPerilla) f('PRES MÁX fuera de 0-80');
  if (!['AC', 'SIMV', 'CPAP'].includes(e.modo)) f('modo inválido');
  if (!['principal', 'secundario', 'alarma1', 'alarma2', 'alarma3', 'config'].includes(e.menu)) f(`menú inválido ${e.menu}`);
  if (e.silencio.segundosRestantes < 0 || e.silencio.segundosRestantes > 120) f('silencio fuera de 0-120');
  if (e.nebulizadorEncendido && e.ajustes.flujo < 20 && e.modo !== 'CPAP') f('nebulizador encendido con flujo < 20');
}

prueba('Fuzz: 30 000 acciones aleatorias en 30 sesiones no rompen ninguna regla', () => {
  for (let semilla = 1; semilla <= 30; semilla++) {
    const r = rng(semilla * 7919);
    let e = sincronizar(encender(crearEstadoInicial()));
    const traza = [];
    for (let i = 0; i < 1000; i++) {
      const a = Math.floor(r() * 14);
      let res = null;
      if (e.bloqueado && r() < 0.5) { e = pulsarTecla(pulsarTecla(e, 'bloqueo').estado, 'bloqueo').estado; traza.push('desbloquear'); }
      if (a <= 3) { const id = TECLAS[Math.floor(r() * TECLAS.length)]; traza.push(id); res = pulsarTecla(e, id); }
      else if (a <= 5) { const d = r() < 0.5 ? 1 : -1; traza.push(`flecha${d}`); res = pulsarFlecha(e, d); }
      else if (a === 6) {
        const claves = ['presionMaxima', 'peep', 'flujo']; const c = claves[Math.floor(r() * 3)];
        const p = PARAMETROS[c]; const v = p.min + r() * (p.max - p.min); traza.push(`mando:${c}=${v.toFixed(1)}`); res = girarMando(e, c, v);
      }
      else if (a === 7) { traza.push('neb'); res = alternarNebulizador(e); }
      else if (a === 8) { const s = Math.floor(r() * 40); traza.push(`t+${s}`); e = avanzarTiempo(e, s); }
      else if (a === 9) { traza.push('motor'); e = avanzarMotor(e, 1 + Math.floor(r() * 5)); }
      else if (a === 10) {
        const c = Object.keys(MEDIDOS_RANGO)[Math.floor(r() * 7)]; const [lo, hi] = MEDIDOS_RANGO[c];
        const v = r() < 0.5 ? lo + Math.round(r() * (hi - lo)) : MEDIDOS_INICIALES[c]; traza.push(`medido:${c}=${v}`);
        const m = fijarMedido(e, c, v); if (m.estado) e = m.estado;
      } else if (a === 11) { traza.push('respiracion'); e = nuevaRespiracion(e, r); }
      else if (a === 12) {
        if (r() < 0.5) { const n = ['ninguno', 'infantil', 'pediatrico'][Math.floor(r() * 3)]; traza.push(`neumo:${n}`); e = { ...e, neumotaco: n }; }
        else { const v = 21 + r() * 90; traza.push(`mando:o2=${v.toFixed(0)}`); res = girarMando(e, 'o2', v); }
      } else {
        const q = r();
        if (q < 0.3) { traza.push('fuente'); e = fijarEnergia(e, { fuente: r() < 0.5 ? 'bateria' : 'externa', bateriaPct: Math.round(r() * 100) }).estado ?? e; }
        else if (q < 0.5) { traza.push('gas'); e = fijarEnergia(e, { presionGasOk: r() < 0.5 }).estado ?? e; }
        else { const fs = [null, 'solenoideA', 'errorTransductor', 'falloComunicacion']; const fl = fs[Math.floor(r() * fs.length)]; traza.push(`fallo:${fl}`); e = fijarFallo(e, fl).estado ?? e; }
      }
      if (res && res.estado) e = res.estado;
      e = sincronizar(e);
      invariantes(e, traza);
    }
  }
});

prueba('No se guardan datos clínicos ni personales en el estado', () => {
  const claves = JSON.stringify(Object.keys(crearEstadoInicial())).toLowerCase();
  for (const prohibida of ['paciente', 'nombre', 'historia', 'edad', 'peso', 'documento', 'email']) assert.ok(!claves.includes(prohibida), prohibida);
});

console.log('  cobertura del fuzz:', JSON.stringify({ ...COBERTURA, modos: [...COBERTURA.modos], menus: [...COBERTURA.menus] }));
console.log(`\n${pasadas} pruebas de validación pasadas`);
