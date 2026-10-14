// Fase 5: operación del equipo. Conecta el DOM con el estado y la lógica de interaction.js.
// Las teclas actúan con pointerdown (como una pantalla táctil) porque el SVG se redibuja con cada cambio.
import { crearEstadoInicial, encender, apagar, fijarMedido, fijarEnergia, fijarFallo, fijarNeumotaco, fijarLimiteAlarma, activarAlarma } from './state.js';
import { sincronizar, avanzarMotor, patronSonoro, motivosAlarma } from './engine.js';
import { crearAudio } from './audio.js';
import { crearModos } from './modes.js';
import { indicadores } from './indicators.js';
import { iniciarPWA } from './pwa.js';
import { renderVentilador, rellenoBarra } from './ventilator-renderer.js';
import { nuevaRespiracion, presionInstantanea, periodoRespiratorio } from './dynamics.js';
import { pulsarTecla, pulsarFlecha, girarMando, avanzarTiempo, apagarRetroiluminacion, encenderRetroiluminacion, paso } from './interaction.js';
import { TEXTOS, TECLAS_SIN_FUNCION, ALARMAS, PARAMETROS, O2_PERILLA } from './config.js';
import { MARCA } from './brand.config.js';

const base = () => encender(crearEstadoInicial());
// Escenario limpio: sin silencio ni CONFIG, para ver cada pantalla.
const limpio = (f = (e) => e) => () => {
  const e = base();
  e.silencio = { activo: false, segundosRestantes: 0 };
  e.config.disponible = false; e.configRestante = 0;
  return f(e);
};

const ESCENARIOS = [
  { id: 'principal', etiqueta: 'Encendido', estado: () => base() },
  { id: 'secundario', etiqueta: 'Secundario', estado: limpio((e) => { e.menu = 'secundario'; return e; }) },
  { id: 'alarma1', etiqueta: 'Alarma 1', estado: limpio((e) => { e.menu = 'alarma1'; return e; }) },
  { id: 'alarma2', etiqueta: 'Alarma 2', estado: limpio((e) => { e.menu = 'alarma2'; return e; }) },
  { id: 'alarma3', etiqueta: 'Alarma 3', estado: limpio((e) => { e.menu = 'alarma3'; e.energia = { fuente: 'bateria', bateriaPct: 15, presionGasOk: false }; return e; }) },
  { id: 'simv', etiqueta: 'SIMV', estado: limpio((e) => { e.modo = 'SIMV'; return e; }) },
  { id: 'cpap', etiqueta: 'CPAP', estado: limpio((e) => { e.modo = 'CPAP'; e.fuenteRespiracion = 'ESPONT'; return e; }) },
  { id: 'apagado', etiqueta: 'Apagado', estado: () => crearEstadoInicial() },
];

// Perillas: PRES MÁX (fija la PICO), PEEP, FLUJO y el mezclador de O2 (cambia el O2 del menú de alarmas).
const PERILLAS = { 'presion-maxima': 'presionMaxima', peep: 'peep', flujo: 'flujo', o2: 'o2' };
const valorPerilla = (clave) => (clave === 'o2' ? estado.medidos.o2 : estado.ajustes[clave]);
const rangoPerilla = (clave) => (clave === 'o2' ? O2_PERILLA : PARAMETROS[clave]);

const $ = (id) => document.getElementById(id);
const contenedor = $('ventilador');
const nota = $('nota-suspiro');
const mensaje = $('mensaje');

const audio = crearAudio();
const modos = crearModos();
let pausado = false;
let infoPWA = null;
let encuadre = 'completo';
const CLAVE_ENCUADRE = 'prosventi.encuadre';
let estado = sincronizar(base());
let notaAbierta = false;
let ultimoSvg = '';
let temporizadorMensaje = null;

// ---------- Dibujo ----------
function etiquetaTecla(id, nodo) {
  if (id.startsWith('alarma:')) {
    const [, k, lado] = id.split(':');
    return `${ALARMAS[k].etiqueta}, límite ${lado === 'low' ? 'bajo' : 'alto'}`;
  }
  const fijas = { 'flecha-arriba': 'Flecha arriba', 'flecha-abajo': 'Flecha abajo', 'barra-presion': 'Barra de presión. Mantenga 3 segundos para apagar la pantalla', 'neb-tiempo': 'Tiempo de nebulización', 'neb-estado': 'Nebulizador' };
  return fijas[id] || nodo.textContent.replace(/\s+/g, ' ').trim() || id;
}

function accesibilidad() {
  contenedor.querySelectorAll('[data-tecla]').forEach((n) => {
    const id = n.dataset.tecla;
    if (id === 'suspiro') return;
    n.setAttribute('role', 'button');
    n.setAttribute('tabindex', '0');
    n.setAttribute('aria-label', etiquetaTecla(id, n));
  });
}

function actualizarIndicadores() {
  const lista = indicadores(estado, { pausado });
  if (infoPWA) {
    if (infoPWA.conexion === 'sin-conexion') lista.push({ id: 'conexion', texto: 'Sin conexión', nivel: 'aviso' });
    if (infoPWA.offline === 'listo') lista.push({ id: 'offline', texto: 'Disponible sin conexión', nivel: 'ok' });
  }
  const ul = $('estado-sim');
  ul.replaceChildren(...lista.map((i) => { const li = document.createElement('li'); li.textContent = i.texto; li.dataset.nivel = i.nivel; return li; }));
}

function actualizarMotivos() {
  const ul = $('motivos-alarma');
  const lista = motivosAlarma(estado);
  const clave = JSON.stringify(lista);
  if (ul.dataset.k === clave) return;
  ul.dataset.k = clave;
  ul.replaceChildren(...lista.map((m) => {
    const li = document.createElement('li');
    li.dataset.alarma = m.id;
    const luz = document.createElement('span'); luz.className = 'luz'; luz.setAttribute('aria-hidden', 'true');
    const cuerpo = document.createElement('span');
    const t = document.createElement('b'); t.textContent = m.texto + (m.pestana ? ` (${m.pestana})` : '');
    cuerpo.appendChild(t);
    if (m.causa) { const c = document.createElement('span'); c.className = 'causa'; c.textContent = m.causa; cuerpo.appendChild(c); }
    li.append(luz, cuerpo);
    return li;
  }));
}

function dibujar() {
  actualizarIndicadores();
  actualizarMotivos();
  // La barra se dibuja con la presión del instante actual para que no salte al pico en cada redibujado.
  const presionBarra = estado.encendido ? presionInstantanea(estado, faseRespiracion) : undefined;
  const svg = renderVentilador(estado, { suspiroAbierto: notaAbierta, encuadre, presionBarra });
  if (svg === ultimoSvg) return;
  ultimoSvg = svg;
  const activo = document.activeElement;
  let foco = null;
  if (activo && contenedor.contains(activo)) foco = activo.dataset.tecla ? `[data-tecla="${activo.dataset.tecla}"]` : activo.dataset.perilla ? `[data-perilla="${activo.dataset.perilla}"]` : null;
  contenedor.innerHTML = svg;
  accesibilidad();
  if (foco) { const n = contenedor.querySelector(foco); if (n) n.focus({ preventScroll: true }); }
  $('btn-encendido').textContent = estado.encendido ? TEXTOS.apagar : TEXTOS.encender;
  $('btn-encendido').setAttribute('aria-pressed', String(estado.encendido));
}

function avisar(texto) {
  if (!texto) return;
  mensaje.textContent = texto;
  clearTimeout(temporizadorMensaje);
  temporizadorMensaje = setTimeout(() => { mensaje.textContent = ''; }, 4500);
}

function tono(t) {
  if (!t) return;
  audio.tono(t);
  window.dispatchEvent(new CustomEvent('prosventi:tono', { detail: t })); // por si otro módulo lo necesita
}

function aplicar(r) {
  if (!r) return;
  avisar(r.aviso);
  tono(r.tono);
  if (r.estado) estado = sincronizar(r.estado);
  dibujar();
  actualizarSonido();
  sincronizarPanel();
}

function fijarEncuadre(valor, recordar = true) {
  encuadre = valor;
  const amp = encuadre === 'pantalla';
  for (const id of ['btn-encuadre', 'btn-encuadre-proy']) {
    $(id).setAttribute('aria-pressed', String(amp));
  }
  $('btn-encuadre').textContent = amp ? 'Equipo completo' : 'Ampliar pantalla';
  $('btn-encuadre-proy').textContent = amp ? 'Equipo completo (Z)' : 'Ampliar pantalla (Z)';
  document.body.dataset.encuadre = encuadre;
  if (recordar) { try { localStorage.setItem(CLAVE_ENCUADRE, encuadre); } catch { /* sin almacenamiento */ } }
  dibujar();
}

let avisoSonidoMostrado = false;
function actualizarSonido() {
  const patron = pausado ? null : patronSonoro(estado);
  audio.alarma(patron);
  // El navegador no deja sonar hasta que la persona toca la página: se avisa una vez.
  if (patron && audio.estaHabilitado() && audio.necesitaGesto() && !avisoSonidoMostrado) {
    avisoSonidoMostrado = true;
    avisar('Hay una alarma. Toque o haga clic en la página para que el navegador active el sonido.');
  }
}

function alternarPausa(valor = !pausado) {
  pausado = valor;
  $('btn-pausa').textContent = pausado ? 'Reanudar' : 'Pausar';
  $('btn-pausa').setAttribute('aria-pressed', String(pausado));
  modos.indicarPausa(pausado);
  actualizarIndicadores();
  actualizarSonido();
  avisar(pausado ? 'Simulación en pausa: el tiempo no avanza.' : 'Simulación reanudada.');
}

function alternarNota(abierta) {
  notaAbierta = abierta;
  nota.hidden = !abierta;
  dibujar();
}

function cargarEscenario(e) {
  estado = sincronizar(e);
  alternarNota(false);
  mensaje.textContent = '';
  ultimoSvg = '';
  dibujar();
  actualizarSonido();
  sincronizarPanel(true);
}

// ---------- Flechas con repetición acelerada ----------
let repeticion = null;
function detenerRepeticion() {
  if (!repeticion) return;
  clearTimeout(repeticion.espera); clearInterval(repeticion.intervalo);
  repeticion = null;
}
function iniciarRepeticion(direccion) {
  detenerRepeticion();
  aplicar(pulsarFlecha(estado, direccion));
  const rep = { n: 0 };
  rep.espera = setTimeout(() => {
    const paso1 = () => {
      const r = pulsarFlecha(estado, direccion);
      aplicar(r);
      if (r.tono === 'limite' || r.tono === 'error') { detenerRepeticion(); return; } // el desplazamiento se detiene en el límite
      rep.n += 1;
      if (rep.n === 10) { clearInterval(rep.intervalo); rep.intervalo = setInterval(paso1, 60); }
    };
    rep.intervalo = setInterval(paso1, 140);
  }, 450);
  repeticion = rep;
}

// ---------- Perillas ----------
let arrastre = null;
function iniciarArrastre(ev, nodo) {
  const clave = PERILLAS[nodo.dataset.perilla];
  const centro = nodo.querySelector('[data-centro]').getBoundingClientRect();
  const cx = centro.left + centro.width / 2, cy = centro.top + centro.height / 2;
  const { min, max } = rangoPerilla(clave);
  arrastre = {
    clave, cx, cy, min, max,
    acumulado: valorPerilla(clave),
    anterior: Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI,
  };
  try { contenedor.setPointerCapture(ev.pointerId); } catch { /* sin captura */ }
}
function moverArrastre(ev) {
  if (!arrastre) return;
  const a = arrastre;
  const ang = Math.atan2(ev.clientY - a.cy, ev.clientX - a.cx) * 180 / Math.PI;
  let d = ang - a.anterior;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  a.anterior = ang;
  a.acumulado = Math.min(a.max, Math.max(a.min, a.acumulado + d / 270 * (a.max - a.min)));
  aplicar(girarMando(estado, a.clave, a.acumulado));
}

// ---------- Panel del instructor ----------
const formMedidos = $('form-medidos');
const formSistema = $('form-sistema');
const formVme = $('form-vme');
function sincronizarPanel(forzar = false) {
  sincronizarDeslizadores(forzar);
  const libre = (el) => forzar || document.activeElement !== el;
  for (const input of formMedidos.querySelectorAll('input')) if (libre(input)) input.value = estado.medidos[input.name];
  const q = (n) => formSistema.querySelector(`[name="${n}"]`);
  const v = (n) => formVme.querySelector(`[name="${n}"]`);
  if (libre(v('vmeActiva'))) v('vmeActiva').checked = estado.limites.vme.enabled;
  if (libre(v('vmeLow'))) v('vmeLow').value = estado.limites.vme.low;
  if (libre(v('vmeHigh'))) v('vmeHigh').value = estado.limites.vme.high;
  if (libre(q('fuente'))) q('fuente').value = estado.energia.fuente;
  if (libre(q('neumotaco'))) q('neumotaco').value = estado.neumotaco;
  if (libre(q('bateriaPct'))) q('bateriaPct').value = estado.energia.bateriaPct;
  if (libre(q('gasBajo'))) q('gasBajo').checked = !estado.energia.presionGasOk;
  if (libre(q('fallo'))) q('fallo').value = estado.fallo || '';
}
function sincronizarDeslizadores(forzar = false) {
  for (const input of $('deslizadores').querySelectorAll('input')) {
    const v = Math.round(valorPerilla(input.name) * 10) / 10;
    if (forzar || document.activeElement !== input) input.value = Math.round(v);
    const salida = $('deslizadores').querySelector(`[data-salida="${input.name}"]`);
    salida.textContent = v;
    input.setAttribute('aria-valuetext', `${v}`);
  }
}
function errorPanel(texto) { $('panel-error').textContent = texto || ''; }
function iniciarPanel() {
  const sel = $('sel-fallo');
  for (const [k, v] of Object.entries(TEXTOS.fallos)) { const o = document.createElement('option'); o.value = k; o.textContent = v; sel.appendChild(o); }
  formMedidos.addEventListener('submit', (ev) => ev.preventDefault());
  formMedidos.addEventListener('change', (ev) => {
    const input = ev.target;
    const r = fijarMedido(estado, input.name, input.value === '' ? NaN : Number(input.value));
    if (!r.ok) { errorPanel(r.error); input.value = estado.medidos[input.name]; return; }
    errorPanel(''); aplicar({ estado: r.estado });
  });
  formVme.addEventListener('change', (ev) => {
    const el = ev.target;
    let r;
    if (el.name === 'vmeActiva') r = activarAlarma(estado, 'vme', el.checked);
    else {
      const lado = el.name === 'vmeLow' ? 'low' : 'high';
      r = fijarLimiteAlarma(estado, 'vme', lado, el.value === '' ? NaN : Number(el.value));
    }
    if (!r.ok) { errorPanel(r.error); sincronizarPanel(true); return; }
    errorPanel(''); aplicar({ estado: r.estado });
  });
  formSistema.addEventListener('change', (ev) => {
    const el = ev.target;
    let r;
    if (el.name === 'fuente') r = fijarEnergia(estado, { fuente: el.value });
    else if (el.name === 'bateriaPct') r = fijarEnergia(estado, { bateriaPct: el.value === '' ? NaN : Number(el.value) });
    else if (el.name === 'gasBajo') r = fijarEnergia(estado, { presionGasOk: !el.checked });
    else if (el.name === 'fallo') r = fijarFallo(estado, el.value || null);
    else if (el.name === 'neumotaco') r = fijarNeumotaco(estado, el.value);
    if (r && !r.ok) { errorPanel(r.error); sincronizarPanel(true); return; }
    errorPanel(''); if (r) aplicar({ estado: r.estado });
  });
}

// ---------- Aplicación (PWA) ----------
const pwa = iniciarPWA({ alCambiar: (info) => { infoPWA = info; mostrarPWA(); actualizarIndicadores(); } });
const TEXTO_OFFLINE = {
  desconocido: 'Sin comprobar',
  preparando: 'Preparando…',
  listo: 'Lista: todos los archivos están guardados',
  incompleto: 'No disponible (faltan archivos o el navegador no lo permite)',
};
function mostrarPWA() {
  const i = infoPWA;
  $('app-version').textContent = i.version;
  $('app-conexion').textContent = i.conexion === 'conectado' ? 'Con conexión' : 'Sin conexión';
  $('app-offline').textContent = i.sw === 'desarrollo' ? 'Desactivado en servidor local (agregue ?sw=1 a la dirección para probarlo)' : i.sw === 'sin-soporte' ? 'No disponible en este navegador o sin HTTPS' : (TEXTO_OFFLINE[i.offline] + (i.faltan.length ? `: ${i.faltan.join(', ')}` : ''));
  $('app-instalada').textContent = i.instalada ? 'Sí' : 'No';
  $('btn-instalar').hidden = !i.puedeInstalar;
  $('aviso-actualizacion').hidden = !i.actualizacion;
}
function iniciarPanelApp() {
  $('btn-instalar').addEventListener('click', async () => { const r = await pwa.instalar(); avisar(r === 'accepted' ? 'Instalación aceptada.' : 'Instalación cancelada.'); });
  $('btn-actualizar').addEventListener('click', () => pwa.aplicarActualizacion());
  $('btn-actualizar-luego').addEventListener('click', () => pwa.descartarActualizacion());
  $('btn-buscar-actualizacion').addEventListener('click', async () => {
    avisar('Buscando actualización…');
    const hay = await pwa.buscarActualizacion();
    avisar(hay ? 'Hay una versión nueva disponible.' : (infoPWA && infoPWA.conexion === 'sin-conexion' ? 'Sin conexión: no se pudo comprobar.' : 'Está usando la versión más reciente.'));
  });
  $('btn-borrar-datos').addEventListener('click', () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith('prosventi.')).forEach((k) => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
    avisar('Preferencias guardadas borradas. La copia para uso sin conexión se mantiene.');
  });
  pwa.iniciar();
}

// ---------- Retroiluminación: mantener 3 s la barra de presión ----------
let temporizadorBarra = null;

function iniciar() {
  document.title = `${MARCA.nombreCompleto} · Simulador educativo`;
  $('marca').textContent = MARCA.nombreCompleto;
  $('aviso').textContent = TEXTOS.aviso;

  const sus = TECLAS_SIN_FUNCION.suspiroOff;
  $('nota-suspiro-titulo').textContent = TEXTOS.tituloNotaSuspiro;
  $('nota-suspiro-texto').textContent = TEXTOS[sus.nota];
  $('nota-suspiro-simulador').textContent = TEXTOS[sus.notaSimulador];

  const nav = $('vistas');
  ESCENARIOS.forEach((v) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = v.etiqueta;
    b.addEventListener('click', () => cargarEscenario(v.estado()));
    nav.appendChild(b);
  });

  $('btn-encendido').addEventListener('click', () => {
    cargarEscenario(estado.encendido ? apagar(estado) : encender(estado));
  });
  $('btn-reiniciar').addEventListener('click', () => { if (pausado) alternarPausa(false); cargarEscenario(base()); });
  $('btn-pausa').addEventListener('click', () => alternarPausa());
  $('btn-encuadre').addEventListener('click', () => fijarEncuadre(encuadre === 'pantalla' ? 'completo' : 'pantalla'));
  $('btn-encuadre-proy').addEventListener('click', () => fijarEncuadre(encuadre === 'pantalla' ? 'completo' : 'pantalla'));
  document.addEventListener('keydown', (ev) => {
    if ((ev.key === 'z' || ev.key === 'Z') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const t = ev.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName))) return;
      ev.preventDefault(); fijarEncuadre(encuadre === 'pantalla' ? 'completo' : 'pantalla');
    }
  });
  let previo = null;
  try { previo = localStorage.getItem(CLAVE_ENCUADRE); } catch { /* sin almacenamiento */ }
  if (previo === 'pantalla') fijarEncuadre('pantalla', false);

  // Táctil: la perilla se arrastra sin que la página se desplace, y la pulsación larga no abre el menú contextual.
  contenedor.addEventListener('touchstart', (ev) => { if (ev.target.closest('[data-perilla]')) ev.preventDefault(); }, { passive: false });
  contenedor.addEventListener('contextmenu', (ev) => ev.preventDefault());

  // Deslizadores de las perillas (alternativa táctil y accesible).
  $('deslizadores').addEventListener('input', (ev) => {
    const el = ev.target;
    aplicar(girarMando(estado, el.name, Number(el.value)));
  });
  $('btn-cerrar-nota').addEventListener('click', () => alternarNota(false));
  modos.iniciar();
  $('btn-sonido').addEventListener('click', () => {
    const si = !audio.estaHabilitado();
    audio.habilitar(si);
    $('btn-sonido').textContent = si ? 'Sonido: sí' : 'Sonido: no';
    $('btn-sonido').setAttribute('aria-pressed', String(si));
    avisar(si ? TEXTOS.sonidoActivado : TEXTOS.sonidoDesactivado);
    actualizarSonido();
  });
  // El navegador solo permite audio tras un gesto del usuario.
  for (const tipo of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(tipo, () => audio.activarContexto(), { capture: true });
  iniciarPanel();
  iniciarPanelApp();

  contenedor.addEventListener('pointerdown', (ev) => {
    const perilla = ev.target.closest('[data-perilla]');
    if (!estado.retroiluminacion && !perilla) { // tocar la pantalla la enciende
      aplicar(encenderRetroiluminacion(estado));
      return;
    }
    if (perilla) { ev.preventDefault(); iniciarArrastre(ev, perilla); return; }
    const tecla = ev.target.closest('[data-tecla]');
    if (!tecla) return;
    const id = tecla.dataset.tecla;
    if (id === 'suspiro') { alternarNota(!notaAbierta); return; }
    if (id === 'barra-presion') {
      clearTimeout(temporizadorBarra);
      temporizadorBarra = setTimeout(() => aplicar(apagarRetroiluminacion(estado)), 3000);
      return;
    }
    if (id === 'flecha-arriba' || id === 'flecha-abajo') { iniciarRepeticion(id === 'flecha-arriba' ? 1 : -1); return; }
    aplicar(pulsarTecla(estado, id));
  });
  contenedor.addEventListener('pointermove', moverArrastre);
  const soltar = () => { arrastre = null; detenerRepeticion(); clearTimeout(temporizadorBarra); };
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);
  window.addEventListener('blur', soltar);

  // Teclado: Enter o Espacio activan una tecla; las flechas, Inicio/Fin y Re Pág/Av Pág mueven las perillas.
  contenedor.addEventListener('keydown', (ev) => {
    const perilla = ev.target.closest('[data-perilla]');
    if (perilla) {
      const clave = PERILLAS[perilla.dataset.perilla];
      const { min, max } = rangoPerilla(clave);
      const v = valorPerilla(clave);
      const mapa = { ArrowUp: v + paso(clave, v), ArrowRight: v + paso(clave, v), ArrowDown: v - paso(clave, v < 10 ? v : v - 0.01), ArrowLeft: v - paso(clave, v < 10 ? v : v - 0.01), PageUp: v + 5, PageDown: v - 5, Home: min, End: max };
      if (ev.key in mapa) { ev.preventDefault(); aplicar(girarMando(estado, clave, mapa[ev.key])); }
      return;
    }
    const tecla = ev.target.closest('[data-tecla]');
    if (tecla && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      const id = tecla.dataset.tecla;
      if (id === 'suspiro') alternarNota(!notaAbierta);
      else if (id === 'flecha-arriba') aplicar(pulsarFlecha(estado, 1));
      else if (id === 'flecha-abajo') aplicar(pulsarFlecha(estado, -1));
      else if (id === 'barra-presion') aplicar(apagarRetroiluminacion(estado));
      else aplicar(pulsarTecla(estado, id));
    }
  });

  // Reloj de 1 s: silencio, bloqueo, selección, CONFIG y nebulizador.
  setInterval(() => {
    if (pausado) return;
    const nuevo = sincronizar(avanzarMotor(avanzarTiempo(estado, 1), 1));
    if (nuevo !== estado) { estado = nuevo; dibujar(); actualizarSonido(); sincronizarPanel(); }
  }, 1000);

  dibujar();
  sincronizarPanel(true);
  requestAnimationFrame(cuadro);
}

// ---------- Respiraciones simuladas ----------
// Cada respiración dura 60 / FREC medida. Al empezar se sortean las variaciones de presión (0-3 %) y de volumen (0-10 %);
// la barra de presión sube hasta la PICO en la inspiración (INSP) y baja a la PEEP en la espiración.
// Respeta la pausa: con la simulación en pausa la barra queda quieta.
let faseRespiracion = 0;
let ultimoCuadro = null;
function cuadro(marca) {
  const dt = ultimoCuadro === null ? 0 : Math.min(0.25, (marca - ultimoCuadro) / 1000);
  ultimoCuadro = marca;
  if (estado.encendido && !pausado) {
    faseRespiracion += dt;
    const periodo = periodoRespiratorio(estado);
    if (faseRespiracion >= periodo) {
      faseRespiracion %= periodo;
      estado = sincronizar(nuevaRespiracion(estado));
      dibujar(); actualizarSonido(); sincronizarPanel();
    }
  }
  const barra = contenedor.querySelector('[data-barra]');
  if (barra && estado.encendido && estado.retroiluminacion) {
    const p = presionInstantanea(estado, faseRespiracion);
    const clave = `${p.toFixed(1)}|${estado.limites.pico.high}|${estado.limites.pico.enabled}`;
    if (barra.dataset.p !== clave) { barra.innerHTML = rellenoBarra(estado, p); barra.dataset.p = clave; }
  }
  requestAnimationFrame(cuadro);
}

iniciar();

// Para depuración y pruebas automáticas del navegador.
window.__prosventi = { obtenerEstado: () => estado, cargar: cargarEscenario };
