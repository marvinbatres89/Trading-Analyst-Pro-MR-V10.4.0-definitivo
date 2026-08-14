TRADING ANALYZER FIX13.5 - FILTROS DE CALIDAD

INCLUYE:
- indicators.js
- engine1.js
- engine2.js
- consensus.js
- quality-filter.js

NO TOCA:
- app.js
- PREPARAR / EJECUTAR
- TARGET 10
- calibración del BOT
- bot.js
- bot-engine.js

CAMBIOS PRINCIPALES:
1. Engine 2 exige información nueva entre validaciones.
2. Par/Impar y Over/Under exigen alineación 3/3 y diferencias mínimas en ventanas corta/media/larga.
3. Rise/Fall exige mejor alineación y bloquea contradicciones.
4. Consensus usa el score más conservador de ambos motores.
5. El timing ya no aumenta el score direccional.
6. Umbrales mínimos internos más exigentes, sin bajar los que ya tenga config.js.

OBJETIVO:
Menos operaciones, pero señales más selectivas. No garantiza ganancias ni una tasa de acierto concreta.

INSTALACIÓN:
1. Hacer respaldo de estos cinco archivos actuales.
2. Reemplazar solamente estos cinco archivos.
3. No cambiar app.js ni archivos del BOT.
4. Recargar la herramienta.
5. Probar primero en DEMO.
