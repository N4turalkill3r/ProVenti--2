# Prosventi V-2.0 — Simulador educativo de ventilador de transporte

Aplicación web progresiva (PWA) para entrenar al personal médico en la operación de la interfaz de un ventilador mecánico de transporte.

> **AVISO:** esto es un simulador educativo. No controla equipos físicos y no debe usarse para tratar pacientes.

## Estado del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Análisis del manual | Hecha |
| 2 | Especificación funcional y mapa visual | Hecha |
| 3 | Arquitectura de archivos y modelo de datos | Hecha |
| 4 | Interfaz estática (SVG) | Hecha |
| 5 | Controles interactivos | Hecha |
| 6 | Motor de simulación: alarmas, AUTO AJUSTE, sonidos, panel básico del instructor | Hecha |
| 7 | Modo de proyección y modo de control discreto | Hecha |
| 8 | Adaptación a móviles y tabletas | Hecha |
| 9 | PWA: manifiesto, service worker, instalación, uso sin conexión y actualización | Hecha |
| 10 | Pruebas finales, validación contra el manual y guía de publicación en GitHub Pages | Hecha |
| 1.1.0 | Cambios del usuario: VC = 17 ml × PICO, perillas sincronizadas y perilla de O2, DISP. FLUJO 0,1–10, barra de presión animada, parpadeo de ALARMA1/2 | Hecha |
| 1.2.0 | Rediseño de alarmas: motivo de cada alarma con luz roja, luz en la pestaña, DISP. FLUJO independiente, barra de presión según la FREC | Hecha |
| 1.2.1 | Alarma de VME (límites y silenciar) en el panel del instructor | **Hecha (esta entrega)** |

## Estructura

```
ventilador-pwa/
├── index.html            (Fase 4)
├── manifest.webmanifest  Manifiesto de la PWA
├── service-worker.js     Caché con versión, uso sin conexión y actualización
├── 404.html, .nojekyll   Archivos para GitHub Pages
├── icons/                Logotipo propio (SVG y PNG, incluido icono enmascarable)
├── css/
├── js/
│   ├── config.js         Rangos, valores predeterminados, alarmas, reglas, textos en español
│   ├── brand.config.js   Marca y nombre (intercambiable)
│   ├── utils.js          Funciones puras: límites, pasos, tiempos I/E
│   ├── state.js          Estado inicial, validación y dependencias entre teclas
│   ├── ventilator-renderer.js  Dibuja el equipo completo en SVG a partir del estado
│   ├── dynamics.js       Dinámica respiratoria: VC, PICO, FREC, variaciones y forma de la presión (sin DOM)
│   ├── random.js         Fuente de azar única (sustituible en pruebas)
│   ├── engine.js         Alarmas, silencio, AUTO AJUSTE y patrón sonoro (sin DOM)
│   ├── modes.js          Cajón de controles y proyección (pantalla completa, salida, bloqueo de pantalla)
│   ├── indicators.js     Indicadores de estado de la simulación (sin DOM)
│   ├── pwa.js            Registro del service worker, instalación, actualización y estado sin conexión
│   ├── version.js        Versión de la aplicación (debe coincidir con service-worker.js y package.json)
│   ├── audio.js          Sonidos con Web Audio (códigos del Apéndice D)
│   ├── interaction.js    Teclas, flechas, perillas, bloqueo, silencio y temporizadores (sin DOM)
│   ├── app.js            Eventos del navegador, escenarios de prueba y nota de SUSPIRO
│   └── (resto en fases siguientes)
├── docs/
│   ├── technical-specification.md
│   ├── pdf-extraction.md
│   ├── simulation-limitations.md
│   ├── visual-differences.md
│   ├── operation-rules.md
│   ├── simulation-engine.md
│   ├── modes.md
│   ├── responsive.md
│   ├── pwa.md
│   ├── dynamics.md
│   ├── validation.md
│   └── publishing.md
└── tests/
    ├── parameter-tests.js
    ├── render-tests.js
    ├── interaction-tests.js
    ├── engine-tests.js
    ├── indicators-tests.js
    ├── dynamics-tests.js
    ├── pwa-tests.js
    └── validation-tests.js
```

## Probar el modelo de datos

Requiere Node.js 18 o superior (solo para las pruebas; la aplicación final es estática).

```
cd ventilador-pwa
npm test
```

## Ver la interfaz

Los módulos ES no cargan desde `file://`; use un servidor local:

```
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Publicar

Vea `docs/publishing.md` (9 pasos para GitHub Pages) y `docs/validation.md` (qué se validó y qué no).

## Convenciones

- Todo el texto visible está en español (`js/config.js`, sección `TEXTOS`).
- Cada dato técnico lleva su estado: **C** confirmado en el manual, **I** inferencia de diseño, **P** pendiente de validar.
- Las rutas son relativas para que funcione en GitHub Pages.
