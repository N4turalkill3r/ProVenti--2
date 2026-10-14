# PWA: instalación, uso sin conexión y actualización (Fase 9)

## Archivos
- `manifest.webmanifest`: nombre, iconos, `display: standalone`, `start_url` y `scope` relativos (`./`).
- `service-worker.js`: caché versionada `prosventi-<VERSION>` y estrategias de respuesta.
- `js/pwa.js`: registro, estado de conexión, verificación de caché, instalación y actualización.
- `js/version.js`: versión que muestra la aplicación.
- `icons/`: logotipo propio en SVG y PNG (192, 512, enmascarable 512 y 180 para iOS).
- `404.html` y `.nojekyll`: requeridos para GitHub Pages.

## Estrategia de caché
| Petición | Estrategia | Motivo |
|---|---|---|
| Navegación (HTML) | Red primero, 4 s de espera máxima; si falla, `index.html` en caché | Que una versión publicada llegue pronto, pero que abra sin red |
| CSS, JS, iconos, manifiesto | Caché primero | Rapidez y uso sin conexión |
| Otras solicitudes | Red | No se guarda nada que no esté en la lista |

La instalación usa `cache.addAll` con `cache: 'reload'`: si falta un solo recurso, la instalación falla y sigue activa la versión anterior. Nunca queda una caché incompleta activa.

## Cuándo se muestra "Disponible sin conexión"
La aplicación no lo afirma por registrar el service worker. Le pregunta al service worker la lista de recursos y comprueba uno por uno que estén en la caché. Solo si están todos aparece el indicador. Si faltan archivos, el panel "Aplicación" lo indica ("No disponible… faltan archivos") y no aparece el indicador.

## Actualizar una versión
1. Cambie `VERSION` en `service-worker.js`, `js/version.js` y `package.json` (la prueba `tests/pwa-tests.js` falla si no coinciden).
2. Si agrega o renombra un archivo de `css/`, `js/` o `icons/`, inclúyalo en `RECURSOS` (la prueba también lo verifica).
3. Publique. Al abrir la aplicación, o cada 30 minutos, o al volver a la pestaña, se busca la versión nueva.
4. La persona ve el aviso "Hay una versión nueva del simulador" con **Actualizar ahora** o **Más tarde**. No se recarga sola mientras se practica.
5. Al activar, se borran las cachés `prosventi-*` anteriores y la página se recarga una vez.

## Datos guardados en el dispositivo
Solo preferencias de la interfaz (encuadre, panel de controles) y la caché de la aplicación. No se guarda ningún dato clínico ni personal. El botón **Borrar datos guardados** (panel "Aplicación") elimina las preferencias; la copia para uso sin conexión se mantiene.

## Servidores locales (Live Server, http.server)
En `localhost` y `127.0.0.1` el service worker **se desactiva** y se eliminan sus cachés y registros anteriores, para que los cambios en los archivos se vean al recargar y no queden copias viejas. Para probar el modo sin conexión en local, abra `http://localhost:PUERTO/index.html?sw=1`. En GitHub Pages (HTTPS) funciona siempre.

## Si la página aparece en blanco
Si la aplicación no arranca, la página muestra el aviso «El simulador no pudo iniciar» con la causa probable. La más común es abrir `index.html` con doble clic (`file://`): los navegadores bloquean los módulos JavaScript. Use Live Server o `python3 -m http.server`.

## Requisitos y límites conocidos
- Requiere HTTPS (GitHub Pages lo cumple) o `localhost`. No funciona desde `file://`.
- Instalación en iPhone/iPad: Safari → Compartir → "Añadir a pantalla de inicio" (iOS no muestra el botón Instalar propio).
- Instalación en Android/Chrome y escritorio: botón **Instalar aplicación** del panel cuando el navegador lo permite.
- Verificado con Chromium automatizado (registro, caché completa, recarga sin conexión, actualización y borrado de la caché vieja). **No se ha probado en dispositivos reales** (iOS Safari, Android Chrome).
- La primera carga necesita conexión. iOS puede borrar la caché de apps que no se usan durante semanas.
- El audio requiere un toque previo del usuario en el navegador (política de reproducción automática).
