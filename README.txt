TRADING ANALYST PRO MR V11.3.1 — ARQUITECTURA CONSOLIDADA
========================================================

FUNCIONAMIENTO
1. CONNECT.
2. START ENGINE.
3. El análisis trabaja continuamente en segundo plano.
4. PREDICTION solicita una decisión rápida.
5. Si supera filtros, se muestra una sola señal.
6. Explicación breve.
7. Cuenta regresiva de 10 segundos.
8. Predicción finalizada.
9. No se genera otra señal automáticamente.

MOTORES
- Motor Explorador.
- Motor Validador.
- Motor de Consenso.
- Detector de Timing.
- Filtro de Calidad.

MATCHES
- 0 = NO OPERAR.
- 1 al 9 = elegibles si superan todos los filtros.
- Las señales válidas también tienen cuenta regresiva de 10 segundos.

MANTENIMIENTO
- Máximo de 500 precios y 500 dígitos.
- Limpieza al apagar.
- Limpieza al cambiar de mercado.
- Caché versionada.
- JavaScript solicitado sin caché antigua.
- Diagnóstico permanente.
- Control de latencia y bloqueo cuando los datos llegan retrasados.

AGREGAR NUEVOS MERCADOS
Edite solamente MARKETS dentro de config.js. Cada mercado puede definir nombre,
estado activo y estrategias permitidas.

SUBIDA A GITHUB
- Extraiga el ZIP.
- Suba todos los archivos a la raíz del repositorio.
- No cree subcarpetas.
- Active GitHub Pages desde main / root.
- Espere el cheque verde.
- Pruebe primero en cuenta demo.

IMPORTANTE
La confianza técnica es una puntuación interna, no una garantía de resultado.
La herramienta no ejecuta operaciones ni puede asegurar ganancias.


NOVEDADES V11
- Cambio de mercado sin apagar el motor.
- Cambio de estrategia sin apagar el motor.
- Validación más estricta; calidad antes que cantidad.
- Explicación breve y pausada.
- Preparación de 10 segundos y ejecución de 10 segundos.
- Conteos completos desde 10 hasta 0.
- Mensaje final: “Predicción finalizada. Genera una nueva señal.”
- Matches reforzado y más selectivo.
- Calibrador manual del segundo de entrada.
- Recomendación solo después de suficientes pruebas.


AJUSTES V11.3.1
- Se conserva el primer conteo como único conteo operativo.
- Se elimina el segundo conteo tardío.
- La explicación y la voz tienen pausas más naturales.
- El conteo inicia en 10 y termina en 0 sin repetir números.
- Matches queda un poco más abierto, pero mantiene filtros y 0 = NO OPERAR.
- Se rediseña la zona de Mercado, Estrategia y Modo.
- No se modifica la conexión, el cambio de mercado en caliente ni el resto de la arquitectura estable.


AJUSTES V11.3.1
- Mercado, Estrategia y Modo usan selectores personalizados oscuros.
- Las opciones ya no dependen visualmente del cuadro blanco nativo de Android.
- Cada opción tiene fondo oscuro, borde, selección verde y radio visual.
- En teléfono se abre un panel inferior oscuro con fondo atenuado.
- No se modificó la lógica de predicción ni los motores.


AJUSTE V11.3.1 — AUDIO Y CONTEO
- Predicción, explicación y aviso de diez segundos se dicen de forma continua.
- Sin pausas largas antes del conteo.
- Conteo basado en el reloj real del navegador.
- Cada número cambia cada segundo.
- Números pronunciados a mayor velocidad.
- Se conserva un solo conteo operativo de 10 a 0.


NOVEDADES V11.3
- Panel Ticker en Vivo con precio grande, último dígito y últimos 20 dígitos.
- Conteos de pares, impares, subidas y bajadas.
- Interfaz bilingüe Español / English.
- Nombres oficiales de mercados y estrategias se mantienen.
- Indicadores visibles traducidos.
- Consulta de símbolos activos desde Deriv.
- Registro manual de mercados adicionales.
- Lista manual de mercados como respaldo.
- No se presenta la confianza técnica como garantía de resultado.
