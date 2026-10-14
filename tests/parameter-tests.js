// Pruebas del modelo de datos. Ejecutar con: npm test
import assert from 'node:assert/strict';
import { PARAMETROS, ALARMAS, LIMITES_PREDETERMINADOS, TECLAS_SIN_FUNCION, TEXTOS } from '../js/config.js';
import { calcularTiempos, pasoPara } from '../js/utils.js';
import {
  crearEstadoInicial, fijarParametro, pasoParametro, fijarModo,
  alternarFlujoConstante, fijarLimiteAlarma, calcularDeshabilitados, evaluarAlarmas,
} from '../js/state.js';

let pasadas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ok  ', nombre); }
  catch (e) { console.error('  FALLA', nombre, '\n       ', e.message); process.exitCode = 1; }
}

console.log('Modelo de datos');

prueba('Fig. 5: frecuencia 20, VC 500, flujo 30 -> I=1,00, E=2,00, I/E=1:2,0', () => {
  const t = calcularTiempos({ frecuencia: 20, vc: 500, flujo: 30, insp: 1, preferencia: 'VC' });
  assert.equal(t.i, 1);
  assert.equal(t.e, 2);
  assert.equal(t.ie, '1:2.0');
});

prueba('Preferencia INSP: cambiar el flujo cambia VC y mantiene I/E', () => {
  const t = calcularTiempos({ frecuencia: 20, vc: 0, flujo: 15, insp: 1, preferencia: 'INSP' });
  assert.equal(t.vc, 250);
  assert.equal(t.ie, '1:2.0');
});

prueba('Alarma I/E fuera de rango (> 3:1)', () => {
  const t = calcularTiempos({ frecuencia: 40, vc: 900, flujo: 30, insp: 1, preferencia: 'VC' });
  assert.equal(t.avisos.relacionIE, true);
});

prueba('Valores predeterminados (modo, frecuencia, VC resultado de la presión, disparo, SIMV, soporte)', () => {
  const e = crearEstadoInicial();
  assert.equal(e.modo, 'AC');
  assert.equal(e.ajustes.frecuencia, 12);
  assert.equal(e.ajustes.vc, 595); // el VC resulta de la presión: 17 ml x PRES MÁX 35
  assert.equal(e.ajustes.dispPresion, 1);
  assert.equal(e.ajustes.frecuenciaSimv, 10);
  assert.equal(e.ajustes.soportePresion, null);
});

prueba('Ajustes iniciales elegidos por el usuario: presión máxima 35, flujo 30, PEEP 5', () => {
  const e = crearEstadoInicial();
  assert.equal(e.ajustes.presionMaxima, 35);
  assert.equal(e.ajustes.flujo, 30);
  assert.equal(e.ajustes.peep, 5);
  // Con VC 500, flujo 30 y frecuencia 12: I = 1,00 s, E = 4,00 s, I/E = 1:4,0
  const t = calcularTiempos({ frecuencia: 12, vc: 500, flujo: 30, insp: 1, preferencia: 'VC' });
  assert.equal(t.i, 1);
  assert.equal(t.e, 4);
  assert.equal(t.ie, '1:4.0');
  assert.equal(t.avisos.inspiracion, false);
  assert.equal(t.avisos.relacionIE, false);
});

prueba('Al iniciar no suena ninguna alarma (límites fisiológicos y medidos coherentes)', () => {
  assert.deepEqual(evaluarAlarmas(crearEstadoInicial()), []);
});

prueba('SUSPIRO OFF: sin función y con nota desplegable (solo al tocar la tecla)', () => {
  const s = TECLAS_SIN_FUNCION.suspiroOff;
  assert.equal(s.visible, true);
  assert.equal(s.funcional, false);
  assert.equal(s.notaDesplegable, true);
  assert.ok(TEXTOS[s.nota].startsWith('Es una maniobra programada'));
  assert.ok(TEXTOS[s.notaSimulador].includes('ninguna función'));
});

prueba('Límites de alarma predeterminados: todos dentro de los rangos de la pág. 21 y low < high', () => {
  for (const [k, v] of Object.entries(LIMITES_PREDETERMINADOS)) {
    const a = ALARMAS[k];
    assert.ok(v.low >= a.low[0] && v.low <= a.low[1], `${k} low fuera de rango`);
    assert.ok(v.high >= a.high[0] && v.high <= a.high[1], `${k} high fuera de rango`);
    assert.ok(v.low < v.high, `${k} low >= high`);
  }
});

prueba('Rango de frecuencia de respaldo CPAP: 5 a 30', () => {
  assert.equal(PARAMETROS.frecuenciaRespaldo.min, 5);
  assert.equal(PARAMETROS.frecuenciaRespaldo.max, 30);
  const e = crearEstadoInicial();
  assert.equal(fijarParametro(e, 'frecuenciaRespaldo', 31).ok, false);
  assert.equal(fijarParametro(e, 'frecuenciaRespaldo', 30).ok, true);
});

prueba('Rechaza valores fuera de rango y no numéricos', () => {
  const e = crearEstadoInicial();
  assert.equal(fijarParametro(e, 'vc', 1000).ok, false);
  assert.equal(fijarParametro(e, 'frecuencia', 4).ok, false);
  assert.equal(fijarParametro(e, 'vc', 'abc').ok, false);
});

prueba('Pasos de VC: 1 ml bajo 200 y 10 ml sobre 200', () => {
  assert.equal(pasoPara('vc', 150, 1), 1);
  assert.equal(pasoPara('vc', 250, 1), 10);
  const e = crearEstadoInicial();
  e.ajustes.vc = 500;
  assert.equal(pasoParametro(e, 'vc', 1).estado.ajustes.vc, 510);
});

prueba('Las flechas se detienen en el límite e informan', () => {
  let e = fijarParametro(crearEstadoInicial(), 'frecuencia', 150).estado;
  const r = pasoParametro(e, 'frecuencia', 1);
  assert.equal(r.estado.ajustes.frecuencia, 150);
  assert.equal(r.limiteAlcanzado, true);
});

prueba('Soporte de presión bloqueado en A/C y disponible en SIMV', () => {
  const e = crearEstadoInicial();
  assert.equal(fijarParametro(e, 'soportePresion', 10).ok, false);
  const s = fijarModo(e, 'SIMV').estado;
  assert.equal(fijarParametro(s, 'soportePresion', 10).ok, true);
});

prueba('Flujo constante apaga disparos y soporte; SIMV pasa a A/C', () => {
  let e = fijarModo(crearEstadoInicial(), 'SIMV').estado;
  e = fijarParametro(e, 'soportePresion', 10).estado;
  e = alternarFlujoConstante(e, true).estado;
  assert.equal(e.flujoConstante, true);
  assert.equal(e.ajustes.dispPresion, null);
  assert.equal(e.ajustes.soportePresion, null);
  assert.equal(e.modo, 'AC');
  assert.equal(fijarModo(e, 'SIMV').ok, false);
});

prueba('Activar disparo por presión apaga el flujo constante', () => {
  let e = alternarFlujoConstante(crearEstadoInicial(), true).estado;
  e = fijarParametro(e, 'dispPresion', 2).estado;
  assert.equal(e.flujoConstante, false);
});

prueba('Disparo por flujo requiere neumotacógrafo y no cambia otras funciones', () => {
  let e = crearEstadoInicial();
  assert.equal(fijarParametro(e, 'dispFlujo', 5).ok, false); // sin neumotacógrafo
  e.neumotaco = 'pediatrico';
  const r = fijarParametro(e, 'dispFlujo', 5);
  assert.equal(r.ok, true);
  assert.equal(r.estado.ajustes.dispPresion, e.ajustes.dispPresion); // DISP. FLUJO es independiente
});

prueba('Neumotacógrafo conectado bloquea el flujo constante', () => {
  const e = crearEstadoInicial();
  e.neumotaco = 'pediatrico';
  assert.equal(alternarFlujoConstante(e, true).ok, false);
});

prueba('Nebulizador bloqueado con flujo menor de 20 L/min', () => {
  const e = fijarParametro(crearEstadoInicial(), 'flujo', 10).estado;
  assert.ok(calcularDeshabilitados(e).has('nebulizador'));
});

prueba('Límites de alarma: bajo < alto y apagado de alarmas opcionales', () => {
  const e = crearEstadoInicial();
  assert.equal(fijarLimiteAlarma(e, 'pico', 'low', 70).ok, false);      // >= alto (64)
  assert.equal(fijarLimiteAlarma(e, 'pico', 'low', 30).ok, true);
  assert.equal(fijarLimiteAlarma(e, 'pico', 'low', null).ok, false);    // no apagable
  const s = fijarLimiteAlarma(e, 'o2', 'low', null);
  assert.equal(s.ok, true);
  assert.equal(s.estado.limites.o2.enabled, false);
  assert.equal(fijarLimiteAlarma(s.estado, 'o2', 'low', 50).estado.limites.o2.enabled, true);
});

prueba('Evaluación de alarmas con valores medidos del instructor', () => {
  let e = fijarLimiteAlarma(crearEstadoInicial(), 'pico', 'low', 10).estado;
  e = fijarLimiteAlarma(e, 'pico', 'high', 40).estado;
  e.medidos.pico = 55;
  assert.ok(evaluarAlarmas(e).includes('pico'));
  e.medidos.pico = 25;
  assert.ok(!evaluarAlarmas(e).includes('pico'));
});

console.log(`\n${pasadas} pruebas pasadas`);
