// Pruebas del renderizador: comprueban que el SVG sea válido y refleje el estado. Ejecutar con: npm test
import assert from 'node:assert/strict';
import { crearEstadoInicial, fijarModo, alternarFlujoConstante, fijarParametro } from '../js/state.js';
import { renderVentilador, renderPantallaSVG } from '../js/ventilator-renderer.js';
import { TEXTOS, TECLAS_SIN_FUNCION } from '../js/config.js';

let pasadas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ok  ', nombre); }
  catch (e) { console.error('  FALLA', nombre, '\n       ', e.message); process.exitCode = 1; }
}
const encendido = (o = {}) => ({ ...crearEstadoInicial(), encendido: true, ...o });
const on = (estado) => ({ ...estado, encendido: true }); // para estados ya completos

console.log('Renderizador');

prueba('El SVG completo se genera y trae etiqueta accesible con el nombre', () => {
  const svg = renderVentilador(encendido());
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.ok(svg.includes('Prosventi V-2.0'));
  assert.ok(!svg.includes('BIO-MED') && !svg.includes('CROSSVENT'));
});

prueba('Menú principal: etiquetas en español, INSP programable, VC resultado de la presión y tiempos E e I/E (E=4,00, I/E=1:4.0)', () => {
  const svg = renderPantallaSVG(encendido());
  for (const s of ['FREC', 'VC', 'FLUJO', 'FLUJO CONSTANTE', 'DISP. FLUJO', 'DISP. PRES', 'PRINC', 'AUTO']) assert.ok(svg.includes(s), s);
  assert.ok(svg.includes('VC = 595'));
  assert.ok(svg.includes('E = 4.00'));
  assert.ok(svg.includes('I/E = 1:4.0'));
});

prueba('Valores iniciales visibles: presión máxima 35, flujo 30', () => {
  const svg = renderVentilador(encendido());
  assert.ok(svg.includes('35 cmH2O'));
  assert.ok(svg.includes('30 L/min'));
});

prueba('Modo SIMV y CPAP cambian la etiqueta de frecuencia; flujo constante pasa A/C a CMV y oculta SIMV', () => {
  assert.ok(renderPantallaSVG(on(fijarModo(crearEstadoInicial(), 'SIMV').estado)).includes('FREC SIMV'));
  assert.ok(renderPantallaSVG(on(fijarModo(crearEstadoInicial(), 'CPAP').estado)).includes('FREC RESPALDO'));
  const cf = on(alternarFlujoConstante(crearEstadoInicial(), true).estado);
  const svg = renderPantallaSVG(cf);
  assert.ok(svg.includes('>CMV<'));
  assert.ok(!svg.includes('data-tecla="modo-simv"'));
  assert.ok(svg.includes('INSP')); // con flujo constante, VC se convierte en INSP
});

prueba('Menú secundario: soporte de presión y nebulizador', () => {
  const svg = renderPantallaSVG(encendido({ menu: 'secundario' }));
  assert.ok(svg.includes('SOPORTE PRES') && svg.includes('NEB') && svg.includes('00:00'));
});

prueba('Alarma 1 y 2: límites, etiquetas y tecla SUSPIRO OFF accesible', () => {
  const a1 = renderPantallaSVG(encendido({ menu: 'alarma1' }));
  for (const s of ['PICO', 'FREC', 'VCE', 'BAJO', 'ALTO']) assert.ok(a1.includes(s), s);
  assert.ok(a1.includes('data-tecla="suspiro"') && a1.includes('role="button"') && a1.includes('tabindex="0"'));
  const a2 = renderPantallaSVG(encendido({ menu: 'alarma2' }));
  for (const s of ['PEEP', 'MEDIA', 'OXÍGENO']) assert.ok(a2.includes(s), s);
});

prueba('La nota de SUSPIRO no aparece dibujada en el SVG (solo se muestra al tocar la tecla)', () => {
  const svg = renderVentilador(encendido({ menu: 'alarma1' }));
  const nota = TEXTOS[TECLAS_SIN_FUNCION.suspiroOff.nota];
  assert.ok(!svg.includes(nota.slice(0, 30)));
  assert.ok(svg.includes('aria-expanded="false"'));
});

prueba('Alarma violada: el valor medido se resalta en rojo y parpadea', () => {
  const e = encendido({ menu: 'alarma1' });
  e.medidos.pico = 55;
  assert.ok(renderPantallaSVG(e).includes('class="parpadeo"'));
});

prueba('Alarma 3 muestra batería baja y baja presión de suministro', () => {
  const e = encendido({ menu: 'alarma3' });
  e.energia = { fuente: 'bateria', bateriaPct: 10, presionGasOk: false };
  const svg = renderPantallaSVG(e);
  assert.ok(svg.includes('BATERÍA BAJA') && svg.includes('BAJA PRESIÓN DE SUMINISTRO'));
});

prueba('Teclas bloqueadas por reglas se dibujan atenuadas (soporte de presión en A/C)', () => {
  const svg = renderPantallaSVG(encendido({ menu: 'secundario' }));
  assert.ok(/data-tecla="soporte-presion" opacity="0.45"/.test(svg));
});

prueba('Apagado: pantalla negra sin menús', () => {
  const svg = renderPantallaSVG(encendido({ encendido: false }));
  assert.ok(!svg.includes('PRINC'));
});

prueba('Perillas reflejan los ajustes', () => {
  const e = fijarParametro(encendido(), 'peep', 12).estado;
  assert.ok(renderVentilador(e).includes('12 cmH2O'));
});

console.log(`\n${pasadas} pruebas de renderizado pasadas`);
