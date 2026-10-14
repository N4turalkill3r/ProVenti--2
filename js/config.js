// Datos del equipo. Sin lógica de interfaz.
// Estado: C = confirmado en el manual, I = inferencia, P = pendiente de validar.

// Pasos de ajuste: [{ hasta, paso }] ordenados; el último aplica al resto.
export const PARAMETROS = {
  frecuencia:   { etiqueta: 'FREC', unidad: 'rpm', min: 5, max: 150, paso: [{ hasta: Infinity, paso: 1 }], defecto: 12, estado: 'C' },
  frecuenciaSimv: { etiqueta: 'FREC SIMV', unidad: 'rpm', min: 0.6, max: 50, paso: [{ hasta: 10, paso: 0.1 }, { hasta: Infinity, paso: 1 }], defecto: 10, estado: 'C' },
  // Decisión de capacitación del usuario (CPAP espontáneo): 5-30.
  frecuenciaRespaldo: { etiqueta: 'FREC RESPALDO', unidad: 'rpm', min: 5, max: 30, paso: [{ hasta: Infinity, paso: 1 }], defecto: 12, estado: 'I' },
  vc:           { etiqueta: 'VC', unidad: 'ml', min: 5, max: 990, paso: [{ hasta: 200, paso: 1 }, { hasta: Infinity, paso: 10 }], defecto: 500, estado: 'C' },
  insp:         { etiqueta: 'INSP', unidad: 's', min: 0.1, max: 3.0, paso: [{ hasta: 1.0, paso: 0.05 }, { hasta: Infinity, paso: 0.1 }], defecto: 1.0, estado: 'C' },
  flujo:        { etiqueta: 'FLUJO', unidad: 'L/min', min: 1, max: 50, paso: [{ hasta: 10, paso: 0.1 }, { hasta: Infinity, paso: 1 }], defecto: 30, estado: 'I', soloPerilla: true }, // valor elegido por el usuario
  dispPresion:  { etiqueta: 'DISP. PRES', unidad: 'cmH2O', min: 0.2, max: 10, paso: [{ hasta: 3, paso: 0.1 }, { hasta: Infinity, paso: 1 }], defecto: 1, estado: 'C' },
  // Decisión del usuario: 0,1 a 10 L/min en pasos de 0,1; 0,0 es APAGADO (null). El manual indica 1-20.
  dispFlujo:    { etiqueta: 'DISP. FLUJO', unidad: 'L/min', min: 0.1, max: 10, paso: [{ hasta: Infinity, paso: 0.1 }], defecto: null, estado: 'I' },
  soportePresion: { etiqueta: 'SOPORTE PRES', unidad: 'cmH2O', min: 1, max: 50, paso: [{ hasta: Infinity, paso: 1 }], defecto: null, estado: 'C' }, // null = APAGADO
  peep:         { etiqueta: 'PEEP', unidad: 'cmH2O', min: 0, max: 20, paso: [{ hasta: Infinity, paso: 1 }], defecto: 5, estado: 'I', soloPerilla: true },
  presionMaxima: { etiqueta: 'PRES MÁX', unidad: 'cmH2O', min: 0, max: 80, paso: [{ hasta: Infinity, paso: 1 }], defecto: 35, estado: 'I', soloPerilla: true }, // valor elegido por el usuario
  nebulizador:  { etiqueta: 'NEB', unidad: 'min', min: 1, max: 30, paso: [{ hasta: Infinity, paso: 1 }], defecto: 5, estado: 'C' },
};

// Dinámica respiratoria simulada (decisiones del usuario). Valores ajustables aquí.
//  - El VC (volumen corriente) resulta de la presión: VC = vcPorCmH2O x PICO, con una variación aleatoria en cada respiración.
//  - La PICO sigue a la perilla PRES MÁX, con una variación aleatoria en cada espiración.
//  - DISP. FLUJO por encima del umbral aumenta la FREC medida (solo visible en el menú de alarmas) con un porcentaje
//    sorteado al cambiar el valor; se mantiene fijo hasta el siguiente cambio.
export const DINAMICA = {
  vcPorCmH2O: 17,
  variacionVcMax: 0.10,
  variacionPresionMax: 0.03,
  aumentoFrecPorcentajes: [0, 5, 10, 15],
  dispFlujoUmbral: 3,
  picoMaxPerilla: 80,
};
// Perilla del mezclador de oxígeno (sin función en pantalla salvo el valor de O2 del menú de alarmas).
export const O2_PERILLA = { min: 21, max: 100 };

// Límites con flujo constante activo (pág. 17).
export const FLUJO_CONSTANTE = { flujoMax: 29, inspMax: 3.0, vcAlarmaMl: 500 };
// Tiempo inspiratorio mínimo con nebulizador (pág. 19).
export const NEB = { inspMin: 0.2, flujoMin: 20, flujoNeb: 7 };

export const MODOS = ['AC', 'SIMV', 'CPAP'];

// Límites de alarma (pág. 21). apagable: se desactiva bajando LOW hasta APAGADO.
// paso: incremento de las flechas (1 si no se indica). El manual no lo documenta [I].
export const ALARMAS = {
  pico:   { menu: 'alarma1', etiqueta: 'PICO',   unidad: 'cmH2O', rangoPantalla: [0, 125],  low: [3, 89],  high: [4, 90],   apagable: false },
  frecuencia: { menu: 'alarma1', etiqueta: 'FREC', unidad: 'RPM', rangoPantalla: [0, 199],   low: [4, 159], high: [5, 160],  apagable: false },
  vce:    { menu: 'alarma1', etiqueta: 'VCE',    unidad: 'ML',    rangoPantalla: [50, 4000], low: [5, 1299], high: [6, 1300], apagable: true, paso: 10 },
  vme:    { menu: 'alarma1', etiqueta: 'VME',    unidad: 'L',     rangoPantalla: [0, 200],   low: [0, 44],  high: [1, 45],   apagable: true },
  peep:   { menu: 'alarma2', etiqueta: 'PEEP',   unidad: 'cmH2O', rangoPantalla: [0, 99],    low: [-1, 29], high: [0, 30],   apagable: false },
  media:  { menu: 'alarma2', etiqueta: 'MEDIA',  unidad: 'cmH2O', rangoPantalla: [0, 125],   low: [0, 89],  high: [1, 90],   apagable: true },
  o2:     { menu: 'alarma2', etiqueta: 'OXÍGENO', unidad: '%O2',  rangoPantalla: [0, 100],   low: [18, 100], high: [19, 105], apagable: true },
};

// Límites de alarma predeterminados [I]: decisión del usuario.
// Se respetan los rangos de la pág. 21 y se eligen valores cercanos a lo fisiológico,
// coherentes con los ajustes iniciales (frecuencia 12, VC 500 ml, PEEP 5, presión máxima 35).
// Se descartan los valores del Apéndice B para VME, VCE y PEEP porque quedan fuera de esos rangos.
export const LIMITES_PREDETERMINADOS = {
  pico:       { low: 10,  high: 40 },
  frecuencia: { low: 8,   high: 20 },
  vce:        { low: 350, high: 750 }, // 17 ml x PICO 35 = 595 ml; con variación de +10 % llega a 654 ml
  vme:        { low: 4,   high: 10 },
  peep:       { low: 3,   high: 8 },
  media:      { low: 5,   high: 20 },
  o2:         { low: 18,  high: 100 },
};

// Rango de los valores medidos que puede fijar el instructor (los límites de pantalla de la pág. 21; PICO admite negativos como la barra de presión).
export const MEDIDOS_RANGO = {
  pico: [-5, 125], peep: [-5, 99], frecuencia: [0, 199], media: [0, 125], o2: [0, 100], vce: [0, 4000], vme: [0, 200],
};

// Valores medidos iniciales [I]: dentro de los límites anteriores, para que no suene ninguna alarma al empezar.
// Los modifica el instructor.
// pico, vce, vme, frecuencia y peep se derivan de los ajustes (js/dynamics.js); aquí solo para referencia y pruebas.
export const MEDIDOS_INICIALES = { pico: 35, peep: 5, frecuencia: 12, media: 10, o2: 21, vce: 595, vme: 7.1 };

// Teclas que se muestran pero no tienen función en el simulador.
// notaDesplegable: la nota solo aparece cuando se toca la tecla.
export const TECLAS_SIN_FUNCION = {
  suspiroOff: { visible: true, funcional: false, notaDesplegable: true, nota: 'notaSuspiro', notaSimulador: 'notaSuspiroSimulador' },
};

// AUTO AJUSTE (pág. 24). pct = porcentaje; abs = suma/resta absoluta; min/max = extremos permitidos.
export const AUTO_AJUSTE = {
  AC:   { pico: { tipo: 'pct', v: 30 }, frecuencia: { tipo: 'pct', v: 30 }, o2: { tipo: 'abs', v: 5 } },
  SIMV: { pico: { tipo: 'pct', v: 30, soloAsistidas: true }, frecuencia: { tipo: 'pct', v: 30 }, o2: { tipo: 'abs', v: 5 } },
  CPAP: { pico: { tipo: 'extremos' }, frecuencia: { tipo: 'extremos' }, peep: { tipo: 'abs', v: 3 }, o2: { tipo: 'abs', v: 5 } },
  // VCE y VME no se afectan; MEDIA queda en APAGADO.
  noAfectados: ['vce', 'vme'],
  apagados: ['media'],
  respiraciones: 5, ventanaPulsacionesSeg: 5,
};

// Temporizadores (segundos).
export const TEMPORIZADORES = { seleccionAuto: 30, silencio: 60, silencioDoble: 120, bloqueoDesbloqueo: 5, configDisponible: 30, apagadoRetroiluminacion: 3 };

// Funciones deshabilitadas (Apéndice C). Cada regla: condición -> claves deshabilitadas.
// tipo 'bloqueo': la función no se puede usar mientras se cumpla la condición.
// tipo 'exclusion': al activar una, las otras pasan a APAGADO automáticamente (no se bloquean).
// DISP. FLUJO es independiente: activarlo o apagarlo no activa ni desactiva ninguna otra función ni genera alarma.
export const REGLAS_DESHABILITADO = [
  { cuando: 'flujoConstante', tipo: 'bloqueo', deshabilita: ['soportePresion', 'alarmaFrecuencia', 'vce', 'vme'], nota: 'Nebulizador inactivo en CPAP y respiraciones espontáneas' },
  { cuando: 'flujoConstante', tipo: 'exclusion', deshabilita: ['dispPresion'] },
  { cuando: 'modoCPAPConFlujoConstante', tipo: 'bloqueo', deshabilita: ['frecuencia', 'relacionIE', 'autoAjuste', 'soportePresion', 'nebulizador', 'alarmaFrecuencia', 'vce', 'vme', 'media'] },
  { cuando: 'dispPresionActivo', tipo: 'exclusion', deshabilita: ['flujoConstante'] },
  { cuando: 'flujoMenor20', tipo: 'bloqueo', deshabilita: ['nebulizador'] },
  { cuando: 'sinNeumotacografo', tipo: 'bloqueo', deshabilita: ['dispFlujo'] },
  { cuando: 'neumotacoInfantil', tipo: 'bloqueo', deshabilita: ['flujoConstante', 'dispPresion'] },
  { cuando: 'cualquierNeumotaco', tipo: 'bloqueo', deshabilita: ['flujoConstante'] },
  { cuando: 'modoAC', tipo: 'bloqueo', deshabilita: ['soportePresion'] },
];

// Códigos sonoros del Apéndice D: [largos, cortos] (continuo = 'continuo').
export const CODIGOS_SONOROS = {
  perdidaEnergia: [1, 0], bajaBateria: [1, 0], bajaPresionSuministro: [1, 0],
  solenoideA: [1, 1], solenoideB: [1, 2], solenoideC: [1, 3],
  solenoideD1: [2, 1], solenoideD2: [2, 2], solenoideD3: [2, 3],
  solenoideE1: [2, 4], solenoideE2: [2, 5],
  errorTransductor: [2, 6], falloComunicacion: 'continuo',
};

// Textos visibles, todo en español. Nota de SUSPIRO OFF incluida.
export const TEXTOS = {
  aviso: 'Simulador educativo. No controla equipos físicos ni debe usarse para tratar pacientes.',
  alarmaSimulada: 'ALARMA SIMULADA',
  principal: 'PRINC', secundario: 'SEC', alarma1: 'ALARMA1', alarma2: 'ALARMA2',
  bloqueo: 'BLOQ', silenciar: 'SILENCIAR ALARMA', autoAjuste: 'AUTO AJUSTE', configuracion: 'CONFIG',
  modoAC: 'A/C', modoSIMV: 'SIMV', modoCPAP: 'CPAP', manual: 'MANUAL',
  flujoConstante: 'FLUJO CONSTANTE', desactNeumo: 'DESACT NEUMO',
  fuenteControl: 'CONTROL', fuenteAsistida: 'ASISTIDA', fuenteEspontanea: 'ESPONT', fuenteManual: 'MANUAL',
  energiaExterna: 'EXTERNA', energiaBateria: 'BATERÍA',
  suspiroOff: 'SUSPIRO OFF',
  tituloNotaSuspiro: 'Suspiro',
  notaSuspiro: 'Es una maniobra programada en algunos ventiladores mecánicos que entrega de manera periódica (por ejemplo, cada 100 ciclos respiratorios o a intervalos de tiempo configurados) un volumen corriente (tidal) mayor al habitual (generalmente entre 1.5 y 2 veces el volumen programado) o un incremento temporal de la PEEP.',
  notaSuspiroSimulador: 'En este simulador la tecla no tiene ninguna función: el manual del equipo documentado no describe su uso.',
  cerrar: 'Cerrar',
  bajo: 'BAJO', alto: 'ALTO', apagado: 'APAGADO', encendido: 'ENCENDIDO',
  sinNeumo: 'SIN NEUMO', neumoIncorrecto: 'NEUMO INCORRECTO', excedePEF: 'EXCEDE PEF',
  bateriaBaja: 'BATERÍA BAJA, CONECTE ALIMENTACIÓN EXTERNA',
  bajaPresionSuministro: 'BAJA PRESIÓN DE SUMINISTRO',
  falloVentilador: 'FALLO DEL VENTILADOR',
  fallos: {
    solenoideA: 'SOLENOIDE A', solenoideB: 'SOLENOIDE B', solenoideC: 'SOLENOIDE C',
    solenoideD1: 'SOLENOIDE D1', solenoideD2: 'SOLENOIDE D2', solenoideD3: 'SOLENOIDE D3',
    solenoideE1: 'SOLENOIDE E1', solenoideE2: 'SOLENOIDE E2',
    errorTransductor: 'TRANSDUCTOR', falloComunicacion: 'FALLO DE COMUNICACIÓN',
  },
  avisoAutoAjusteArmado: 'AUTO AJUSTE: pulse de nuevo en 5 segundos para calcular.',
  avisoAutoAjusteCalculando: 'AUTO AJUSTE calculando. Se promedian 5 respiraciones.',
  avisoAutoAjusteListo: 'AUTO AJUSTE: límites de alarma actualizados.',
  avisoAutoAjusteInactivo: 'AUTO AJUSTE no está disponible con CPAP y flujo constante.',
  avisoBateriaConfirmada: 'Modo batería confirmado.',
  vcAlarma: 'Reduzca el flujo o el tiempo inspiratorio (VC ≥ 500 ml).',
  sonidoActivado: 'Sonido activado', sonidoDesactivado: 'Sonido desactivado',
  // Interfaz de operación (Fase 5)
  encender: 'Encender', apagar: 'Apagar', reiniciar: 'Reiniciar',
  tituloConfig: 'CONFIGURACIÓN', configVC: 'VOLUMEN CORRIENTE (VC)', configInsp: 'TIEMPO INSPIRATORIO (INSP)',
  configAyuda: 'Elija el parámetro que se ajusta en el menú principal. Pulse PRINC para volver.',
  avisoLimite: 'Límite alcanzado.',
  avisoApagado: 'El equipo está apagado.',
  avisoBloqueado: 'Pantalla bloqueada. Solo funcionan los menús y SILENCIAR ALARMA. Pulse BLOQ y de nuevo en 5 s para desbloquear.',
  avisoBloqueoConfirmar: 'Pulse BLOQ otra vez en menos de 5 segundos para desbloquear.',
  avisoDesbloqueado: 'Pantalla desbloqueada.',
  avisoBloqueadoAhora: 'Pantalla bloqueada.',
  avisoNoDisponible: 'No disponible con la configuración actual.',
  avisoUsePerillaFlujo: 'El flujo solo se modifica con la perilla FLUJO.',
  avisoSinFuncion: 'Esta tecla no tiene función en el simulador.',
  avisoVcResultado: 'El VC resulta de la presión: no se programa desde la pantalla.',
  avisoPicoPerilla: 'La PICO sigue a la perilla PRES MÁX (0 a 80 cmH2O).',
  avisoVcMaximo: 'Con 17 ml por cmH2O el VC máximo es 1360 ml.',
  avisoNebApagado: 'El tiempo del nebulizador solo se modifica con el nebulizador apagado.',
  avisoNebEncendido: 'Nebulizador encendido.', avisoNebApagadoAhora: 'Nebulizador apagado.',
  avisoRetroiluminacion: 'Pantalla apagada. Toque la pantalla para encenderla.',
  avisoSeleccione: 'Seleccione primero un parámetro.',
};
