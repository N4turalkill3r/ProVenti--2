// Lógica de operación de teclas, flechas y perillas. Sin DOM.
// Cada función devuelve { estado, aviso?, tono? }. tono: 'tecla' | 'limite' | 'error' (el audio se conecta en otra fase).
import { PARAMETROS, ALARMAS, TEMPORIZADORES, TEXTOS, NEB, O2_PERILLA } from './config.js';
import {
  calcularDeshabilitados, fijarParametro, pasoParametro, fijarModo, alternarFlujoConstante,
  fijarLimiteAlarma, limitesEfectivos,
} from './state.js';
import { redondear } from './utils.js';
import { pulsarAutoAjuste, cancelarAutoAjuste } from './engine.js';

const ok = (estado, extra = {}) => ({ estado, tono: 'tecla', ...extra });
const rechazo = (estado, aviso, tono = 'error') => ({ estado, aviso, tono });
const clonar = (e) => structuredClone(e);

// Tecla de pantalla -> selección lógica (lo que se resalta en amarillo).
const SELECCION = {
  frecuencia: 'frecuencia', insp: 'insp', // el VC ya no se programa: resulta de la presión
  'disp-flujo': 'dispFlujo', 'disp-presion': 'dispPresion', 'soporte-presion': 'soportePresion',
  'neb-estado': 'nebEstado', 'neb-tiempo': 'nebulizador',
};
// Selección -> clave de bloqueo de las reglas del Apéndice C.
const BLOQUEO_DE = { frecuencia: 'frecuencia', dispFlujo: 'dispFlujo', dispPresion: 'dispPresion', soportePresion: 'soportePresion', nebEstado: 'nebulizador', nebulizador: 'nebulizador' };
const APAGABLES = ['dispFlujo', 'dispPresion', 'soportePresion'];
// Teclas que siguen activas con la pantalla bloqueada (pág. 25).
const SIEMPRE_ACTIVAS = ['menu-principal', 'menu-secundario', 'menu-alarmas', 'silenciar', 'bloqueo'];
const CONSERVAN_CONFIG = ['silenciar', 'energia', 'config'];

export function claveFrecuencia(estado) {
  return estado.modo === 'SIMV' ? 'frecuenciaSimv' : estado.modo === 'CPAP' ? 'frecuenciaRespaldo' : 'frecuencia';
}

function claveDeSeleccion(estado, sel) {
  if (sel === 'frecuencia') return claveFrecuencia(estado);
  return sel;
}

function seleccionar(estado, sel) {
  const s = clonar(estado);
  if (s.teclaSeleccionada === sel) { // pulsar de nuevo la tecla la deselecciona
    s.teclaSeleccionada = null; s.seleccionRestante = 0;
  } else {
    s.teclaSeleccionada = sel; s.seleccionRestante = TEMPORIZADORES.seleccionAuto;
  }
  return ok(s);
}

function cambiarMenu(estado, menu) {
  const s = clonar(estado);
  const veniaDeConfig = s.menu === 'config';
  s.menu = menu; s.teclaSeleccionada = null; s.seleccionRestante = 0;
  if (veniaDeConfig && menu === 'principal') { // al volver de CONFIG se silencia 60 s (pág. 23)
    s.config.abierto = false; s.config.disponible = false; s.configRestante = 0;
    s.silencio = { activo: true, segundosRestantes: TEMPORIZADORES.silencio };
  }
  return ok(s);
}

// Silencio: reposo -> 60 s -> 120 s -> cancelar. Con >= 61 s restantes se cancela con una pulsación; con <= 60 s hacen falta dos.
function ciclarSilencio(estado) {
  const s = clonar(estado);
  const sil = s.silencio;
  if (!sil.activo) s.silencio = { activo: true, segundosRestantes: TEMPORIZADORES.silencio };
  else if (sil.segundosRestantes >= 61) s.silencio = { activo: false, segundosRestantes: 0 };
  else s.silencio = { activo: true, segundosRestantes: TEMPORIZADORES.silencioDoble };
  return ok(s);
}

function pulsarBloqueo(estado) {
  const s = clonar(estado);
  if (!s.bloqueado) {
    s.bloqueado = true; s.teclaSeleccionada = null; s.seleccionRestante = 0;
    return ok(s, { aviso: TEXTOS.avisoBloqueadoAhora });
  }
  if (s.bloqueoPendiente > 0) { // segunda pulsación dentro de 5 s
    s.bloqueado = false; s.bloqueoPendiente = 0;
    return ok(s, { aviso: TEXTOS.avisoDesbloqueado });
  }
  s.bloqueoPendiente = TEMPORIZADORES.bloqueoDesbloqueo;
  return ok(s, { aviso: TEXTOS.avisoBloqueoConfirmar });
}

// Nebulizador: se enciende o apaga con una flecha cuando está seleccionada la tecla NEB (pág. 19).
export function alternarNebulizador(estado) {
  if (calcularDeshabilitados(estado).has('nebulizador')) return rechazo(estado, TEXTOS.avisoNoDisponible);
  const s = clonar(estado);
  if (s.nebulizadorEncendido) {
    s.nebulizadorEncendido = false; s.nebRestante = 0;
    return ok(s, { aviso: TEXTOS.avisoNebApagadoAhora });
  }
  s.nebulizadorEncendido = true;
  s.nebRestante = Math.round(s.ajustes.nebulizador * 60);
  if (s.ajustes.insp < NEB.inspMin) s.ajustes.insp = NEB.inspMin; // INSP mínimo 0,2 s con nebulizador
  return ok(s, { aviso: TEXTOS.avisoNebEncendido });
}

export function pulsarTecla(estado, id) {
  if (!estado.encendido) return rechazo(estado, TEXTOS.avisoApagado);
  if (estado.bloqueado && !SIEMPRE_ACTIVAS.includes(id)) return rechazo(estado, TEXTOS.avisoBloqueado);
  if (estado.menu === 'config' && !['menu-principal', 'config-vc', 'config-insp'].includes(id)) return rechazo(estado, '', 'tecla');

  let base = estado;
  // Cualquier tecla distinta de SILENCIAR o BATERÍA sustituye CONFIG por las flechas.
  if (estado.config.disponible && !CONSERVAN_CONFIG.includes(id)) {
    base = clonar(estado); base.config.disponible = false; base.configRestante = 0;
  }

  if (id.startsWith('alarma:')) { // alarma:<clave>:<low|high>
    if (base.menu !== 'alarma1' && base.menu !== 'alarma2') return ok(base);
    return seleccionar(base, id);
  }
  if (SELECCION[id]) {
    const sel = SELECCION[id];
    const bloqueo = BLOQUEO_DE[sel];
    if (bloqueo && calcularDeshabilitados(base).has(bloqueo)) return rechazo(estado, TEXTOS.avisoNoDisponible);
    return seleccionar(base, sel);
  }

  switch (id) {
    case 'menu-principal': return cambiarMenu(base, 'principal');
    case 'menu-secundario': return cambiarMenu(base, 'secundario');
    case 'menu-alarmas': return cambiarMenu(base, base.menu === 'alarma1' ? 'alarma2' : 'alarma1');
    case 'bloqueo': return pulsarBloqueo(base);
    case 'silenciar': return ciclarSilencio(base);
    case 'config': {
      const s = clonar(base); s.menu = 'config'; s.config.abierto = true; s.config.disponible = false; s.configRestante = 0;
      s.teclaSeleccionada = null; s.seleccionRestante = 0;
      return ok(s);
    }
    case 'config-vc': return rechazo(estado, TEXTOS.avisoVcResultado, 'tecla'); // el VC resulta de la presión
    case 'config-insp': return ok(base);
    case 'vc': return rechazo(estado, TEXTOS.avisoVcResultado, 'tecla');
    case 'modo-ac': case 'modo-simv': case 'modo-cpap': {
      const modo = { 'modo-ac': 'AC', 'modo-simv': 'SIMV', 'modo-cpap': 'CPAP' }[id];
      const r = fijarModo(base, modo);
      if (!r.ok) return rechazo(estado, r.error);
      r.estado.fuenteRespiracion = modo === 'CPAP' ? 'ESPONT' : 'CONTROL'; // el motor lo actualizará con cada respiración
      r.estado.teclaSeleccionada = null; r.estado.seleccionRestante = 0;
      return ok(cancelarAutoAjuste(r.estado)); // pulsar un modo cancela el AUTO AJUSTE en curso
    }
    case 'flujo-constante': {
      const r = alternarFlujoConstante(base, !base.flujoConstante);
      if (!r.ok) return rechazo(estado, r.error);
      r.estado.teclaSeleccionada = null; r.estado.seleccionRestante = 0;
      return ok(r.estado);
    }
    case 'flujo': return rechazo(estado, TEXTOS.avisoUsePerillaFlujo, 'tecla');
    case 'desact-neumo': case 'suspiro': return ok(base, id === 'desact-neumo' ? { aviso: TEXTOS.avisoSinFuncion } : {});
    case 'auto-ajuste': return pulsarAutoAjuste(base);
    case 'energia': {
      if (base.energia.fuente !== 'bateria' || base.energia.bateriaConfirmada) return ok(base);
      const s = clonar(base); s.energia.bateriaConfirmada = true;
      return ok(s, { aviso: TEXTOS.avisoBateriaConfirmada });
    }
    case 'flecha-arriba': return pulsarFlecha(base, 1);
    case 'flecha-abajo': return pulsarFlecha(base, -1);
    default: return ok(base);
  }
}

function pasoAlarma(estado, clave, lado, dir) {
  const a = ALARMAS[clave];
  const l = estado.limites[clave];
  const paso = a.paso || 1;
  const [min, max] = a[lado];
  if (lado === 'low' && !l.enabled) { // desde APAGADO, subir devuelve el límite al mínimo
    if (dir < 0) return { estado, tono: 'limite', aviso: TEXTOS.avisoLimite };
    return fijarLimiteAlarma(estado, clave, 'low', min);
  }
  const actual = l[lado];
  if (dir < 0 && lado === 'low' && actual <= min && a.apagable) return fijarLimiteAlarma(estado, clave, 'low', null);
  const nuevo = redondear(Math.min(max, Math.max(min, actual + dir * paso)));
  if (nuevo === actual) return { ok: false, estado, tono: 'limite', aviso: TEXTOS.avisoLimite };
  return fijarLimiteAlarma(estado, clave, lado, nuevo);
}

export function pulsarFlecha(estado, direccion) {
  if (!estado.encendido) return rechazo(estado, TEXTOS.avisoApagado);
  if (estado.bloqueado) return rechazo(estado, TEXTOS.avisoBloqueado);
  const sel = estado.teclaSeleccionada;
  if (!sel) return rechazo(estado, TEXTOS.avisoSeleccione, 'tecla');

  let r;
  if (sel === 'nebEstado') {
    r = alternarNebulizador(estado);
  } else if (sel.startsWith('alarma:')) {
    const [, clave, lado] = sel.split(':');
    r = pasoAlarma(estado, clave, lado, direccion);
  } else if (sel === 'nebulizador' && estado.nebulizadorEncendido) {
    return rechazo(estado, TEXTOS.avisoNebApagado);
  } else {
    const clave = claveDeSeleccion(estado, sel);
    const actual = estado.ajustes[clave];
    const { min } = limitesEfectivos(estado, clave);
    if (APAGABLES.includes(clave) && direccion < 0 && (actual === null || actual <= min)) {
      r = actual === null ? { ok: false, estado, tono: 'limite', aviso: TEXTOS.avisoLimite } : fijarParametro(estado, clave, null);
    } else {
      r = pasoParametro(estado, clave, direccion);
      if (r.ok && r.limiteAlcanzado) { r.tono = 'limite'; r.aviso = TEXTOS.avisoLimite; }
    }
  }
  if (r.ok === false) return { estado, tono: r.tono || 'error', aviso: r.aviso || r.error };
  const s = clonar(r.estado);
  s.seleccionRestante = TEMPORIZADORES.seleccionAuto; // cada pulsación reinicia los 30 s
  return { estado: s, tono: r.tono || 'tecla', aviso: r.aviso };
}

// Perillas físicas: presión máxima (PICO), PEEP, flujo y oxígeno. Se ajustan siempre, aun con la pantalla bloqueada.
export function paso(clave, valor) {
  return clave === 'flujo' && valor < 10 ? 0.1 : 1;
}

export function girarMando(estado, clave, valor) {
  if (!estado.encendido) return rechazo(estado, TEXTOS.avisoApagado);
  if (clave === 'o2') { // perilla del mezclador: cambia el O2 que mide el menú de alarmas
    const v = Math.round(Math.min(O2_PERILLA.max, Math.max(O2_PERILLA.min, valor)));
    if (v === estado.medidos.o2) return { estado, tono: null };
    const s = clonar(estado); s.medidos.o2 = v;
    return { estado: s, tono: v === O2_PERILLA.min || v === O2_PERILLA.max ? 'limite' : 'tecla' };
  }
  if (!PARAMETROS[clave] || !PARAMETROS[clave].soloPerilla) return rechazo(estado, TEXTOS.avisoNoDisponible);
  const { min, max } = limitesEfectivos(estado, clave);
  const acotado = Math.min(max, Math.max(min, valor));
  const nuevo = redondear(Math.round(acotado / paso(clave, acotado)) * paso(clave, acotado));
  if (nuevo === estado.ajustes[clave]) return { estado, tono: null };
  const r = fijarParametro(estado, clave, Math.min(max, Math.max(min, nuevo)));
  if (!r.ok) return rechazo(estado, r.error);
  const llegaALimite = nuevo === min || nuevo === max;
  return { estado: r.estado, tono: llegaALimite ? 'limite' : 'tecla' };
}

// Avance del reloj (por defecto 1 s). Sin DOM, para poder probarlo.
export function avanzarTiempo(estado, segundos = 1) {
  if (!estado.encendido) return estado;
  const s = clonar(estado);
  let cambio = false;
  const bajar = (campo) => { if (s[campo] > 0) { s[campo] = Math.max(0, s[campo] - segundos); cambio = true; } };
  if (s.silencio.activo) {
    s.silencio.segundosRestantes -= segundos; cambio = true;
    if (s.silencio.segundosRestantes <= 0) s.silencio = { activo: false, segundosRestantes: 0 };
  }
  bajar('bloqueoPendiente'); bajar('configRestante');
  if (s.configRestante === 0 && s.config.disponible && cambio) s.config.disponible = false;
  if (s.seleccionRestante > 0) {
    s.seleccionRestante = Math.max(0, s.seleccionRestante - segundos); cambio = true;
    if (s.seleccionRestante === 0) s.teclaSeleccionada = null;
  }
  if (s.nebulizadorEncendido) {
    s.nebRestante = Math.max(0, s.nebRestante - segundos); cambio = true;
    if (s.nebRestante === 0) s.nebulizadorEncendido = false;
  }
  return cambio ? s : estado;
}

export function apagarRetroiluminacion(estado) {
  if (!estado.encendido) return { estado };
  const s = clonar(estado); s.retroiluminacion = false;
  return { estado: s, aviso: TEXTOS.avisoRetroiluminacion, tono: 'tecla' };
}
export function encenderRetroiluminacion(estado) {
  const s = clonar(estado); s.retroiluminacion = true;
  return { estado: s };
}
