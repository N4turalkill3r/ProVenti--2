// Modos de visualización: cajón de controles (modo discreto) y proyección. Solo DOM; no toca el estado de la simulación.
const CLAVE_CONTROLES = 'prosventi.controles';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const $ = (id) => document.getElementById(id);

export function crearModos({ alCambiar = () => {} } = {}) {
  const cuerpo = document.body;
  let proyeccion = false;
  let pantallaCompleta = false;
  let bloqueoPantalla = null;
  let temporizadorBarra = null;
  let pausado = false;

  // ---------- Cajón de controles ----------
  function abrirControles(abrir, { recordar = true } = {}) {
    $('controles').hidden = !abrir;
    $('btn-controles').setAttribute('aria-expanded', String(abrir));
    cuerpo.dataset.controles = abrir ? 'abierto' : 'cerrado';
    if (recordar) guardar(CLAVE_CONTROLES, abrir ? '1' : '0');
    alCambiar();
  }
  const controlesAbiertos = () => cuerpo.dataset.controles === 'abierto';

  // ---------- Proyección ----------
  function mostrarBarra() {
    if (!proyeccion) return;
    $('proy-barra').classList.add('visible');
    cuerpo.classList.remove('cursor-oculto');
    clearTimeout(temporizadorBarra);
    temporizadorBarra = setTimeout(() => {
      $('proy-barra').classList.remove('visible');
      if (proyeccion) cuerpo.classList.add('cursor-oculto');
    }, 3000);
  }

  async function pedirBloqueo() {
    try { if ('wakeLock' in navigator) bloqueoPantalla = await navigator.wakeLock.request('screen'); } catch { bloqueoPantalla = null; }
  }
  function soltarBloqueo() { try { bloqueoPantalla?.release(); } catch { /* nada */ } bloqueoPantalla = null; }

  function sincronizarProyeccion() {
    $('proy-barra').hidden = !proyeccion;
    $('proy-marca').hidden = !proyeccion;
    $('proy-pausa').hidden = !(proyeccion && pausado);
  }

  async function entrarProyeccion() {
    if (proyeccion) return;
    proyeccion = true;
    cuerpo.dataset.modo = 'proyeccion';
    sincronizarProyeccion();
    mostrarBarra();
    // Pantalla completa si el navegador lo autoriza; si no, la proyección funciona igual dentro de la ventana.
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        pantallaCompleta = true;
      }
    } catch { pantallaCompleta = false; }
    pedirBloqueo();
    alCambiar();
  }

  function salirProyeccion() {
    if (!proyeccion) return;
    proyeccion = false;
    cuerpo.dataset.modo = 'control';
    cuerpo.classList.remove('cursor-oculto');
    clearTimeout(temporizadorBarra);
    sincronizarProyeccion();
    soltarBloqueo();
    if (pantallaCompleta && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    pantallaCompleta = false;
    $('btn-proyeccion').focus({ preventScroll: true });
    alCambiar();
  }

  const alternarProyeccion = () => (proyeccion ? salirProyeccion() : entrarProyeccion());

  function iniciar() {
    $('btn-controles').addEventListener('click', () => abrirControles(!controlesAbiertos()));
    $('btn-proyeccion').addEventListener('click', entrarProyeccion);
    $('btn-salir-proyeccion').addEventListener('click', salirProyeccion);

    // Al salir de pantalla completa con Esc u otra acción del navegador, también se sale de la proyección.
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && proyeccion && pantallaCompleta) { pantallaCompleta = false; salirProyeccion(); }
    });
    document.addEventListener('visibilitychange', () => { if (proyeccion && document.visibilityState === 'visible') pedirBloqueo(); });
    for (const tipo of ['pointermove', 'pointerdown', 'touchstart']) document.addEventListener(tipo, mostrarBarra, { passive: true });

    document.addEventListener('keydown', (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Escape' && proyeccion && !document.fullscreenElement) { salirProyeccion(); return; }
      const t = ev.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName))) return;
      if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); alternarProyeccion(); }
      else if ((ev.key === 'c' || ev.key === 'C') && !proyeccion) { ev.preventDefault(); abrirControles(!controlesAbiertos()); }
    });

    // Estado inicial: abierto en pantallas anchas salvo que el usuario haya elegido otra cosa.
    const previo = leer(CLAVE_CONTROLES);
    abrirControles(previo === null ? window.innerWidth >= 1000 : previo === '1', { recordar: false });
    sincronizarProyeccion();
  }

  return {
    iniciar, abrirControles, entrarProyeccion, salirProyeccion, alternarProyeccion,
    enProyeccion: () => proyeccion,
    indicarPausa(valor) { pausado = valor; sincronizarProyeccion(); },
  };
}
