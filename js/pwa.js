// Funciones PWA: registro del service worker, actualización, instalación y estado sin conexión.
// No afirma que la aplicación funcione sin conexión hasta comprobar que todos los recursos están en la caché.
import { VERSION } from './version.js';

export function iniciarPWA({ alCambiar = () => {} } = {}) {
  const estado = {
    version: VERSION,
    soporte: 'serviceWorker' in navigator && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(location.hostname)),
    sw: 'sin-soporte',                // 'sin-soporte' | 'registrando' | 'activo' | 'error'
    offline: 'desconocido',           // 'desconocido' | 'preparando' | 'listo' | 'incompleto'
    faltan: [],
    conexion: navigator.onLine ? 'conectado' : 'sin-conexion',
    actualizacion: false,             // hay una versión nueva esperando
    puedeInstalar: false,
    instalada: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
    error: '',
  };
  const emitir = () => alCambiar({ ...estado });
  let registro = null;
  let instalador = null;
  let recargando = false;

  window.addEventListener('online', () => { estado.conexion = 'conectado'; emitir(); });
  window.addEventListener('offline', () => { estado.conexion = 'sin-conexion'; emitir(); });
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); instalador = ev; estado.puedeInstalar = true; emitir(); });
  window.addEventListener('appinstalled', () => { instalador = null; estado.puedeInstalar = false; estado.instalada = true; emitir(); });

  // Comprueba que cada recurso esencial está de verdad en la caché de esta versión.
  async function verificarCache(info) {
    try {
      const cache = await caches.open(info.cache);
      const faltan = [];
      for (const url of info.recursos) if (!(await cache.match(url, { ignoreSearch: true }))) faltan.push(url);
      estado.faltan = faltan;
      estado.offline = faltan.length ? 'incompleto' : 'listo';
    } catch (e) { estado.offline = 'incompleto'; estado.error = String(e); }
    emitir();
  }

  function pedirVersion() {
    const sw = registro && (registro.active || navigator.serviceWorker.controller);
    if (sw) sw.postMessage('VERSION');
  }

  function vigilar(reg) {
    const revisar = (trabajador) => {
      if (!trabajador) return;
      trabajador.addEventListener('statechange', () => {
        if (trabajador.state === 'installed' && navigator.serviceWorker.controller) { estado.actualizacion = true; emitir(); }
        if (trabajador.state === 'activated') pedirVersion();
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) { estado.actualizacion = true; emitir(); }
    revisar(reg.installing);
    reg.addEventListener('updatefound', () => revisar(reg.installing));
  }

  // En un servidor local (Live Server, http.server) el service worker se desactiva para que los cambios
  // en los archivos se vean al recargar. Para probar el modo sin conexión en local, agregue ?sw=1 a la dirección.
  const desarrolloLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !new URLSearchParams(location.search).has('sw');

  async function iniciar() {
    if (desarrolloLocal && 'serviceWorker' in navigator) {
      try {
        for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        for (const n of await caches.keys()) if (n.startsWith('prosventi-')) await caches.delete(n);
      } catch { /* sin acceso: se ignora */ }
      estado.sw = 'desarrollo'; emitir(); return;
    }
    if (!estado.soporte) { estado.sw = 'sin-soporte'; emitir(); return; }
    estado.sw = 'registrando'; estado.offline = 'preparando'; emitir();
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data && ev.data.tipo === 'version') verificarCache(ev.data);
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return;
      if (estado.actualizacion) { recargando = true; location.reload(); }
    });
    try {
      // updateViaCache: 'none' hace que el navegador pida siempre a la red el archivo del service worker.
      registro = await navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' });
      vigilar(registro);
      estado.sw = 'activo';
      await navigator.serviceWorker.ready;
      pedirVersion();
      emitir();
      // Busca versiones nuevas al volver a la aplicación y cada 30 minutos.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') registro.update().catch(() => {}); });
      setInterval(() => registro.update().catch(() => {}), 30 * 60 * 1000);
    } catch (e) {
      estado.sw = 'error'; estado.offline = 'incompleto'; estado.error = String(e);
      console.warn('No se pudo registrar el service worker:', e);
      emitir();
    }
  }

  return {
    iniciar,
    estado: () => ({ ...estado }),
    async buscarActualizacion() {
      if (!registro) return false;
      try { await registro.update(); } catch { return false; }
      return Boolean(registro.waiting) || estado.actualizacion;
    },
    // Activa la versión nueva: recarga la página (la simulación se reinicia).
    aplicarActualizacion() {
      if (registro && registro.waiting) registro.waiting.postMessage('SALTAR_ESPERA');
      else location.reload();
    },
    descartarActualizacion() { estado.actualizacion = false; emitir(); },
    async instalar() {
      if (!instalador) return 'no-disponible';
      instalador.prompt();
      const r = await instalador.userChoice;
      instalador = null; estado.puedeInstalar = false; emitir();
      return r.outcome;
    },
  };
}
