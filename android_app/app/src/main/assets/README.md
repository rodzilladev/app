# 🛰️ Trancendencia Radio - Ultimate Pro (Android Edition)

Arquitectura de alta fidelidad para streaming de audio persistente en Android WebView.

## 🚀 Innovaciones Técnicas (Parche de Estabilidad)

### 1. Motor de Audio Blindado (HTML5/JS)
- **Reconexión con Backoff Exponencial:** Si el stream se corta, la app reintenta la conexión en intervalos crecientes (0s, 2s, 4s, 8s, 16s) para evitar bucles infinitos y saturación de red.
- [Guía Firebase & Push](FIREBASE_PUSH.md): Detalles técnicos sobre el sistema de notificaciones.
- [Guía de Eventos Globales](EVENTS_GUIDE.md): Manual de Anomalías y el Monolito.
- [Manual de Operaciones](README_PROD.md): Guía para administradores y DJs.
- **Detección de "Silencio de Buffer":** Listeners específicos para `stalled`, `waiting` y `error`. Si el servidor de SomaFM deja de enviar datos por 10 segundos, la app fuerza una reconexión automática.
- **Cache-Buster Inteligente:** Solo en reconexiones, se añade un timestamp (`?_t=...`) a la URL para saltar el caché del ISP y forzar un nuevo handshake con el servidor de streaming.

### 2. Visualización "Pro" Resiliente
- **Modo Híbrido Real/Procedural:** El visualizador intenta leer datos reales (vía CORS). Si el servidor bloquea los datos, la app detecta el "silencio visual" y activa un **Ritmo Procedural** que simula el beat de la música, asegurando que las barras NUNCA se queden quietas.
- **Audio Heartbeat:** Un intervalo de 1 segundo fuerza el `resume()` del `AudioContext` para evitar que Android suspenda el motor visual al minimizar la app.

### 3. Persistencia en Android (Java Nativo)
- **RadioForegroundService:** Implementación de un servicio de primer plano (`ForegroundService`) con tipo `mediaPlayback`. Esto eleva la prioridad del proceso al nivel de apps como Spotify, impidiendo que Android lo cierre para ahorrar memoria.
- **Estrategia START_STICKY:** Si el sistema llega a cerrar la app por falta de memoria extrema, Android la reiniciará automáticamente en cuanto haya recursos disponibles.
- **Gestión de Ciclo de Vida:**
    - `onPause()`: Activa el Servicio de primer plano.
    - `onResume()`: Detiene el servicio para ahorrar batería mientras la app está visible.

### 4. Ecosistema de Notificaciones 🔔
- **Notificación Persistente (Foreground):** Mantiene el proceso vivo en Android 10+ y permite controlar el audio desde la pantalla de bloqueo.
- **Alertas de Sistema (Native Bridge):** El JavaScript se comunica con Android a través de `AndroidInterface` para lanzar *Toasts* nativos incluso si la UI está minimizada.
- **Notificaciones PUSH (Firebase):** 
    - Canal: `trancendencia_alerts` (Importancia Alta).
    - Uso: Alertas globales de Anomalías Espaciales y Apertura del Monolito.
    - Sincronización: El token FCM se registra automáticamente y se vincula al Pasaporte del usuario en la base de datos D1.

## 🛠️ Requisitos de Compilación

- **Android SDK:** 34+ (Android 14 ready)
- **Permisos Críticos:**
    - `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (Para audio en segundo plano)
    - `POST_NOTIFICATIONS` (Para la notificación persistente)
    - `WAKE_LOCK` (Como respaldo de energía)
- **Configuración WebView:**
    - `setAllowUniversalAccessFromFileURLs(true)`: Permite cargar datos de la nube desde archivos locales.
    - `setSafeBrowsingEnabled(false)`: Evita bloqueos de seguridad en streams de radio externos.

## 📂 Estructura de Sincronización

Cada cambio en el archivo raíz `trancendencia_ultimate_pro.html` debe ser sincronizado a los assets de Android:
```bash
cp trancendencia_ultimate_pro.html android_app/app/src/main/assets/index.html
```

---
**Trancendencia Radio** - *Elevando la experiencia auditiva al siguiente plano.* 🌌✨
