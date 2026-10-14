// Estado y reglas de validación. Sin DOM. Todas las funciones devuelven un estado nuevo.
import { PARAMETROS, ALARMAS, DINAMICA, TEXTOS, MEDIDOS_RANGO, CODIGOS_SONOROS, LIMITES_PREDETERMINADOS, MEDIDOS_INICIALES, REGLAS_DESHABILITADO, FLUJO_CONSTANTE, NEB, TEMPORIZADORES } from './config.js';
import { limitar, redondear, pasoPara } from './utils.js';
import { derivarMedidos, aumentoPorDispFlujo, picoDesdeVc } from './dynamics.js';

export function crearEstadoInicial() {
  const limites = {};
  for (const [k, v] of Object.entries(LIMITES_PREDETERMINADOS)) limites[k] = { low: v.low, high: v.high, enabled: true };
  const estado = {
    encendido: false,
    modo: 'AC',                    // AC | SIMV | CPAP
    flujoConstante: false,
    menu: 'principal',             // principal | secundario | alarma1 | alarma2 | alarma3
    teclaSeleccionada: null,
    bloqueado: false,
    silencio: { activo: false, segundosRestantes: 0 },
    config: { disponible: false, abierto: false, preferenciaVcInsp: 'INSP' }, // el VC resulta de la presión: ya no se programa
    ajustes: Object.fromEntries(Object.entries(PARAMETROS).map(([k, p]) => [k, p.defecto])),
    nebulizadorEncendido: false,
    neumotaco: 'ninguno',          // ninguno | infantil | pediatrico | incorrecto
    limites,
    medidos: { ...MEDIDOS_INICIALES }, // derivados de los ajustes (dynamics.js); el instructor puede modificarlos desde su panel
    respiracion: { n: 0, varPresion: 0, varVc: 0 }, // variaciones aleatorias de la respiración en curso
    aumentoFrecPct: 0,             // aumento de FREC por DISP. FLUJO (0, 5, 10 o 15 %), fijo hasta el siguiente cambio
    fuenteRespiracion: 'CONTROL',  // CONTROL | ASISTIDA | ESPONT | MANUAL
    energia: { fuente: 'externa', bateriaPct: 100, presionGasOk: true, bateriaConfirmada: true },
    fallo: null,                   // clave de CODIGOS_SONOROS (solenoides, transductor...) o null
    alarmas: { activas: [] },      // ids de las condiciones de alarma vigentes (las calcula engine.js)
    autoAjuste: { fase: 'inactivo', ventana: 0, respiraciones: 0, progreso: 0 },
    retroiluminacion: true,
    // Temporizadores de operación (segundos restantes; 0 = inactivo)
    seleccionRestante: 0,
    bloqueoPendiente: 0,          // ventana para confirmar el desbloqueo
    configRestante: 0,
    nebRestante: 0,
  };
  return derivarMedidos(estado);
}

// Encendido: recupera los ajustes guardados; silencio automático de 60 s; CONFIG disponible 30 s (pág. 23 y 25).
export function encender(estado) {
  const s = clonar(estado);
  s.encendido = true;
  s.menu = 'principal';
  s.teclaSeleccionada = null;
  s.bloqueado = false;
  s.retroiluminacion = true;
  s.silencio = { activo: true, segundosRestantes: TEMPORIZADORES.silencio };
  s.config.disponible = true;
  s.config.abierto = false;
  s.configRestante = TEMPORIZADORES.configDisponible;
  s.seleccionRestante = 0; s.bloqueoPendiente = 0;
  s.alarmas = { activas: null };            // null: primera evaluación tras encender (no cancela el silencio)
  s.autoAjuste = { fase: 'inactivo', ventana: 0, respiraciones: 0, progreso: 0 };
  s.energia.bateriaConfirmada = s.energia.fuente !== 'bateria';
  return s;
}

// Apagado: conserva los ajustes (memoria con respaldo) y limpia lo transitorio.
export function apagar(estado) {
  const s = clonar(estado);
  s.encendido = false;
  s.retroiluminacion = true;
  s.teclaSeleccionada = null;
  s.bloqueado = false;
  s.silencio = { activo: false, segundosRestantes: 0 };
  s.nebulizadorEncendido = false; s.nebRestante = 0;
  s.config.disponible = false; s.config.abierto = false; s.configRestante = 0;
  s.seleccionRestante = 0; s.bloqueoPendiente = 0;
  s.alarmas = { activas: [] };
  s.autoAjuste = { fase: 'inactivo', ventana: 0, respiraciones: 0, progreso: 0 };
  return s;
}

function condiciones(e) {
  return {
    flujoConstante: e.flujoConstante,
    modoCPAPConFlujoConstante: e.modo === 'CPAP' && e.flujoConstante,
    dispPresionActivo: e.ajustes.dispPresion !== null,
    flujoMenor20: e.ajustes.flujo < NEB.flujoMin,
    sinNeumotacografo: e.neumotaco === 'ninguno',
    neumotacoInfantil: e.neumotaco === 'infantil',
    cualquierNeumotaco: e.neumotaco !== 'ninguno',
    modoAC: e.modo === 'AC',
  };
}

// Conjunto de funciones bloqueadas según el Apéndice C.
export function calcularDeshabilitados(estado) {
  const c = condiciones(estado);
  const bloqueadas = new Set();
  for (const r of REGLAS_DESHABILITADO) {
    if (r.tipo === 'bloqueo' && c[r.cuando]) r.deshabilita.forEach((k) => bloqueadas.add(k));
  }
  return bloqueadas;
}

const ok = (estado) => ({ ok: true, estado });
const error = (estado, mensaje) => ({ ok: false, estado, error: mensaje });
const clonar = (e) => structuredClone(e);

// Límites efectivos de un parámetro según el estado.
export function limitesEfectivos(estado, clave) {
  const p = PARAMETROS[clave];
  let { min, max } = p;
  if (clave === 'insp' && estado.nebulizadorEncendido) min = NEB.inspMin;
  if (estado.flujoConstante && clave === 'insp') max = Math.min(max, FLUJO_CONSTANTE.inspMax);
  if (estado.flujoConstante && clave === 'flujo') max = Math.min(max, FLUJO_CONSTANTE.flujoMax);
  return { min, max };
}

const CLAVES_DERIVADAS = ['frecuencia', 'frecuenciaSimv', 'frecuenciaRespaldo', 'presionMaxima', 'peep', 'dispFlujo'];

// Asigna un valor exacto (null = APAGADO donde aplique). Rechaza valores inválidos.
export function fijarParametro(estado, clave, valor) {
  const p = PARAMETROS[clave];
  if (!p) return error(estado, 'Parámetro desconocido.');
  if (calcularDeshabilitados(estado).has(clave)) return error(estado, 'No disponible con la configuración actual.');
  const apagable = ['dispFlujo', 'dispPresion', 'soportePresion'].includes(clave);
  const s = clonar(estado);
  if (valor === null) {
    if (!apagable) return error(estado, 'Este parámetro no se puede apagar.');
    s.ajustes[clave] = null;
    if (clave === 'dispFlujo') { s.aumentoFrecPct = 0; derivarMedidos(s); } // sin alarmas ni cambios en otras funciones
    return ok(s);
  }
  if (typeof valor !== 'number' || Number.isNaN(valor)) return error(estado, 'Valor no numérico.');
  const { min, max } = limitesEfectivos(estado, clave);
  if (valor < min || valor > max) return error(estado, `Valor fuera de rango (${min} a ${max} ${p.unidad}).`);
  s.ajustes[clave] = redondear(valor);
  // Exclusiones mutuas (Apéndice C): activar un disparo apaga el otro y el flujo constante.
  if (clave === 'dispPresion') s.flujoConstante = false; // DISP. FLUJO no interviene: es independiente
  if (clave === 'flujo' && valor < NEB.flujoMin) s.nebulizadorEncendido = false;
  // Valores medidos que dependen de este ajuste (perillas PRES MÁX y PEEP, frecuencia y DISP. FLUJO).
  if (clave === 'dispFlujo') s.aumentoFrecPct = aumentoPorDispFlujo(s.ajustes.dispFlujo);
  if (CLAVES_DERIVADAS.includes(clave)) derivarMedidos(s);
  return ok(s);
}

// Un toque de flecha: avanza un paso y se detiene en el límite (el manual emite un tono).
export function pasoParametro(estado, clave, direccion) {
  const actual = estado.ajustes[clave];
  const p = PARAMETROS[clave];
  const { min, max } = limitesEfectivos(estado, clave);
  const base = actual === null ? (direccion > 0 ? min - pasoPara(clave, min) : max + pasoPara(clave, max)) : actual;
  const nuevo = limitar(redondear(base + direccion * pasoPara(clave, base, direccion)), min, max);
  const r = fijarParametro(estado, clave, nuevo);
  if (r.ok && nuevo === (direccion > 0 ? max : min)) r.limiteAlcanzado = true;
  void p;
  return r;
}

export function fijarModo(estado, modo) {
  if (!['AC', 'SIMV', 'CPAP'].includes(modo)) return error(estado, 'Modo desconocido.');
  if (modo === 'SIMV' && estado.flujoConstante) return error(estado, 'SIMV no está disponible con flujo constante.');
  const s = clonar(estado);
  s.modo = modo;
  if (modo === 'AC') s.ajustes.soportePresion = null; // soporte de presión inactivo en A/C
  derivarMedidos(s); // la frecuencia que se mide depende del modo
  return ok(s);
}

export function alternarFlujoConstante(estado, activar) {
  const s = clonar(estado);
  if (!activar) {
    s.flujoConstante = false;
    s.ajustes.dispPresion = PARAMETROS.dispPresion.defecto;
    return ok(s);
  }
  if (calcularDeshabilitados(estado).has('flujoConstante')) return error(estado, 'No disponible con el neumotacógrafo conectado.');
  s.flujoConstante = true;
  if (s.ajustes.flujo > FLUJO_CONSTANTE.flujoMax) s.ajustes.flujo = FLUJO_CONSTANTE.flujoMax; // límite de 29 L/min (pág. 17)
  s.ajustes.dispPresion = null;
  s.ajustes.soportePresion = null;
  if (s.modo === 'SIMV') s.modo = 'AC'; // se muestra como CMV
  return ok(derivarMedidos(s));
}

// Neumotacógrafo conectado (condición del instructor). Con uno conectado no puede haber flujo constante (Apéndice C).
export function fijarNeumotaco(estado, tipo) {
  if (!['ninguno', 'infantil', 'pediatrico'].includes(tipo)) return error(estado, 'Neumotacógrafo desconocido.');
  const s = clonar(estado);
  s.neumotaco = tipo;
  if (tipo !== 'ninguno' && s.flujoConstante) { s.flujoConstante = false; s.ajustes.dispPresion = PARAMETROS.dispPresion.defecto; }
  return ok(derivarMedidos(s));
}

// Límite de alarma. valor === null en LOW de una alarma apagable la desactiva.
export function fijarLimiteAlarma(estado, clave, lado, valor) {
  const a = ALARMAS[clave];
  if (!a) return error(estado, 'Alarma desconocida.');
  if (valor !== null && (typeof valor !== 'number' || Number.isNaN(valor))) return error(estado, 'Valor no numérico.');
  const s = clonar(estado);
  const l = s.limites[clave];
  if (valor === null) {
    if (lado !== 'low' || !a.apagable) return error(estado, 'Esta alarma no se puede apagar.');
    l.enabled = false;
    return ok(s);
  }
  const [min, max] = a[lado];
  if (valor < min || valor > max) return error(estado, `Fuera de rango (${min} a ${max}).`);
  const otro = lado === 'low' ? l.high : l.low;
  if (lado === 'low' && valor >= otro) return error(estado, 'El límite bajo debe ser menor que el alto.');
  if (lado === 'high' && valor <= otro) return error(estado, 'El límite alto debe ser mayor que el bajo.');
  l[lado] = valor;
  l.enabled = true;
  return ok(s);
}

// Activa o apaga una alarma apagable (p. ej. VME) desde el panel del instructor; igual que APAGADO en el menú de alarmas.
export function activarAlarma(estado, clave, activa) {
  const a = ALARMAS[clave];
  if (!a) return error(estado, 'Alarma desconocida.');
  if (!a.apagable) return error(estado, 'Esta alarma no se puede apagar.');
  const s = clonar(estado);
  s.limites[clave].enabled = Boolean(activa);
  return ok(s);
}

// Evalúa qué alarmas de los menús 1 y 2 están en violación según los valores medidos.
export function evaluarAlarmas(estado) {
  const activas = [];
  for (const clave of Object.keys(ALARMAS)) {
    const l = estado.limites[clave];
    if (!l.enabled) continue;
    const v = estado.medidos[clave];
    if (v < l.low || v > l.high) activas.push(clave);
  }
  return activas;
}

// ---------- Valores que fija el instructor ----------
export function fijarMedido(estado, clave, valor) {
  const r = MEDIDOS_RANGO[clave];
  if (!r) return error(estado, 'Valor medido desconocido.');
  if (typeof valor !== 'number' || Number.isNaN(valor)) return error(estado, 'Valor no numérico.');
  if (valor < r[0] || valor > r[1]) return error(estado, `Fuera de rango (${r[0]} a ${r[1]}).`);
  const s = clonar(estado);
  // PICO, VCE y PEEP no son independientes: siguen a las perillas y a la fórmula VC = 17 ml x PICO (dynamics.js).
  if (clave === 'pico') {
    if (valor < 0 || valor > DINAMICA.picoMaxPerilla) return error(estado, TEXTOS.avisoPicoPerilla);
    s.ajustes.presionMaxima = redondear(valor, 3); s.respiracion.varPresion = 0;
    return ok(derivarMedidos(s));
  }
  if (clave === 'vce') {
    const pico = picoDesdeVc(valor);
    if (pico > DINAMICA.picoMaxPerilla) return error(estado, TEXTOS.avisoVcMaximo);
    s.ajustes.presionMaxima = pico; s.respiracion.varPresion = 0; s.respiracion.varVc = 0;
    return ok(derivarMedidos(s));
  }
  if (clave === 'peep') {
    if (valor < PARAMETROS.peep.min || valor > PARAMETROS.peep.max) return error(estado, `La PEEP sigue a la perilla PEEP (${PARAMETROS.peep.min} a ${PARAMETROS.peep.max} cmH2O).`);
    s.ajustes.peep = redondear(valor);
    return ok(derivarMedidos(s));
  }
  s.medidos[clave] = redondear(valor);
  if (clave === 'frecuencia') s.aumentoFrecPct = 0; // el valor fijado por el instructor sustituye a la lectura con aumento
  if (clave === 'frecuencia') s.medidos.vme = limitar(redondear(s.medidos.vce * valor / 1000, 1), 0, MEDIDOS_RANGO.vme[1]); // VME = VCE x FREC
  return ok(s);
}

// Fuente de energía, carga de batería y presión de suministro de gas.
export function fijarEnergia(estado, cambios) {
  const s = clonar(estado);
  const e = s.energia;
  if ('fuente' in cambios) {
    if (!['externa', 'bateria'].includes(cambios.fuente)) return error(estado, 'Fuente desconocida.');
    if (cambios.fuente !== e.fuente) e.bateriaConfirmada = cambios.fuente === 'externa'; // al pasar a batería hay que confirmarla con la tecla BATERÍA
    e.fuente = cambios.fuente;
  }
  if ('bateriaPct' in cambios) {
    if (typeof cambios.bateriaPct !== 'number' || cambios.bateriaPct < 0 || cambios.bateriaPct > 100) return error(estado, 'La batería va de 0 a 100 %.');
    e.bateriaPct = Math.round(cambios.bateriaPct);
  }
  if ('presionGasOk' in cambios) e.presionGasOk = Boolean(cambios.presionGasOk);
  return ok(s);
}

// Fallo del ventilador: null o una clave con código sonoro del Apéndice D.
export function fijarFallo(estado, fallo) {
  if (fallo !== null && !(fallo in CODIGOS_SONOROS && !['perdidaEnergia', 'bajaBateria', 'bajaPresionSuministro'].includes(fallo))) return error(estado, 'Fallo desconocido.');
  const s = clonar(estado);
  s.fallo = fallo;
  return ok(s);
}
