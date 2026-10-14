// Pruebas de la PWA: manifiesto, iconos, lista de recursos del service worker, versiones y rutas relativas.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(join(raiz, r), 'utf8');
let total = 0;
function prueba(nombre, fn) { fn(); total += 1; console.log(`  ok   ${nombre}`); }

const sw = leer('service-worker.js');
const manifiesto = JSON.parse(leer('manifest.webmanifest'));
const html = leer('index.html');
const recursos = [...sw.match(/const RECURSOS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

// Dimensiones de un PNG leídas de su cabecera IHDR.
function dimPNG(ruta) {
  const b = readFileSync(join(raiz, ruta));
  assert.equal(b.toString('ascii', 1, 4), 'PNG', `${ruta} no es PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

// Archivos locales que carga la aplicación: index.html, módulos JS importados y CSS.
function recursosCargados() {
  const set = new Set(['index.html', 'manifest.webmanifest']);
  for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) if (!/^(https?:|data:)/.test(m[1])) set.add(m[1]);
  const cola = ['js/app.js'];
  const vistos = new Set();
  while (cola.length) {
    const f = cola.pop();
    if (vistos.has(f)) continue;
    vistos.add(f); set.add(f);
    for (const m of leer(f).matchAll(/(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      cola.push(relative(raiz, normalize(join(raiz, dirname(f), m[1] || m[2]))));
    }
  }
  return set;
}

console.log('PWA');

prueba('Manifiesto: campos obligatorios, rutas relativas y modo independiente', () => {
  assert.equal(manifiesto.display, 'standalone');
  assert.equal(manifiesto.lang, 'es');
  assert.ok(manifiesto.name && manifiesto.short_name);
  for (const campo of ['start_url', 'scope', 'id']) assert.ok(!manifiesto[campo].startsWith('/'), `${campo} no debe ser absoluta`);
  assert.ok(existsSync(join(raiz, manifiesto.start_url)));
  assert.match(manifiesto.theme_color, /^#[0-9a-f]{6}$/i);
});

prueba('Manifiesto: iconos existen con el tamaño declarado y hay uno enmascarable', () => {
  for (const ic of manifiesto.icons) {
    assert.ok(existsSync(join(raiz, 'icons', ic.src.replace('icons/', ''))), `falta ${ic.src}`);
    if (ic.type === 'image/png') {
      const [w, h] = ic.sizes.split('x').map(Number);
      assert.deepEqual(dimPNG(ic.src), [w, h], `tamaño incorrecto en ${ic.src}`);
    }
  }
  assert.ok(manifiesto.icons.some((i) => i.purpose === 'maskable'));
  assert.ok(manifiesto.icons.some((i) => i.sizes === '192x192') && manifiesto.icons.some((i) => i.sizes === '512x512'));
  assert.deepEqual(dimPNG('icons/apple-touch-icon.png'), [180, 180]);
});

prueba('Service worker: la lista de recursos cubre todo lo que carga la aplicación', () => {
  const lista = new Set(recursos.map((r) => r.replace(/^\.\//, '')));
  for (const r of recursosCargados()) {
    if (r === 'index.html' || r === 'manifest.webmanifest' || r.startsWith('css/') || r.startsWith('js/') || r.startsWith('icons/')) {
      assert.ok(lista.has(r), `falta en RECURSOS: ${r}`);
    }
  }
  assert.ok(recursos.includes('./') && recursos.includes('./index.html'));
});

prueba('Service worker: todos los recursos listados existen y no hay duplicados', () => {
  for (const r of recursos) if (r !== './') assert.ok(existsSync(join(raiz, r)), `no existe ${r}`);
  assert.equal(new Set(recursos).size, recursos.length);
});

prueba('Todos los JS y CSS del proyecto están en la lista (no sobra ni falta ninguno)', () => {
  const lista = new Set(recursos.map((r) => r.replace(/^\.\//, '')));
  for (const [dir, ext] of [['js', '.js'], ['css', '.css']]) {
    for (const f of readdirSync(join(raiz, dir)).filter((x) => x.endsWith(ext))) assert.ok(lista.has(`${dir}/${f}`), `${dir}/${f} no está en RECURSOS`);
  }
});

prueba('La versión coincide en service-worker.js, js/version.js y package.json', () => {
  const swV = sw.match(/const VERSION = '([^']+)'/)[1];
  const jsV = leer('js/version.js').match(/VERSION = '([^']+)'/)[1];
  const pkV = JSON.parse(leer('package.json')).version;
  assert.equal(swV, jsV); assert.equal(swV, pkV);
  assert.match(sw, /const CACHE = `prosventi-\$\{VERSION\}`/);
});

prueba('Sin rutas absolutas (compatible con GitHub Pages en subcarpeta)', () => {
  assert.ok(!/(?:href|src)="\//.test(html), 'index.html tiene una ruta absoluta');
  assert.ok(!/(?:start_url|scope|src)"\s*:\s*"\//.test(leer('manifest.webmanifest')));
  assert.ok(!/['"]\/[a-z]/i.test(sw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/[^/\n]+\/[gimsuy]*\.test|\.match\(\/[^\n]*/g, '')), 'el service worker usa rutas absolutas');
});

prueba('El service worker activa la limpieza de cachés viejas y no salta la espera por sí solo', () => {
  assert.match(sw, /caches\.delete/);
  assert.match(sw, /SALTAR_ESPERA/);
  assert.ok(!/addEventListener\('install'[\s\S]*?skipWaiting[\s\S]*?addEventListener\('activate'/.test(sw), 'skipWaiting automático en install');
});

prueba('Archivos para GitHub Pages: .nojekyll y 404.html', () => {
  assert.ok(existsSync(join(raiz, '.nojekyll')));
  assert.ok(existsSync(join(raiz, '404.html')));
});

prueba('index.html declara manifiesto, iconos y aviso educativo visible', () => {
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /theme-color/);
  assert.match(html, /educativ/i);
});

console.log(`\n${total} pruebas de PWA pasadas`);
