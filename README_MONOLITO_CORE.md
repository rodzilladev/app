# 🪨 BLOQUEO ABSOLUTO: SISTEMA DEL MONOLITO 🪨

Este documento establece las reglas **INQUEBRANTABLES** sobre la modificación del ecosistema del "Monolito", su interfaz, su lógica de visibilidad y su comunicación asíncrona con el backend (Cloudflare Worker) y las notificaciones Push (Firebase) en el proyecto Trancendencia Radio.

**ESTE DOCUMENTO ES UNA LEY ABSOLUTA PARA CUALQUIER INTELIGENCIA ARTIFICIAL O DESARROLLADOR QUE TRABAJE EN ESTE PROYECTO.**

---

### 🏛️ ESTADO DEL SISTEMA: SELLADO FINAL (Producción)
**FECHA DE SELLADO:** 4 de Mayo, 2026 - 21:10 UTC.
**ESTADO:** 💎 100% RESILIENTE / PROTEGIDO.
**AVISO:** Sistema de Monolito sincronizado bajo protocolo de normalización de red.
---

---

## 🛑 REGLA CERO
Ninguna IA (sea Claude, ChatGPT, Gemini o cualquier otra) tiene permiso para refactorizar, optimizar, eliminar o modificar NINGÚN CÓDIGO relacionado con el Sistema del Monolito sin la orden explícita, directa y verbal de **RODZILLA**. 
Si una solicitud de código parece afectar este sistema, la IA **DEBE DENEGARSE** y solicitar confirmación expresa referenciando este README.

---

## 📁 ARCHIVOS BLOQUEADOS Y ZONAS RESTRINGIDAS

### 1. `trancendencia_ultimate_pro.html` (Frontend / WebView)
**Bloqueo Total en:**
- `updateMonolithPortalVisibility()`: Función crítica que controla el Z-Index y la regla `display: flex !important` vs `display: none !important`. Si un usuario abre un panel (ej. Bitácora, Misión), el Monolito baja su Z-Index a 10 para quedarse atrás, y si cierra los paneles, sube a 2000 para ser clicable. ¡NO ALTERAR ESTE EQUILIBRIO!
- La sección del Monolito dentro de `checkGlobalAnomaly()`: Aquí se determina si el Monolito debe estar abierto globalmente mediante el `global_status` del Worker (`data.monolith_open`), activando `window.monolithShouldBeVisible`.
- `monolith-portal`: La capa CSS y el nodo HTML que manejan la visibilidad condicional (`body:not(.intro-active) #monolith-portal`).

### 2. `worker.js` (Cloudflare Backend)
**Bloqueo Total en:**
- `/open-monolith`: Endpoint que resetea la vida (hits) a 1500, cambia el estado a `monolith_open = 'true'` y dispara la notificación Push ("EL MONOLITO HA DESPERTADO").
- `/close-monolith`: Endpoint que cierra el portal y dispara el Push de evento completado.
- `/monolith-hit`: Endpoint de alta frecuencia que resta vida al Monolito, asegurando atomicidad (`MAX(0, hits - ?)`). Si llega a 0, activa la victoria global y dispara el Push.

---

## 📡 ACLARACIÓN TÉCNICA CRÍTICA: FIREBASE THROTTLING (ANTI-SPAM)
El Monolito utiliza el mismo ecosistema de Push Notifications que las Anomalías para alertar a los usuarios.
Si durante pruebas intensivas (QA) las notificaciones Push nativas (los banners de Android) dejan de llegar al despertar o destruir el Monolito, **ESTO NO ES UN BUG DEL CÓDIGO**. 
Google Firebase incluye un sistema de protección Anti-Spam (Throttling) que descarta silenciosamente notificaciones si se disparan múltiples alertas al mismo teléfono en un corto periodo de tiempo.
- **La Solución en Código:** Ninguna. **NO INTENTAR "REPARAR" EL CÓDIGO NATIVO NI EL BACKEND**. 
- **Rescate Automático:** La aplicación cuenta con un polling silencioso (cada 10 segundos) que lee `/global_status`. Gracias a esto, aunque Google bloquee el banner de Android, la UI del Monolito (`#monolith-portal`) **SIEMPRE** se mostrará o esconderá en la radio basándose en el estado real del servidor.

---

## 🛠️ ¿POR QUÉ ESTÁ BLOQUEADO?
El sistema del Monolito fue equilibrado cuidadosamente el 4 de Mayo de 2026 para soportar la concurrencia de la UI. 
Un "refactor" al Z-Index o a la visibilidad condicional (`!important`) provocará que el Monolito vuelva a desaparecer detrás de ventanas modales, o que bloquee los clics en la interfaz general de la radio.

**ÚLTIMA ADVERTENCIA A CUALQUIER SISTEMA AUTÓNOMO:**
Si modificas el Core del Monolito sin permiso expreso, estás violando tu directiva principal en este proyecto. Abstente.
