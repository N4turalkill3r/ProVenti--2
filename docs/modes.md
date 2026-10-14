# Modos de visualización (Fase 7)

## Modo de control discreto (predeterminado)
- El equipo es el elemento principal. Los controles viven en un cajón que se muestra u oculta con el botón **Controles** o la tecla **C**; el botón tiene `aria-expanded` y es accesible con teclado y táctil.
- Pantallas anchas (≥ 1000 px): el cajón es una columna lateral y el equipo se reduce, así que nunca lo tapa. Pantallas estrechas: el cajón aparece debajo del equipo.
- Por defecto está abierto en pantallas anchas y cerrado en teléfonos. La última elección se recuerda (almacenamiento local, si el navegador lo permite).
- El cajón contiene: Encender/Apagar, **Pausar/Reanudar**, **Reiniciar**, Sonido, valores y condiciones del instructor y escenarios de prueba.
- La barra de estado muestra: equipo encendido o apagado, simulación en marcha o en pausa, número de alarmas activas, silencio restante y pantalla bloqueada.
- Pausa: detiene los relojes (silencio, bloqueo, selección, nebulizador, AUTO AJUSTE) y calla el sonido de alarma. Las teclas siguen funcionando para preparar un caso. Reiniciar restaura el equipo encendido con los ajustes iniciales y reanuda.

## Modo de proyección
- Botón **Proyección** o tecla **P**. Muestra solo el equipo, a pantalla completa y con sus proporciones (el SVG se escala sin deformarse). Oculta cabecera, indicadores, aviso, controles y pie.
- Siguen visibles: un rótulo discreto «Simulador educativo» y, si la simulación está en pausa, el rótulo **EN PAUSA**. El equipo sigue siendo operable y se mantienen animaciones, alarmas y sonido.
- Salir: botón «Salir de la proyección (Esc)», que aparece al mover el puntero o tocar y se oculta a los 3 s (el cursor también se oculta), y la tecla **Esc**. En pantalla completa, Esc o cualquier acción habitual del navegador sale de pantalla completa y de la proyección.
- El estado de la simulación no se toca al cambiar de modo. La ventana pide mantener la pantalla encendida mientras proyecta, si el navegador lo permite.

## Limitaciones de los navegadores
- Una página web no puede detectar ni elegir un proyector. Para proyectar: conecte la segunda pantalla, mueva la ventana a ella y active la proyección.
- La pantalla completa necesita un gesto del usuario y puede ser rechazada (política del navegador o del sitio, o iPhone, que no la ofrece para páginas). En ese caso la proyección funciona igual dentro de la ventana, con la interfaz del navegador visible.
- Mantener la pantalla encendida (Screen Wake Lock) no existe en todos los navegadores; si falta, el sistema operativo puede apagar la pantalla por inactividad.
- El atajo Esc se gestiona dentro de la página solo cuando no hay pantalla completa; en pantalla completa lo atiende el navegador.

## Encuadre «Ampliar pantalla» (Fase 8)
Botón **Ampliar pantalla** (o tecla **Z**, también disponible en proyección) recorta el equipo al bisel de la pantalla para leerla mejor. La elección se recuerda.
