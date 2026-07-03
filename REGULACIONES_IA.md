# 🛡️ REGLAS DE ORO DE TRANCENDENCIA RADIO

**ESTE DOCUMENTO ES LA VERDAD ABSOLUTA.** La IA tiene terminantemente prohibido alterar los parámetros aquí descritos sin instrucción explícita y directa del usuario.

## ⚠️ CONFIGURACIONES SAGRADAS

1.  **Velocidades de Animación:**
    *   **Órbitas:** 60s (externa) y 45s (interna). Nunca acelerar.
    *   **Monolito:** Rotación multiaxial ultra lenta (incrementos de 0.002, 0.001, 0.0015). Debe mantener una deriva espacial elegante.
2.  **Exclusividad por Registro (PROTECTED CORE):** 
    *   Push Notifications y Anomalías son **SÓLO** para usuarios con correo electrónico validado.
    *   Si no hay correo, el sistema debe permanecer en silencio y sin iconos de eventos.
3.  **Higiene del Intro:** 
    *   PROHIBIDO mostrar cualquier elemento de evento (Monolito, Anomalía, Toasts) antes de que el cuerpo tenga la clase `.intro-done` y se haya confirmado el acceso.
4.  **Rendimiento en Android:** 
    *   Mantener optimizaciones de renderizado (fillRect en lugar de arc para estrellas) para garantizar 60 FPS estables.

## 🔒 4. SISTEMA DE NOTIFICACIONES Y ANOMALÍAS (PROTECTED CORE)
- **Prohibido** cambiar el nombre de la función `window.registerPushToken`. Es el único puente válido con la APK.
- **Prohibido** usar cualquier identificador que no sea el **EMAIL** para el registro de tokens (`user_id`).
- **Prohibido** alterar los selectores CSS de visibilidad del `#anomaly-node`. Deben depender de los estados del `body` (`.intro-done`, `.access-granted`).
- **Prohibido** eliminar la lógica de persistencia de tokens en `localStorage` antes del login.

## 📦 5. INTEGRIDAD DE LA APK
- Cualquier cambio en el HTML debe ser sincronizado inmediatamente a `android_app/app/src/main/assets/` para evitar desincronizaciones de versión.

---
*Este documento es la ley suprema para el asistente de IA. Cualquier violación de estas reglas se considera un fallo crítico de sistema.* 🛰️🛡️🫡
