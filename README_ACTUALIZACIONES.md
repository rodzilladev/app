# 🛰️ MANUAL DE ACTUALIZACIÓN DINÁMICA - TRANCENDENCIA RADIO

Este sistema permite lanzar actualizaciones de la App y notificar a todos los usuarios **sin tocar el código del servidor**.

---

## 🏗️ PASO 1: Preparar la nueva APK
1. Realiza los cambios necesarios en tu código (HTML/JS/CSS).
2. Genera la APK en **Android Studio** (Build -> Build APKs).
3. **RENOMBRAR:** Cambia el nombre del archivo generado a `trancendencia-radio.apk`.
4. **SUBIR A R2:** Sube el archivo a tu bucket de Cloudflare R2 (reemplaza el anterior).
   * URL de descarga: `https://pub-0d48f5ae74464ad2bbac710f92d0d80a.r2.dev/trancendencia-radio.apk`

---

## 🚀 PASO 2: Disparar la Actualización (El Aviso)
Para que a los usuarios les aparezca el cartel de "Nueva Versión", debes cambiar el número en la base de datos. Tienes dos formas:

### MÉTODO A: Por comando (Recomendado + Envía Notificación Push) 🔔
Usa este comando en tu terminal para actualizar la versión y enviar un mensaje a todos los celulares al mismo tiempo:

```bash
curl -X POST https://app.rodzilla-castro.workers.dev/update-app-version \
  -H "Content-Type: application/json" \
  -d '{"newVersion": "1.0.1", "sendPush": true}'
```
*(Cambia "1.0.1" por el número de versión que corresponda)*.

### MÉTODO B: Manual (Sin notificación push) 🖱️
1. Entra al panel de **Cloudflare -> D1 -> app-trancendencia -> Studio**.
2. Abre la tabla `configuracion_global`.
3. Busca la fila donde dice `app_version` y cambia el valor (ej. de `1.0.0` a `1.0.1`).
4. Haz clic en **Apply**.

---

## 🛡️ NOTAS IMPORTANTES
* **¿Cuándo salta el aviso?**: El aviso aparece cuando la versión guardada en la App del usuario es DIFERENTE a la que tú pongas en la base de datos D1.
* **Firebase Push**: El sistema de notificaciones está vinculado al endpoint administrativo. Úsalo con sabiduría para no saturar a los oyentes.
* **Seguridad**: El núcleo de la radio (Anomalías y Monolito) sigue funcionando de forma independiente y segura.

---

## 🛠️ RESUMEN TÉCNICO
* **Endpoint de Verificación**: `GET /version` (Lee de D1).
* **Endpoint de Administración**: `POST /update-app-version` (Actualiza D1 y envía Push).
* **Almacenamiento**: Cloudflare R2 (APK Binaria).

**Sistema configurado y sellado por Antigravity.** 🛰️🫡💎
