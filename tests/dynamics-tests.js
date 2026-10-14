// Pruebas de la dinámica respiratoria (VC = 17 ml x PICO, perillas, DISP. FLUJO, barra de presión, pestañas de alarma).
import assert from 'node:assert/strict';
import { crearEstadoInicial, encender, fijarNeumotaco, fijarLimiteAlarma, fijarParametro, pasoParametro, fijarMedido, fijarModo } from '../js/state.js';
import { alternarFlujoConstante, activarAlarma } from '../js/state.js';
import { pulsarTecla, pulsarFlecha, girarMando } from '../js/interaction.js';
import { sincronizar, patronSonoro, condiciones, motivosAlarma } from '../js/engine.js';
import { nuevaRespiracion, presionInstantanea, periodoRespiratorio, vcDesdePico, picoDesdeVc, aumentoPorDispFlujo } from '../js/dynamics.js';
import { calcularTiempos } from '../js/utils.js';
import { renderPantalla, renderVentilador, rellenoBarra } from '../js/ventilator-renderer.js';
import { usarAleatorio } from '../js/random.js';

let pasadas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ok  ', nombre); }
  catch (e) { console.error('  FALLA', nombre, '\n       ', e.message); process.exitCode = 1; }
  finally { usarAleatorio(null); }
}
const nuevo = () => encender(crearEstadoInicial());
const secuencia = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

console.log('Dinámica respiratoria');

prueba('El VC es 17 ml por unidad de PICO (sin variación al encender)', () => {
  const e = nuevo();
  assert.equal(e.ajustes.presionMaxima, 35);
  assert.equal(e.ajustes.vc, 595);
  assert.equal(e.medidos.vce, 595);
  assert.equal(vcDesdePico(20), 340);
  assert.equal(picoDesdeVc(340), 20);
});

prueba('INSP no cambia el VC; solo cambia E e I/E', () => {
  let e = nuevo();
  const antes = e.ajustes.vc;
  const t1 = calcularTiempos({ frecuencia: e.ajustes.frecuencia, vc: e.ajustes.vc, flujo: e.ajustes.flujo, insp: e.ajustes.insp, preferencia: 'INSP' });
  e = pulsarTecla(e, 'insp').estado;
  for (let i = 0; i < 4; i++) e = pulsarFlecha(e, 1).estado;
  assert.equal(e.ajustes.insp, 1.4);
  assert.equal(e.ajustes.vc, antes);
  assert.equal(e.medidos.vce, antes);
  const t2 = calcularTiempos({ frecuencia: e.ajustes.frecuencia, vc: e.ajustes.vc, flujo: e.ajustes.flujo, insp: e.ajustes.insp, preferencia: 'INSP' });
  assert.notEqual(t1.e, t2.e);
  assert.notEqual(t1.ie, t2.ie);
  assert.equal(e.ajustes.flujo, 30); // el flujo lo edita el usuario: no se recalcula
});

prueba('Subir la PICO (perilla PRES MÁX) sube el VC y la presión del panel; el flujo no cambia', () => {
  let e = nuevo();
  e = girarMando(e, 'presionMaxima', 40).estado;
  assert.equal(e.ajustes.presionMaxima, 40);
  assert.equal(e.medidos.pico, 40);
  assert.equal(e.ajustes.vc, 680);
  assert.equal(e.medidos.vce, 680);
  assert.equal(e.ajustes.flujo, 30);
});

prueba('Las perillas PEEP y FLUJO actualizan los valores de pantalla', () => {
  let e = nuevo();
  e = girarMando(e, 'peep', 8).estado;
  assert.equal(e.medidos.peep, 8);
  e = girarMando(e, 'flujo', 22).estado;
  assert.equal(e.ajustes.flujo, 22);
});

prueba('Perilla de O2: gira de 21 a 100 y cambia el O2 del panel de alarmas', () => {
  let e = nuevo();
  e = girarMando(e, 'o2', 60).estado;
  assert.equal(e.medidos.o2, 60);
  assert.equal(girarMando(e, 'o2', 5).estado.medidos.o2, 21);
  assert.equal(girarMando(e, 'o2', 500).estado.medidos.o2, 100);
  assert.equal(girarMando(crearEstadoInicial(), 'o2', 60).tono, 'error'); // apagado
});

prueba('Variación aleatoria: presión hasta ±3 % y VC hasta ±10 % en cada respiración', () => {
  const e = nuevo();
  const alto = nuevaRespiracion(e, () => 1);
  assert.equal(alto.respiracion.varPresion, 0.03);
  assert.equal(alto.respiracion.varVc, 0.1);
  assert.equal(alto.medidos.pico, 36.1);
  assert.equal(alto.medidos.vce, 655); // 17 x 35 x 1,10 = 654,5
  const bajo = nuevaRespiracion(e, () => 0);
  assert.equal(bajo.medidos.vce, 536);
  assert.equal(bajo.medidos.pico, 33.9);
  const medio = nuevaRespiracion(e, () => 0.5);
  assert.equal(medio.medidos.vce, 595);
  usarAleatorio(null);
  for (let i = 0; i < 500; i++) {
    const r = nuevaRespiracion(e);
    assert.ok(Math.abs(r.respiracion.varPresion) <= 0.03 && Math.abs(r.respiracion.varVc) <= 0.1);
    assert.ok(r.medidos.vce >= 535 && r.medidos.vce <= 655);
  }
  assert.equal(alto.respiracion.n, 1);
});

prueba('Los valores por defecto no disparan alarmas con la variación máxima', () => {
  const e = nuevo();
  for (const r of [0, 0.5, 1]) {
    const s = sincronizar(nuevaRespiracion(e, () => r));
    assert.deepEqual(s.alarmas.activas, [], `alarma con aleatorio=${r}`);
  }
});

prueba('Instructor: cambiar el VC recalcula la presión; cambiar la PICO recalcula el VC', () => {
  let e = nuevo();
  let r = fijarMedido(e, 'vce', 600);
  assert.ok(r.ok);
  assert.equal(r.estado.medidos.vce, 600);
  assert.ok(Math.abs(r.estado.ajustes.presionMaxima - 600 / 17) < 0.001);
  assert.ok(Math.abs(r.estado.medidos.pico - r.estado.ajustes.presionMaxima) < 0.05);
  r = fijarMedido(e, 'pico', 50);
  assert.equal(r.estado.ajustes.presionMaxima, 50);
  assert.equal(r.estado.medidos.vce, 850);
  assert.equal(fijarMedido(e, 'pico', 81).ok, false);
  assert.equal(fijarMedido(e, 'vce', 1400).ok, false);
  assert.equal(fijarMedido(e, 'peep', 25).ok, false);
  assert.equal(fijarMedido(e, 'peep', 10).estado.ajustes.peep, 10);
  assert.equal(fijarMedido(e, 'o2', 40).estado.medidos.o2, 40);
});

prueba('VME = VCE x FREC; la frecuencia medida del instructor recalcula el VME', () => {
  let e = nuevo();
  assert.equal(e.medidos.vme, 7.1);
  e = fijarMedido(e, 'frecuencia', 20).estado;
  assert.equal(e.medidos.frecuencia, 20);
  assert.equal(e.medidos.vme, 11.9);
});

console.log('DISP. FLUJO');

prueba('DISP. FLUJO: de 0,1 a 10 L/min en pasos de 0,1; 0,0 es APAGADO', () => {
  let e = nuevo(); e.neumotaco = 'pediatrico';
  assert.equal(e.ajustes.dispFlujo, null);
  e = pulsarTecla(e, 'disp-flujo').estado;
  e = pulsarFlecha(e, 1).estado;
  assert.equal(e.ajustes.dispFlujo, 0.1);
  e = pulsarFlecha(e, 1).estado;
  assert.equal(e.ajustes.dispFlujo, 0.2);
  assert.equal(pulsarFlecha(pulsarFlecha(e, -1).estado, -1).estado.ajustes.dispFlujo, null); // bajar de 0,1 = APAGADO
  assert.equal(fijarParametro(e, 'dispFlujo', 10).ok, true);
  assert.equal(fijarParametro(e, 'dispFlujo', 10.1).ok, false);
  assert.equal(fijarParametro(e, 'dispFlujo', 0.05).ok, false);
  const arriba = fijarParametro(e, 'dispFlujo', 10).estado;
  assert.equal(pasoParametro(arriba, 'dispFlujo', 1).limiteAlcanzado, true);
  assert.equal(fijarParametro(e, 'dispFlujo', 5).estado.ajustes.dispPresion, e.ajustes.dispPresion); // no cambia otras funciones
});

prueba('DISP. FLUJO <= 3: sin aumento de FREC. Por encima de 3: 0, 5, 10 o 15 % solo en el menú de alarmas', () => {
  let e = nuevo(); e.neumotaco = 'pediatrico';
  assert.equal(fijarParametro(e, 'dispFlujo', 3).estado.aumentoFrecPct, 0);
  const casos = [[0, 0], [0.3, 5], [0.6, 10], [0.99, 15]]; // aleatorio -> porcentaje
  for (const [r, pct] of casos) {
    usarAleatorio(() => r);
    const s = fijarParametro(e, 'dispFlujo', 6).estado;
    assert.equal(s.aumentoFrecPct, pct);
    assert.equal(s.ajustes.frecuencia, 12); // PRINC no cambia
    assert.equal(s.medidos.frecuencia, Math.round(12 * (1 + pct / 100)));
  }
});

prueba('El aumento de FREC es estático hasta que DISP. FLUJO vuelve a cambiar', () => {
  let e = nuevo(); e.neumotaco = 'pediatrico';
  usarAleatorio(() => 0.99);
  e = fijarParametro(e, 'dispFlujo', 6).estado;
  assert.equal(e.aumentoFrecPct, 15);
  usarAleatorio(() => 0);
  e = girarMando(e, 'peep', 7).estado;           // otros cambios no lo sortean de nuevo
  e = nuevaRespiracion(e);
  e = fijarParametro(e, 'frecuencia', 20).estado;
  assert.equal(e.aumentoFrecPct, 15);
  assert.equal(e.medidos.frecuencia, 23);
  e = fijarParametro(e, 'dispFlujo', 7).estado;   // al cambiarlo se sortea otra vez
  assert.equal(e.aumentoFrecPct, 0);
  assert.equal(e.medidos.frecuencia, 20);
  e = fijarParametro(e, 'dispFlujo', null).estado;
  assert.equal(e.aumentoFrecPct, 0);
});

prueba('aumentoPorDispFlujo: valores de la lista y reglas del umbral', () => {
  assert.equal(aumentoPorDispFlujo(null), 0);
  assert.equal(aumentoPorDispFlujo(3), 0);
  assert.equal(aumentoPorDispFlujo(3.1, () => 0.26), 5);
  assert.equal(aumentoPorDispFlujo(10, () => 0.999999), 15);
});

prueba('El cambio de modo recalcula la FREC medida con la frecuencia del modo', () => {
  let e = nuevo();
  e = fijarModo(e, 'SIMV').estado;
  assert.equal(e.medidos.frecuencia, 10);
  e = fijarModo(e, 'CPAP').estado;
  assert.equal(e.medidos.frecuencia, 12);
});

console.log('Barra de presión');

prueba('La presión sube de la PEEP a la PICO en la inspiración y vuelve a la PEEP en la espiración', () => {
  const e = nuevo();
  const T = periodoRespiratorio(e);
  assert.equal(T, 5);
  assert.equal(presionInstantanea(e, 0), e.medidos.peep);
  assert.equal(presionInstantanea(e, 0.9), e.medidos.pico);          // dentro de INSP (1,0 s) en meseta
  assert.ok(presionInstantanea(e, 0.2) > e.medidos.peep && presionInstantanea(e, 0.2) < e.medidos.pico);
  assert.ok(presionInstantanea(e, 4.9) - e.medidos.peep < 0.5);       // casi en PEEP al final
  for (let t = 0; t <= T; t += 0.05) {
    const p = presionInstantanea(e, t);
    assert.ok(p >= e.medidos.peep - 1e-9 && p <= e.medidos.pico + 1e-9);
  }
});

prueba('La barra sigue la PICO de la perilla y es dibujable con cualquier presión', () => {
  const e = girarMando(nuevo(), 'presionMaxima', 60).estado;
  assert.equal(e.medidos.pico, 60);
  assert.equal(presionInstantanea(e, 0.9), 60);
  assert.match(rellenoBarra(e, 20), /rect/);
  assert.notEqual(rellenoBarra(e, 10), rellenoBarra(e, 30));
  assert.match(renderPantalla(e), /data-barra/);
});

console.log('Pantalla');

prueba('PRINC muestra INSP programable y VC como resultado (sin tecla VC)', () => {
  const svg = renderPantalla(nuevo());
  assert.match(svg, /data-tecla="insp"/);
  assert.doesNotMatch(svg, /data-tecla="vc"/);
  assert.match(svg, /VC = 595/);
  assert.match(svg, /I\/E = /);
});

prueba('La tecla VC no se puede programar y CONFIG no la activa', () => {
  const e = nuevo();
  assert.ok(pulsarTecla(e, 'vc').aviso);
  assert.equal(pulsarTecla(e, 'vc').estado.teclaSeleccionada, null);
  assert.ok(pulsarTecla(pulsarTecla(e, 'config').estado, 'config-vc').aviso);
});

prueba('ALARMA1 parpadea mientras la alarma de PICO siga activa, aun con silencio y viendo ese menú', () => {
  let e = sincronizar(nuevo());
  const pestana = (s, n) => (s.match(new RegExp(`<g data-pestana="${n}"[^>]*>`)) || [''])[0];
  assert.doesNotMatch(pestana(renderPantalla(e), 'alarma1'), /parpadeo/);
  e = sincronizar(fijarMedido(e, 'pico', 60).estado);
  assert.ok(e.alarmas.activas.includes('pico:high'));
  assert.equal(e.menu, 'principal');                                         // no se mueve al panel de alarmas
  assert.match(pestana(renderPantalla(e), 'alarma1'), /parpadeo/);          // la pestaña parpadea
  e = pulsarTecla(e, 'menu-alarmas').estado;
  assert.equal(e.menu, 'alarma1');
  assert.match(pestana(renderPantalla(e), 'alarma1'), /parpadeo/);          // viendo el menú
  assert.doesNotMatch(pestana(renderPantalla(e), 'alarma2'), /parpadeo/);
  const sil = sincronizar(pulsarTecla(e, 'silenciar').estado);
  assert.equal(sil.silencio.activo, true);
  assert.match(pestana(renderPantalla(sil), 'alarma1'), /parpadeo/);        // silenciada: sigue parpadeando
  const otro = pulsarTecla(sil, 'menu-principal').estado;
  assert.match(pestana(renderPantalla(otro), 'alarma1'), /parpadeo/);       // en otro menú
  const res = sincronizar(fijarMedido(otro, 'pico', 30).estado);
  assert.doesNotMatch(pestana(renderPantalla(res), 'alarma1'), /parpadeo/); // resuelta: se detiene
});

prueba('ALARMA2 parpadea con una alarma de O2 y no ALARMA1', () => {
  let e = sincronizar(nuevo());
  e = sincronizar(fijarLimiteAlarma(e, 'o2', 'low', 40).estado); // el O2 medido (21) queda por debajo
  assert.ok(e.alarmas.activas.includes('o2:low'));
  const svg = renderPantalla(e);
  assert.match((svg.match(/<g data-pestana="alarma2"[^>]*>/) || [''])[0], /parpadeo/);
  assert.doesNotMatch((svg.match(/<g data-pestana="alarma1"[^>]*>/) || [''])[0], /parpadeo/);
});

prueba('El equipo completo dibuja el mezclador como perilla de O2', () => {
  const svg = renderVentilador(nuevo());
  assert.match(svg, /data-perilla="o2"/);
  assert.match(svg, /data-perilla="presion-maxima"/);
});

console.log('Alarmas dinámicas');

const silencioFuera = (e) => { const s = structuredClone(e); s.silencio = { activo: false, segundosRestantes: 0 }; return s; };

prueba('El valor que activó la alarma parpadea en rojo (menú de alarmas, barra y VC de PRINC)', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  const parpadeoRojo = (svg, texto) => new RegExp(`<text[^>]*fill="#[0-9A-Fa-f]+"[^>]*class="parpadeo"[^>]*>${texto}</text>`).test(svg) || new RegExp(`<text[^>]*class="parpadeo"[^>]*>${texto}</text>`).test(svg);
  assert.ok(!/class="parpadeo"/.test(renderPantalla(e)));
  e = sincronizar(fijarMedido(e, 'pico', 60).estado);                 // PICO 60 -> VCE 1020 (alto)
  const principal = renderPantalla(e);
  assert.ok(parpadeoRojo(principal, '60'), 'número de PICO de la barra');
  assert.match(principal, /<text[^>]*class="parpadeo"[^>]*>VC = 1020<\/text>/);
  const alarmas = renderPantalla(pulsarTecla(e, 'menu-alarmas').estado);
  assert.ok(parpadeoRojo(alarmas, '60'), 'valor en la fila PICO');
  assert.ok(parpadeoRojo(alarmas, '1020'), 'valor en la fila VCE');
  assert.ok(!parpadeoRojo(alarmas, '12'), 'la FREC no está en alarma');
});

prueba('Un valor programado fuera de límites suena y se resuelve al volver al rango o al mover los límites', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  e = sincronizar(fijarParametro(e, 'frecuencia', 25).estado);        // programada 25 > límite alto 20
  assert.ok(e.alarmas.activas.includes('frecuencia:high'));
  assert.ok(patronSonoro(e), 'debe sonar');
  assert.equal(e.menu, 'principal');
  e = sincronizar(fijarParametro(e, 'frecuencia', 15).estado);
  assert.ok(!e.alarmas.activas.includes('frecuencia:high'));
  assert.equal(patronSonoro(e), null);
  e = sincronizar(girarMando(e, 'peep', 12).estado);                  // PEEP 12 > límite alto 8
  assert.ok(e.alarmas.activas.includes('peep:high') && patronSonoro(e));
  e = sincronizar(fijarLimiteAlarma(e, 'peep', 'high', 15).estado);   // el límite se aleja del valor
  assert.deepEqual(e.alarmas.activas, []);
  assert.equal(patronSonoro(e), null);
  e = sincronizar(fijarLimiteAlarma(e, 'peep', 'high', 10).estado);   // y vuelve a estar fuera
  assert.ok(e.alarmas.activas.includes('peep:high') && patronSonoro(e));
});

prueba('Perilla PRES MÁX baja: alarma de PICO baja (salvo en CPAP) y VCE bajo', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  e = sincronizar(girarMando(e, 'presionMaxima', 5).estado);
  assert.ok(e.alarmas.activas.includes('pico:low') && e.alarmas.activas.includes('vce:low'));
  let c = sincronizar(silencioFuera(nuevo()));
  c = sincronizar(fijarModo(c, 'CPAP').estado);
  c = sincronizar(girarMando(c, 'presionMaxima', 5).estado);
  assert.ok(!c.alarmas.activas.includes('pico:low'));
});

prueba('Con un valor en el borde, la variación de cada respiración enciende y apaga la alarma y el sonido', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  e = sincronizar(girarMando(e, 'presionMaxima', 39).estado);         // 39 x 1,03 = 40,2 > 40
  const alta = sincronizar(nuevaRespiracion(e, () => 1));
  const media = sincronizar(nuevaRespiracion(alta, () => 0.5));
  assert.ok(alta.alarmas.activas.includes('pico:high') && patronSonoro(alta));
  assert.ok(!media.alarmas.activas.includes('pico:high'));
  assert.equal(patronSonoro(media), null);
  const otra = sincronizar(nuevaRespiracion(media, () => 1));
  assert.ok(otra.alarmas.activas.includes('pico:high') && patronSonoro(otra));
});

prueba('Una alarma nueva cancela el silencio; la ya existente sigue parpadeando aunque esté silenciada', () => {
  let e = sincronizar(nuevo());                                       // silencio de 60 s al encender
  e = sincronizar(fijarMedido(e, 'pico', 50).estado);
  assert.equal(e.silencio.activo, false);                              // alarma nueva: suena
  assert.ok(patronSonoro(e));
  e = sincronizar(pulsarTecla(e, 'silenciar').estado);
  assert.equal(patronSonoro(e), null);                                 // silenciada
  assert.match((renderPantalla(e).match(/<g data-pestana="alarma1"[^>]*>/) || [''])[0], /parpadeo/);
  assert.ok(condiciones(e).length > 0);
});

console.log('Alarmas rediseñadas');

prueba('La PICO programada que deja el VC fuera de rango activa la alarma de VCE con su motivo, luz roja y sonido', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  e = sincronizar(girarMando(e, 'presionMaxima', 46).estado);        // VC = 17 x 46 = 782 > 750 (PICO 46 sigue < 64)
  assert.ok(e.alarmas.activas.includes('vce:high'));
  assert.ok(patronSonoro(e));
  const m = motivosAlarma(e).find((x) => x.id === 'vce:high');
  assert.match(m.texto, /VCE ALTO: 782 ML.*límite 750/);
  assert.match(m.causa, /17 ml × PICO/);
  assert.equal(m.pestana, 'ALARMA1');
  const svg = renderPantalla(e);
  assert.match(svg, /data-luz="alarma1"/);
  assert.match(renderPantalla(e, { menu: 'alarma1' }), /▲/);
  assert.equal(e.menu, 'principal'); // no cambia de pantalla
});

prueba('Al volver dentro de los límites la alarma, su motivo y la luz se apagan', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  e = sincronizar(girarMando(e, 'presionMaxima', 46).estado);
  e = sincronizar(girarMando(e, 'presionMaxima', 35).estado);
  assert.equal(motivosAlarma(e).length, 0);
  assert.equal(patronSonoro(e), null);
  assert.ok(!/data-luz/.test(renderPantalla(e)));
});

prueba('Cada alarma indica su motivo, incluidos los de ALARMA2 y los del sistema', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  e = sincronizar(fijarLimiteAlarma(e, 'peep', 'high', 6).estado);
  e = sincronizar(girarMando(e, 'peep', 8).estado);                  // PEEP 8 > 6
  const m = motivosAlarma(e).find((x) => x.clave === 'peep');
  assert.equal(m.pestana, 'ALARMA2');
  assert.match(m.texto, /PEEP ALTO/);
  assert.match(renderPantalla(e), /data-luz="alarma2"/);
  e.energia.presionGasOk = false;
  assert.ok(motivosAlarma(e).some((x) => x.nivel === 'sistema' && /SUMINISTRO/.test(x.texto)));
});

prueba('DISP. FLUJO no genera alarma ni cambia otras funciones, aunque suba la FREC de la lectura', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  e = fijarNeumotaco(e, 'pediatrico').estado;
  const antes = JSON.stringify({ a: e.ajustes, f: e.flujoConstante });
  usarAleatorio(() => 0.99);                                          // aumento de 15 %
  const c = fijarParametro(e, 'dispFlujo', 8).estado;
  assert.equal(c.aumentoFrecPct, 15);
  assert.ok(c.medidos.frecuencia > e.medidos.frecuencia);
  assert.deepEqual(JSON.parse(antes).f, c.flujoConstante);
  assert.equal(c.ajustes.dispPresion, e.ajustes.dispPresion);
  const s = sincronizar(c);
  assert.equal(s.alarmas.activas.length, 0);
  // Con un límite alto de FREC justo sobre la FREC programada, el aumento no activa la alarma.
  const l = sincronizar(fijarLimiteAlarma(c, 'frecuencia', 'high', 13).estado);
  assert.equal(l.alarmas.activas.length, 0);
  const off = sincronizar(fijarParametro(l, 'dispFlujo', null).estado);
  assert.equal(off.alarmas.activas.length, 0);
});

prueba('La barra completa una respiración por ciclo de FREC (12 => 5 s) y sube a la PICO una vez', () => {
  let e = nuevo();
  assert.equal(periodoRespiratorio(e), 5);
  const picos = [];
  let previo = -1; let subiendo = false;
  for (let t = 0; t < 15; t += 0.05) {
    const p = presionInstantanea(e, t % periodoRespiratorio(e));
    if (!subiendo && p > e.medidos.pico - 0.5 && previo <= e.medidos.pico - 0.5) picos.push(t);
    subiendo = p > e.medidos.pico - 0.5; previo = p;
  }
  assert.equal(picos.length, 3);                                      // 3 respiraciones en 15 s = 12 por minuto
  e = fijarParametro(e, 'frecuencia', 20).estado;
  assert.equal(periodoRespiratorio(e), 3);
  usarAleatorio(() => 0.99);
  const d = fijarParametro(fijarNeumotaco(e, 'pediatrico').estado, 'dispFlujo', 8).estado;
  assert.equal(periodoRespiratorio(d), 3);                            // el aumento de DISP. FLUJO no cambia el ritmo de la barra
});

prueba('La pantalla puede dibujarse con la presión del instante (no salta al pico al redibujar)', () => {
  const e = nuevo();
  const bajo = renderPantalla(e, { presionBarra: e.medidos.peep });
  const alto = renderPantalla(e);
  assert.notEqual(bajo, alto);
});

prueba('El neumotacógrafo conectado apaga el flujo constante', () => {
  let e = nuevo();
  e = alternarFlujoConstante(e, true).estado;
  e = fijarNeumotaco(e, 'infantil').estado;
  assert.equal(e.flujoConstante, false);
  assert.equal(fijarNeumotaco(e, 'raro').ok, false);
});

prueba('Alarma de VME desde el panel: límites, silenciarla (apagarla) y reactivarla', () => {
  let e = sincronizar(silencioFuera(nuevo()));
  e = sincronizar(fijarLimiteAlarma(e, 'vme', 'high', 6).estado);     // VME 7,1 > 6
  assert.ok(e.alarmas.activas.includes('vme:high'));
  assert.match(motivosAlarma(e).find((x) => x.clave === 'vme').texto, /VME ALTO/);
  e = sincronizar(activarAlarma(e, 'vme', false).estado);             // silenciar la alarma de VME
  assert.ok(!e.alarmas.activas.includes('vme:high'));
  assert.equal(patronSonoro(e), null);
  e = sincronizar(activarAlarma(e, 'vme', true).estado);
  assert.ok(e.alarmas.activas.includes('vme:high'));
  assert.equal(fijarLimiteAlarma(e, 'vme', 'low', 7).ok, false);     // bajo < alto
  assert.equal(fijarLimiteAlarma(e, 'vme', 'high', NaN).ok, false);
  assert.equal(activarAlarma(e, 'pico', false).ok, false);           // PICO no es apagable
});

console.log(`\n${pasadas} pruebas de dinámica pasadas`);
