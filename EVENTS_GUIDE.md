# 🌌 Guía de Eventos Globales: Anomalías & Monolito
## Manual de Operaciones Críticas - Trancendencia Radio

Esta guía detalla el funcionamiento interno, los protocolos de ejecución y los procedimientos de recuperación para los eventos dinámicos del sistema.

---

## 🏗️ 1. Infraestructura de Datos (Cloudflare D1)

Los eventos se rigen por estados persistentes en la base de datos `DB`.

### Tablas Críticas
- **`configuracion_global`**: Almacena los interruptores maestros (`active_anomaly`, `monolith_open`, `anomaly_expire`).
- **`monolith_state`**: Controla la salud actual del Monolito (`hits`).

---

## ⚠️ 2. Sistema de Anomalías

Las anomalías son eventos de corta duración (15 min) que alteran la percepción de la señal.

### Activación
1.  **Automática:** El Worker ejecuta un chequeo probabilístico (`Math.random() < 1/300`) cada minuto.
2.  **Manual:** `POST /activate-anomaly`. Activa el flag y envía un push global.

### Recuperación (Si se queda colgada)
Si una anomalía no se cierra sola (el cron falla), se debe ejecutar:
-   **Comando:** `POST /close-anomaly`.
-   **Efecto:** Fuerza el flag a `false` y limpia el timestamp de expiración.

---

## 🗿 3. El Despertar del Monolito

El Monolito es el evento masivo semanal.

### Ciclo de Vida
1.  **Apertura:** Sábados a las 21:00 UTC (Automático) o `POST /open-monolith` (Manual).
2.  **Salud:** Se inicializa con **1500 hits**.
3.  **Cierre:** Se desactiva automáticamente cuando los hits llegan a **0** vía `POST /monolith-hit`.

### Procedimiento de Emergencia
Si el Monolito no se abre el sábado:
1.  Verificar que la tabla `monolith_state` tenga el `id=1`.
2.  Ejecutar `POST /open-monolith` para forzar el inicio y la notificación.

---

## 🛠️ 4. Diccionario de Endpoints (Control Total)

| Acción | Endpoint | Método | Descripción |
| :--- | :--- | :--- | :--- |
| **Activar Anomalía** | `/activate-anomaly` | POST | Inicia anomalía de prueba (2 min). |
| **Cerrar Anomalía** | `/close-anomaly` | POST | Estabiliza el sector manualmente. |
| **Abrir Monolito** | `/open-monolith` | POST | Inicia el evento semanal y envía push. |
| **Cerrar Monolito** | `/monolith-hit` | POST | Enviar `{"amount": 10000}` para forzar cierre. |
| **Estado Global** | `/global_status` | GET | Consulta rápida de flags activos. |

---

## 🚑 5. Guía de Recuperación Ante Fallos

### El sistema no envía Notificaciones Push
1.  Verificar que la variable `FIREBASE_SERVICE_ACCOUNT` en los secretos del Worker sea un JSON válido.
2.  Asegurarse de que el `project_id` coincida con la consola de Firebase.

### La App no detecta el evento
1.  Verificar los logs del Worker en Cloudflare para errores de D1.
2.  Asegurarse de que el frontend está apuntando a la `WORKER_URL` correcta.
3.  Limpiar caché en la App: Los eventos dependen de `global_status`, que debe ser ultra-rápido.

---
*Documentación técnica para la estabilidad del Cosmos.* 🛰️🫡✨
