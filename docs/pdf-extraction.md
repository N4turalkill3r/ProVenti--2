# Trazabilidad con el manual (CROSSVENT-2+, Bio-Med Devices, rev. 050216)

Las páginas son las numeradas en el manual impreso. El manual en español es traducción automática; en caso de duda prevalece el inglés.

| Dato | Página | Estado |
|---|---|---|
| Rangos de frecuencia, VC, INSP, flujo, disparos, soporte de presión, PEEP, presión máxima | 10, 11, 18, 19 | C |
| Resoluciones de pantalla (VC 1 ml <200, 10 ml >200; Ti 0,05 <1,00 y 0,1 >1,00) | 10 | C |
| Pantalla: disposición, colores, teclas (Figs. 5–8) | 16–25 | C |
| Gráfico de barras −5 a +115 cmH2O, colores verde/rojo/amarillo | 16 | C |
| Rangos y límites de alarma | 21 | C |
| Alarmas fuera de menús y Alarma 3 | 21 | C |
| AUTO AJUSTE (tabla por modo) | 24 | C |
| Predeterminados de modo, frecuencia 12, VC 500, disparo 1, SIMV 4 (el simulador usa 10 por decisión del usuario), soporte OFF | Apéndice B (85) | C |
| Límites de alarma predeterminados | Se descarta el Apéndice B; se usan valores fisiológicos dentro de los rangos de la pág. 21 | I (decisión del usuario) |
| Presión máxima 35, flujo 30, PEEP 5 iniciales | No documentados; elegidos por el usuario | I |
| Funciones deshabilitadas | Apéndice C (86) | C |
| Códigos sonoros | Apéndice D (87) | C |
| Silencio de alarma 60/120 s; bloqueo 5 s; CONFIG 30 s | 23, 25 | C |
| Frecuencia de respaldo CPAP 5–30 | Decisión de capacitación | I |
| Función de SUSPIRO OFF | No documentada; la tecla se muestra sin función | P |

## Incoherencias del manual (se registran, no se corrigen)

- 31 psi figura como 214 kPa y como 303,6 kPa.
- Umbral de baja presión de suministro: 35 psi (tabla de Alarma 3) frente a 31 psi (rango de suministro).
- Rango de VC espirado: 5–1300 (límites de alarma) y 5–990 (VC programado).
- Apéndice B: los límites predeterminados de VME (49/50), VCE (1599/1600) y PEEP (49/50) quedan fuera de los rangos de la pág. 21 (VME 0–44/1–45, VCE 5–1299/6–1300, PEEP −1 a 29/0–30). El manual no lo explica. Por eso el simulador no usa esos valores: aplica límites fisiológicos dentro de los rangos de la pág. 21 (ver `config.js`, `LIMITES_PREDETERMINADOS`) [I].
