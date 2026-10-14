# Dinámica respiratoria simulada (versión 1.2.1)

Los valores que muestra el equipo ya no son independientes: se derivan de los ajustes con reglas sencillas. Todos los números están en `js/config.js` (`DINAMICA`, `O2_PERILLA`) y la lógica en `js/dynamics.js` (sin DOM).

## Fórmulas
| Valor | Cómo se obtiene |
|---|---|
| PICO | Perilla **PRES MÁX** × (1 ± hasta 3 %), nueva variación en cada respiración |
| VC (menú PRINC) y VCE (alarmas) | **17 ml × PRES MÁX** × (1 ± hasta 10 %), nueva variación en cada respiración |
| PEEP | Perilla **PEEP** (o nivel de CPAP) |
| FREC medida (menú de alarmas) | Frecuencia programada del modo × (1 + aumento por DISP. FLUJO) |
| VME | VCE × FREC medida |
| O2 | Perilla del mezclador (21–100 %) o panel del instructor |
| FLUJO | Perilla **FLUJO**; lo edita el usuario y nunca se calcula |

- **INSP** es el tiempo inspiratorio: solo cambia E e I/E. El VC no depende de INSP ni del flujo.
- En la pantalla el **VC no se puede modificar** (no hay tecla VC; en CONFIG la opción VC está atenuada y avisa que resulta de la presión).
- **Panel del instructor:** cambiar la PICO mueve la perilla PRES MÁX y recalcula el VC; cambiar el VCE recalcula la PICO con la misma fórmula (límite: PICO 0–80, es decir VC hasta 1360 ml); cambiar la PEEP mueve la perilla PEEP. Frecuencia, presión media, O2 y VME se pueden fijar directamente (hasta el siguiente cambio de ajustes).
- Las perillas funcionan siempre, también con la pantalla bloqueada, y hay deslizadores alternativos en el cajón de controles (incluido O2 para el equipo sin mezclador visible).

## DISP. FLUJO
Valor programable de **0,1 a 10 L/min** en pasos de 0,1; bajar de 0,1 deja **APAGADO** (0,0). Requiere un neumotacógrafo conectado (selector «Neumotacógrafo» del panel del instructor). **Es independiente:** activarlo o apagarlo no genera alarmas ni activa o desactiva ninguna otra función (DISP. PRES, FLUJO CONSTANTE, etc.). Mide la sensibilidad del disparo y, **cada vez que se cambia el valor**, define el aumento de FREC:
- Hasta 3 L/min o APAGADO: 0 %.
- Por encima de 3 y hasta 10: se sortea 0, 5, 10 o 15 %.
- El aumento queda **fijo** hasta que DISP. FLUJO cambia otra vez y solo se ve en la FREC del menú de alarmas; la FREC de PRINC no cambia. Ese aumento **no se compara con los límites de FREC** (DISP. FLUJO no genera alarmas) ni cambia el ritmo de la barra.

## Barra de presión
Una respiración por ciclo de FREC: cada respiración dura 60 / FREC programada (FREC 12 ⇒ 12 respiraciones por minuto, 5 s cada una; no incluye el aumento de DISP. FLUJO). Al empezar se sortean las variaciones. La presión sube de la PEEP a la PICO durante INSP (subida corta y meseta) y baja de forma exponencial a la PEEP en la espiración. La barra se dibuja con `requestAnimationFrame` y **se detiene con la pausa**; funciona también en el modo de proyección. El número PICO junto a la barra es el valor máximo de la respiración.

## Alarmas y pestañas
- Con valores iniciales y variaciones máximas no suena ninguna alarma (límites VCE 350–750, pensados para 17 ml × 35 = 595 ml ± 10 %).
- Subir PRES MÁX provoca también alarmas de VCE y VME altos, igual que en un equipo real.
- **Las alarmas son dinámicas:** se reevalúan con cada cambio. Suenan cuando el valor medido o programado queda por encima del límite alto o por debajo del límite bajo, y dejan de sonar cuando el valor vuelve al rango o cuando se cambian los límites de modo que lo abarquen. Con un valor cerca del límite, la variación de cada respiración puede encenderlas y apagarlas.
- **No cambian de pantalla:** al activarse una alarma de límite no se abre el menú de alarmas. Parpadean la pestaña ALARMA1 o ALARMA2 y, en rojo, el valor que la activó: la fila del menú de alarmas, el número PICO o PEEP junto a la barra y el VC de PRINC (VCE). Duran hasta que la alarma se resuelve, aunque se silencie.
- Excepción: Alarma 3 (batería, presión de gas, fallo del ventilador) no tiene pestaña, así que se muestra sola mientras dura y luego vuelve a PRINC.
- SILENCIAR ALARMA solo calla el sonido (60 s, 120 s); una alarma nueva cancela el silencio.
- El navegador no permite sonar hasta que la persona toca la página; si hay una alarma antes, se muestra un aviso para tocar la pantalla.

## Motivo de cada alarma (1.2.0)
Debajo de la barra de estado hay una lista «Motivo de las alarmas activas» con una luz roja intermitente por alarma. Cada fila dice qué valor salió de rango, su límite y la pestaña que la aloja (ALARMA1 o ALARMA2), y su causa (por ejemplo: «VCE ALTO: 782 ML, por encima del límite 750 (ALARMA1) — El VC resulta de la presión: 17 ml × PICO»). Las alarmas del sistema (fallo del ventilador, gas, batería, VC con flujo constante) también indican su motivo. En la pantalla del equipo, la pestaña activa muestra además una luz roja y, en el menú de alarmas, una flecha ▲ (alto) o ▼ (bajo) junto al valor medido. La lista y las luces se apagan solas cuando la alarma se resuelve.

## Alarma de VME en el panel del instructor (1.2.1)
El panel tiene la sección «Alarma de VME»: límite bajo, límite alto y una casilla «Alarma de VME activa». Desmarcarla silencia (apaga) esa alarma, igual que APAGADO en ALARMA1; marcarla la reactiva. Los límites siguen las mismas reglas que en el menú de alarmas (rango 0–44 / 1–45 L, bajo < alto) y se sincronizan con la pantalla en ambos sentidos.

## Límites conocidos
- La presión media no se deriva de la forma de onda.
- La forma de la presión es ilustrativa; no hay curvas de flujo ni volumen.
- El modelo no reproduce el recálculo del tiempo inspiratorio con nebulizador.
