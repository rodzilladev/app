# 🛡️ PROTOCOLO DE PROTECCIÓN: SISTEMA DE ANOMALÍAS

**ESTE DOCUMENTO ES DE OBLIGADA LECTURA ANTES DE EDITAR `trancendencia_ultimate_pro.html`.**
El sistema de anomalías es un ecosistema frágil que depende de la sincronización exacta entre Android, el Worker de Cloudflare y el Frontend. **NO MODIFICAR** las siguientes secciones sin una razón de peso mayor.

---

## 1. Reglas de Visibilidad (CSS)
El nodo `#anomaly-node` tiene bloqueos físicos para evitar confusión al usuario.
- **PROHIBIDO** quitar las reglas `body:not(.intro-done)` y `body:not(.access-granted)`. 
- Estas reglas aseguran que la anomalía sea invisible durante la introducción y en la pantalla de login.
- **ESTADO ACTUAL:** `display: none !important` si no se cumplen las condiciones.

## 2. Lógica de Activación (JavaScript)
- **Radar:** El radar debe mantenerse en un intervalo de **5 segundos** (`setInterval(checkGlobalAnomaly, 5000)`) para asegurar una respuesta fluida.
- **Flicker-Free:** La función `startAnomaly()` debe asignar el icono y el nombre **ANTES** de cambiar el estilo a `display: flex`.
- **Persistencia:** El ID de la anomalía se guarda en `node.dataset.pendingId` para evitar que el icono cambie aleatoriamente mientras el usuario lo está viendo.

## 3. Registro de Notificaciones (Push)
Es la parte más crítica. El registro es **doble y redundante**:
- **Paso 1:** Al recibir el token del APK (`onAndroidToken`), se guarda en `localStorage` y se envía al servidor con el ID `last_known_device`.
- **Paso 2:** Si el usuario hace login, la función `requestAccess` recupera ese token guardado y lo vincula inmediatamente a su **correo electrónico**.
- **REGLA DE ORO:** Nunca cambies `user_id` por otro campo que no sea el email, ya que el Worker espera el email para la sincronización de la base de datos.

## 4. Integración con el Worker
- La constante `WORKER_URL` debe apuntar siempre a `https://app.rodzilla-castro.workers.dev`.
- Cualquier cambio en el endpoint `/activate-anomaly` o `/save-push-token` requiere una actualización coordinada en este archivo.

---

**⚠️ ADVERTENCIA:** Si el sistema de Push deja de funcionar con la radio cerrada, revisa primero los permisos de Android y luego la llave de Firebase en los secretos del Worker. No toques el código del HTML si los tests globales devuelven `success: true`.
