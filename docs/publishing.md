# Publicar en GitHub Pages (Fase 10)

Requisitos: una cuenta gratuita de GitHub. En cuentas gratuitas, GitHub Pages exige un repositorio **público**: cualquiera con la dirección podrá abrir el simulador. No suba datos personales ni clínicos (la aplicación no los usa).

## 1. Crear el repositorio
1. Entre a github.com e inicie sesión → botón **+** (arriba a la derecha) → **New repository**.
2. Nombre sugerido: `prosventi-v2` (solo letras minúsculas, números y guiones). Esto formará la dirección final.
3. Visibilidad **Public**. No marque "Add a README" (el proyecto ya trae uno). → **Create repository**.

## 2. Organizar los archivos
Descomprima `ventilador-pwa-fase10.zip`. **`index.html` debe quedar en la raíz del repositorio**, no dentro de otra carpeta. Estructura que debe ver en GitHub:
```
index.html  manifest.webmanifest  service-worker.js  404.html  .nojekyll  README.md  package.json
css/  js/  icons/  docs/  tests/
```
`docs/` y `tests/` son opcionales para publicar; el simulador funciona sin ellas.

## 3. Subir los archivos
Opción A, desde el navegador:
1. En el repositorio nuevo, enlace **uploading an existing file**.
2. Arrastre **el contenido** de la carpeta (todo lo de dentro, incluidas las carpetas `css`, `js`, `icons`). Verifique que `.nojekyll` también se subió (es un archivo oculto: en macOS Finder use Cmd+Mayús+. para verlo).
3. Escriba un mensaje (por ejemplo "Prosventi V-2.0 versión 1.0") → **Commit changes**.

Opción B, con Git:
```
cd ventilador-pwa
git init
git add .
git commit -m "Prosventi V-2.0 versión 1.0"
git branch -M main
git remote add origin https://github.com/USUARIO/prosventi-v2.git
git push -u origin main
```

## 4. Configurar Pages
**Settings** → **Pages** (menú izquierdo) → en *Build and deployment*, **Source: Deploy from a branch** → Branch **main**, carpeta **/ (root)** → **Save**.

## 5. Esperar la publicación
En la pestaña **Actions** aparece "pages build and deployment". Tarda entre 1 y 3 minutos; cuando tiene la marca verde está publicado. En **Settings → Pages** aparece "Your site is live at…".

## 6. Abrir la dirección
`https://USUARIO.github.io/prosventi-v2/`

Si ve la página 404 de GitHub, espere un minuto y recargue con Ctrl/Cmd+Mayús+R. Si persiste, compruebe que `index.html` esté en la raíz y que el paso 4 se guardó.

## 7. Instalar
- **Android / Chrome / Edge:** botón **Instalar aplicación** del panel "Aplicación y sin conexión" o el icono de instalar de la barra de direcciones.
- **iPhone / iPad (Safari):** Compartir → **Añadir a pantalla de inicio**.

## 8. Publicar una actualización
1. Cambie el número de versión **en los tres sitios**: `service-worker.js` (`VERSION`), `js/version.js` y `package.json`. `npm test` falla si no coinciden.
2. Si agregó o renombró archivos de `css/`, `js/` o `icons/`, inclúyalos en `RECURSOS` de `service-worker.js` (también lo verifica `npm test`).
3. Suba los archivos cambiados (paso 3). Espere el paso 5.
4. Quien tenga la app abierta verá el aviso "Hay una versión nueva" y elegirá **Actualizar ahora** o **Más tarde**.

## 9. Verificar recursos y modo sin conexión
Abra la dirección en Chrome o Edge → F12 (herramientas del desarrollador):
1. **Application → Manifest:** sin errores; se ven nombre, iconos y "Installable".
2. **Application → Service Workers:** estado *activated and is running*.
3. **Application → Cache Storage → `prosventi-<versión>`:** deben estar listados todos los archivos (la lista está en `RECURSOS`).
4. **Network:** marque **Offline** y recargue: el simulador debe abrir y operar. En el panel "Aplicación y sin conexión" debe decir "Lista: todos los archivos están guardados".
5. **Console:** sin errores en rojo.
6. Pruebe la dirección en un móvil real (Android y iPhone si es posible): instalar, abrir con el modo avión activado y operar.

## Probar en el equipo antes de subir
En Visual Studio Code abra la **carpeta del proyecto** (la que contiene `index.html`), clic derecho en `index.html` → **Open with Live Server**. No abra `index.html` con doble clic: el navegador bloquea los módulos (`file://`) y verá el aviso «El simulador no pudo iniciar». En local el modo sin conexión está desactivado a propósito; use `?sw=1` al final de la dirección para probarlo.

## Problemas frecuentes
| Síntoma | Causa probable | Solución |
|---|---|---|
| Pantalla en blanco o aviso «no pudo iniciar» | Abierto con doble clic (`file://`), o archivos dentro de una subcarpeta extra | Usar un servidor; mover `index.html` a la raíz |
| Falta el estilo o el equipo no se dibuja | No se subió `css/` o `js/` | Subir las carpetas completas |
| No ofrece instalar | No está en HTTPS o ya está instalada | Usar la dirección `https://…github.io` |
| Sigue viendo la versión vieja | Aún no activó la actualización | Pulsar **Actualizar ahora** o cerrar todas las pestañas y volver a abrir |
| "Disponible sin conexión" no aparece | Falta un archivo en la caché | Panel "Aplicación": indica cuáles faltan; revisar `RECURSOS` |

## Aviso sobre el diseño
El simulador redibuja la interfaz con gráficos propios y marca propia (Prosventi V-2.0), pero reproduce la disposición de un equipo comercial. Esto reduce, pero **no elimina**, el riesgo de propiedad intelectual. Antes de difundirlo públicamente, obtenga permiso escrito del fabricante o asesoría legal.
