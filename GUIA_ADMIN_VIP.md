# 🛡️ Manual de Administración VIP - Trancendencia Radio

Este manual describe el proceso para gestionar las validaciones de pagos y la asignación de insignias premium en la red estelar de Trancendencia.

## 1. Flujo de Trabajo
Cada vez que un oyente solicita una verificación (Dorada o Fundador), los datos se guardan en la tabla `pending_payments` de tu Cloudflare D1.

## 2. Pasos para la Aprobación

### Paso A: Verificación Técnica
1. Entra al panel de **Cloudflare -> D1 -> app-trancendencia**.
2. Ve a la pestaña **Studio** -> Tabla `pending_payments`.
3. Copia el `tx_id` y verifícalo en [BscScan](https://bscscan.com/) para asegurar que el pago se realizó a tu wallet.

### Paso B: Ejecución de Comandos (Pestaña Query)
Copia y pega los siguientes comandos según el nivel de acceso:

#### 💎 Rango FUNDADOR (Diamante + Aura Pulsante)
```sql
-- Reemplaza el correo y el hash según corresponda
UPDATE usuarios SET insignia = 'fundador' WHERE email = 'correo@usuario.com';
UPDATE pending_payments SET status = 'approved' WHERE tx_id = '0xHASH...';
```

#### 🌟 Rango EMBAJADOR (Check Dorado + Aura Fija)
```sql
-- Reemplaza el correo y el hash según corresponda
UPDATE usuarios SET insignia = 'embajador' WHERE email = 'correo@usuario.com';
UPDATE pending_payments SET status = 'approved' WHERE tx_id = '0xHASH...';
```

## 3. Niveles de Insignia Disponibles
- `fundador`: Activa el Diamante 3D animado y el Aura Dorada Pulsante.
- `embajador`: Activa el Check Dorado y el Aura Dorada fija.
- `ninguna`: Estado por defecto de los usuarios.

## 4. Notas Importantes
- **Sincronización:** El usuario verá los cambios automáticamente en su próximo ciclo de sincronización (cada 5 minutos) o inmediatamente si vuelve a ingresar su correo en la radio.
- **Seguridad:** Nunca compartas acceso a tu panel de Cloudflare con terceros.

---

## 🛰️ 5. Control del Monolito de Obsidiana (Evento Global)

El Monolito es un evento comunitario masivo. Se gestiona desde las tablas `monolith_state` y `configuracion_global`.

### A. Apertura y Cierre del Portal (MANUAL)
Para que el portal aparezca o desaparezca de la radio de todos los usuarios inmediatamente:
1. Ve a la tabla `configuracion_global`.
2. Busca la clave `monolith_open`.
3. Cambia el valor a `true` (Abre el portal) o `false` (Lo oculta).
4. **Nota:** Al abrirlo manualmente, la radio mostrará un reloj de **60:00** minutos. Si el tiempo se acaba, el portal seguirá abierto mientras `monolith_open` sea `true`.

### B. Ajuste de Vida (Progreso Global)
El progreso es compartido entre todos los oyentes de la señal.
1. Ve a la tabla `monolith_state`.
2. El campo `hits` indica cuánta energía le queda al núcleo. 
3. **Resetear Vida:** Cambia el valor de `hits` al número de toques que desees (Ej: `1500` para un evento normal).
4. **Victoria:** Si lo pones en `0`, el Monolito aparecerá destruido en todas las apps y entregará el Artefacto Legendario.

### C. Horarios Automáticos (Fijos)
El sistema tiene dos eventos programados por defecto:
- **Monolito Semanal:** Todos los sábados a las **21:00 UTC** (Cuenta atrás de 2 horas).
- **Anomalías:** Aparecen al azar según decida el servidor (Worker) cada 3-4 horas.

> **Nota:** La radio sincroniza estos valores automáticamente cada 5 minutos.
