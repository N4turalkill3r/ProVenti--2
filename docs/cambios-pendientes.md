# Cambios pendientes (solicitados el 2026-10-13, sin aplicar)

Estado: **aplicados en la versión 1.1.0** (el cambio 8 se canceló).

## Lista tal como la pidió el usuario
1. En PRINC, INSP no debe afectar el VC. Al aumentar INSP cambian E e I/E; el VC es inmutable.
2. El VC es afectado directamente por la PICO (presión pico): si aumenta la PICO aumenta el VC (directamente proporcional).
3. Las tres perillas de abajo también modifican los parámetros de la pantalla, sincronizadas así: PRES MÁX → PICO; PEEP → PEEP (o CPAP); FLUJO → FLUJO en pantalla.
4. Permitir girar la perilla de FiO2 aunque no tenga función en la pantalla (útil para la simulación).
5. La barra de presión (izquierda de la pantalla) se mueve junto con la perilla y con el valor pico de la línea numérica; simula las respiraciones del paciente y sube hasta la presión máxima de cada respiración.
6. DISP. FLUJO activable según las reglas ya establecidas, con rango 0,5–10 L/min. Cuando el valor supere 3 (hasta 10), de forma aleatoria o no, la FREC puede aumentar 0 %, 5 %, 10 % o 15 %. Ese aumento se ve solo en el panel de alarmas, no en PRINC.
7. Cuando una alarma se activa (por ejemplo PICO), parpadea la pestaña que la contiene (en el ejemplo, ALARMA1).
8. Renombrar DISP. PRES a PRES. SOPORT con las mismas funciones.

## Dudas por aclarar antes de implementar
1. **INSP/VC:** hoy VC = INSP × FLUJO. Si el VC no cambia al mover INSP, ¿qué absorbe el cambio: el flujo se recalcula, o INSP y VC quedan independientes? ¿Se conserva la tecla CONFIG (elegir VC o INSP)?
2. **PICO → VC:** ¿es el VC programado, o el VCE medido? ¿Con qué relación (constante o compliance, por ejemplo ml por cmH2O)? Hoy PICO y VCE los fija el instructor.
3. **Perillas:** ¿PRES MÁX pasa a ser la PICO medida (y el instructor deja de editarla), o la PICO sigue al ajuste? Hoy PRES MÁX es el ajuste de presión máxima y PICO es medida. PEEP en CPAP: ¿se refiere al nivel de CPAP? Con flujo constante, el flujo máximo es 29.
4. **FiO2:** ¿solo gira y muestra su valor, o también fija el O2 medido del panel de alarmas?
5. **Barra de presión:** requiere un ciclo respiratorio animado (frecuencia, I:E). Cambia la decisión anterior de "sin simulación fisiológica". ¿Debe respetar pausa, proyección y "reducir movimiento"? ¿La PICO medida seguirá siendo fijada por el instructor?
6. **DISP. FLUJO:** ¿paso del ajuste (0,1 hasta 3 y 0,5 después, por ejemplo)? ¿El aumento de FREC es aleatorio en cada respiración, o fijo por sesión? ¿Se aplica a la FREC medida del panel de alarmas?
7. **Parpadeo:** ¿parpadea también cuando ya se está viendo ese menú, y se detiene al silenciar o al normalizarse la alarma? Hoy solo parpadea con silencio activo y alarma en otro menú.
8. **Nombre:** ya existe la tecla SOPORTE PRES (soporte de presión). «PRES. SOPORT» se parecería mucho; confirmar que no se confunden y que DISP. PRES (disparo por presión) es la tecla que se renombra.

## Archivos que probablemente se tocarán
`js/config.js`, `js/utils.js`, `js/state.js`, `js/interaction.js`, `js/engine.js`, `js/ventilator-renderer.js`, `js/app.js`, tests (parameter, interaction, engine, validation) y docs (operation-rules, simulation-engine, validation, limitations).

## Respuestas del usuario (2026-10-13 10:29)
1. INSP es el tiempo inspiratorio. VC es el volumen corriente, **resultado de la presión** que el ventilador entrega al pulmón. El **flujo es un valor que el usuario edita; no se calcula**. Mover INSP solo cambia E e I/E.
2. PICO y VC son directamente proporcionales: **17 ml por cada unidad de PICO**, con una variación aleatoria de **0 a 10 %** (sube o baja).
3. La PICO sigue a la perilla PRES MÁX y también actualiza el valor en el **panel del instructor**.
4. La perilla de O2 sí cambia el O2 del panel de alarmas.
5. La barra de presión respeta **pausa y proyección**. En **cada espiración** hay una variación aleatoria de **0 a 3 %** en el valor.
6. DISP. FLUJO es un valor programado fijo: determina la sensibilidad del ventilador para disparar una respiración. El aumento de FREC ocurre **cada vez que se cambia el valor** y se mantiene **estático** hasta el siguiente cambio (no es aleatorio por respiración).
7. Una alarma activa mantiene el parpadeo de su pestaña **hasta que se resuelve**. SILENCIAR ALARMA silencia **todas** las alarmas por el tiempo establecido (60 s, 120 s).
8. **No modificar** el nombre: DISP. PRES se queda como está. (Queda sin efecto el cambio 8.)

## Dudas que siguen abiertas
- **Tecla VC y CONFIG:** si el VC es resultado de la presión, ¿el VC de PRINC pasa a mostrarse solo (no editable)? ¿Qué pasa con CONFIG (elegir VC o INSP)?
- **DISP. FLUJO:** rango 0,5–10 L/min; falta el paso del ajuste (propuesta: 0,1 hasta 3 y 0,5 después).
- **Parpadeo con silencio:** ¿al silenciar se detiene solo el sonido y la pestaña sigue parpadeando hasta resolverse?
- **Variación del VC (0–10 %):** ¿se vuelve a sortear en cada respiración, junto con la variación de presión de 0–3 %?

## Respuestas finales a las dudas (2026-10-13 14:47)
1. **VC en pantalla:** es solo resultado (VC = 17 ml × PICO ± 0–10 %); desde la pantalla **no se puede modificar**. En el **panel del instructor** sí se puede cambiar el VC para simular un cambio en la dinámica respiratoria, y con la misma fórmula **cambia la presión (PICO)**.
2. **DISP. FLUJO:** valor programable 0, 0,1, 0,2 … 1,0, 1,1 … hasta 10 (paso de 0,1 en todo el rango).
3. **Parpadeo:** al silenciar solo se calla el sonido; la pestaña sigue parpadeando hasta que la alarma se resuelva.
4. **Variación del VC (0–10 %):** se sortea **en cada respiración** (igual que la variación de presión de 0–3 % en cada espiración).

## Supuestos míos a confirmar al aplicar (no los preguntaré antes; se verán en la prueba)
- DISP. FLUJO = 0 equivale a APAGADO, y el panel de la tecla sigue bloqueándose por las reglas del Apéndice C (por ejemplo, exige neumotacógrafo).
- La tecla CONFIG (elegir VC o INSP) deja de tener efecto sobre el VC; INSP se sigue ajustando y solo cambia E e I/E.
- Hoy el instructor fija VCE, VME, PICO, etc. Con este cambio el VCE sale de la fórmula (17 × PICO ± 0–10 %) y el VME de VCE × FREC; el instructor puede seguir editando PICO o VC, y el resto se recalcula.
- Los números 17 ml/cmH2O, 0–10 % y 0–3 % irán en `config.js` para poder ajustarlos.

## Respuestas a los supuestos (2026-10-13 15:08)
1. DISP. FLUJO 0,0 es APAGADO. 2. VC e INSP se muestran; INSP no afecta al VC pero sí a E e I/E. 3 y 4: confirmados.

Estado: **APLICADO en la versión 1.1.0** (cambios 1 a 7; el 8 quedó cancelado). Ver `docs/dynamics.md`.

## Rediseño de alarmas (2026-10-14) — APLICADO en la versión 1.2.0
1. Alarmas dinámicas: se activan cuando un valor medido o programado sale de los límites de ALARMA1/ALARMA2.
2. Cada alarma indica su motivo (lista con luz roja intermitente, flecha ▲/▼ y valor en rojo).
3. Luz roja en la pestaña ALARMA1/ALARMA2 que aloja la alarma activa.
4. DISP. FLUJO no genera alarma ni activa/desactiva otras funciones (se añadió el selector de neumotacógrafo en el panel del instructor).
5. La barra de presión hace una respiración por ciclo de FREC (FREC 12 ⇒ 12 por minuto); se corrigió el salto al pico en cada redibujado.
