# Temporizador Pomodoro

Aplicación web sin dependencias (HTML, CSS y JavaScript puros).

## Cómo usarla
Abre `index.html` en tu navegador. No necesita servidor ni instalación.

## Estructura
- `index.html`: estructura de la página (temporizador, ajustes y tareas).
- `style.css`: diseño, colores (variables en `:root`) y tema claro/oscuro automático.
- `script.js`: lógica del temporizador, sesiones, tareas y sonido.

## Cómo personalizarla
- Duraciones por defecto y límites: constantes `DEFAULTS` y `LIMITS` al inicio de `script.js` (en minutos).
- Sesiones antes del descanso largo: constante `SESSIONS_BEFORE_LONG` en `script.js` (los puntos se ajustan solos).
- Colores de cada modo: `--work`, `--short` y `--long` en `style.css`.
- Sonido: constante `CHIME_NOTES` (notas en Hz) y función `playChime()` en `script.js`.

## Notas
- El tiempo se calcula con `Date.now()`, así no se desfasa aunque la pestaña quede en segundo plano.
- Las duraciones se guardan en el navegador (`localStorage`); las tareas y el conteo de sesiones no.
- La tipografía (Figtree) se carga desde Google Fonts; sin conexión se usa la fuente del sistema.
