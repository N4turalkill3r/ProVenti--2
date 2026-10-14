# Reglas de operación implementadas (Fase 5)

Origen: manual traducido del equipo documentado. C = confirmado en el manual, I = inferencia, P = pendiente.

| Regla | Comportamiento en el simulador | Estado |
|---|---|---|
| Seleccionar | Pulsar una tecla de parámetro la resalta en amarillo; pulsarla otra vez la deselecciona | C |
| Autodeselección | A los 30 s sin pulsar flechas se deselecciona; cada flecha reinicia el contador | C |
| Flechas | Ajustan el parámetro seleccionado, con repetición acelerada al mantener; se detienen en el límite y emiten tono de límite | C |
| CONFIG | Aparece al encender y se sustituye por las flechas con cualquier tecla salvo SILENCIAR o BATERÍA, o a los 30 s | C |
| Menú CONFIG | Solo la preferencia VC/INSP. Calibración y servicio excluidos | C / decisión del usuario |
| Silencio de alarma | Al encender y al volver de CONFIG: 60 s. Ciclo: 60 s, 120 s, cancelar. Con ≥61 s se cancela con una pulsación, con ≤60 s con dos | C (ciclo: I) |
| Bloqueo | Inactiva todas las teclas salvo menús y SILENCIAR. Desbloquear: pulsar BLOQ y de nuevo en 5 s | C |
| Perillas | Presión máxima, PEEP y flujo se mueven siempre, aun con la pantalla bloqueada | I |
| Flujo | Solo con la perilla; tocar la tecla FLUJO avisa | C |
| Flujo constante | Flujo máximo 29 L/min (se recorta al activarlo) | C |
| Nebulizador | Se enciende o apaga con una flecha tras seleccionar NEB; el tiempo solo se cambia apagado; cuenta atrás y apagado automático; INSP mínimo 0,2 s | C |
| Alarmas apagables | Bajar el límite bajo más allá del mínimo da APAGADO (VCE, VME, MEDIA, O2) | C |
| Paso de límites de alarma | 1, salvo VCE con 10 | I |
| Retroiluminación | Mantener 3 s la barra de presión apaga la pantalla; tocarla la enciende; al apagar y encender vuelve a encendida | C |
| ALARMA1/ALARMA2 | Una sola tecla que alterna ambos menús | I |
| DESACT NEUMO, SUSPIRO OFF | Sin función (SUSPIRO muestra su nota desplegable) | Decisión del usuario |

## Pendiente
- Con nebulizador encendido y VC como parámetro, el manual reduce el tiempo inspiratorio para compensar los 7 L/min extra; hoy no se recalcula.
- Proyección y modo discreto: Fase 7.
