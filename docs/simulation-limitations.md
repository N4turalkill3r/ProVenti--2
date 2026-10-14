# Limitaciones de la simulación

- Es una herramienta **educativa**. No controla equipos físicos ni sustituye el entrenamiento con el equipo real.
- No hay modelo fisiológico. Los valores medidos siguen reglas simples (`docs/dynamics.md`): PICO = PRES MÁX, VC = 17 ml × PICO, PEEP = perilla PEEP, VME = VCE × FREC; la presión media, el O2 (también con la perilla del mezclador) y los demás los fija el instructor. Las variaciones aleatorias (±3 % de presión, ±10 % de volumen) son ilustrativas, no clínicas.
- La barra de presión simula respiraciones con una forma sencilla (subida, meseta y caída exponencial a la PEEP). No hay curvas de presión, flujo ni volumen.
- La presión media (MEDIA) no se deriva de la forma de la presión: la fija el instructor.
- Las alarmas y sonidos son **simulados** y no equivalen a las alarmas reales del fabricante.
- La función de la tecla SUSPIRO OFF no está descrita en el manual; solo se muestra.
- Los menús de calibración y servicio no se reproducen.
- Los navegadores no permiten detectar ni controlar un proyector: para proyectar, mueva la ventana a la segunda pantalla y active el modo proyección.
- La aplicación no almacena datos de pacientes. Solo guarda en el dispositivo preferencias de pantalla (controles abiertos y encuadre) y una copia de sus archivos para el uso sin conexión. La simulación no se conserva al cerrar o actualizar.
- Sin simular: alarmas SIN NEUMO, NEUMO INCORRECTO y EXCEDE PEF; recálculo del tiempo inspiratorio al usar el nebulizador con VC (+7 L/min).
- Probado con un navegador automatizado (Chromium). No se ha probado en iOS Safari ni Android Chrome reales, ni con lectores de pantalla.
- En la vista ampliada de la pantalla y en móviles pequeños, las teclas miden menos de 44 px; se ofrecen controles alternativos en el cajón.
- Los sonidos son sintetizados (Web Audio) y rotulados como educativos; no reproducen los del equipo real. Requieren un toque previo en la página.
- El manual consultado es una traducción automática; ante la duda prevalece el original en inglés. Las incoherencias detectadas están en `pdf-extraction.md`.
- Este proyecto reproduce la disposición de un equipo comercial con gráficos y marca propios. Para difusión pública se recomienda permiso escrito del fabricante.
