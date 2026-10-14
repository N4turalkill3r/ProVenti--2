// Pruebas de los indicadores de estado. Ejecutar con: npm test
import assert from 'node:assert/strict';
import { crearEstadoInicial, encender } from '../js/state.js';
// Valor medido directo (solo se prueban los indicadores, no la fórmula VC = 17 ml x PICO).
const medir = (e, clave, v) => { const c = structuredClone(e); c.medidos[clave] = v; return c; };
import { sincronizar } from '../js/engine.js';
import { indicadores } from '../js/indicators.js';

let pasadas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ok  ', nombre); }
  catch (e) { console.error('  FALLA', nombre, '\n       ', e.message); process.exitCode = 1; }
}
const por = (l, id) => l.find((x) => x.id === id);

console.log('Indicadores');

prueba('Apagado: equipo apagado, sin alarmas y sin silencio', () => {
  const l = indicadores(crearEstadoInicial());
  assert.equal(por(l, 'equipo').texto, 'Equipo apagado');
  assert.equal(por(l, 'alarmas').texto, 'Sin alarmas');
  assert.equal(por(l, 'silencio'), undefined);
});

prueba('Recién encendido: silencio de 60 s visible', () => {
  const l = indicadores(sincronizar(encender(crearEstadoInicial())));
  assert.equal(por(l, 'silencio').texto, 'Silencio 60 s');
  assert.equal(por(l, 'simulacion').texto, 'Simulación en marcha');
});

prueba('Pausa y alarmas se reflejan', () => {
  let e = sincronizar(encender(crearEstadoInicial()));
  e = sincronizar(medir(e, 'pico', 50));
  const l = indicadores(e, { pausado: true });
  assert.equal(por(l, 'simulacion').nivel, 'aviso');
  assert.equal(por(l, 'alarmas').texto, '1 alarma activa');
  assert.equal(por(l, 'alarmas').nivel, 'alarma');
  e = sincronizar(medir(e, 'frecuencia', 50));
  assert.equal(por(indicadores(e), 'alarmas').texto, '2 alarmas activas');
});

prueba('Bloqueo se indica solo con el equipo encendido', () => {
  const e = sincronizar(encender(crearEstadoInicial()));
  e.bloqueado = true;
  assert.ok(por(indicadores(e), 'bloqueo'));
  assert.equal(por(indicadores({ ...e, encendido: false }), 'bloqueo'), undefined);
});

console.log(`\n${pasadas} pruebas de indicadores pasadas`);
