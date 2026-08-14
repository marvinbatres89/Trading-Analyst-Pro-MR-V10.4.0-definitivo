FIX13.6 - AJUSTE EQUILIBRADO DE FILTROS

REEMPLAZAR SOLO:
- config.js
- engine1.js
- engine2.js
- quality-filter.js

NO TOCAR:
- app.js
- indicators.js
- consensus.js
- timing.js
- archivos del BOT
- sincronización PREPARAR / EJECUTAR
- TARGET 10
- calibración STANDARD 0.0 s

QUÉ CORRIGE
1. FIX13.5 exigía demasiadas condiciones simultáneas.
2. Engine2 bloqueaba si no llegaba un tick nuevo durante la validación.
3. En mercados STANDARD, 1.8 s podía ser poco para recibir ese tick.
4. Par/Impar y Over/Under requerían diferencias demasiado grandes.
5. Quality Filter aplicaba mínimos adicionales más altos que config.js.

FIX13.6
- quickValidationMs: 2200 ms
- Sin tick nuevo: penaliza, pero no bloquea automáticamente.
- Dígitos: 3/3 ventanas se mantiene.
- Diferencias mínimas: 8 / 4 / 2.
- Contexto largo mínimo: 60 dígitos.
- Umbral Even/Odd: 76.
- Umbral Over/Under: 76.
- Match: 80.
- Timing NO aumenta la confianza direccional.

OBJETIVO
Conseguir un punto intermedio:
más señales que FIX13.5, pero sin volver al filtro permisivo anterior.

VALIDACIÓN
Probar únicamente en DEMO.
No se garantiza rentabilidad ni una tasa concreta de aciertos.
