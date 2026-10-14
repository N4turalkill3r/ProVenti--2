// Pruebas de la lógica de operación (teclas, flechas, perillas, temporizadores). Ejecutar con: npm test
import assert from 'node:assert/strict';
import { crearEstadoInicial, encender, apagar } from '../js/state.js';
import { pulsarTecla, pulsarFlecha, girarMando, avanzarTiempo, alternarNebulizador, apagarRetroiluminacion } from '../js/interaction.js';

let pasadas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ok  ', nombre); }
  catch (e) { console.error('  FALLA', nombre, '\n       ', e.message); process.exitCode = 1; }
}
const nuevo = () => encender(crearEstadoInicial());
const pulsa = (e, ...ids) => ids.reduce((s, id) => pulsarTecla(s, id).estado, e);
const flecha = (e, d, n = 1) => { let s = e; for (let i = 0; i < n; i++) s = pulsarFlecha(s, d).estado; return s; };

console.log('Operación del equipo');

prueba('Encendido: silencio automático de 60 s, CONFIG disponible; apagar conserva ajustes', () => {
  const e = nuevo();
  assert.equal(e.silencio.activo, true);
  assert.equal(e.silencio.segundosRestantes, 60);
  assert.equal(e.config.disponible, true);
  const e2 = apagar(flecha(pulsa(e, 'frecuencia'), 1, 3));
  assert.equal(e2.encendido, false);
  assert.equal(encender(e2).ajustes.frecuencia, 15);
});

prueba('Con el equipo apagado las teclas no hacen nada', () => {
  const r = pulsarTecla(crearEstadoInicial(), 'frecuencia');
  assert.equal(r.estado.teclaSeleccionada, null);
  assert.ok(r.aviso);
});

prueba('Seleccionar, ajustar con flechas y deseleccionar al pulsar de nuevo', () => {
  let e = pulsa(nuevo(), 'frecuencia');
  assert.equal(e.teclaSeleccionada, 'frecuencia');
  e = flecha(e, 1, 3);
  assert.equal(e.ajustes.frecuencia, 15);
  e = flecha(e, -1);
  assert.equal(e.ajustes.frecuencia, 14);
  e = pulsa(e, 'frecuencia');
  assert.equal(e.teclaSeleccionada, null);
});

prueba('Flecha sin selección no cambia nada y avisa', () => {
  const r = pulsarFlecha(nuevo(), 1);
  assert.equal(r.estado.ajustes.frecuencia, 12);
  assert.ok(r.aviso);
});

prueba('El valor se detiene en el límite con tono de límite', () => {
  let e = pulsa(nuevo(), 'frecuencia');
  e = flecha(e, -1, 7); // 12 -> 5
  assert.equal(e.ajustes.frecuencia, 5);
  const r = pulsarFlecha(e, -1);
  assert.equal(r.estado.ajustes.frecuencia, 5);
  assert.equal(r.tono, 'limite');
});

prueba('La frecuencia ajustada depende del modo (SIMV usa 0,1 por paso; CPAP tope 30)', () => {
  let e = pulsa(nuevo(), 'modo-simv', 'frecuencia');
  assert.equal(flecha(e, 1).ajustes.frecuenciaSimv, 11); // por encima de 10 el paso es 1
  assert.equal(flecha(e, -1).ajustes.frecuenciaSimv, 9.9); // por debajo, 0,1
  e = pulsa(nuevo(), 'modo-cpap', 'frecuencia');
  e = flecha(e, 1, 40);
  assert.equal(e.ajustes.frecuenciaRespaldo, 30);
});

prueba('Pasar a A/C apaga el soporte de presión; flujo constante muestra CMV y limita el flujo a 29', () => {
  let e = pulsa(nuevo(), 'modo-simv', 'menu-secundario', 'soporte-presion');
  e = flecha(e, 1);
  assert.equal(e.ajustes.soportePresion, 1);
  e = pulsa(e, 'modo-ac');
  assert.equal(e.ajustes.soportePresion, null);
  e = pulsa(nuevo(), 'menu-principal', 'flujo-constante');
  assert.equal(e.flujoConstante, true);
  assert.equal(e.ajustes.flujo, 29);
  assert.equal(girarMando(e, 'flujo', 40).estado.ajustes.flujo, 29);
});

prueba('Soporte de presión bloqueado en A/C: la tecla avisa y no se selecciona', () => {
  const r = pulsarTecla(pulsa(nuevo(), 'menu-secundario'), 'soporte-presion');
  assert.equal(r.estado.teclaSeleccionada, null);
  assert.ok(r.aviso);
});

prueba('Parámetros apagables: bajar del mínimo da APAGADO y subir vuelve a encender', () => {
  let e = pulsa(nuevo(), 'modo-simv', 'menu-secundario', 'soporte-presion');
  e = flecha(e, 1, 3);
  assert.equal(e.ajustes.soportePresion, 3);
  e = flecha(e, -1, 3);
  assert.equal(e.ajustes.soportePresion, null);
  e = flecha(e, 1);
  assert.equal(e.ajustes.soportePresion, 1);
});

prueba('El flujo no se selecciona con la tecla: solo con la perilla', () => {
  const r = pulsarTecla(nuevo(), 'flujo');
  assert.equal(r.estado.teclaSeleccionada, null);
  assert.ok(r.aviso.includes('perilla'));
});

prueba('Perillas: valores acotados y redondeados; flujo con 0,1 por debajo de 10', () => {
  const e = nuevo();
  assert.equal(girarMando(e, 'presionMaxima', 120).estado.ajustes.presionMaxima, 80);
  assert.equal(girarMando(e, 'peep', 7.4).estado.ajustes.peep, 7);
  assert.equal(girarMando(e, 'flujo', 8.26).estado.ajustes.flujo, 8.3);
  assert.equal(girarMando(e, 'flujo', 0).estado.ajustes.flujo, 1);
  assert.equal(girarMando(e, 'frecuencia', 20).tono, 'error'); // no es una perilla
});

prueba('Un flujo menor de 20 apaga el nebulizador (pág. 19)', () => {
  let e = pulsa(nuevo(), 'menu-secundario', 'neb-estado');
  e = flecha(e, 1);
  assert.equal(e.nebulizadorEncendido, true);
  e = girarMando(e, 'flujo', 15).estado;
  assert.equal(e.nebulizadorEncendido, false);
});

prueba('Alarmas: seleccionar el límite, ajustarlo y respetar bajo < alto', () => {
  let e = pulsa(nuevo(), 'menu-alarmas');
  assert.equal(e.menu, 'alarma1');
  e = pulsa(e, 'alarma:pico:high');
  e = flecha(e, 1, 5);
  assert.equal(e.limites.pico.high, 45);
  e = pulsa(e, 'alarma:pico:high', 'alarma:pico:low');
  e = flecha(e, 1, 40); // intenta pasar el alto (45)
  assert.ok(e.limites.pico.low < e.limites.pico.high);
});

prueba('Alarma apagable: bajar el límite bajo hasta el mínimo lo deja en APAGADO', () => {
  let e = pulsa(nuevo(), 'menu-alarmas', 'alarma:vme:low');
  e = flecha(e, -1, 5); // 4 -> 0 y un paso más
  assert.equal(e.limites.vme.enabled, false);
  e = flecha(e, 1);
  assert.equal(e.limites.vme.enabled, true);
});

prueba('Alarma no apagable (PICO): se queda en su mínimo con tono de límite', () => {
  let e = pulsa(nuevo(), 'menu-alarmas', 'alarma:pico:low');
  e = flecha(e, -1, 20); // 10 -> 3
  assert.equal(e.limites.pico.enabled, true);
  assert.equal(pulsarFlecha(e, -1).tono, 'limite');
});

prueba('ALARMA1/ALARMA2 alterna los dos menús', () => {
  let e = pulsa(nuevo(), 'menu-alarmas');
  assert.equal(e.menu, 'alarma1');
  e = pulsa(e, 'menu-alarmas');
  assert.equal(e.menu, 'alarma2');
  e = pulsa(e, 'menu-principal');
  assert.equal(e.menu, 'principal');
});

prueba('Cualquier tecla (menos SILENCIAR) sustituye CONFIG por las flechas', () => {
  let e = pulsa(nuevo(), 'silenciar');
  assert.equal(e.config.disponible, true);
  e = pulsa(e, 'menu-secundario');
  assert.equal(e.config.disponible, false);
});

prueba('CONFIG: elegir INSP y volver a PRINC activa el silencio de 60 s', () => {
  let e = pulsa(nuevo(), 'config');
  assert.equal(e.menu, 'config');
  assert.equal(pulsarTecla(e, 'frecuencia').estado.teclaSeleccionada, null);
  e = pulsa(e, 'config-insp');
  assert.equal(e.config.preferenciaVcInsp, 'INSP');
  e.silencio = { activo: false, segundosRestantes: 0 };
  e = pulsa(e, 'menu-principal');
  assert.equal(e.menu, 'principal');
  assert.equal(e.silencio.segundosRestantes, 60);
});

prueba('Silencio: 60 s, luego 120 s; con >= 61 s se cancela con una pulsación y con <= 60 s con dos', () => {
  let e = nuevo();
  e.silencio = { activo: false, segundosRestantes: 0 };
  e = pulsa(e, 'silenciar');
  assert.equal(e.silencio.segundosRestantes, 60);
  e = pulsa(e, 'silenciar'); // <= 60 s: extiende
  assert.equal(e.silencio.segundosRestantes, 120);
  e = pulsa(e, 'silenciar'); // >= 61 s: cancela
  assert.equal(e.silencio.activo, false);
  let f = pulsa(e, 'silenciar'); // 60 s, hace falta pulsar dos veces
  f = pulsa(f, 'silenciar', 'silenciar');
  assert.equal(f.silencio.activo, false);
});

prueba('El silencio termina al agotarse el tiempo', () => {
  let e = nuevo();
  e = avanzarTiempo(e, 59);
  assert.equal(e.silencio.segundosRestantes, 1);
  e = avanzarTiempo(e, 1);
  assert.equal(e.silencio.activo, false);
});

prueba('Bloqueo: inactiva las teclas salvo menús y SILENCIAR; se desbloquea con dos pulsaciones en 5 s', () => {
  let e = pulsa(nuevo(), 'bloqueo');
  assert.equal(e.bloqueado, true);
  assert.equal(pulsarTecla(e, 'frecuencia').estado.teclaSeleccionada, null);
  assert.equal(pulsarTecla(e, 'menu-secundario').estado.menu, 'secundario');
  assert.equal(girarMando(e, 'peep', 8).estado.ajustes.peep, 8); // las perillas siguen activas
  e = pulsa(e, 'bloqueo');
  assert.equal(e.bloqueado, true);
  assert.equal(e.bloqueoPendiente, 5);
  e = pulsa(e, 'bloqueo');
  assert.equal(e.bloqueado, false);
  // Si pasan 5 s sin confirmar, sigue bloqueado.
  let f = pulsa(nuevo(), 'bloqueo', 'bloqueo');
  f = avanzarTiempo(f, 5);
  f = pulsa(f, 'bloqueo');
  assert.equal(f.bloqueado, true);
});

prueba('La selección se cancela sola tras 30 s y cada flecha reinicia el contador', () => {
  let e = pulsa(nuevo(), 'frecuencia');
  e = avanzarTiempo(e, 20);
  e = flecha(e, 1);
  assert.equal(e.seleccionRestante, 30);
  e = avanzarTiempo(e, 29);
  assert.equal(e.teclaSeleccionada, 'frecuencia');
  e = avanzarTiempo(e, 1);
  assert.equal(e.teclaSeleccionada, null);
});

prueba('CONFIG deja de estar disponible a los 30 s', () => {
  let e = avanzarTiempo(nuevo(), 30);
  assert.equal(e.config.disponible, false);
});

prueba('Nebulizador: se enciende con una flecha, cuenta atrás y se apaga solo; el tiempo no se edita encendido', () => {
  let e = pulsa(nuevo(), 'menu-secundario', 'neb-tiempo');
  e = flecha(e, 1, 2);
  assert.equal(e.ajustes.nebulizador, 7);
  e = pulsa(e, 'neb-estado');
  e = flecha(e, 1);
  assert.equal(e.nebulizadorEncendido, true);
  assert.equal(e.nebRestante, 420);
  e = pulsa(e, 'neb-tiempo');
  assert.ok(pulsarFlecha(e, 1).aviso.includes('apagado'));
  e = avanzarTiempo(e, 420);
  assert.equal(e.nebulizadorEncendido, false);
});

prueba('Nebulizador: con INSP < 0,2 s sube a 0,2 s al encender', () => {
  let e = nuevo();
  e.ajustes.insp = 0.1;
  assert.equal(alternarNebulizador(e).estado.ajustes.insp, 0.2);
});

prueba('Retroiluminación: se apaga manteniendo la barra y vuelve al apagar y encender', () => {
  const e = apagarRetroiluminacion(nuevo()).estado;
  assert.equal(e.retroiluminacion, false);
  assert.equal(encender(apagar(e)).retroiluminacion, true);
});

prueba('Flujo constante y disparos: se excluyen entre sí', () => {
  let e = pulsa(nuevo(), 'menu-principal', 'flujo-constante');
  assert.equal(e.ajustes.dispPresion, null);
  e = pulsa(e, 'flujo-constante'); // se apaga y vuelve el disparo por presión
  assert.equal(e.flujoConstante, false);
  assert.equal(e.ajustes.dispPresion, 1);
});

console.log(`\n${pasadas} pruebas de operación pasadas`);
