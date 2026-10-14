// Renderizador SVG del equipo y de su pantalla. Solo dibuja; no modifica el estado.
// Dibujo propio (no incrusta ni calca las imágenes del manual). Colores y formas adaptados.
import { TEXTOS, ALARMAS, TECLAS_SIN_FUNCION } from './config.js';
import { MARCA } from './brand.config.js';
import { calcularTiempos } from './utils.js';
import { calcularDeshabilitados } from './state.js';
import { condiciones, parametrosEnAlarma } from './engine.js';

const C = {
  navy: '#1B2A72', azul: '#3A8FCB', amarillo: '#FFE81A', blanco: '#FFFFFF', negro: '#101418',
  rojo: '#E5232B', verde: '#2FBF4A', ambar: '#F2B705', pista: '#E9EEF6',
  carcasa: '#F2EEE3', carcasaBorde: '#C9C3B3', asa: '#2F6DB5', asaOscuro: '#1F4E8C',
  bisel: '#3A3F46', gris: '#9AA0A6',
};
const FUENTE = 'Arial, Helvetica, sans-serif';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- Primitivas ----------
function txt(x, y, s, { size = 16, anchor = 'start', weight = 700, fill = C.blanco, extra = '' } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}"${extra}>${esc(s)}</text>`;
}
const zona = (x, y, w, h, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" pointer-events="all"${extra}/>`;
function rect(x, y, w, h, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
}

// Tecla con 1 o 2 líneas de texto centradas.
function tecla({ x, y, w, h, id, activa = false, fondo = C.navy, lineas, atenuada = false, borde = false, attrs = '' }) {
  const fill = activa ? C.amarillo : fondo;
  const color = activa ? C.negro : C.blanco;
  const n = lineas.length;
  const total = lineas.reduce((a, l) => a + l.size, 0) + (n - 1) * 2;
  let cy = y + h / 2 - total / 2;
  const partes = lineas.map((l) => {
    const base = cy + l.size * 0.82;
    cy += l.size + 2;
    return txt(x + w / 2, base.toFixed(1), l.s, { size: l.size, anchor: 'middle', fill: color, weight: l.weight || 700 });
  }).join('');
  // Zona de toque 4 unidades más alta que la tecla (dedos en pantallas pequeñas).
  return `<g data-tecla="${id}"${atenuada ? ' opacity="0.45"' : ''}${attrs}>${zona(x, y - 4, w, h + 8)}${rect(x, y, w, h, fill, borde ? ` stroke="${C.blanco}" stroke-width="1"` : '')}${partes}</g>`;
}

// Fila etiqueta + valor sobre fondo azul medio.
function fila({ x, w, y, h, id, etiqueta, valor, atenuada = false, sel = false, rojo = false, sizeEt = 17, sizeVal = 22, sub }) {
  const cy = y + h / 2;
  const fg = sel ? C.negro : C.blanco;
  const vfg = sel ? C.negro : (rojo ? C.rojo : C.blanco);
  return `<g data-tecla="${id}"${atenuada ? ' opacity="0.45"' : ''}>`
    + zona(x, y, w, h)
    + (sel ? rect(x, y + 4, w, h - 8, C.amarillo) : '')
    + txt(x + 6, (cy + sizeEt * 0.35).toFixed(1), etiqueta, { size: sizeEt, fill: fg })
    + (sub ? txt(x + 6, (cy + sizeEt * 0.35 + 14).toFixed(1), sub, { size: 10, fill: fg, weight: 400 }) : '')
    + txt(x + w - 6, (cy + sizeVal * 0.35).toFixed(1), valor, { size: sizeVal, anchor: 'end', fill: vfg })
    + `</g>`;
}

const flecha = (cx, cy, abajo) => {
  const s = abajo ? 1 : -1;
  return `<polygon points="${cx - 6},${cy - 8 * s} ${cx + 6},${cy - 8 * s} ${cx + 6},${cy + 1 * s} ${cx + 13},${cy + 1 * s} ${cx},${cy + 14 * s} ${cx - 13},${cy + 1 * s} ${cx - 6},${cy + 1 * s}" fill="${C.blanco}"/>`;
};

// ---------- Pantalla (480 x 360) ----------
const yDe = (p) => 292 - ((p + 5) / 120) * 262; // -5..115 cmH2O

// Relleno de la barra para una presión p. La aplicación lo redibuja en cada cuadro para simular las respiraciones.
export function rellenoBarra(e, p) {
  const limite = e.limites.pico.enabled ? e.limites.pico.high : Infinity;
  const y0 = yDe(0);
  let b = '';
  if (p > 0) {
    const topVerde = yDe(Math.min(p, limite));
    b += rect(36, topVerde, 14, y0 - topVerde, C.verde);
    if (p > limite) b += rect(36, yDe(Math.min(p, 115)), 14, topVerde - yDe(Math.min(p, 115)), C.rojo);
  } else if (p < 0) {
    b += rect(36, y0, 14, yDe(Math.max(p, -5)) - y0, C.ambar);
  }
  return b;
}

function barraPresion(e, p) {
  const pico = e.medidos.pico;
  const enAlarma = parametrosEnAlarma(e);
  const alerta = (clave) => (enAlarma.has(clave) ? { fill: C.rojo, extra: ' class="parpadeo"' } : {});
  let b = rect(36, yDe(115), 14, yDe(-5) - yDe(115), C.pista);
  b += `<g data-barra>${rellenoBarra(e, typeof p === 'number' ? p : pico)}</g>`;
  for (let p = 0; p <= 100; p += 20) {
    b += `<line x1="26" x2="34" y1="${yDe(p)}" y2="${yDe(p)}" stroke="${C.blanco}" stroke-width="1.5"/>`;
    b += txt(2, (yDe(p) + 3.5).toFixed(1), p, { size: 10, weight: 400 });
  }
  b += txt(31, 14, 'PICO', { size: 11, anchor: 'middle' });
  b += txt(31, 31, Math.round(pico), { size: 15, anchor: 'middle', ...alerta('pico') });
  b += txt(31, 322, 'PEEP', { size: 11, anchor: 'middle' });
  b += txt(31, 344, Math.round(e.medidos.peep), { size: 15, anchor: 'middle', ...alerta('peep') });
  return `<g data-tecla="barra-presion">${zona(0, 0, 62, 360)}${b}</g>`;
}

function filaSuperior(e, menu) {
  const sil = e.silencio;
  const enAlarma = new Set(condiciones(e).map((x) => x.menu));
  return rect(62, 0, 418, 50, C.navy)
    + tecla({ x: 66, y: 4, w: 64, h: 42, id: 'menu-principal', activa: menu === 'principal', lineas: [{ s: TEXTOS.principal, size: 16 }] })
    + tecla({ x: 132, y: 4, w: 58, h: 42, id: 'menu-secundario', activa: menu === 'secundario', lineas: [{ s: TEXTOS.secundario, size: 16 }] })
    // Tecla compartida ALARMA1/ALARMA2: se ilumina la mitad que corresponde. Cada mitad parpadea mientras tenga una
    // alarma activa (también con el silencio activo y aunque ya se esté viendo ese menú) hasta que la alarma se resuelva.
    + `<g data-tecla="menu-alarmas">`
    + rect(194, 4, 90, 42, C.navy)
    + `<g data-pestana="alarma1"${enAlarma.has('alarma1') ? ' class="parpadeo"' : ''}>`
    + (enAlarma.has('alarma1') ? `<circle data-luz="alarma1" cx="204" cy="14" r="4.5" fill="${C.rojo}"/>` : '')
    + (menu === 'alarma1' ? rect(194, 4, 90, 21, C.amarillo) : '')
    + txt(239, 20, TEXTOS.alarma1, { size: 13, anchor: 'middle', fill: menu === 'alarma1' ? C.negro : C.blanco })
    + `</g><g data-pestana="alarma2"${enAlarma.has('alarma2') ? ' class="parpadeo"' : ''}>`
    + (enAlarma.has('alarma2') ? `<circle data-luz="alarma2" cx="204" cy="36" r="4.5" fill="${C.rojo}"/>` : '')
    + (menu === 'alarma2' ? rect(194, 25, 90, 21, C.amarillo) : '')
    + txt(239, 40, TEXTOS.alarma2, { size: 13, anchor: 'middle', fill: menu === 'alarma2' ? C.negro : C.blanco })
    + `</g>`
    + `</g>`
    + tecla({ x: 286, y: 4, w: 60, h: 42, id: 'bloqueo', activa: e.bloqueado, lineas: [{ s: TEXTOS.bloqueo, size: 16 }] })
    + (sil.activo
      ? tecla({ x: 348, y: 4, w: 130, h: 42, id: 'silenciar', activa: true, lineas: [{ s: String(sil.segundosRestantes), size: 22 }] })
      : tecla({ x: 348, y: 4, w: 130, h: 42, id: 'silenciar', lineas: [{ s: 'SILENCIAR', size: 14 }, { s: 'ALARMA', size: 14 }] }))
    ;
}

function filaInferior(e, menu, o) {
  const energia = e.energia;
  const ext = energia.fuente === 'externa';
  const neumo = e.neumotaco === 'infantil' ? 'INFANTIL' : e.neumotaco === 'pediatrico' ? 'PEDI' : '';
  const fuente = { CONTROL: TEXTOS.fuenteControl, ASISTIDA: TEXTOS.fuenteAsistida, ESPONT: TEXTOS.fuenteEspontanea, MANUAL: TEXTOS.fuenteManual }[e.fuenteRespiracion];
  const barraW = 56;
  const relleno = Math.max(0, Math.min(100, energia.bateriaPct)) / 100 * (barraW - 4);
  let s = rect(62, 300, 418, 60, C.navy);
  s += `<g data-tecla="fuente-inspiratoria">${zona(66, 304, 80, 52)}${txt(106, 321, fuente, { size: 12, anchor: 'middle' })}${neumo ? txt(106, 341, neumo, { size: 13, anchor: 'middle' }) : ''}</g>`;
  s += `<g data-tecla="energia"${!ext && !energia.bateriaConfirmada ? ' class="parpadeo"' : ''}>${zona(150, 304, 86, 52)}${txt(195, 320, ext ? TEXTOS.energiaExterna : TEXTOS.energiaBateria, { size: 12, anchor: 'middle', fill: ext ? C.blanco : C.ambar })}`
    + rect(167, 327, barraW, 14, C.blanco)
    + rect(169, 329, relleno.toFixed(1), 10, C.verde)
    + [1, 2, 3, 4].map((i) => `<line x1="${167 + i * barraW / 5}" x2="${167 + i * barraW / 5}" y1="336" y2="341" stroke="${C.navy}" stroke-width="1"/>`).join('')
    + `</g>`;
  const alarmas = menu === 'alarma1' || menu === 'alarma2';
  if (alarmas) {
    const sus = TECLAS_SIN_FUNCION.suspiroOff;
    s += `<g data-tecla="suspiro" role="button" tabindex="0" aria-expanded="${o.suspiroAbierto ? 'true' : 'false'}" aria-controls="nota-suspiro" aria-label="${esc(TEXTOS.suspiroOff)}: ${sus.funcional ? '' : 'sin función. '}Toque para ver la nota">`
      + `${txt(278, 322, 'SUSPIRO', { size: 13, anchor: 'middle' })}${txt(278, 340, 'OFF', { size: 13, anchor: 'middle' })}`
      + `<rect x="238" y="304" width="80" height="52" fill="transparent" pointer-events="all" stroke="${C.blanco}" stroke-width="${o.suspiroAbierto ? 2 : 0}" rx="2"/></g>`;
  } else {
    const aa = e.autoAjuste;
    s += tecla({ x: 240, y: 304, w: 78, h: 52, id: 'auto-ajuste', activa: aa.fase !== 'inactivo', atenuada: calcularDeshabilitados(e).has('autoAjuste'), lineas: aa.fase === 'calculando' ? [{ s: String(aa.respiraciones), size: 26 }] : [{ s: 'AUTO', size: 14 }, { s: 'AJUSTE', size: 14 }] });
  }
  if ((o.mostrarConfig || e.config.disponible) && menu === 'principal') {
    s += tecla({ x: 324, y: 304, w: 152, h: 52, id: 'config', lineas: [{ s: TEXTOS.configuracion, size: 22 }] });
  } else {
    s += `<g data-tecla="flecha-abajo">${flecha(362, 330, true)}</g><g data-tecla="flecha-arriba">${flecha(438, 330, false)}</g>`;
  }
  return s;
}

function valorParam(v, decimales = 0) {
  return v === null ? 'APAGADO' : (decimales ? Number(v).toFixed(decimales) : String(v));
}

function menuPrincipalOSecundario(e, menu, deshab) {
  const modo = e.modo, cf = e.flujoConstante, a = e.ajustes;
  const claveFrec = modo === 'SIMV' ? 'frecuenciaSimv' : modo === 'CPAP' ? 'frecuenciaRespaldo' : 'frecuencia';
  const etFrec = modo === 'SIMV' ? 'FREC SIMV' : modo === 'CPAP' ? 'FREC RESPALDO' : 'FREC';
  // INSP se programa; el VC resulta de la presión (17 ml x PICO) y no cambia con INSP, que solo afecta E e I/E.
  const t = calcularTiempos({ frecuencia: a[claveFrec], vc: a.vc, flujo: a.flujo, insp: a.insp, preferencia: 'INSP' });
  const sel = (k) => e.teclaSeleccionada === k;
  // El VC parpadea en rojo con la alarma de VCE (límites) o con la de flujo constante (VC >= 500 ml).
  const vcAlarma = condiciones(e).some((x) => x.id === 'vcFlujoConstante');
  const vcRojo = vcAlarma || parametrosEnAlarma(e).has('vce');
  const f = (n) => 52 + 62 * n; // inicio de cada fila (0..3)
  let s = rect(62, 50, 418, 250, C.azul);

  // Columna izquierda
  s += fila({ x: 66, w: 192, y: f(0), h: 62, id: 'frecuencia', etiqueta: etFrec, valor: claveFrec === 'frecuenciaSimv' ? Number(a[claveFrec]).toFixed(a[claveFrec] < 10 ? 1 : 0) : String(a[claveFrec]), sel: sel('frecuencia'), atenuada: deshab.has('frecuencia'), sizeEt: etFrec.length > 9 ? 14 : 17 });
  s += fila({ x: 66, w: 192, y: f(1), h: 62, id: 'insp', etiqueta: 'INSP', valor: a.insp.toFixed(2), sel: sel('insp') });
  const sinIE = deshab.has('relacionIE');
  s += `<g data-parte="tiempos"${sinIE ? ' opacity="0.45"' : ''}>`
    + txt(72, f(2) + 26, `VC = ${Math.round(a.vc)}`, { size: 14, fill: vcRojo ? C.rojo : C.blanco, extra: vcRojo ? ' class="parpadeo"' : '' })
    + txt(172, f(2) + 26, `E = ${t.e.toFixed(2)}`, { size: 14, fill: t.avisos.espiracion ? C.rojo : C.blanco })
    + txt(72, f(2) + 48, `I/E = ${t.ie}`, { size: 14, fill: t.avisos.relacionIE ? C.rojo : C.blanco })
    + `</g>`;
  s += fila({ x: 66, w: 192, y: f(3), h: 62, id: 'flujo', etiqueta: 'FLUJO', valor: a.flujo >= 10 ? String(Math.round(a.flujo)) : Number(a.flujo).toFixed(1), sel: sel('flujo') });

  // Teclas de modo (fila 1, derecha)
  const modoActivo = (m) => modo === m;
  s += tecla({ x: 262, y: f(0) + 9, w: 64, h: 44, id: 'modo-ac', activa: modoActivo('AC'), lineas: [{ s: cf ? 'CMV' : TEXTOS.modoAC, size: 18 }] });
  if (!cf) s += tecla({ x: 330, y: f(0) + 9, w: 62, h: 44, id: 'modo-simv', activa: modoActivo('SIMV'), lineas: [{ s: TEXTOS.modoSIMV, size: 18 }] });
  s += tecla({ x: 396, y: f(0) + 9, w: 82, h: 44, id: 'modo-cpap', activa: modoActivo('CPAP'), lineas: [{ s: TEXTOS.modoCPAP, size: 15 }, { s: TEXTOS.manual, size: 11 }] });

  if (menu === 'principal') {
    s += `<g data-tecla="flujo-constante">${zona(262, f(1) + 8, 134, 46)}${cf ? rect(262, f(1) + 8, 134, 46, C.amarillo) : ''}${txt(268, f(1) + 36, TEXTOS.flujoConstante, { size: 12, fill: cf ? C.negro : C.blanco })}</g>`;
    s += tecla({ x: 400, y: f(1) + 9, w: 78, h: 44, id: 'desact-neumo', fondo: C.azul, lineas: [{ s: 'DESACT', size: 11 }, { s: 'NEUMO', size: 11 }], borde: false });
    s += fila({ x: 262, w: 216, y: f(2), h: 62, id: 'disp-flujo', etiqueta: 'DISP. FLUJO', valor: valorParam(a.dispFlujo, 1), atenuada: deshab.has('dispFlujo'), sel: sel('dispFlujo'), sizeEt: 15, sizeVal: a.dispFlujo === null ? 14 : 22 });
    s += fila({ x: 262, w: 216, y: f(3), h: 62, id: 'disp-presion', etiqueta: 'DISP. PRES', valor: valorParam(a.dispPresion, 1), atenuada: deshab.has('dispPresion'), sel: sel('dispPresion'), sizeEt: 15, sizeVal: a.dispPresion === null ? 14 : 22 });
  } else {
    s += fila({ x: 262, w: 216, y: f(1), h: 62, id: 'soporte-presion', etiqueta: 'SOPORTE PRES', valor: valorParam(a.soportePresion), atenuada: deshab.has('soportePresion'), sel: sel('soportePresion'), sizeEt: 15, sizeVal: a.soportePresion === null ? 14 : 22 });
    const nebDis = deshab.has('nebulizador');
    const rest = e.nebulizadorEncendido ? e.nebRestante : 0;
    const mmss = `${String(Math.floor(rest / 60)).padStart(2, '0')}:${String(rest % 60).padStart(2, '0')}`;
    const selNeb = sel('nebulizador');
    s += `<g data-parte="nebulizador"${nebDis ? ' opacity="0.45"' : ''}>`
      + tecla({ x: 264, y: f(3) + 9, w: 64, h: 44, id: 'neb-estado', fondo: C.azul, activa: sel('nebEstado'), lineas: [{ s: 'NEB', size: 14 }, { s: e.nebulizadorEncendido ? 'ENC.' : 'APAG.', size: 12 }] })
      + txt(392, f(3) + 40, mmss, { size: 22, anchor: 'middle' })
      + `<g data-tecla="neb-tiempo">${zona(436, f(3) + 4, 42, 54)}${selNeb ? rect(436, f(3) + 8, 42, 46, C.amarillo) : ''}${txt(472, f(3) + 40, String(a.nebulizador), { size: 22, anchor: 'end', fill: selNeb ? C.negro : C.blanco })}</g>`
      + `</g>`;
  }
  return s;
}

function menuAlarmas(e, menu) {
  const claves = Object.keys(ALARMAS).filter((k) => ALARMAS[k].menu === menu);
  const activas = parametrosEnAlarma(e);
  let s = rect(62, 50, 418, 250, C.azul);
  s += txt(268, 84, TEXTOS.bajo, { size: 15, anchor: 'middle' }) + txt(444, 84, TEXTOS.alto, { size: 15, anchor: 'middle' });
  claves.forEach((k, i) => {
    const a = ALARMAS[k], l = e.limites[k];
    const y = 100 + i * 66;
    const cy = y + 33;
    const selB = e.teclaSeleccionada === `alarma:${k}:low`, selA = e.teclaSeleccionada === `alarma:${k}:high`;
    const viol = activas.has(k);
    const cond = condiciones(e).find((x) => x.clave === k);
    s += `<g data-parte="alarma-${k}">`
      + txt(70, cy + 2, a.etiqueta, { size: 19 })
      + txt(70, cy + 18, a.unidad, { size: 10, weight: 400 })
      + zona(224, y + 8, 88, 50, ` data-tecla="alarma:${k}:low"`)
      + (l.enabled ? zona(400, y + 8, 76, 50, ` data-tecla="alarma:${k}:high"`) : '')
      + (selB ? rect(224, y + 8, 88, 50, C.amarillo, ' pointer-events="none"') : '')
      + (selA ? rect(400, y + 8, 88 - 12, 50, C.amarillo, ' pointer-events="none"') : '')
      + txt(268, cy + 8, l.enabled ? String(l.low) : 'APAGADO', { size: l.enabled ? 24 : 14, anchor: 'middle', fill: selB ? C.negro : C.blanco })
      + txt(356, cy + 8, String(Math.round(e.medidos[k] * 10) / 10), { size: 24, anchor: 'middle', fill: viol ? C.rojo : C.blanco, extra: viol ? ' class="parpadeo"' : '' })
      + (cond ? txt(398, cy + 6, cond.lado === 'high' ? '▲' : '▼', { size: 14, anchor: 'middle', fill: C.rojo, extra: ' class="parpadeo"' }) : '')
      + (l.enabled ? txt(444, cy + 8, String(l.high), { size: 24, anchor: 'middle', fill: selA ? C.negro : C.blanco }) : '')
      + `</g>`;
  });
  return s;
}

function menuAlarma3(e) {
  const ids = new Set(condiciones(e).map((x) => x.id));
  const m = [];
  if (ids.has('falloVentilador')) m.push(`${TEXTOS.falloVentilador}  ${TEXTOS.fallos[e.fallo] || ''}`.trim());
  if (ids.has('bateriaBaja')) m.push(TEXTOS.bateriaBaja);
  if (ids.has('presionSuministro')) m.push(TEXTOS.bajaPresionSuministro);
  let s = rect(62, 50, 418, 250, C.azul);
  if (!m.length) return s + txt(271, 170, 'ALARMA 3', { size: 20, anchor: 'middle' }) + txt(271, 196, 'Aparece solo cuando ocurre la condición', { size: 12, anchor: 'middle', weight: 400 });
  m.forEach((t, i) => { s += rect(72, 70 + i * 70, 398, 56, C.rojo) + txt(271, 104 + i * 70, t, { size: t.length > 30 ? 14 : 20, anchor: 'middle', extra: ' class="parpadeo"' }); });
  return s;
}

// Menú CONFIG: elige si el menú principal ajusta VC o INSP (pág. 25). Calibración y servicio no se incluyen.
function menuConfig(e, opciones = {}) {
  let s = rect(0, 0, 480, 360, C.navy) + barraPresion(e, opciones.presionBarra);
  s += tecla({ x: 66, y: 4, w: 64, h: 42, id: 'menu-principal', lineas: [{ s: TEXTOS.principal, size: 16 }] });
  s += rect(62, 50, 418, 310, C.azul);
  s += txt(271, 92, TEXTOS.tituloConfig, { size: 22, anchor: 'middle' });
  s += txt(271, 118, 'El VC resulta de la presión; se programa INSP', { size: 13, anchor: 'middle', weight: 400 });
  s += tecla({ x: 90, y: 140, w: 360, h: 64, id: 'config-vc', activa: false, atenuada: true, fondo: C.navy, lineas: [{ s: TEXTOS.configVC, size: 20 }] });
  s += tecla({ x: 90, y: 220, w: 360, h: 64, id: 'config-insp', activa: true, fondo: C.navy, lineas: [{ s: TEXTOS.configInsp, size: 20 }] });
  s += txt(271, 322, 'Pulse PRINC para volver', { size: 13, anchor: 'middle', weight: 400 });
  return s;
}

export function renderPantalla(estado, opciones = {}) {
  const e = estado;
  if (!e.encendido || !e.retroiluminacion) return rect(0, 0, 480, 360, C.negro);
  if (e.menu === 'config' && !opciones.menu) return menuConfig(e, opciones);
  const menu = opciones.menu || e.menu;
  const deshab = calcularDeshabilitados(e);
  let s = rect(0, 0, 480, 360, C.navy) + barraPresion(e, opciones.presionBarra) + filaSuperior(e, menu);
  if (menu === 'principal' || menu === 'secundario') s += menuPrincipalOSecundario(e, menu, deshab);
  else if (menu === 'alarma1' || menu === 'alarma2') s += menuAlarmas(e, menu);
  else s += menuAlarma3(e);
  s += filaInferior(e, menu, opciones);
  return s;
}

export function renderPantallaSVG(estado, opciones = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" font-family="${FUENTE}">${renderPantalla(estado, opciones)}</svg>`;
}

// ---------- Equipo completo ----------
// Encuadres (viewBox): sin márgenes vacíos, o solo el bisel de la pantalla para leerla mejor en teléfonos.
export const ENCUADRES = {
  completo: '8 38 842 608',
  completoSinMezclador: '8 38 716 608',
  pantalla: '232 164 428 328',
};

function perilla({ cx, cy, etiqueta, valor, unidad, min, max, id }) {
  const texto = String(Math.round(valor * 10) / 10);
  const frac = (valor - min) / (max - min);
  const ang = -135 + 270 * frac;
  const marca = (deg, relleno) => {
    const r = 56, rad = (deg - 90) * Math.PI / 180;
    return `<circle cx="${(cx + r * Math.cos(rad)).toFixed(1)}" cy="${(cy + r * Math.sin(rad)).toFixed(1)}" r="4.5" fill="${relleno ? C.verde : C.carcasa}" stroke="${relleno ? '#1C7A30' : '#7A7566'}" stroke-width="1.5"/>`;
  };
  return `<g data-perilla="${id}" role="slider" tabindex="0" aria-orientation="vertical" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${texto}" aria-valuetext="${texto} ${esc(unidad)}" aria-label="${esc(etiqueta)}">`
    + `<circle data-centro cx="${cx}" cy="${cy}" r="58" fill="transparent" pointer-events="all"/>`
    + marca(-135, false) + marca(135, true)
    + `<circle cx="${cx}" cy="${cy}" r="44" fill="${C.asa}" stroke="${C.asaOscuro}" stroke-width="3"/>`
    + `<circle cx="${cx}" cy="${cy}" r="35" fill="#4C84C9" stroke="${C.asaOscuro}" stroke-width="2"/>`
    + `<g transform="rotate(${ang.toFixed(1)} ${cx} ${cy})"><rect x="${cx - 6}" y="${cy - 36}" width="12" height="72" rx="3" fill="${C.asaOscuro}"/><rect x="${cx - 3}" y="${cy - 36}" width="6" height="72" rx="2" fill="#7FB0E8"/></g>`
    + txt(cx, cy + 82, `${texto} ${unidad}`, { size: 11, anchor: 'middle', fill: '#4A4A44', weight: 400 })
    + txt(cx, cy + 66, etiqueta, { size: 12, anchor: 'middle', fill: '#33332E' })
    + `</g>`;
}

function logoMini() {
  return `<g transform="translate(62 170) scale(0.62)" fill="none" stroke="${MARCA.colores.primario}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="45" cy="45" r="32"/><path d="M34 62V28h13a9 9 0 0 1 0 18H34"/><path d="M80 45h6l4-9 6 18 4-9h5"/></g>`
    + txt(62, 238, MARCA.nombre.toUpperCase(), { size: 15, fill: MARCA.colores.oscuro, extra: ' letter-spacing="2.5"' })
    + txt(62, 254, `${MARCA.version} · ${MARCA.subtitulo}`, { size: 10, fill: MARCA.colores.suave, weight: 400, extra: ' letter-spacing="1.5"' });
}

function mezclador(e) {
  const o2 = e.medidos.o2;
  const cx = 764, cy = 252;
  const ang = (v) => -135 + 270 * (v - 21) / 79;
  let ticks = '';
  for (const v of [21, 40, 60, 80, 100]) {
    const a = (ang(v) - 90) * Math.PI / 180;
    ticks += `<line x1="${(cx + 36 * Math.cos(a)).toFixed(1)}" y1="${(cy + 36 * Math.sin(a)).toFixed(1)}" x2="${(cx + 42 * Math.cos(a)).toFixed(1)}" y2="${(cy + 42 * Math.sin(a)).toFixed(1)}" stroke="#555" stroke-width="1.5"/>`
      + txt((cx + 50 * Math.cos(a)).toFixed(1), (cy + 50 * Math.sin(a) + 3).toFixed(1), v, { size: 9, anchor: 'middle', fill: '#444', weight: 400 });
  }
  return `<g data-parte="mezclador">`
    + `<rect x="706" y="150" width="116" height="200" rx="10" fill="#F7F7F4" stroke="${C.carcasaBorde}" stroke-width="2"/>`
    + txt(764, 170, 'MEZCLADOR', { size: 10, anchor: 'middle', fill: '#555' }) + txt(764, 182, 'AIRE / OXÍGENO', { size: 9, anchor: 'middle', fill: '#555', weight: 400 })
    + `<g data-perilla="o2" role="slider" tabindex="0" aria-orientation="vertical" aria-valuemin="21" aria-valuemax="100" aria-valuenow="${o2}" aria-valuetext="${o2} %" aria-label="Oxígeno, mezclador">`
    + `<circle data-centro cx="${cx}" cy="${cy}" r="52" fill="transparent" pointer-events="all"/>`
    + `<circle cx="${cx}" cy="${cy}" r="31" fill="#5BA0D8" stroke="#2F6FA8" stroke-width="3"/>` + ticks
    + `<g transform="rotate(${ang(o2).toFixed(1)} ${cx} ${cy})"><rect x="${cx - 3}" y="${cy - 28}" width="6" height="28" rx="2" fill="#12395C"/></g>`
    + txt(cx, cy + 22, 'O₂ %', { size: 10, anchor: 'middle', fill: '#fff' })
    + `</g>`
    + `<rect x="730" y="350" width="20" height="40" rx="3" fill="${C.gris}"/><rect x="778" y="350" width="20" height="40" rx="3" fill="${C.gris}"/>`
    + `<path d="M740 390 C 740 440, 730 470, 702 478" fill="none" stroke="#D9DCDF" stroke-width="12" stroke-linecap="round"/>`
    + `<path d="M740 390 C 740 440, 730 470, 702 478" fill="none" stroke="#B7BCC1" stroke-width="12" stroke-linecap="round" stroke-dasharray="3 5"/>`
    + `<rect x="822" y="236" width="22" height="32" rx="3" fill="#B8BDC2"/>`
    + `</g>`;
}

export function renderVentilador(estado, opciones = {}) {
  const e = estado;
  const alarmaActiva = e.encendido && condiciones(e).length > 0;
  const cuerpo = `
  <rect x="26" y="316" width="16" height="26" rx="4" fill="${C.gris}"/><rect x="30" y="360" width="12" height="14" rx="3" fill="${C.gris}"/>
  <rect x="16" y="404" width="26" height="52" rx="7" fill="#B7BCC1"/>
  <path d="M130 140 V76 Q130 56 150 56 H590 Q610 56 610 76 V140" fill="none" stroke="${C.asa}" stroke-width="26" stroke-linecap="round"/>
  <path d="M130 140 V76 Q130 56 150 56 H590 Q610 56 610 76 V140" fill="none" stroke="${C.asaOscuro}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
  <rect x="42" y="140" width="660" height="500" rx="24" fill="${C.carcasa}" stroke="${C.carcasaBorde}" stroke-width="3"/>
  <rect x="292" y="130" width="18" height="10" rx="3" fill="${alarmaActiva ? '#FF2A2A' : '#7E1B1B'}"${alarmaActiva ? ' class="parpadeo"' : ''}/>
  ${logoMini()}
  <rect x="236" y="168" width="420" height="320" rx="12" fill="${C.bisel}"/>
  <clipPath id="clip-pantalla"><rect x="248" y="180" width="396" height="297" rx="3"/></clipPath>
  <g clip-path="url(#clip-pantalla)"><g transform="translate(248 180) scale(0.825)">${renderPantalla(e, opciones)}</g></g>
  ${perilla({ cx: 266, cy: 546, etiqueta: 'PRES MÁX', valor: e.ajustes.presionMaxima, unidad: 'cmH2O', min: 0, max: 80, id: 'presion-maxima' })}
  ${perilla({ cx: 396, cy: 546, etiqueta: 'PEEP', valor: e.ajustes.peep, unidad: 'cmH2O', min: 0, max: 20, id: 'peep' })}
  ${perilla({ cx: 526, cy: 546, etiqueta: 'FLUJO', valor: e.ajustes.flujo, unidad: 'L/min', min: 1, max: 50, id: 'flujo' })}
  ${txt(690, 600, MARCA.nombreCompleto, { size: 15, anchor: 'end', fill: '#33332E', extra: ' letter-spacing="0.5"' })}
  ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<circle cx="${640 + c * 12}" cy="${506 + r * 12}" r="2.6" fill="#A9A599"/>`).join('')).join('')}
  <rect x="702" y="440" width="14" height="40" rx="3" fill="#B8BDC2"/>`;
  const mez = opciones.mezclador === false ? '' : mezclador(e);
  const conMezclador = opciones.mezclador !== false;
  const vb = opciones.encuadre === 'pantalla' ? ENCUADRES.pantalla : (conMezclador ? ENCUADRES.completo : ENCUADRES.completoSinMezclador);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" font-family="${FUENTE}" role="group" aria-label="${esc(MARCA.nombreCompleto)}, simulador educativo de ventilador de transporte"><title>${esc(MARCA.nombreCompleto)}</title>${mez}${cuerpo}</svg>`;
}
