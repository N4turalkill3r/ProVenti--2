# Adaptación a móviles y tabletas (Fase 8)

## Qué se hizo
- **Marco ajustado:** el SVG ya no lleva márgenes vacíos, así que el equipo ocupa más pantalla en todos los tamaños.
- **Ampliar pantalla:** encuadre que muestra solo la pantalla del equipo (≈ +50 % de tamaño del texto en un teléfono vertical). Botón en la cabecera, tecla Z y botón en la proyección. Las perillas quedan fuera de ese encuadre, por eso existen los deslizadores.
- **Perillas con deslizador:** PRES MÁX, PEEP y FLUJO en el cajón de controles (`input type="range"`, 44 px de alto), sincronizados con las perillas dibujadas.
- **Táctil:** las perillas dibujadas se arrastran con el dedo sin desplazar la página; la pulsación larga no abre el menú del navegador (necesaria para apagar la pantalla con la barra de presión); sin retardo de doble toque.
- **Teclas del equipo:** la zona de toque es 4 unidades más alta que la tecla dibujada.
- **Diseño:**
  - Vertical en teléfono: cabecera con tres botones, equipo a todo el ancho y cajón debajo.
  - Horizontal en teléfono: el equipo ocupa la altura y el cajón va a un lado.
  - Tableta: cajón centrado (vertical) o lateral (≥ 1000 px).
  - Áreas seguras (muescas) respetadas.
  - Campos de texto de 16 px para que iOS no amplíe la página.

## Verificación (Chromium con emulación)
| Pantalla | Resultado |
|---|---|
| iPhone 390×844 y 844×390, Pixel 412×915, iPad 768×1024 y 1024×768, teléfono pequeño 320×568 | Sin scroll horizontal, con y sin cajón y con «Ampliar pantalla». Toque en teclas, deslizadores y botones ≥ 44 px (cabecera ≥ 38 px en horizontal) |
| Arrastre táctil de perilla (eventos táctiles reales por CDP) | Cambia el valor y la página no se desplaza |

## Tamaño de las teclas en «Ampliar pantalla»
Tecla PRINC dibujada (ancho × alto en px CSS): iPhone vertical 44 × 29; Pixel 47 × 31; iPad vertical 91 × 60; teléfono de 320 px 36 × 23. La zona de toque añade unos 5 px de alto. Es menos que los 44 px recomendados porque el equipo conserva su aspecto original; en teléfonos pequeños conviene usar la tableta o la proyección, o un lápiz táctil. Esta diferencia queda registrada como limitación.

## No verificado
- Dispositivos reales (iOS Safari, Android Chrome): solo se probó la emulación de Chromium. Las diferencias de teclado virtual y de barra de direcciones móvil (`dvh`) están sin comprobar.
- Contraste y legibilidad al aire libre.
