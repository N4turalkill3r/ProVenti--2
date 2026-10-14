// Sonidos sintetizados con Web Audio. Educativos: no reproducen el sonido del equipo real.
// Los códigos del Apéndice D son [largos, cortos]; 'continuo' es un tono sostenido; 'generico' es el aviso de límite (inferido).

const LARGO = 0.6, CORTO = 0.2, HUECO = 0.2, PAUSA_CICLO = 1.6;

// Convierte un código en una lista de tonos { f (Hz), d (s) } con silencios { f: 0, d }.
export function secuenciaDe(codigo) {
  if (codigo === 'continuo') return [{ f: 800, d: 2 }];
  if (codigo === 'generico') return [0, 1, 2].flatMap(() => [{ f: 1000, d: 0.15 }, { f: 0, d: 0.1 }]);
  const [largos, cortos] = codigo;
  const s = [];
  for (let i = 0; i < largos; i++) s.push({ f: 800, d: LARGO }, { f: 0, d: HUECO });
  for (let i = 0; i < cortos; i++) s.push({ f: 800, d: CORTO }, { f: 0, d: HUECO });
  return s;
}
export const duracionDe = (sec) => sec.reduce((a, t) => a + t.d, 0);

export function crearAudio() {
  let ctx = null;
  let habilitado = true;
  let clave = null;      // patrón en curso
  let temporizador = null;
  const volumen = 0.12;

  function contexto() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function pitido(f, inicio, dur, tipo = 'square') {
    const c = contexto();
    if (!c || !habilitado) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = tipo; osc.frequency.value = f;
    const t0 = c.currentTime + inicio;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(volumen, t0 + 0.008);
    g.gain.setValueAtTime(volumen, t0 + Math.max(0.01, dur - 0.01));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function ciclo(codigo) {
    const sec = secuenciaDe(codigo);
    let t = 0;
    for (const x of sec) { if (x.f) pitido(x.f, t, x.d); t += x.d; }
    return t + (codigo === 'continuo' ? 0 : PAUSA_CICLO);
  }

  function detener() { clearTimeout(temporizador); temporizador = null; clave = null; }

  return {
    // Debe llamarse desde un gesto del usuario para que el navegador permita el audio.
    activarContexto() { contexto(); },
    habilitar(si) { habilitado = si; if (!si) detener(); },
    estaHabilitado: () => habilitado,
    // true si el navegador aún no permite sonar (hace falta un toque o una tecla en la página).
    necesitaGesto: () => !ctx || ctx.state === 'suspended',
    // patron: null o { id, codigo }. Repite el ciclo hasta que cambie o se silencie.
    alarma(patron) {
      const nueva = patron ? `${patron.id}|${JSON.stringify(patron.codigo)}` : null;
      if (nueva === clave) return;
      detener();
      if (!patron || !habilitado) return;
      clave = nueva;
      const repetir = () => {
        const total = ciclo(patron.codigo);
        temporizador = setTimeout(repetir, total * 1000);
      };
      repetir();
    },
    // Tonos de interfaz: tecla, límite (se detiene el desplazamiento) y error.
    tono(tipo) {
      if (tipo === 'tecla') pitido(1200, 0, 0.04, 'sine');
      else if (tipo === 'limite') pitido(600, 0, 0.18, 'sine');
      else if (tipo === 'error') pitido(300, 0, 0.14, 'sine');
    },
    detener,
  };
}
