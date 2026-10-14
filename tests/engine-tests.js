// Pruebas del motor: alarmas, menú automático, silencio, AUTO AJUSTE y patrón sonoro. Ejecutar con: npm test
import assert from 'node:assert/strict';
import { crearEstadoInicial, encender, fijarMedido, fijarEnergia, fijarFallo, alternarFlujoConstante, fijarModo, fijarLimiteAlarma } from '../js/state.js';
import { condiciones, sincronizar, patronSonoro, pulsarAutoAjuste, avanzarMotor, menusConAlarmaOculta } from '../js/engine.js';
import { pulsarTecla } from '../js/interaction.js';

let pasadas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ok  ', nombre); }
  catch (e) { console.error('  FALLA', nombre, '\n       ', e.message); process.exitCode = 1; }
}
const nuevo = () => sincronizar(encender(crearEstadoInicial()));
// Fija un valor medido directamente (para probar solo la lógica de alarmas, sin la fórmula VC = 17 ml x PICO).
const medir = (e, clave, v) => { const c = structuredClone(e); c.medidos[clave] = v; return sincronizar(c); };
const quieto = (e) => ({ ...e, silencio: { activo: false, segundosRestantes: 0 } });

console.log('Motor de simulación');

prueba('Con los valores iniciales no hay alarmas ni sonido', () => {
  const e = nuevo();
  assert.deepEqual(condiciones(e), []);
  assert.equal(patronSonoro(e), null);
});

prueba('Presión máxima alta: alarma y sonido genérico, sin cambiar de menú', () => {
  let e = quieto(nuevo());
  e = medir(e, 'pico', 45);
  assert.deepEqual(condiciones(e).map((x) => x.id), ['pico:high']);
  assert.equal(e.menu, 'principal'); // no se mueve al panel de alarmas: solo parpadean la pestaña y el valor
  assert.equal(patronSonoro(e).codigo, 'generico');
});

prueba('Alarma 2 (PEEP baja) tampoco cambia de menú', () => {
  const e = medir(quieto(nuevo()), 'peep', 1);
  assert.equal(e.menu, 'principal');
  assert.equal(condiciones(e)[0].id, 'peep:low');
  assert.ok(patronSonoro(e));
});

prueba('Con alarmas en 1 y 2 el menú sigue donde estaba; al resolverlas se apagan una a una', () => {
  let e = pulsarTecla(quieto(nuevo()), 'menu-secundario').estado;
  e = medir(e, 'peep', 1);
  e = medir(e, 'pico', 45);
  assert.equal(e.menu, 'secundario');
  assert.deepEqual(new Set(condiciones(e).map((x) => x.id)), new Set(['pico:high', 'peep:low']));
  e = medir(e, 'pico', 20);
  assert.deepEqual(condiciones(e).map((x) => x.id), ['peep:low']);
  e = medir(e, 'peep', 5);
  assert.deepEqual(condiciones(e), []);
  assert.equal(patronSonoro(e), null);
  assert.equal(e.menu, 'secundario');
});

prueba('El silencio calla el sonido, pero una alarma nueva lo cancela', () => {
  let e = nuevo();
  e = pulsarTecla(quieto(e), 'silenciar').estado;
  e = medir(e, 'pico', 45);
  // La alarma aparece con el silencio activo: al ser nueva, lo cancela y suena.
  assert.equal(e.silencio.activo, false);
  assert.ok(patronSonoro(e));
  e = pulsarTecla(e, 'silenciar').estado;
  assert.equal(patronSonoro(e), null);
  e = medir(e, 'frecuencia', 30); // otra alarma nueva
  assert.equal(e.silencio.activo, false);
  assert.ok(patronSonoro(e));
});

prueba('Silencio activo con alarma en otro menú: la tecla de menú parpadea', () => {
  let e = quieto(nuevo());
  e = medir(e, 'pico', 45);
  e = pulsarTecla(e, 'menu-principal').estado;
  e = pulsarTecla(e, 'silenciar').estado;
  assert.ok(menusConAlarmaOculta(e).has('alarma1'));
});

prueba('Alarma apagada o límite desactivado no se evalúa (VME apagado)', () => {
  let e = quieto(nuevo());
  e = sincronizar(fijarLimiteAlarma(e, 'vme', 'low', null).estado);
  e = medir(e, 'vme', 1);
  assert.deepEqual(condiciones(e), []);
});

prueba('Presión máxima baja inactiva en CPAP', () => {
  let e = quieto(sincronizar(fijarModo(nuevo(), 'CPAP').estado));
  e = medir(e, 'pico', 2);
  assert.equal(condiciones(e).length, 0);
  const a = medir(quieto(nuevo()), 'pico', 2);
  assert.equal(condiciones(a)[0].id, 'pico:low');
});

prueba('Con flujo constante se desactivan las alarmas de frecuencia, VCE y VME', () => {
  let e = quieto(sincronizar(alternarFlujoConstante(nuevo(), true).estado));
  e = medir(e, 'frecuencia', 50);
  e = medir(e, 'vce', 100);
  e = medir(e, 'vme', 1);
  assert.deepEqual(condiciones(e), []);
});

prueba('Flujo constante con VC >= 500 ml: alarma sonora (flujo 29 x 1,0 s = 483 ml; con 3 s = 1450 ml)', () => {
  let e = quieto(sincronizar(alternarFlujoConstante(nuevo(), true).estado));
  assert.equal(condiciones(e).length, 0);
  e.ajustes.insp = 1.1; // 29 L/min x 1,1 s = 532 ml
  assert.equal(condiciones(sincronizar(e))[0].id, 'vcFlujoConstante');
});

prueba('Batería: pasar a batería suena hasta confirmar con la tecla BATERÍA y SILENCIAR no la calla', () => {
  let e = nuevo();
  e = sincronizar(fijarEnergia(e, { fuente: 'bateria' }).estado);
  assert.equal(condiciones(e)[0].id, 'modoBateria');
  assert.ok(patronSonoro(pulsarTecla(e, 'silenciar').estado));
  e = pulsarTecla(e, 'energia').estado;
  assert.equal(patronSonoro(sincronizar(e)), null);
});

prueba('Batería baja (<= 20 %) y presión de gas baja: Alarma 3 con código [1 largo, 0 cortos]', () => {
  let e = quieto(nuevo());
  e = sincronizar(fijarEnergia(e, { fuente: 'bateria', bateriaPct: 15 }).estado);
  e.energia.bateriaConfirmada = true;
  e = sincronizar(fijarEnergia(quieto(e), { presionGasOk: false }).estado);
  assert.equal(e.menu, 'alarma3');
  assert.deepEqual(patronSonoro(e).codigo, [1, 0]);
  const ids = condiciones(e).map((x) => x.id);
  assert.ok(ids.includes('bateriaBaja') && ids.includes('presionSuministro'));
});

prueba('Fallo del ventilador: usa el código del Apéndice D y tiene prioridad', () => {
  let e = quieto(nuevo());
  e = sincronizar(fijarEnergia(e, { presionGasOk: false }).estado);
  e = sincronizar(fijarFallo(quieto(e), 'solenoideE2').estado);
  assert.deepEqual(patronSonoro(e).codigo, [2, 5]);
  assert.equal(patronSonoro(sincronizar(fijarFallo(e, 'falloComunicacion').estado)).codigo, 'continuo');
  assert.ok(!fijarFallo(e, 'inventado').ok);
});

prueba('Al resolver Alarma 3 el menú vuelve al principal', () => {
  let e = quieto(nuevo());
  e = sincronizar(fijarEnergia(e, { presionGasOk: false }).estado);
  assert.equal(e.menu, 'alarma3');
  e = sincronizar(fijarEnergia(e, { presionGasOk: true }).estado);
  assert.equal(e.menu, 'principal');
});

prueba('Valores medidos: se validan los rangos', () => {
  const e = nuevo();
  assert.ok(!fijarMedido(e, 'o2', 150).ok);
  assert.ok(!fijarMedido(e, 'pico', 'x').ok);
  assert.ok(!fijarMedido(e, 'pico', -3).ok); // la PICO sigue a la perilla PRES MÁX (0 a 80)
  assert.ok(fijarMedido(e, 'pico', 0).ok);
});

prueba('Al encender con una alarma presente el silencio de 60 s se mantiene', () => {
  let base = crearEstadoInicial();
  base = fijarEnergia(base, { presionGasOk: false }).estado;
  const e = sincronizar(encender(base));
  assert.equal(e.silencio.activo, true);
  assert.equal(patronSonoro(e), null);
});

prueba('AUTO AJUSTE en A/C: dos pulsaciones, 5 respiraciones y límites +/-30 %; MEDIA queda APAGADO', () => {
  let e = quieto(nuevo());
  e = medir(e, 'pico', 20);
  e = pulsarTecla(e, 'auto-ajuste').estado;
  assert.equal(e.autoAjuste.fase, 'armado');
  e = pulsarTecla(e, 'auto-ajuste').estado;
  assert.equal(e.autoAjuste.fase, 'calculando');
  assert.equal(e.autoAjuste.respiraciones, 5);
  // Frecuencia medida 12 rpm: una respiración cada 5 s.
  e = avanzarMotor(e, 5);
  assert.equal(e.autoAjuste.respiraciones, 4);
  e = avanzarMotor(e, 20);
  assert.equal(e.autoAjuste.fase, 'inactivo');
  assert.equal(e.limites.pico.low, 14);
  assert.equal(e.limites.pico.high, 26);
  assert.equal(e.limites.frecuencia.low, 8); // 12 x 0,7 = 8,4
  assert.equal(e.limites.frecuencia.high, 16); // 12 x 1,3 = 15,6
  assert.equal(e.limites.o2.low, 18); // 21 - 5 = 16, acotado al mínimo del rango
  assert.equal(e.limites.o2.high, 26);
  assert.equal(e.limites.media.enabled, false);
  assert.equal(e.limites.vce.low, 350); // VCE no se afecta
});

prueba('AUTO AJUSTE: la ventana de 5 s se agota y una alarma desactivada no se toca', () => {
  let e = quieto(nuevo());
  e = pulsarTecla(e, 'auto-ajuste').estado;
  e = avanzarMotor(e, 5);
  assert.equal(e.autoAjuste.fase, 'inactivo');
  e = sincronizar(fijarLimiteAlarma(e, 'o2', 'low', null).estado);
  const lowAntes = e.limites.o2.low;
  e = pulsarTecla(pulsarTecla(e, 'auto-ajuste').estado, 'auto-ajuste').estado;
  e = avanzarMotor(e, 30);
  assert.equal(e.limites.o2.enabled, false);
  assert.equal(e.limites.o2.low, lowAntes);
});

prueba('AUTO AJUSTE en CPAP: PICO y FREC a los extremos del rango, PEEP +/-3', () => {
  let e = quieto(sincronizar(fijarModo(nuevo(), 'CPAP').estado));
  e = pulsarTecla(pulsarTecla(e, 'auto-ajuste').estado, 'auto-ajuste').estado;
  e = avanzarMotor(e, 30);
  assert.equal(e.limites.pico.low, 3);
  assert.equal(e.limites.pico.high, 90);
  assert.equal(e.limites.frecuencia.low, 4);
  assert.equal(e.limites.frecuencia.high, 160);
  assert.equal(e.limites.peep.low, 2);
  assert.equal(e.limites.peep.high, 8);
});

prueba('AUTO AJUSTE se cancela al pulsar una tecla de modo y no existe con CPAP y flujo constante', () => {
  let e = quieto(nuevo());
  e = pulsarTecla(pulsarTecla(e, 'auto-ajuste').estado, 'auto-ajuste').estado;
  e = pulsarTecla(e, 'modo-simv').estado;
  assert.equal(e.autoAjuste.fase, 'inactivo');
  let c = quieto(nuevo());
  c.modo = 'CPAP'; c.flujoConstante = true;
  const r = pulsarAutoAjuste(c);
  assert.equal(r.estado.autoAjuste.fase, 'inactivo');
  assert.ok(r.aviso);
});

console.log(`\n${pasadas} pruebas del motor pasadas`);
