# Motor de simulación (Fase 6)

El motor no modela fisiología: los valores medidos se derivan de los ajustes (`docs/dynamics.md`) o los fija el instructor, y el motor decide qué alarmas hay. Las alarmas se reevalúan en cada cambio: valor medido, ajuste programado, perilla, límite o respiración nueva. Estado: C confirmado en el manual, I inferencia.

## Alarmas
| Condición | Comportamiento | Estado |
|---|---|---|
| Límite violado (PICO, FREC, VCE, VME, PEEP, MEDIA, O2) | El valor parpadea en rojo (fila del menú de alarmas, número de la barra y VC de PRINC), parpadea la pestaña ALARMA1 o ALARMA2 y suena el aviso. **No cambia de pantalla.** Dura hasta que el valor vuelve a estar dentro de los límites o los límites dejan de abarcarlo | decisión del usuario |
| Presión máxima baja | Inactiva en CPAP y en respiraciones espontáneas | C |
| Flujo constante | Desactiva las alarmas de frecuencia, VCE y VME (y MEDIA en CPAP) | C |
| Flujo constante con VC ≥ 500 ml | El valor VC parpadea en rojo y suena | C |
| Batería baja (≤ 20 %), baja presión de suministro, fallo del ventilador | Menú Alarma 3 (sin tecla propia); código sonoro del Apéndice D | C |
| Paso a batería | Suena hasta pulsar la tecla BATERÍA (que parpadea); SILENCIAR no la calla | C |
| Alarma nueva | Cancela el silencio y enciende la pantalla si estaba apagada | C |
| Alarma resuelta | Se apaga el parpadeo y el sonido. Alarma 3 (la única que abre su pantalla sola) vuelve a PRINC | I |
| Pestaña ALARMA1/ALARMA2 | Parpadea mientras haya una alarma activa de ese menú, esté silenciada o no y se esté viendo o no ese menú | decisión del usuario |
| SILENCIAR ALARMA | Calla el sonido de todas las alarmas silenciables (60 s, 120 s); el parpadeo continúa | C |
| Al encender con una alarma presente | Se mantiene el silencio automático de 60 s | I |

No se simulan las alarmas SIN NEUMO, NEUMO INCORRECTO ni EXCEDE PEF: los sensores se consideran presentes.

## Sonido
Sintetizado con Web Audio, con fines educativos; no imita el sonido del equipo real. Los códigos de fallo usan tonos largos y cortos del Apéndice D. El aviso genérico de límite (tres pitidos) es una elección propia [I], porque el manual no describe su forma. El navegador exige un gesto del usuario antes de reproducir audio.

## AUTO AJUSTE
Dos pulsaciones en 5 s; luego promedia 5 respiraciones (una cada 60 / frecuencia medida segundos; el número cuenta de 5 a 1 en la tecla) y fija los límites:
- A/C y SIMV: PICO y FREC ±30 %, O2 ±5; VCE y VME sin cambios; MEDIA queda APAGADO.
- CPAP: PICO y FREC a los extremos del rango, PEEP ±3, O2 ±5.
- Una alarma desactivada no se reconfigura. Pulsar una tecla de modo cancela el cálculo. Con CPAP y flujo constante no está disponible.
- En SIMV el manual promedia solo las respiraciones asistidas o controladas; aquí el valor medido es fijo, así que no cambia el resultado. Los redondeos de límites son una elección propia [I].

## Panel del instructor (básico)
Permite fijar los siete valores medidos, la fuente de energía, la carga de batería, la baja presión de gas y un fallo del ventilador. Vive en el cajón de controles (ver `docs/modes.md`).
