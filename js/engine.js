// Motor de simulación: condiciones de alarma, menú automático, AUTO AJUSTE y patrón sonoro. Sin DOM ni audio.
// Los valores medidos se derivan de los ajustes (js/dynamics.js); el instructor puede modificarlos desde su panel. El motor no modela fisiología.
import { ALARMAS, AUTO_AJUSTE, CODIGOS_SONOROS, FLUJO_CONSTANTE, TEXTOS } from './config.js';
import { calcularDeshabilitados } from './state.js';
import { frecuenciaAlarma } from './dynamics.js';
import { calcularTiempos, redondear } from './utils.js';

const clonar = (e) => structuredClone(e);

// Clave de bloqueo (Apéndice C) que desactiva la alarma de cada parámetro.
const BLOQUEO_ALARMA = { frecuencia: 'alarmaFrecuencia', vce: 'vce', vme: 'vme', media: 'media' };
// Orden de prioridad (0 = más urgente).
const PRIORIDAD = { falloVentilador: 0, presionSuministro: 1, bateriaBaja: 1, modoBateria: 2, limite: 3, vcFlujoConstante: 4 };

// Valor que se compara con los límites. La FREC no incluye el aumento de DISP. FLUJO (esa función no genera alarmas).
export const valorParaAlarma = (estado, clave) => (clave === 'frecuencia' ? frecuenciaAlarma(estado) : estado.medidos[clave]);

// Lista de condiciones de alarma vigentes, ordenadas por prioridad.
// Cada una: { id, tipo, menu, clave?, lado?, silenciable }
export function condiciones(estado) {
  if (!estado.encendido) return [];
  const c = [];
  const dis = calcularDeshabilitados(estado);
  const e = estado.energia;
  if (estado.fallo) c.push({ id: 'falloVentilador', tipo: 'falloVentilador', menu: 'alarma3', silenciable: true });
  if (!e.presionGasOk) c.push({ id: 'presionSuministro', tipo: 'presionSuministro', menu: 'alarma3', silenciable: true });
  if (e.fuente === 'bateria' && e.bateriaPct <= 20) c.push({ id: 'bateriaBaja', tipo: 'bateriaBaja', menu: 'alarma3', silenciable: true });
  // Al pasar a batería suena hasta que se confirma con la tecla BATERÍA; la tecla SILENCIAR no la calla (pág. 25).
  if (e.fuente === 'bateria' && !e.bateriaConfirmada) c.push({ id: 'modoBateria', tipo: 'modoBateria', menu: null, silenciable: false });

  for (const clave of Object.keys(ALARMAS)) {
    const l = estado.limites[clave];
    if (!l.enabled) continue;
    if (BLOQUEO_ALARMA[clave] && dis.has(BLOQUEO_ALARMA[clave])) continue; // p. ej. con flujo constante
    const v = valorParaAlarma(estado, clave);
    let lado = null;
    if (v < l.low) {
      // La presión máxima baja está inactiva en respiraciones espontáneas y en CPAP (pág. 22).
      const espontanea = estado.modo === 'CPAP' || estado.fuenteRespiracion === 'ESPONT';
      if (!(clave === 'pico' && espontanea)) lado = 'low';
    } else if (v > l.high) lado = 'high';
    if (lado) c.push({ id: `${clave}:${lado}`, tipo: 'limite', menu: ALARMAS[clave].menu, clave, lado, silenciable: true });
  }

  if (estado.flujoConstante) { // pág. 17: con flujo constante, VC >= 500 ml parpadea y suena
    const t = calcularTiempos({ frecuencia: estado.ajustes.frecuencia, vc: estado.ajustes.vc, flujo: estado.ajustes.flujo, insp: estado.ajustes.insp, preferencia: 'INSP' });
    if (t.vc >= FLUJO_CONSTANTE.vcAlarmaMl) c.push({ id: 'vcFlujoConstante', tipo: 'vcFlujoConstante', menu: null, silenciable: true });
  }
  return c.sort((a, b) => PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo]);
}

// Claves de parámetros con límite violado, para resaltarlos en rojo.
export function parametrosEnAlarma(estado) {
  return new Set(condiciones(estado).filter((x) => x.clave).map((x) => x.clave));
}

// Recalcula las alarmas tras cualquier cambio: cancela el silencio ante alarmas nuevas y cambia de menú automáticamente.
export function sincronizar(estado) {
  const act = condiciones(estado);
  const ids = act.map((x) => x.id);
  const previas = estado.alarmas.activas;
  const nuevas = previas === null ? [] : ids.filter((i) => !previas.includes(i));
  const igual = previas !== null && previas.length === ids.length && nuevas.length === 0;

  const menusActivos = new Set(act.map((x) => x.menu).filter(Boolean));
  const s = clonar(estado);
  s.alarmas = { activas: ids };
  if (!estado.encendido) return igual ? estado : s;

  // Una alarma nueva cancela el silencio (pág. 23).
  if (nuevas.length && s.silencio.activo) s.silencio = { activo: false, segundosRestantes: 0 };
  if (nuevas.length && !s.retroiluminacion) s.retroiluminacion = true; // una alarma enciende la pantalla (pág. 16)

  if (s.menu !== 'config') {
    // Las alarmas de límite (Alarma 1 y 2) NO cambian la pantalla: solo parpadean su pestaña y el valor en rojo hasta que se
    // resuelven. Únicamente Alarma 3 (fallos y energía), que no tiene pestaña, se muestra sola mientras dura la condición.
    const cambiar = (m) => { if (s.menu !== m) { s.menu = m; s.teclaSeleccionada = null; s.seleccionRestante = 0; } };
    if (nuevas.some((i) => act.find((x) => x.id === i && x.menu === 'alarma3'))) cambiar('alarma3');
    else if (s.menu === 'alarma3' && !menusActivos.has('alarma3')) cambiar('principal');
  }
  const sinCambios = JSON.stringify(s) === JSON.stringify(estado);
  return sinCambios ? estado : s;
}

// Motivo de cada alarma activa, para mostrarlo junto al equipo. Cada una: { id, menu, nivel, texto, causa }.
const CAUSA = {
  pico: 'La PICO resulta de la perilla PRES MÁX (o del valor del instructor).',
  vce: 'El VC resulta de la presión: 17 ml × PICO (PRES MÁX).',
  vme: 'El VME es VCE × FREC.',
  frecuencia: 'La FREC resulta de la frecuencia programada.',
  peep: 'La PEEP resulta de la perilla PEEP.',
  media: 'La presión media la fija el instructor.',
  o2: 'El oxígeno resulta de la perilla del mezclador (FiO2).',
};
export function motivosAlarma(estado) {
  return condiciones(estado).map((x) => {
    if (x.tipo === 'limite') {
      const a = ALARMAS[x.clave];
      const l = estado.limites[x.clave];
      const v = Math.round(valorParaAlarma(estado, x.clave) * 10) / 10;
      const texto = x.lado === 'high'
        ? `${a.etiqueta} ALTO: ${v} ${a.unidad}, por encima del límite ${l.high}`
        : `${a.etiqueta} BAJO: ${v} ${a.unidad}, por debajo del límite ${l.low}`;
      return { id: x.id, menu: x.menu, nivel: 'limite', lado: x.lado, clave: x.clave, texto, causa: CAUSA[x.clave], pestana: x.menu === 'alarma1' ? TEXTOS.alarma1 : TEXTOS.alarma2 };
    }
    const texto = { falloVentilador: TEXTOS.fallos?.[estado.fallo] ? `FALLO DEL VENTILADOR: ${TEXTOS.fallos[estado.fallo]}` : 'FALLO DEL VENTILADOR', presionSuministro: 'BAJA PRESIÓN DE SUMINISTRO DE GAS', bateriaBaja: `BATERÍA BAJA: ${estado.energia.bateriaPct} %`, modoBateria: 'FUNCIONA CON BATERÍA: confirme con la tecla BATERÍA', vcFlujoConstante: 'VC IGUAL O MAYOR A 500 ML CON FLUJO CONSTANTE' }[x.tipo];
    return { id: x.id, menu: x.menu, nivel: 'sistema', texto, causa: null, pestana: null };
  });
}

// Menús (Alarma 1 o 2) con alarma activa distintos del que se muestra: sus teclas parpadean si hay silencio.
export function menusConAlarmaOculta(estado) {
  if (!estado.silencio.activo) return new Set();
  return new Set(condiciones(estado).map((x) => x.menu).filter((m) => (m === 'alarma1' || m === 'alarma2') && m !== estado.menu));
}

// ---------- Sonido ----------
// Devuelve null (silencio) o { id, codigo }: codigo = [largos, cortos] | 'continuo' | 'generico'.
export function patronSonoro(estado) {
  const audibles = condiciones(estado).filter((x) => !(x.silenciable && estado.silencio.activo));
  if (!audibles.length) return null;
  const top = audibles[0];
  let codigo = 'generico';
  if (top.tipo === 'falloVentilador') codigo = CODIGOS_SONOROS[estado.fallo];
  else if (top.tipo === 'presionSuministro') codigo = CODIGOS_SONOROS.bajaPresionSuministro;
  else if (top.tipo === 'bateriaBaja' || top.tipo === 'modoBateria') codigo = CODIGOS_SONOROS.bajaBateria;
  return { id: top.id, codigo };
}

// ---------- AUTO AJUSTE (pág. 24) ----------
// Se pulsa dos veces en 5 s; luego promedia 5 respiraciones y fija los límites alrededor de los valores medidos.
export function pulsarAutoAjuste(estado) {
  if (calcularDeshabilitados(estado).has('autoAjuste')) return { estado, tono: 'error', aviso: TEXTOS.avisoAutoAjusteInactivo };
  const a = estado.autoAjuste;
  const s = clonar(estado);
  if (a.fase === 'inactivo') {
    s.autoAjuste = { fase: 'armado', ventana: AUTO_AJUSTE.ventanaPulsacionesSeg, respiraciones: 0, progreso: 0 };
    return { estado: s, tono: 'tecla', aviso: TEXTOS.avisoAutoAjusteArmado };
  }
  if (a.fase === 'armado') {
    s.autoAjuste = { fase: 'calculando', ventana: 0, respiraciones: AUTO_AJUSTE.respiraciones, progreso: 0 };
    return { estado: s, tono: 'tecla', aviso: TEXTOS.avisoAutoAjusteCalculando };
  }
  return { estado, tono: 'tecla' };
}

export function cancelarAutoAjuste(estado) {
  if (estado.autoAjuste.fase === 'inactivo') return estado;
  const s = clonar(estado);
  s.autoAjuste = { fase: 'inactivo', ventana: 0, respiraciones: 0, progreso: 0 };
  return s;
}

const acotar = (clave, lado, v) => Math.min(ALARMAS[clave][lado][1], Math.max(ALARMAS[clave][lado][0], Math.round(v)));

export function aplicarAutoAjuste(estado) {
  const s = clonar(estado);
  const cfg = AUTO_AJUSTE[s.modo];
  for (const clave of ['pico', 'frecuencia', 'peep', 'o2']) {
    const spec = cfg[clave];
    const l = s.limites[clave];
    if (!spec || !l.enabled) continue; // una alarma desactivada no se reconfigura
    const m = s.medidos[clave];
    let low; let high;
    if (spec.tipo === 'pct') { low = m * (1 - spec.v / 100); high = m * (1 + spec.v / 100); }
    else if (spec.tipo === 'abs') { low = m - spec.v; high = m + spec.v; }
    else { low = ALARMAS[clave].low[0]; high = ALARMAS[clave].high[1]; } // extremos
    low = acotar(clave, 'low', low); high = acotar(clave, 'high', high);
    if (low >= high) { if (high - 1 >= ALARMAS[clave].low[0]) low = high - 1; else high = low + 1; }
    l.low = low; l.high = high;
  }
  for (const clave of AUTO_AJUSTE.apagados) s.limites[clave].enabled = false; // MEDIA queda en APAGADO
  s.autoAjuste = { fase: 'inactivo', ventana: 0, respiraciones: 0, progreso: 0 };
  return s;
}

// Avance del reloj del motor. Cada respiración dura 60 / frecuencia medida (entre 0,3 y 60 s).
export function avanzarMotor(estado, segundos = 1) {
  if (!estado.encendido) return estado;
  const a = estado.autoAjuste;
  if (a.fase === 'inactivo') return estado;
  const s = clonar(estado);
  if (a.fase === 'armado') {
    s.autoAjuste.ventana -= segundos;
    if (s.autoAjuste.ventana <= 0) s.autoAjuste = { fase: 'inactivo', ventana: 0, respiraciones: 0, progreso: 0 };
    return s;
  }
  const periodo = Math.min(60, Math.max(0.3, redondear(60 / Math.max(s.medidos.frecuencia, 1), 3)));
  s.autoAjuste.progreso += segundos;
  while (s.autoAjuste.progreso >= periodo && s.autoAjuste.respiraciones > 0) {
    s.autoAjuste.progreso -= periodo;
    s.autoAjuste.respiraciones -= 1;
  }
  return s.autoAjuste.respiraciones === 0 ? aplicarAutoAjuste(s) : s;
}
