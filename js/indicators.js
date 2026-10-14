// Indicadores del estado de la simulación para la barra de estado. Sin DOM.
// Cada indicador: { id, texto, nivel: 'ok' | 'aviso' | 'alarma' | 'neutro' }.
import { condiciones } from './engine.js';

export function indicadores(estado, { pausado = false } = {}) {
  const lista = [];
  lista.push(estado.encendido
    ? { id: 'equipo', texto: 'Equipo encendido', nivel: 'ok' }
    : { id: 'equipo', texto: 'Equipo apagado', nivel: 'neutro' });
  lista.push(pausado
    ? { id: 'simulacion', texto: 'Simulación en pausa', nivel: 'aviso' }
    : { id: 'simulacion', texto: 'Simulación en marcha', nivel: 'ok' });
  const n = condiciones(estado).length;
  lista.push(n
    ? { id: 'alarmas', texto: n === 1 ? '1 alarma activa' : `${n} alarmas activas`, nivel: 'alarma' }
    : { id: 'alarmas', texto: 'Sin alarmas', nivel: 'neutro' });
  if (estado.encendido && estado.silencio.activo) lista.push({ id: 'silencio', texto: `Silencio ${estado.silencio.segundosRestantes} s`, nivel: 'aviso' });
  if (estado.encendido && estado.bloqueado) lista.push({ id: 'bloqueo', texto: 'Pantalla bloqueada', nivel: 'aviso' });
  return lista;
}
