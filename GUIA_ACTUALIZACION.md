# 🛰️ GUÍA DE ACTUALIZACIÓN - TRANCENDENCIA RADIO

Este manual detalla los pasos para lanzar nuevas versiones de **Trancendencia Radio** sin tocar el código nativo.

---

## 🏗️ PASO 1: Preparar la nueva APK
1. Realiza tus cambios en el código HTML/JS de la radio.
2. Genera la nueva APK en **Android Studio** (Build -> Build APKs).
3. **RENOMBRAR EL ARCHIVO:** Cambia el nombre de `app-debug.apk` a:
   👉 `trancendencia-radio.apk`
4. Sube el archivo a tu bucket de **Cloudflare R2**.
   * URL Oficial: `https://pub-0d48f5ae74464ad2bbac710f92d0d80a.r2.dev/trancendencia-radio.apk`

---

## ⚙️ PASO 2: Activar la Actualización (D1 + PUSH)
Para que las Apps de los usuarios "sepan" que deben actualizarse, ahora puedes hacerlo directamente desde tu base de datos D1 o mediante un comando, sin tocar el código del Worker.

### Opción A: Desde el Panel de Cloudflare (Manual)
1. Entra a **Cloudflare -> D1 -> app-trancendencia -> Studio**.
2. En la tabla `configuracion_global`, busca la fila `app_version` (si no existe, créala).
3. Cambia el valor (ej. de `1.0.0` a `1.0.1`).
4. **Resultado:** Todos los usuarios verán el aviso la próxima vez que abran la app.

### Opción B: Mediante Comando (Recomendado + PUSH)
Puedes usar una herramienta de consulta (como Postman o cURL) para enviar una señal al nuevo endpoint que además enviará una notificación push a todos los teléfonos:

```bash
curl -X POST https://app.rodzilla-castro.workers.dev/update-app-version \
  -H "Content-Type: application/json" \
  -d '{"newVersion": "1.0.1", "sendPush": true}'
```

> [!IMPORTANT]
> El sistema ahora es dinámico. Al cambiar el número en D1, la App mostrará el aviso automáticamente.


---

## 🚀 PASO 3: Desplegar los Cambios
Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npx wrangler deploy
```

Al terminar, todas las apps en los móviles de tus oyentes verán el cartel de actualización automáticamente. 🛰️🔔

---

## 🛡️ NOTAS DE SEGURIDAD (Play Protect)
Para evitar el aviso amarillo/rojo de Google:
1. **Apelar a Google:** Envía tu APK cada vez que cambies mucho el código aquí:
   👉 [Play Protect Appeals](https://support.google.com/googleplay/android-developer/contact/protect_appeals)
2. **Guía de Usuario:** La página de descarga ya incluye una guía visual para que el usuario sepa que debe pulsar "Instalar de todas formas".

---

## 🛠️ COMPONENTES ACTIVOS
* **Backend:** Cloudflare Workers + D1 Database (Maneja el Pasaporte, Monolito y Gritos).
* **Descargas:** Manejadas de forma nativa por el `DownloadListener` en Java.
* **Gritos Estelares:** Funcionando a través de los endpoints `/shout` y `/shouts`.

---

## 💎 GESTIÓN DE PAGOS VIP (ADMINISTRACIÓN)
Cuando un usuario envía un pago desde la App, debes aprobarlo manualmente en tu panel de Cloudflare para que se active su insignia:

1. **Verificar el Pago:**
   * Entra a **Cloudflare -> D1 -> app-trancendencia -> Studio**.
   * Abre la tabla `pending_payments`.
   * Copia el `tx_id` y verifícalo en un explorador de bloques (como BscScan) para confirmar que recibiste los fondos.

2. **Aprobar en el Panel (Manual):**
   * En la tabla `pending_payments`, cambia el `status` de `pending` a **`approved`**. Pulsa "Apply".
   * Ve a la tabla `usuarios`, busca el correo del usuario y en la columna `insignia` escribe el rango: **`fundador`** o **`embajador`**. Pulsa "Apply".

3. **Resultado:**
   * El usuario deberá cerrar y abrir sesión en su Pasaporte para ver su nueva insignia y aparecer en el Muro de Honor.

**Manual actualizado por Antigravity - Todo Sincronizado.** 🛰️🫡💎
