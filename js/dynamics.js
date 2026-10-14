// Dinámica respiratoria simulada. Sin DOM. Convierte los ajustes del equipo en los valores medidos:
//   PICO  = PRES MÁX x (1 + variación de presión)            [variación ± hasta 3 % en cada espiración]
//   VC    = 17 ml x PRES MÁX x (1 + variación de volumen)     [variación ± hasta 10 % en cada respiración]
//   PEEP  = perilla PEEP
//   FREC  = frecuencia programada x (1 + aumento por DISP. FLUJO)
//   VME   = VCE x FREC
// INSP no interviene en el VC: solo cambia E e I/E.
import { DINAMICA, MEDIDOS_RANGO } from './config.js';
import { limitar, redondear } from './utils.js';
import { aleatorio } from './random.js';

export function frecuenciaProgramada(e) {
  return e.ajustes[e.modo === 'SIMV' ? 'frecuenciaSimv' : e.modo === 'CPAP' ? 'frecuenciaRespaldo' : 'frecuencia'];
}

export const vcDesdePico = (pico, variacion = 0) => Math.round(DINAMICA.vcPorCmH2O * pico * (1 + variacion));
export const picoDesdeVc = (vc) => redondear(vc / DINAMICA.vcPorCmH2O, 3);

// FREC que se compara con los límites de alarma: la programada, sin el aumento que DISP. FLUJO añade a la lectura del panel
// (DISP. FLUJO no genera alarmas). Si el instructor fija la FREC medida, ese valor se usa tal cual.
export function frecuenciaAlarma(e) {
  const f = e.medidos.frecuencia / (1 + (e.aumentoFrecPct || 0) / 100);
  return redondear(f, f < 10 ? 1 : 0);
}

const rango = (clave, v) => limitar(v, MEDIDOS_RANGO[clave][0], MEDIDOS_RANGO[clave][1]);

// Recalcula los valores medidos derivados. Modifica el estado recibido (úsese sobre una copia) y lo devuelve.
export function derivarMedidos(s) {
  const base = s.ajustes.presionMaxima;
  const r = s.respiracion;
  s.medidos.pico = rango('pico', redondear(base * (1 + r.varPresion), 1));
  s.medidos.peep = rango('peep', s.ajustes.peep);
  const vc = vcDesdePico(base, r.varVc);
  s.ajustes.vc = vc; // el VC que muestra el menú principal es el resultado de la presión
  s.medidos.vce = rango('vce', vc);
  const f = frecuenciaProgramada(s) * (1 + s.aumentoFrecPct / 100);
  s.medidos.frecuencia = rango('frecuencia', redondear(f, f < 10 ? 1 : 0));
  s.medidos.vme = rango('vme', redondear(s.medidos.vce * s.medidos.frecuencia / 1000, 1));
  return s;
}

// Sorteo del aumento de FREC al cambiar DISP. FLUJO: solo por encima del umbral; si no, 0 %.
export function aumentoPorDispFlujo(valor, rnd = aleatorio) {
  if (valor === null || valor <= DINAMICA.dispFlujoUmbral) return 0;
  const lista = DINAMICA.aumentoFrecPorcentajes;
  return lista[Math.min(lista.length - 1, Math.floor(rnd() * lista.length))];
}

// Inicio de una respiración: sortea las variaciones y recalcula los valores medidos.
export function nuevaRespiracion(estado, rnd = aleatorio) {
  const s = structuredClone(estado);
  s.respiracion = {
    n: s.respiracion.n + 1,
    varPresion: redondear((rnd() * 2 - 1) * DINAMICA.variacionPresionMax, 4),
    varVc: redondear((rnd() * 2 - 1) * DINAMICA.variacionVcMax, 4),
  };
  return derivarMedidos(s);
}

// ---------- Forma de la presión (para la barra) ----------
// Una respiración por ciclo: FREC 12 => 12 respiraciones por minuto (5 s cada una). El aumento de DISP. FLUJO solo se ve en el panel de alarmas.
export function periodoRespiratorio(e) {
  return limitar(60 / Math.max(frecuenciaAlarma(e), 1), 0.3, 60);
}

// Presión en la vía aérea t segundos después del inicio de la respiración: sube hasta la PICO durante la inspiración
// y vuelve a la PEEP durante la espiración.
export function presionInstantanea(e, t) {
  const T = periodoRespiratorio(e);
  const ti = limitar(e.ajustes.insp, 0.1, T * 0.8);
  const peep = e.medidos.peep;
  const pico = Math.max(e.medidos.pico, peep);
  if (t < ti) {
    const subida = Math.min(ti * 0.4, 0.4);
    return t < subida ? peep + (pico - peep) * (t / subida) : pico;
  }
  const tau = Math.max(0.12, (T - ti) * 0.2);
  return peep + (pico - peep) * Math.exp(-(t - ti) / tau);
}
