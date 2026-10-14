# Validación contra el manual (Fase 10)

La validación es automática: `tests/validation-tests.js` contiene una **tabla del manual escrita aparte** de `js/config.js` y falla si cualquiera de los dos cambia sin el otro. Se ejecuta con `npm test`.

## Parámetros programables (págs. 10, 11, 18 y 19)

| Parámetro | Rango | Resolución | Inicial | Estado |
|---|---|---|---|---|
| FREC (A/C) | 5–150 rpm | 1 | 12 | C |
| FREC SIMV | 0,6–50 rpm | 0,1 hasta 10; 1 sobre 10 | 10 (decisión del usuario; el manual indica 4) | C / decisión |
| FREC RESPALDO (CPAP) | 5–30 rpm | 1 | 12 | I (decisión del usuario) |
| VC (programación del manual) | 5–990 ml | 1 hasta 200; 10 sobre 200 | **resultado de la presión: 17 ml × PRES MÁX = 595** (ya no se programa en pantalla) | C / decisión |
| INSP | 0,1–3,0 s | 0,05 hasta 1,0; 0,1 sobre 1,0 | 1,0 | C |
| FLUJO (perilla) | 1–50 L/min | 0,1 hasta 10; 1 sobre 10 | 30 | I (decisión del usuario) |
| DISP. PRES | 0,2–10 cmH2O | 0,1 hasta 3; 1 sobre 3 | 1 | C |
| DISP. FLUJO | **0,1–10 L/min (0,0 = APAGADO)** | 0,1 | APAGADO | decisión del usuario (el manual indica 1–20) |
| SOPORTE PRES | 1–50 cmH2O | 1 | APAGADO | C |
| PEEP (perilla) | 0–20 cmH2O | 1 | 5 | I (decisión del usuario) |
| PRES MÁX (perilla) | 0–80 cmH2O | 1 | 35 | I (decisión del usuario) |

La fórmula del VC, las variaciones aleatorias y el efecto de las perillas se describen en `docs/dynamics.md`.

Con flujo constante el flujo máximo es 29 L/min y el INSP máximo 3,0 s (pág. 17).

## Límites de alarma (pág. 21)

| Alarma | LOW | HIGH | Predeterminado (I) |
|---|---|---|---|
| PICO | 3–89 | 4–90 | 10 / 40 |
| FREC | 4–159 | 5–160 | 8 / 20 |
| VCE | 5–1299 | 6–1300 | 350 / 750 |
| VME | 0–44 | 1–45 | 4 / 10 |
| PEEP | −1–29 | 0–30 | 3 / 8 |
| MEDIA | 0–89 | 1–90 | 5 / 20 |
| O2 | 18–100 | 19–105 | 18 / 100 |

## Qué comprueban las pruebas automáticas
1. Los rangos y resoluciones de cada parámetro coinciden con la tabla del manual.
2. Los rangos de alarma coinciden con la pág. 21 y los valores predeterminados caen dentro de ellos, sin alarma al encender.
3. Recorriendo cada parámetro con las flechas de un extremo al otro: no sale del rango, avanza siempre en el sentido correcto y se detiene exactamente en el mínimo y el máximo.
4. **Prueba de acciones aleatorias:** 30 sesiones de 1000 acciones (teclas, flechas, perillas, nebulizador, tiempo, valores medidos, batería, gas y fallos). Después de cada acción se verifica que ningún ajuste salga de su rango, que los límites de alarma sean válidos, que DISP. PRES y FLUJO CONSTANTE sean excluyentes (DISP. FLUJO es independiente), que el flujo no pase de 29 con flujo constante y que el estado sea siempre serializable. En la ejecución de referencia visitó los tres modos, todos los menús, alarmas activas, nebulizador, flujo constante y teclas seleccionadas.
5. El estado no contiene campos de datos clínicos ni personales.
6. Dinámica (`tests/dynamics-tests.js`, 33 pruebas; incluye motivos de alarma, luz de pestaña, DISP. FLUJO sin alarmas ni efectos y barra a una respiración por ciclo de FREC): VC = 17 ml × PICO, INSP no cambia el VC, variaciones de ±3 % y ±10 % con valores extremos del azar, perillas y panel del instructor, DISP. FLUJO (rango, pasos, aumento de FREC fijo hasta el siguiente cambio), forma de la presión de la barra y parpadeo de ALARMA1/ALARMA2. El fuzz también comprueba VC = VCE, que el aumento de FREC sea 0/5/10/15 % y que sea 0 con DISP. FLUJO apagado o ≤ 3.

## Prueba de extremo a extremo en navegador (Chromium)
27 comprobaciones del recorrido general y 40 de la dinámica (perillas arrastradas con el puntero, barra animada, pausa y proyección, DISP. FLUJO, alarmas sin cambio de menú con parpadeo rojo y sonido que empieza y termina con el valor). Recorrido general: aviso educativo visible, textos en español, cambio de modo, ajustes con flechas, bloqueo y desbloqueo, nota de SUSPIRO, alarma por valor del instructor con cambio automático de menú y silencio, modo batería, pausa, proyección, almacenamiento local solo con claves `prosventi.*`, aviso de privacidad, móvil sin desplazamiento horizontal y ausencia de errores de consola. Esta prueba usa un navegador automatizado y se ejecutó fuera del repositorio (no forma parte de `npm test`).

## Lo que NO valida esta prueba
- Que el manual traducido (automático) sea correcto: ante la duda prevalece el manual en inglés.
- El comportamiento en dispositivos reales (iOS Safari, Android Chrome) ni con lectores de pantalla.
- Que los sonidos se parezcan al equipo real: son sintetizados y rotulados como educativos.
