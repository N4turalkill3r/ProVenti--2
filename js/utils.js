// Funciones puras, sin dependencias del DOM.
import { PARAMETROS } from './config.js';

export function limitar(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

export function redondear(valor, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

// Paso aplicable al valor actual. Al bajar se usa el tramo inmediatamente inferior.
export function pasoPara(clave, valor, direccion = 1) {
  const tramos = PARAMETROS[clave].paso;
  const ref = direccion < 0 ? valor - 1e-9 : valor;
  for (const t of tramos) if (ref < t.hasta) return t.paso;
  return tramos[tramos.length - 1].paso;
}

// Calcula I, E, I/E y VC a partir de frecuencia, flujo y la preferencia (VC o INSP).
// VC (ml) = Ti (s) x flujo (L/min) x 1000 / 60
export function calcularTiempos({ frecuencia, vc, flujo, insp, preferencia }) {
  let i, vcCalc;
  if (preferencia === 'INSP') {
    i = insp;
    vcCalc = i * (flujo / 60) * 1000;
  } else {
    vcCalc = vc;
    i = vc / 1000 / (flujo / 60);
  }
  const ciclo = 60 / frecuencia;
  const e = ciclo - i;
  const avisos = {
    inspiracion: i < 0.1 || i > 3.0,
    espiracion: e < 0.2,
    relacionIE: e <= 0 || i / e > 3 || e / i > 99,
  };
  return { i: redondear(i), e: redondear(e), ie: formatearIE(i, e), vc: Math.round(vcCalc), ciclo: redondear(ciclo), avisos };
}

export function formatearIE(i, e) {
  if (e <= 0 || i <= 0) return '—';
  return i > e ? `${(i / e).toFixed(1)}:1` : `1:${(e / i).toFixed(1)}`;
}
