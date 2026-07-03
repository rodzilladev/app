# 📡 Guía Maestra: Ecosistema Firebase & Notificaciones Push
## Trancendencia Radio Ultimate Pro

Esta guía detalla la arquitectura, implementación y mantenimiento del sistema de notificaciones push de alta fidelidad integrado en la plataforma.

---

## 🏗️ 1. Arquitectura del Sistema

El sistema opera mediante una triangulación perfecta entre tres componentes críticos:

1.  **APK Nativa (Android):** Recepción de señales y gestión de tokens vía FCM.
2.  **WebView (Frontend):** Registro del token en el perfil del navegante y sincronización de identidad.
3.  **Cloudflare Worker (Backend):** Bóveda de tokens en base de datos D1 y orquestación de envíos masivos.

---

## 🛠️ 2. Configuración en la Consola Firebase

Para que el sistema funcione, se deben cumplir los siguientes requisitos en [console.firebase.google.com](https://console.firebase.google.com):

1.  **Crear Proyecto:** "Trancendencia Radio".
2.  **Agregar App Android:** Usar el package name `com.trancendencia.radio`.
3.  **Descargar `google-services.json`:** Debe estar ubicado en `android_app/app/`.
4.  **Habilitar FCM:** En la configuración del proyecto -> Cloud Messaging.
5.  **Obtener Server Key:** Necesaria para que el Worker pueda enviar mensajes.

---

## 📲 3. Implementación Nativa (Android)

### Gestión de Tokens
El archivo `MainActivity.java` inicializa el servicio y recupera el token único del dispositivo:
```java
FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
    String token = task.getResult();
    // Se envía al WebView mediante el puente JavaScript
    webView.evaluateJavascript("if(window.registerPushToken) { registerPushToken('" + token + "'); }", null);
});
```

### Servicio de Mensajería (`MyFirebaseMessagingService.java`)
Este servicio intercepta las señales entrantes. Si la app está abierta, usa el puente nativo `AndroidInterface.showToast` para una experiencia inmersiva. Si está cerrada, genera una notificación de sistema con prioridad alta.

---

## 🛰️ 4. Sincronización en el Frontend

En el archivo `trancendencia_ultimate_pro.html`, la función `registerPushToken` se encarga de la persistencia:

```javascript
async function registerPushToken(token) {
  localStorage.setItem('trancendencia_push_token', token);
  
  // Registro inmediato en la Bóveda Estelar (Worker)
  await fetch(`${WORKER_URL}/register-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token })
  });
  
  syncWithCloud(); // Respaldo total del perfil
}
```

---

## ⚡ 5. Orquestación en el Backend (Worker)

El Worker centraliza la inteligencia de envío.

### Almacenamiento (D1 SQL)
Los tokens se guardan en la tabla `users` vinculados al email del navegante, permitiendo envíos segmentados o globales.

### Endpoint de Envío
El administrador puede disparar anomalías o alertas críticas:
- **URL:** `https://app.rodzilla-castro.workers.dev/admin/send-push`
- **Payload:**
```json
{
  "title": "☄️ ¡ANOMALÍA DETECTADA!",
  "body": "Un nuevo portal musical se ha abierto en el sector 7.",
  "target": "global" 
}
```

---

## 🧪 6. Protocolo de Pruebas

Para verificar que el flujo está activo:

1.  **Instalar APK:** Asegurarse de que sea una versión sincronizada con el último `google-services.json`.
2.  **Abrir App:** El sistema registrará el token automáticamente (verificar consola de Android Studio).
3.  **Disparar Alerta:** Usar el panel de administración del Worker para enviar un "Grito Global".
4.  **Verificación:** La notificación debe aparecer tanto en el área de notificaciones de Android como dentro de la app (vía Toast Celestial).

---

## ⚠️ Notas de Mantenimiento

- **Expiración:** Los tokens de FCM pueden expirar. El sistema los actualiza en cada inicio de sesión.
- **Permisos:** En Android 13+, el usuario debe conceder explícitamente el permiso de notificaciones al primer inicio.
- **CORS:** El endpoint `/register-token` en el Worker debe tener configuradas las cabeceras CORS para permitir peticiones desde el WebView.

---
*Manual generado para la Flota de Trancendencia Radio.* 🛰️🫡✨
