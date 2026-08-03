TRADING ANALYST PRO MR V10.4 — ARQUITECTURA CONSOLIDADA
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
