# Trancendencia Radio — Documentación Completa

> App de radio para Android, construida como una sola página HTML corriendo dentro de un WebView nativo. Todo el backend vive en Cloudflare (Worker + D1). Sin servidor propio, sin base de datos propia, costo ~$0.

---

## ⚠️ ALERTA CRÍTICA — NO USAR EL PROYECTO PAGES `trancendencia-prueba` PARA EL SITIO WEB PRINCIPAL

**`MainActivity.java` (línea ~79) carga la app desde:**
`https://trancendencia-prueba.pages.dev/trancendencia_ultimate_pro.html`

**Ese mismo nombre de proyecto Cloudflare Pages (`trancendencia-prueba`) es usado también por el sitio web principal** `F:\Trancendencia Web\Trancendencia-main` (ver su `wrangler.jsonc`, campo `"name"`). Son proyectos completamente distintos que, por accidente, comparten nombre.

**Qué pasa si se pisan:** cualquier `wrangler pages deploy` del sitio web principal a `trancendencia-prueba` **sobreescribe el HTML que usa la app Android**, dejando la app rota (muestra la home de trancendencia.com en vez del juego/radio). Ya pasó una vez (2026-07-03) y se parchó a mano.

**Regla obligatoria, sin excepción:**
- El sitio web principal (`Trancendencia-main`) **JAMÁS debe deployarse al proyecto `trancendencia-prueba`**. Debe tener su propio proyecto Pages exclusivo, distinto de este.
- Antes de ejecutar `npx wrangler pages deploy` para el sitio web principal, **verificar que `--project-name` (o el `name` en `wrangler.jsonc`) NO sea `trancendencia-prueba`**.
- Esta carpeta (`C:\Users\RODZILLA\Downloads\radio`) es la ÚNICA que debe deployar a `trancendencia-prueba`.
- Solución definitiva pendiente: mover esta app a un proyecto Pages propio (ej. `trancendencia-app-radio`), actualizar la URL en `MainActivity.java` y **recompilar el APK** en Android Studio — hasta que eso se haga, el riesgo de pisarse sigue latente.

---

## 🔒 BLINDAJE DEL SISTEMA — ESTABLE v1.0 (2026-07-03)

**Leer esto ANTES de tocar `worker.js`, `trancendencia_ultimate_pro.html` o hacer cualquier deploy.** Todo lo de abajo fue corregido y verificado en producción durante la sesión del 2026-07-03. No revertir sin entender por qué se hizo así.

### Deploy completo — orden obligatorio, siempre los 2 pasos

Este proyecto tiene **dos mitades que se despliegan por separado** y hay que mantenerlas sincronizadas. Olvidar un paso dejó bugs reales en producción varias veces hoy.

```powershell
cd C:\Users\RODZILLA\Downloads\radio

# 1) Si tocaste worker.js → desplegar el Worker (backend/API)
npx wrangler deploy

# 2) Si tocaste trancendencia_ultimate_pro.html → SIEMPRE copiar la copia del APK primero,
#    y DESPUÉS desplegar a Pages (el orden importa: copiar antes de subir)
copy trancendencia_ultimate_pro.html android_app\app\src\main\assets\trancendencia_ultimate_pro.html
npx wrangler pages deploy . --project-name trancendencia-prueba --commit-dirty=true

# 3) Verificar SIEMPRE después de deployar (la caché de borde de Cloudflare a veces
#    tarda unos segundos en propagar — si el primer curl sale viejo, esperar y repetir):
curl -s "https://app.rodzilla-castro.workers.dev/version"
curl -sL "https://trancendencia-prueba.pages.dev/trancendencia_ultimate_pro.html?cb=123" | grep "APP_VERSION ="
```

**Por qué el paso 2 tiene ese orden exacto:** `android_app/app/src/main/assets/trancendencia_ultimate_pro.html` es la copia de respaldo que usaría el APK si algún día se vuelve a compilar cargando el archivo local en vez de la URL remota. Si no se sincroniza en cada deploy, queda desactualizada silenciosamente y nadie se entera hasta que ya es tarde.

### ⚠️ Regla de oro: `trancendencia-prueba` es SOLO de esta app

Ver la alerta crítica más arriba en este README. Resumen: `npx wrangler pages deploy` del sitio web principal (`Trancendencia-main`) **JAMÁS** debe usar `--project-name trancendencia-prueba` — le pisa el HTML a esta app y la rompe. Ya pasó una vez.

### NO TOCAR sin autorización explícita — sistemas ya cerrados y verificados

- **Sistema único de chequeo de versión/actualización.** Existía un bug real: había **dos sistemas de actualización compitiendo** en el mismo HTML — el oficial (`checkUpdates()` + `#update-modal`, con `APP_VERSION`) y uno viejo/duplicado (`verificarActualizacion()` con `VERSION_ACTUAL` hardcodeado en `"1.0.0"` que nunca se actualizaba, creando su propio modal por JS). El duplicado causaba que el aviso de "nueva versión" apareciera **siempre**, sin importar qué se arreglara en el otro sistema. Se eliminó por completo el duplicado. **Si en el futuro se necesita otro chequeo de versión, usar SIEMPRE `APP_VERSION` como única fuente de verdad — nunca crear una segunda constante de versión.**
- **`showUpdateModal()` con triple candado anti-repetición:** (1) no se dispara si `newVersion === APP_VERSION`, (2) usa `localStorage['update_dismissed_'+version]` para no repetirse tras cerrarlo/descargarlo una vez, (3) `_headers` fuerza `Cache-Control: no-store` en el HTML para que el WebView de Android nunca sirva una copia vieja en caché.
- **Cada vez que se publica versión nueva en el admin (`/admin/set-version`), hay que actualizar TAMBIÉN `APP_VERSION` dentro de `trancendencia_ultimate_pro.html` y desplegarlo.** Son dos números independientes — si no coinciden, el modal de actualización sale para siempre (le pasó al usuario, causa raíz identificada y corregida el 2026-07-03).
- **Contador de descargas del APK:** el botón de descarga (tanto en la app como en `radio.trancendencia.com`) debe apuntar siempre a `https://app.rodzilla-castro.workers.dev/get-apk` — NUNCA al link directo de R2 (`pub-....r2.dev/...`). El túnel `/get-apk` cuenta cada descarga en D1 (`configuracion_global.apk_downloads`, visible en `/admin/payments`) y además oculta la URL cruda del bucket. Si se publica una versión nueva en el admin, el campo del link también debe ser `/get-apk`, no la URL cruda de R2.
- **Deriva Estelar — arquitectura final (no revertir la lógica sin releer esto):**
  - Disponible **a diario**, 3 intentos por día (`DV_MAX_TRIES = 3`, contados en `localStorage.deriva_tries`, reseteo automático por fecha).
  - Automatizada como evento semanal: se **activa sola** los domingos 20:00 UTC por 2 horas (`deriva_auto_opened_at` + push), y se **autocierra** a las 2h — mismo patrón que el Monolito.
  - Interruptor manual de emergencia en `/admin/payments` (`deriva_enabled` en `configuracion_global`) — actívalo/desactívalo cuando quieras sin esperar al domingo; no manda push (es solo para pruebas/emergencias).
  - **Bug de origen corregido:** los 3 endpoints (`/api/deriva/status`, `/played`, `/win`) usaban rutas **relativas** (`fetch('/api/deriva/...')`) en vez de `${WORKER_URL}/api/deriva/...`. Como el HTML vive en un dominio distinto al Worker, esas llamadas siempre fallaban en silencio — el juego nunca sincronizó correctamente desde que existe. Ya corregido; **cualquier nuevo `fetch()` en este archivo DEBE usar `${WORKER_URL}` si llama al Worker**, nunca ruta relativa.
  - **Bug de touch/click corregido:** los listeners táctiles del juego estaban puestos sobre el `#deriva-modal` completo con `preventDefault()`, lo que cancelaba los `click` de los botones (INICIAR MISIÓN, SALIR) en Android. Ahora los listeners táctiles van solo sobre `#deriva-canvas`.
  - **Bug de "loop congelado" corregido:** al cerrar el modal (`closeDeriva()`) se cancela el `requestAnimationFrame`, pero nunca se reiniciaba al reabrir. Ahora `openDeriva()` lo reinicia si hace falta.
  - `dvSyncStatus()` debe limpiar `localStorage.deriva_last_played` cuando el servidor dice `played_today:false` (antes solo lo ponía en `true`, nunca lo quitaba — dejaba el juego bloqueado localmente aunque el servidor dijera lo contrario).
- **Notificaciones push con ícono grande (logo) y `MediaStyle`:** cambios en `RadioForegroundService.java`, `MyFirebaseMessagingService.java`, `MainActivity.java` — código Java, **requiere recompilar el APK en Android Studio** para verse, no basta con desplegar el HTML/Worker.
- **Cooldowns visibles en el admin:** sección "⏱️ Cooldowns de Eventos" en `/admin/payments` — countdown en vivo para Monolito, Deriva, Misiones y Anomalía. Calculado server-side con `nextOccurrenceUTC(dow, hour)`, actualizado cliente-side cada segundo con `setInterval`.
- **Plantillas de push por evento:** sección "EVENTOS AUTOMÁTICOS" en "ENVÍO MANUAL DE PUSH" — botones con el texto EXACTO que manda cada cron, para poder probar cómo llega antes de que ocurra de verdad. Si se cambia el texto de un push automático en el cron, actualizar también su plantilla correspondiente ahí para que no queden desincronizados.

---

## Índice

1. [Arquitectura General](#arquitectura-general)
2. [Archivos del Proyecto](#archivos-del-proyecto)
3. [Backend — Cloudflare Worker](#backend--cloudflare-worker)
4. [Base de Datos — Cloudflare D1](#base-de-datos--cloudflare-d1)
5. [App Android — WebView](#app-android--webview)
6. [Frontend — trancendencia_ultimate_pro.html](#frontend--trancendencia_ultimate_prohtml)
7. [Features Implementados](#features-implementados)
8. [Eventos Automáticos (Cron)](#eventos-automáticos-cron)
9. [Notificaciones Push — Firebase FCM](#notificaciones-push--firebase-fcm)
10. [Mini-Juego — Deriva Estelar](#mini-juego--deriva-estelar)
11. [Cómo Deployar](#cómo-deployar)
12. [Pendiente / Próximos Pasos](#pendiente--próximos-pasos)

---

## Arquitectura General

```
┌─────────────────────────────────────────────────┐
│              ANDROID APP (APK)                  │
│                                                 │
│  MainActivity.java                              │
│  └── WebView carga trancendencia_ultimate_pro.html
│       ├── window.onNativeSignal()  ← señales push
│       ├── window.registerPushToken() ← FCM token
│       └── AndroidInterface.showToast()          │
│                                                 │
│  RadioForegroundService.java                    │
│  └── Mantiene audio en background               │
│                                                 │
│  MyFirebaseMessagingService.java                │
│  └── Recibe push → broadcast → WebView          │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────┐
│         CLOUDFLARE WORKER                       │
│   https://app.rodzilla-castro.workers.dev       │
│                                                 │
│  Endpoints:  /auth  /sync  /global_status       │
│              /shout  /shouts                    │
│              /reaccion  /reacciones             │
│              /monolith-status  /monolith-hit    │
│              /save-push-token                   │
│                                                 │
│  Cron: * * * * *  (cada 1 minuto)               │
└────────────────────┬────────────────────────────┘
                     │ D1 Binding
                     ▼
┌─────────────────────────────────────────────────┐
│         CLOUDFLARE D1                           │
│   database_name: app-trancendencia              │
│   database_id:   4d95aba2-8769-427e-b77a-...    │
│                                                 │
│  Tablas: usuarios, gritos, reacciones,          │
│          monolith_state, configuracion_global,  │
│          user_push_tokens                       │
└─────────────────────────────────────────────────┘
```

---

## Archivos del Proyecto

```
radio/
├── trancendencia_ultimate_pro.html   ← TODA la app (HTML/CSS/JS, ~3000 líneas)
├── worker.js                          ← Cloudflare Worker (compilado, listo para deploy)
├── wrangler.toml                      ← Config de Wrangler (nombre, D1 binding, cron)
├── D1.txt                             ← Snapshot antiguo del worker (IGNORAR, obsoleto)
│
├── android_app/
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       ├── assets/
│       │   └── trancendencia_ultimate_pro.html  ← copia del HTML que usa el APK actual
│       └── java/com/trancendencia/radio/
│           ├── MainActivity.java                 ← Carga el HTML, gestiona WebView y FCM
│           ├── RadioForegroundService.java       ← Servicio de audio en background
│           └── MyFirebaseMessagingService.java   ← Recibe push notifications de Firebase
│
├── GUIA_ADMIN_VIP.md                  ← Guía de administración y comandos SQL útiles
├── FIREBASE_PUSH.md                   ← Cómo funcionan las notificaciones push
├── EVENTS_GUIDE.md                    ← Guía de eventos (Monolito, Anomalías)
└── README_ANOMALIAS.md                ← Detalle del sistema de anomalías
```

---

## Backend — Cloudflare Worker

**URL:** `https://app.rodzilla-castro.workers.dev`  
**Archivo fuente:** `worker.js`  
**Deploy:** `npx wrangler deploy` desde la carpeta `radio/`

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth` | Login/registro. Crea usuario si no existe. Devuelve datos del perfil. |
| POST | `/sync` | Guarda progreso: segundos escuchados, rango, logros, misiones, streak. Devuelve insignia asignada por admin. |
| GET | `/global_status` | Estado global: `active_anomaly` y `monolith_open`. |
| POST | `/shout` | Publica un grito (mensaje) en Frecuencia Estelar. Guarda `email`, `nombre`, `mensaje`, `estacion`. |
| GET | `/shouts` | Últimos 50 gritos, ordenados por fecha desc. |
| POST | `/reaccion` | Incrementa contador de una reacción (`fire`/`heart`/`rocket`) para una estación. Upsert. |
| GET | `/reacciones?estacion=X` | Devuelve totales de reacciones para la estación X. |
| GET | `/monolith-status` | Hits restantes del Monolito. |
| POST | `/monolith-hit` | Golpear el Monolito. Decrementa hits. Si llega a 0, lo cierra. |
| POST | `/save-push-token` | Guarda token FCM de un usuario para recibir push. |
| GET | `/get_verified_users` | Lista de usuarios con insignia `fundador` o `embajador`. |
| GET | `/version` | `{version, url}` — versión publicada y link de descarga del APK (`apk_url`). |
| GET | `/get-apk` | Túnel de descarga del APK — cuenta cada descarga en `apk_downloads`. Usar SIEMPRE este link, nunca el de R2 directo. |
| POST | `/admin/set-version?key=` | Publica versión + link APK + notificación push opcional. Usado por el botón "PUBLICAR + NOTIFICAR" del admin. |
| GET | `/api/deriva/status?email=` | `{played_today, x2_until, x2_active, enabled}` — estado diario + si el evento está activo. |
| POST | `/api/deriva/played` | Marca intento jugado (no implica ganar). |
| POST | `/api/deriva/win` | Activa Racha ×2 por 24h. |
| POST | `/api/deriva/admin-toggle?key=` | Interruptor manual de emergencia — activa/desactiva Deriva para todos sin esperar al domingo. |
| POST | `/api/deriva/reset?key=` | Solo testing — resetea `deriva_last_played`/`deriva_x2_until` de un email. |
| GET | `/admin/payments?key=` | Panel admin completo — pagos, stats, cooldowns, controles de Monolito/Deriva/Anomalía, envío de push. |

---

## Base de Datos — Cloudflare D1

**Nombre:** `app-trancendencia`  
**ID:** `4d95aba2-8769-427e-b77a-e27747180f82`

### Tablas

#### `usuarios`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| email | TEXT PK | Identificador único |
| nombre | TEXT | Nombre de pantalla |
| rango | TEXT | Explorador → Pionero → Navegante → Comandante → Leyenda |
| segundos_escucha | INTEGER | Total acumulado de segundos |
| logros | TEXT (JSON) | Array de IDs de logros desbloqueados |
| insignia | TEXT | `ninguna` / `fundador` / `embajador` — solo admin la cambia |
| misiones | TEXT (JSON) | `{week, progress:{time,stations,shouts}, completed:[]}` |
| streak | INTEGER | Días consecutivos escuchando |
| last_listen_date | TEXT | Fecha última escucha en formato `YYYY-MM-DD` UTC |
| coleccion | TEXT (JSON) | Artefactos desbloqueados `[{id,desbloqueado_en}]` |
| ultima_conexion | TEXT | Timestamp última sync |

#### `gritos`
| Columna | Tipo |
|---------|------|
| id | INTEGER PK AUTOINCREMENT |
| email | TEXT |
| nombre | TEXT |
| mensaje | TEXT |
| estacion | TEXT |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP |

#### `reacciones`
| Columna | Tipo |
|---------|------|
| estacion | TEXT |
| tipo | TEXT (`fire` / `heart` / `rocket`) |
| total | INTEGER DEFAULT 0 |
| PRIMARY KEY | (estacion, tipo) |

#### `monolith_state`
| Columna | Tipo |
|---------|------|
| id | INTEGER PK |
| hits | INTEGER — vidas restantes del Monolito, comienza en 1500 |

#### `configuracion_global`
| clave | Descripción |
|-------|-------------|
| `monolith_open` | `true` / `false` |
| `monolith_opened_at` | Unix timestamp de cuando se abrió |
| `active_anomaly` | `true` / `false` |
| `anomaly_expire` | Unix timestamp de expiración de la anomalía |
| `app_version` | Versión publicada desde el admin (comparada contra `APP_VERSION` del HTML) |
| `apk_url` | Link de descarga publicado — debe ser siempre `https://app.rodzilla-castro.workers.dev/get-apk` |
| `apk_downloads` | Contador de descargas, incrementado por `/get-apk` |
| `deriva_enabled` | Interruptor manual de Deriva Estelar (`true`/`false`, default `true` si no existe) |
| `deriva_auto_opened_at` | Unix ms de cuándo se abrió el evento automático semanal (0 = no hay evento auto en curso) |

#### `user_push_tokens`
| Columna | Tipo |
|---------|------|
| user_id | TEXT PK |
| token | TEXT — token FCM del dispositivo |

---

## App Android — WebView

**Paquete:** `com.trancendencia.radio`  
**minSdkVersion:** 24 (Android 7.0)  
**targetSdkVersion:** 34

### MainActivity.java

Carga el HTML en el WebView con todos los permisos necesarios:

```java
// ACTUAL (carga desde Cloudflare Pages — activado 2026-06-19):
myWebView.loadUrl("https://trancendencia-prueba.pages.dev/trancendencia_ultimate_pro.html");
```

**Puente nativo → WebView:**
- `window.onNativeSignal('PUSH_RECEIVED', payload)` — push recibido mientras la app está abierta
- `window.registerPushToken(token)` — registra token FCM al iniciar

**Puente WebView → nativo:**
- `AndroidInterface.showToast(texto)` — muestra un Toast nativo
- `AndroidInterface.sendLocalNotification(title, msg)` — notificación local del sistema

**Ciclo de vida:**
- `onPause()` → inicia `RadioForegroundService` (audio no se interrumpe al minimizar)
- `onResume()` → detiene `RadioForegroundService`
- `onBackPressed()` → si no hay historial, mueve app al fondo (`moveTaskToBack(true)`)

### RadioForegroundService.java

Servicio en primer plano que muestra una notificación persistente mientras está en background. Evita que Android mate el proceso cuando el usuario minimiza la app con audio reproduciéndose.

### MyFirebaseMessagingService.java

Escucha mensajes FCM entrantes. Al recibir uno, lanza un broadcast interno que `MainActivity` captura y re-inyecta en el WebView via `evaluateJavascript` llamando a `window.onNativeSignal`.

---

## Frontend — trancendencia_ultimate_pro.html

Archivo único ~3000 líneas. Sin build — se puede abrir directamente o servir como asset estático.

**Dependencias externas (CDN):**
- Three.js `0.160.0` — canvas de estrellas animado
- Google Fonts — Cormorant Garamond, Montserrat, Outfit

**Constante principal:**
```js
const WORKER_URL = 'https://app.rodzilla-castro.workers.dev';
```

### Pantallas

| ID | Nombre visible | Descripción |
|----|---------------|-------------|
| `page-home` | Principal | Player de radio, botonera de estaciones, reacciones |
| `page-pasaporte` | Pasaporte Estelar | Perfil: rango, horas, logros, streak, artefactos |
| `page-misiones` | Misiones Semanales | 3 misiones auto-generadas, progreso en tiempo real |
| `page-salon` | Salón de la Fama | Usuarios con insignia fundador/embajador |
| `page-grito` | Frecuencia Estelar | Chat en tiempo real, auto-refresh cada 15s |
| `page-monolito` | El Monolito | Evento semanal colectivo — todos golpean el mismo jefe |
| `page-anomalia` | Anomalía Estelar | Evento aleatorio — mini-juego de resolución |
| `deriva-modal` | Deriva Estelar | Mini-juego 3D de supervivencia, un intento por día |

### Estaciones de Radio

| Nombre | Género |
|--------|--------|
| TRANCENDENCIA | Trance / Deep House |
| COSMOS FM | Ambient / Chillout |
| PULSAR | Progressive / Melodic |
| NEBULA | Deep Techno |
| AURORA | Ethereal / Dreamscape |

### Sistema de Rangos

| Segundos | Rango |
|----------|-------|
| 0 | Explorador |
| 3,600 (1h) | Pionero |
| 18,000 (5h) | Navegante |
| 72,000 (20h) | Comandante |
| 360,000 (100h) | Leyenda |

### Misiones Semanales

3 misiones aleatorias generadas cada lunes. Único por usuario: seed = `(_strHash(email) + wid * 9973) >>> 0`. Reset automático lunes 00:00 UTC via cron.

| ID | Objetivo | Metas posibles |
|----|---------|---------------|
| `time` | Escucha X minutos esta semana | 30 / 60 / 120 min |
| `stations` | Escucha X estaciones diferentes | 2 / 3 / 5 |
| `shouts` | Lanza X gritos en Frecuencia Estelar | 1 / 3 / 5 |

Recompensa al completar: +1 artefacto aleatorio según rareza de la misión.

### Bóveda de Artefactos

12 artefactos clasificados por rareza, desbloqueados al completar misiones.

| Rareza | Artefactos |
|--------|-----------|
| Común | Cristal de Cuarzo, Fragmento Meteórico, Polvo Estelar |
| Raro | Núcleo de Pulsar, Fragmento de Anomalía, Eco Temporal |
| Épico | Mapa Astral, Célula Energética, Sello del Monolito |
| Legendario | Ojo del Universo, Corona Galáctica, Corazón del Cosmos |

### Reacciones por Estación (🔥 ❤️ 🚀)

Botones visibles en el player al reproducir cualquier estación.

- UI optimista: contador sube de inmediato, worker confirma en background
- Cooldown 5 segundos por tipo (via `sessionStorage`)
- Persistido en tabla `reacciones` en D1

### Racha de Órbita (Streak)

- Calculada en el Worker en cada `/sync`
- Fecha UTC `YYYY-MM-DD` para evitar bugs de zona horaria
- Lógica: ayer → streak+1 | hoy ya escuchaste → sin cambio | más antiguo → reinicia a 1
- Visible en Pasaporte Estelar (caja naranja, fondo de la grilla de stats)

### Optimizaciones Mobile

Regla estricta aplicada: **solo `transform` y `opacity` en animaciones CSS.**

Eliminados:
- Todos los `backdrop-filter` / `blur()`
- `box-shadow` animado en `@keyframes`
- `filter` animado en `@keyframes`
- `transition: all`

RAF loop pausado automáticamente cuando la app va a background:
```js
let _rafPaused = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { _rafPaused = true; }
  else { if (_rafPaused) { _rafPaused = false; requestAnimationFrame(drawS); } }
});
function drawS() {
  if (_rafPaused) return;
  // ...
}
```

---

## Eventos Automáticos (Cron)

Cron corre **cada minuto** (`* * * * *`).

| Cuándo | Qué hace |
|--------|---------|
| Sábado 21:00 UTC | Activa El Monolito: 1500 hits, push broadcast a todos |
| Monolito > 3 horas abierto | Auto-cierre, push broadcast |
| Lunes 00:00 UTC | Reset misiones semanales, push broadcast |
| ~1/420 de probabilidad por minuto | Activa Anomalía aleatoria (15 min), push broadcast |
| Anomalía vencida | Auto-cierre, push broadcast |

---

## Notificaciones Push — Firebase FCM

**Proyecto Firebase:** `trancendencia-radio`  
**Credencial admin:** `trancendencia-radio-firebase-adminsdk-fbsvc-*.json` (raíz del repo, NO commitear)

El Worker firma un JWT con la clave privada del service account, obtiene access token de Google OAuth2, y llama a la API FCM v1 para cada token en `user_push_tokens`.

**Flujo completo en Android:**
1. `FirebaseMessaging.getToken()` en `MainActivity.onCreate()`
2. Token inyectado al WebView: `window.registerPushToken(token)`
3. WebView llama `POST /save-push-token`
4. Cuando llega un push: `MyFirebaseMessagingService` → broadcast interno → `MainActivity.pushReceiver` → `window.onNativeSignal('PUSH_RECEIVED', payload)`

**Topic de broadcast:** `radio-listeners` (suscripción automática al iniciar)

---

## Mini-Juego — Deriva Estelar

Juego de supervivencia 3D integrado en la app. Aparece como botón flotante igual al del Monolito. Una vez jugado, el botón desaparece hasta el día siguiente.

### Mecánica

- **Objetivo:** Sobrevivir 30 segundos esquivando asteroides con Three.js (r160)
- **Control:** Deslizar horizontalmente (touch) para mover la nave
- **Victoria:** 30 s sobrevividos → activa **Racha ×2** por 24 horas (guardado en D1)
- **Derrota:** Colisión → termina la partida, igual se marca como jugado (un intento/día)

### Botón

- Posición: `top: 130px; left: 20px` — apilado bajo el botón del Monolito
- Tamaño: 65 × 90 px (idéntico al portal del Monolito)
- Solo visible tras login (`body.intro-done`) y si no se jugó hoy
- Desaparece al terminar la partida (ganada o perdida)

### Nave — Caza Estelar 3D

Construida con `THREE.BufferGeometry` puro (sin cilindros ni conos en el cuerpo):

| Parte | Descripción |
|-------|-------------|
| Fuselaje | 4 secciones transversales rombo (TIP → A → B → C → TAIL), caras trianguladas |
| Alas | Triángulos con grosor real (cara top + bottom + borde de ataque cyan) |
| Cresta dorsal | Espina elevada de A→B, da lectura 3D clara |
| Cockpit | `OctahedronGeometry` aplastado sobre la cresta |
| Propulsores | 3 motores (central + 2 laterales) con núcleo cyan + corona glow, animados |

**Material:** `MeshPhongMaterial` con `flatShading:true`, `DoubleSide`, `transparent`, `shininess:900` + `EdgesGeometry` con `AdditiveBlending` en cada pieza.

**Animación propulsores:** En `dvLoop()` los 3 meshes de escape pulsan escala y `emissiveIntensity` con `sin(ts * 0.011) + sin(ts * 0.019)` (dos frecuencias → parece plasma orgánico).

### Asteroides

`IcosahedronGeometry(1, 2)` con desplazamiento random por vértice (0.45–1.35×) + escalado axial no uniforme. Pool de 10 formas pre-generadas al init — cero lag al spawnear. 7 paletas de color (roca ígnea, asteroide helado, volcánico, etc.) con capas de `EdgesGeometry` para glow.

### API (Worker)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/deriva/status?email=` | `{played_today, x2_until}` — estado del día |
| POST | `/api/deriva/played` | Marca partida jugada (independiente del resultado) |
| POST | `/api/deriva/win` | Activa Racha ×2 por 24 h (`deriva_x2_until = now+86400000`) |
| POST | `/api/deriva/reset` | Resetea estado (solo testing, llamar desde Worker URL directa) |

### Columnas D1 en tabla `usuarios`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `deriva_last_played` | TEXT | Fecha `YYYY-MM-DD` UTC del último juego |
| `deriva_x2_until` | INTEGER | Unix ms hasta el que aplica el ×2. 0 = inactivo |

Ambas columnas se crean con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` en try/catch — migración automática sin schema.sql.

### Sync de estado

`window.dvSyncStatus()` (global) se llama en:
1. `finishIntro()` a los 800 ms (flujo auto-login)
2. Hook de login manual (`access-granted`)
3. `visibilitychange` cuando la app vuelve al foreground (Android multi-tarea)
4. Al abrir el modal del juego

### Deploy

```bash
# HTML (Pages):
cd C:\Users\RODZILLA\Downloads\radio
npx wrangler pages deploy . --project-name trancendencia-prueba

# Worker (incluye los 4 endpoints /api/deriva/*):
npx wrangler deploy
```

> **Nota:** El reset de testing usa la URL del Worker directamente (`https://app.rodzilla-castro.workers.dev/api/deriva/reset`), no la URL de Pages — Pages solo sirve GET de archivos estáticos.

---

## Cómo Deployar

> **Para el deploy del día a día (Worker + HTML juntos, con verificación), usar el checklist en [🔒 BLINDAJE DEL SISTEMA](#-blindaje-del-sistema--estable-v10-2026-07-03) al inicio de este documento.** Lo de abajo es la referencia detallada de primera configuración.

### Worker (Backend)

```bash
cd C:\Users\RODZILLA\Downloads\radio

# Primera vez — crear la base de datos en producción:
npx wrangler d1 create app-trancendencia

# Correr migraciones SQL (crear tablas):
npx wrangler d1 execute app-trancendencia --file=./schema.sql --remote

# Guardar el secreto del Firebase Service Account:
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
# (pegar el contenido del JSON cuando lo pida)

# Deploy:
npx wrangler deploy
```

### HTML en el APK — ✅ ACTIVO (URL remota desde Cloudflare Pages)

`MainActivity.java` línea 79 carga desde:
```
https://trancendencia-prueba.pages.dev/trancendencia_ultimate_pro.html
```

**Para actualizar el HTML sin recompilar el APK:**
```powershell
cd C:\Users\RODZILLA\Downloads\radio
npx wrangler pages deploy . --project-name trancendencia-prueba
```

**Solo recompilar APK si cambias código Java** (`MainActivity.java`, `RadioForegroundService.java`).

### Frontend web React (versión desktop)

```bash
# Desde F:\Trancendencia-radio-web
npm run build
npx wrangler pages deploy dist --project-name=trancendencia-radio
```

---

## Variables de Entorno

| Nombre | Descripción | Cómo configurar |
|--------|-------------|-----------------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo del Firebase Admin SDK service account | `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT` |

---

## Pendiente / Próximos Pasos

| Prioridad | Tarea |
|-----------|-------|
| ✅ Hecho | Cambiar `MainActivity.java` para cargar desde Cloudflare Pages |
| Alta | Compilar APK firmado y probar en dispositivo físico real |
| Media | Mostrar indicador visual de Racha ×2 activa en el Pasaporte Estelar |
| Media | Ranking semanal — top 5 oyentes, query a D1 por `segundos_escucha` |
| Media | Desafío diario — micro-misión que cambia cada 24h, complementa el streak |
| Baja | Deploy del web React (`F:\Trancendencia-radio-web`) a Cloudflare Pages |
| Baja | Ícono personalizado en `RadioForegroundService` (actualmente usa `ic_dialog_info`) |

---

## Versión

- `trancendencia_ultimate_pro.html` — `APP_VERSION = "1.0.1"` (recordar mantenerla sincronizada con lo publicado en el admin — ver bloque de blindaje)
- `android_app/app/build.gradle` — `versionName "1.0.1"`, `versionCode 2`
- Worker — último deploy incluye: contador de descargas APK, sistema unificado de Deriva Estelar (diario + evento automático + toggle manual + 3 intentos), cooldowns visibles en admin, plantillas de push por evento
- Pages URL activa — `https://trancendencia-prueba.pages.dev/trancendencia_ultimate_pro.html`
- Última auditoría/blindaje completo — 2026-07-03
