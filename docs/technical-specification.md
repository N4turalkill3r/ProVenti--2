# Especificación técnica — Prosventi V-2.0

Estados: **[C]** confirmado en el manual · **[I]** inferencia de diseño · **[P]** pendiente de validar.

## 1. Alcance

- Incluye: pantalla táctil (menús Principal, Secundario, Alarma 1, Alarma 2, Alarma 3), perillas virtuales, LED, zumbador, indicadores de energía, CONFIG operativo, panel de instructor, modo proyección y modo de control discreto.
- Excluye: menús de calibración y servicio, curvas, modelo fisiológico y cualquier conexión con equipos reales.
- Idioma: **todo en español** (decisión del usuario).
- Marca: «Prosventi V-2.0» (archivo `js/brand.config.js`).

## 2. Decisiones del usuario

1. CPAP es un modo espontáneo. Para capacitación, la frecuencia de respaldo se limita a **5–30** (decisión de entrenamiento, no dato del fabricante) [I].
2. Todo el texto de la aplicación en español.
3. La tecla SUSPIRO OFF se muestra pero **no tiene ninguna función**. Al tocarla se despliega una nota con la descripción general de la maniobra de suspiro (texto del usuario) y una línea que aclara que en el simulador la tecla no actúa. La nota no está visible hasta que se toca. El manual no documenta su función.
4. Perillas arrastrables con ratón o dedo y operables con teclado, con valor numérico visible.
5. Sonidos sintetizados (Web Audio) con los códigos del Apéndice D, rotulados como educativos.
6. Se dibuja el mezclador de O2 (dial 21–100 %).
7. Los valores medidos (pico, PEEP, frecuencia, media, O2, VCE, VME) son editables por el instructor; las alarmas actúan según los límites.

## 3. Parámetros

Ver `js/config.js` (`PARAMETROS`). Relación base [C]: VC (ml) = Ti (s) × flujo (L/min) × 1000 / 60. Ciclo = 60 / frecuencia; E = ciclo − I.

Comprobación con la Fig. 5 del manual: frecuencia 20, VC 500, flujo 30 → I = 1,00 s, E = 2,00 s, I/E = 1:2,0.

## 4. Dependencias entre teclas

Tomadas del Apéndice C [C]. Implementadas como datos en `config.js` (`REGLAS_DESHABILITADO`) y evaluadas en `state.js` (`calcularDeshabilitados`).

## 5. Alarmas

Rangos de pantalla, límites configurables, comportamiento de AUTO AJUSTE y predeterminados: ver `config.js` (`ALARMAS`, `AUTO_AJUSTE`). Fuente: págs. 21 y 24 y Apéndice B.

## 6. Modelo de estado

Ver `js/state.js` (`crearEstadoInicial`). Campos principales: encendido, modo, flujo constante, menú, tecla seleccionada, bloqueo, silencio, configuración, ajustes, límites, valores medidos (instructor), fuente de respiración, energía.

## 7. Pendientes

- Incrementos de ajuste por tecla: derivados de las resoluciones de pantalla del manual; el resto son inferencias [P].
- Función de SUSPIRO OFF: no documentada; la tecla queda sin función [P].

## 8. Valores iniciales (decisión del usuario)

- Rangos de alarma: los de la pág. 21. Los predeterminados del Apéndice B para VME, VCE y PEEP quedan fuera de esos rangos, así que se usan límites fisiológicos: pico 10–40, frecuencia 8–20, VCE 350–650, VME 4–10, PEEP 3–8, media 5–20, O2 18–100 [I].
- Ajustes iniciales: A/C, frecuencia 12, VC 500, disparo por presión 1, SIMV 10 (el Apéndice B indica 4; el usuario eligió 10 para entrenamiento); presión máxima 35, flujo 30, PEEP 5 (elegidos por el usuario). Con frecuencia 12 y VC 500: I = 1,00 s, E = 4,00 s, I/E = 1:4,0.
- Valores medidos iniciales del instructor: pico 20, PEEP 5, frecuencia 12, media 10, O2 21, VCE 500, VME 6, dentro de los límites para que no suene ninguna alarma al empezar.
