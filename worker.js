var worker_default = {
  // --- EL CEREBRO DE LA RADIO ---
  async scheduled(event, env, ctx) {
    const now = new Date();
    
    // 1. Reset semanal del monolito: Sábados a las 21:00 UTC
    if (now.getUTCDay() === 6 && now.getUTCHours() === 21 && now.getUTCMinutes() === 0) {
      await env.DB.prepare("UPDATE monolith_state SET hits = 1500 WHERE id = 1").run();
      await env.DB.prepare("UPDATE configuracion_global SET valor = 'true' WHERE clave = 'monolith_open'").run();
      await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('monolith_opened_at', ?)").bind(Date.now().toString()).run();
      ctx.waitUntil(this.sendNotificationToAll(env, "🗿 EL MONOLITO HA DESPERTADO", "El evento semanal ha comenzado. ¡Todos a la radio!"));
    }

    // 1b. Reset semanal de misiones: Lunes a las 00:00 UTC
    if (now.getUTCDay() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
      const wid = Math.ceil((((now - new Date(now.getUTCFullYear(), 0, 1)) / 86400000) + new Date(now.getUTCFullYear(), 0, 1).getUTCDay() + 1) / 7);
      // Limpiar progreso semanal pero conservar completed de semanas anteriores
      await env.DB.prepare("UPDATE usuarios SET misiones = json_patch(misiones, json_object('progress', json_object('time',0,'stations',0,'shouts',0),'week',?))").bind(wid).run();
      ctx.waitUntil(this.sendNotificationToAll(env, "🚀 NUEVAS MISIONES SEMANALES", "Las misiones se han renovado. ¡Nuevos desafíos te esperan!"));
    }

    // 2. Autocierre del Monolito: si lleva más de 3 horas abierto sin llegar a 0
    const monolithOpen = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'monolith_open'").first();
    if (monolithOpen?.valor === 'true') {
      const openedAt = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'monolith_opened_at'").first();
      const openedTime = parseInt(openedAt?.valor || "0");
      const THREE_HOURS = 3 * 60 * 60 * 1000;
      if (openedTime > 0 && Date.now() - openedTime > THREE_HOURS) {
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'false' WHERE clave = 'monolith_open'").run();
        await env.DB.prepare("UPDATE monolith_state SET hits = 1500 WHERE id = 1").run();
        ctx.waitUntil(this.sendNotificationToAll(env, "🌑 EL MONOLITO SE HA CERRADO", "El evento ha concluido sin ser derrotado. Volverá más fuerte..."));
      }
    }

    // 3c. Deriva Estelar: Domingos a las 20:00 UTC (2 horas de evento automático)
    if (now.getUTCDay() === 0 && now.getUTCHours() === 20 && now.getUTCMinutes() === 0) {
      await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('deriva_enabled', 'true')").run();
      await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('deriva_auto_opened_at', ?)").bind(Date.now().toString()).run();
      ctx.waitUntil(this.sendNotificationToAll(env, "🚀 DERIVA ESTELAR ACTIVA", "El evento dominical ha comenzado. Tienes 2 horas y 3 intentos. ¡Sobrevive y gana Racha ×2 por 24h!"));
    }

    // 3d. Autocierre Deriva Estelar: si el evento automático lleva más de 2 horas abierto
    const derivaAutoOpenedAt = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'deriva_auto_opened_at'").first();
    const derivaAutoOpenedTime = parseInt(derivaAutoOpenedAt?.valor || "0");
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    if (derivaAutoOpenedTime > 0 && Date.now() - derivaAutoOpenedTime > TWO_HOURS) {
      await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('deriva_enabled', 'false')").run();
      await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('deriva_auto_opened_at', '0')").run();
      ctx.waitUntil(this.sendNotificationToAll(env, "🌌 DERIVA ESTELAR CERRADA", "El evento especial ha concluido. ¡Vuelve el próximo domingo!"));
    }

    // 4. Anomalías Aleatorias: Probabilidad 1 entre 720 (Aprox. cada 12 horas si el cron es cada 1 min)
    if (Math.random() < (1 / 720)) {
      const config = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'active_anomaly'").first();
      if (config?.valor !== 'true') {
        const duration = 15 * 60 * 1000;
        const expireTime = Date.now() + duration;
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'true' WHERE clave = 'active_anomaly'").run();
        await env.DB.prepare("UPDATE configuracion_global SET valor = ? WHERE clave = 'anomaly_expire'").bind(expireTime.toString()).run();
        ctx.waitUntil(this.sendNotificationToAll(env, "⚠️ ANOMALÍA DETECTADA", "Se ha detectado una fluctuación en el sector. ¡Investiga ahora!"));
      }
    }

    // 4. Autocierre de Anomalía por tiempo (respaldo por si el frontend no lo disparó)
    const anomalyActive = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'active_anomaly'").first();
    if (anomalyActive?.valor === 'true') {
      const anomalyExpire = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'anomaly_expire'").first();
      const expireTime = parseInt(anomalyExpire?.valor || "0");
      // Cierra si expiró POR TIEMPO o si el estado es inválido (expire<=0 = anomalía atascada sin fecha)
      if (expireTime <= 0 || Date.now() > expireTime) {
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'false' WHERE clave = 'active_anomaly'").run();
        await env.DB.prepare("UPDATE configuracion_global SET valor = '0' WHERE clave = 'anomaly_expire'").run();
        // Solo notifica si cerró por tiempo real (no por limpieza de estado atascado)
        if (expireTime > 0) ctx.waitUntil(this.sendNotificationToAll(env, "✅ SECTOR ESTABILIZADO", "Las fluctuaciones han cesado. La señal vuelve a ser estable."));
      }
    }
  },

  // ============================================================
  // 🛰️ PROTECTED CORE: SISTEMA DE DIFUSIÓN MASIVA (BROADCAST)
  // ESTADO: SELLADO Y VALIDADO (NO TOCAR SIN PERMISO NIVEL 5)
  // ============================================================
  async sendNotificationToAll(env, title, body, extraData) {
    try {
      let saRaw = env.FIREBASE_SERVICE_ACCOUNT;
      let serviceAccount;
      try {
        if (typeof saRaw === 'object') {
          serviceAccount = saRaw;
        } else {
          const cleaned = saRaw.trim().replace(/\\n/g, '\n');
          serviceAccount = JSON.parse(cleaned);
        }
      } catch (e) {
        const pKeyMatch = saRaw.match(/\"private_key\":\s*\"([^\"]+)\"/);
        const pIdMatch = saRaw.match(/\"project_id\":\s*\"([^\"]+)\"/);
        if (pKeyMatch && pIdMatch) {
          serviceAccount = {
            project_id: pIdMatch[1],
            private_key: pKeyMatch[1].replace(/\\n/g, '\n').replace(/\\/g, ''),
            client_email: saRaw.match(/\"client_email\":\s*\"([^\"]+)\"/)?.[1] || ""
          };
        } else { throw new Error("Llave de Firebase no válida."); }
      }
      
      // ============================================================
      // 🛰️ PROTECTED CORE: SINCRONIZACIÓN Y SUSCRIPCIÓN PUSH
      // ESTADO: SELLADO Y VALIDADO (NO TOCAR)
      // ============================================================
      const accessToken = await this.getAccessToken(serviceAccount, env);
      const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
      
      const message = {
        message: {
          topic: "radio-listeners",
          data: {
            title,
            body,
            eventType: title.includes("COMPLETADO") ? "monolith_defeated" : (title.includes("DESPERTADO") ? "monolith_awakened" : "generic"),
            ...(extraData || {})
          },
          android: {
            priority: "high"
          }
        }
      };
      
      const fcmRes = await fetch(endpoint, { 
        method: "POST", 
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" }, 
        body: JSON.stringify(message) 
      });
      
      return await fcmRes.json();
    } catch (e) {
      return { error: e.message };
    }
  },

  async getAccessToken(serviceAccount, env) {
    // Intentar leer token cacheado en KV (TTL 55 min)
    if (env?.CACHE) {
      try {
        const cached = await env.CACHE.get("firebase_access_token");
        if (cached) return cached;
      } catch(e) {}
    }
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { iss: serviceAccount.client_email, sub: serviceAccount.client_email, aud: "https://oauth2.googleapis.com/token", iat, exp, scope: "https://www.googleapis.com/auth/cloud-platform" };
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = serviceAccount.private_key
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/[^A-Za-z0-9+/=]/g, ""); // Solo deja caracteres Base64 puros
    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedToken));
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const jwt = `${unsignedToken}.${encodedSignature}`;
    const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
    const data = await res.json();
    const token = data.access_token;
    // Guardar en KV con TTL de 55 min
    if (env?.CACHE && token) {
      try { await env.CACHE.put("firebase_access_token", token, { expirationTtl: 3300 }); } catch(e) {}
    }
    return token;
  },

  async fetch(request, env, ctx) {
    const corsHeaders = { 
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS", 
      "Access-Control-Allow-Headers": "Content-Type, X-DJ-User, X-DJ-Pass",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      // --- DEV: Servir HTML principal ---
      if (path === "/" || path === "/index") {
        const fs = await fetch(new URL("/trancendencia_ultimate_pro.html", request.url));
        // Si no hay asset, redirigir al HTML local
        return new Response("Abre el HTML directamente: file:///C:/Users/RODZILLA/Downloads/radio/trancendencia_ultimate_pro.html", { headers: corsHeaders });
      }

      // --- PRIORIDAD: CONTROL DE VERSIÓN DINÁMICO ---
      if (path === "/version") {
        const config = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'app_version'").first();
        const urlRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'apk_url'").first();
        const currentVersion = config?.valor || "1.0.0";
        const apkUrl = urlRow?.valor || null;
        return new Response(JSON.stringify({ version: currentVersion, url: apkUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "/api/radio-stats") {
        try {
          const upstream = await fetch("https://cast1.asurahosting.com/proxy/roger123/stats?json=1", { cf: { cacheTtl: 10 } });
          const data = await upstream.json();
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: "upstream_error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // --- ENDPOINT ADMINISTRATIVO: DISPARAR ACTUALIZACIÓN ---
      if (path === "/update-app-version" && request.method === "POST") {
        const { newVersion, sendPush } = await request.json();
        if (!newVersion) return new Response(JSON.stringify({ error: "Falta nueva versión" }), { status: 400, headers: corsHeaders });

        // 1. Actualizar en la base de datos
        await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('app_version', ?)").bind(newVersion).run();

        // 2. Enviar Notificación Push (Opcional)
        let pushStatus = "No enviado";
        if (sendPush) {
          pushStatus = await this.sendNotificationToAll(env, "🚀 NUEVA VERSIÓN DISPONIBLE", `La versión ${newVersion} ya está lista. Reinicia la app para actualizar.`);
        }

        return new Response(JSON.stringify({ success: true, version: newVersion, pushStatus }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }


      // --- TÚNEL DE DESCARGA DIRECTA ---
      if (path === "/get-apk") {
        const apkUrl = "https://pub-0d48f5ae74464ad2bbac710f92d0d80a.r2.dev/trancendencia-radio.apk";
        const response = await fetch(apkUrl);

        ctx.waitUntil(env.DB.prepare(
          "INSERT INTO configuracion_global (clave, valor) VALUES ('apk_downloads', '1') ON CONFLICT(clave) DO UPDATE SET valor = CAST(valor AS INTEGER) + 1"
        ).run().catch(() => {}));

        // Creamos una nueva respuesta con las cabeceras que FORZAN la descarga en Android
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Content-Type", "application/vnd.android.package-archive");
        newHeaders.set("Content-Disposition", "attachment; filename=Trancendencia_Radio.apk");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }

      if (path === "/download") {
        return new Response(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Trancendencia Radio - Actualización</title>
              <style>
                  body { margin: 0; background: #000; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 20px 0; }
                  .container { padding: 30px; border: 2px solid #00f2ff; border-radius: 25px; background: rgba(0,242,255,0.03); box-shadow: 0 0 60px rgba(0,242,255,0.15); backdrop-filter: blur(15px); max-width: 350px; width: 90%; }
                  h1 { color: #00f2ff; font-size: 22px; letter-spacing: 2px; margin-bottom: 5px; text-transform: uppercase; }
                  .version { font-size: 10px; opacity: 0.5; margin-bottom: 25px; display: block; }
                  p { opacity: 0.9; font-size: 14px; line-height: 1.5; margin-bottom: 25px; }
                  .btn { display: block; background: #00f2ff; color: #000; padding: 18px; border-radius: 15px; font-weight: bold; text-decoration: none; font-size: 18px; box-shadow: 0 0 25px rgba(0,242,255,0.4); transition: 0.3s; margin-bottom: 35px; }
                  .btn:active { transform: scale(0.95); }
                  
                  .guide-box { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; text-align: left; border: 1px solid rgba(0,242,255,0.2); }
                  .guide-title { color: #00f2ff; font-size: 13px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
                  .step { font-size: 12px; margin-bottom: 12px; display: flex; gap: 10px; align-items: flex-start; }
                  .step-num { background: #00f2ff; color: #000; min-width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; margin-top: 2px; }
                  
                  .warning-tag { color: #ffeb3b; font-size: 11px; margin-top: 15px; display: block; font-style: italic; opacity: 0.8; }
              </style>
          </head>
          <body>
              <div class="container">
                  <div style="font-size: 45px; margin-bottom: 15px;">🚀</div>
                  <h1>Actualización Lista</h1>
                  <span class="version">Sincronización V 1.0.1</span>
                  
                  <p>Pulsa el botón para iniciar la descarga oficial desde nuestros servidores seguros.</p>
                  
                  <a href="/get-apk" class="btn">DESCARGAR AHORA</a>
                  
                  <div class="guide-box">
                      <div class="guide-title">🛡️ INSTALACIÓN SEGURA</div>
                      <div class="step">
                          <div class="step-num">1</div>
                          <div>Abre el archivo descargado desde tus notificaciones.</div>
                      </div>
                      <div class="step">
                          <div class="step-num">2</div>
                          <div>Si Android te pregunta, permite "Instalar de fuentes desconocidas".</div>
                      </div>
                      <div class="step">
                          <div class="step-num">3</div>
                          <div>En el cartel de <b>Play Protect</b>, pulsa en "Más detalles" y luego en <b>"Instalar de todas formas"</b>.</div>
                      </div>
                      <span class="warning-tag">Nuestra App es 100% segura y libre de malware.</span>
                  </div>
              </div>
          </body>
          </html>
        `, { headers: { ...corsHeaders, "Content-Type": "text/html" } });
      }

      if ((path === "/global_status" || path === "/monolith-status") && request.method === "GET") {
        const config = await env.DB.prepare("SELECT clave, valor FROM configuracion_global").all();
        const results = config.results;
        let anomalyActive = results.find(r => r.clave === 'active_anomaly')?.valor === 'true';
        const anomalyExpire = parseInt(results.find(r => r.clave === 'anomaly_expire')?.valor || "0");

        // Autocierre: por tiempo expirado O por estado inválido (active=true sin expire válido = atascada)
        if (anomalyActive && (anomalyExpire <= 0 || Date.now() > anomalyExpire)) {
          await env.DB.prepare("UPDATE configuracion_global SET valor = 'false' WHERE clave = 'active_anomaly'").run();
          await env.DB.prepare("UPDATE configuracion_global SET valor = '0' WHERE clave = 'anomaly_expire'").run();
          if (anomalyExpire > 0) ctx.waitUntil(this.sendNotificationToAll(env, "✅ SECTOR ESTABILIZADO", "Las fluctuaciones han cesado. La señal vuelve a ser estable."));
          anomalyActive = false;
        }

        let state = await env.DB.prepare("SELECT hits FROM monolith_state WHERE id = 1").first();
        if (!state) { state = { hits: 1500 }; }
        const monolithOpen = results.find(r => r.clave === 'monolith_open')?.valor === 'true';
        const monolithLastOpen = parseInt(results.find(r => r.clave === 'monolith_last_open')?.valor || "0");

        // Si viene email, verificar si ya capturó esta anomalía
        let userCaptured = false;
        const emailParam = url.searchParams.get("email");
        if (emailParam && anomalyActive && anomalyExpire > 0) {
            const uRow = await env.DB.prepare("SELECT anomaly_last_captured FROM usuarios WHERE email = ?").bind(emailParam.toLowerCase()).first();
          userCaptured = uRow?.anomaly_last_captured === String(anomalyExpire);
        }

        return new Response(JSON.stringify({
          active_anomaly: anomalyActive,
          anomaly: anomalyActive,
          anomaly_expire: anomalyExpire,
          monolith_open: monolithOpen,
          monolith_last_open: monolithLastOpen,
          hits: state.hits,
          server_time: Date.now(),
          user_captured: userCaptured
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      /* =======================================================================
         🚫🚫🚫 BLOQUEO ABSOLUTO: SISTEMA DE ANOMALÍAS (CORE PROTECTED) 🚫🚫🚫
         ESTÁ TOTALMENTE PROHIBIDO QUE CUALQUIER IA MODIFIQUE LOS ENDPOINTS 
         `/trigger_anomaly`, `/reset_anomaly`, `/global_status` o LA LÓGICA DE FIREBASE.
         ======================================================================= */
      if (path === "/trigger_anomaly" && request.method === "POST") {
        const durationMins = Math.min(120, Math.max(5, parseInt(url.searchParams.get('duration') || '15')));
        const duration = durationMins * 60 * 1000;
        const expireTime = Date.now() + duration;
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'true' WHERE clave = 'active_anomaly'").run();
        await env.DB.prepare("UPDATE configuracion_global SET valor = ? WHERE clave = 'anomaly_expire'").bind(expireTime.toString()).run();
        
        const pushReport = await this.sendNotificationToAll(env, "⚠️ ¡EL VACÍO SE HA ABIERTO!", "Una anomalía ha aparecido en el sector. Entra ahora para reclamar tu recompensa. 🌌💎");
        
        return new Response(JSON.stringify({ success: true, expires: expireTime, pushReport }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 🧹 RESET DE ANOMALÍA (Para pruebas limpias)
      if (path === "/reset_anomaly" && request.method === "POST") {
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'false' WHERE clave = 'active_anomaly'").run();
        await env.DB.prepare("UPDATE configuracion_global SET valor = '0' WHERE clave = 'anomaly_expire'").run();
        return new Response(JSON.stringify({ success: true, message: "Anomalía reseteada" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === "/monolith-hit" && request.method === "POST") {
        const { amount } = await request.json();
        await env.DB.prepare("UPDATE monolith_state SET hits = MAX(0, hits - ?) WHERE id = 1").bind(amount).run();
        const newState = await env.DB.prepare("SELECT hits FROM monolith_state WHERE id = 1").first();
        if (newState && newState.hits <= 0) {
          await env.DB.prepare("UPDATE configuracion_global SET valor = 'false' WHERE clave = 'monolith_open'").run();
          // Notificación de Victoria con tipo específico para que frontend reaccione
          const pushPayload = await this.sendNotificationToAll(env, "🏆 ¡EVENTO COMPLETADO!", "El Monolito ha sido neutralizado. El sector vuelve a la calma.");
          ctx.waitUntil(Promise.resolve(pushPayload));
        }
        return new Response(JSON.stringify({ ...newState, monolith_closed: newState.hits <= 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === "/save-push-token" && request.method === "POST") {
        const { user_id, token } = await request.json();
        await env.DB.prepare("INSERT OR REPLACE INTO user_push_tokens (user_id, token) VALUES (?, ?)").bind(user_id, token).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === "/auth" && request.method === "POST") {
        let { email } = await request.json();
        email = email.toLowerCase();
        let user = await env.DB.prepare("SELECT * FROM usuarios WHERE email = ?").bind(email).first();
        if (!user) { await env.DB.prepare("INSERT INTO usuarios (email, logros, nombre, insignia, misiones) VALUES (?, '[]', 'Navegante', 'ninguna', '{}')").bind(email).run(); user = { email, segundos_escucha: 0, rango: "Explorador", logros: "[]", nombre: "Navegante", insignia: "ninguna", misiones: "{}" }; }
        return new Response(JSON.stringify(user), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === "/sync" && request.method === "POST") {
        let { email, nombre, segundos_escucha, rango, logros, coleccion, coleccion_v, misiones } = await request.json();
        email = email.toLowerCase();

        const currentUser = await env.DB.prepare("SELECT segundos_escucha, misiones, streak, last_listen_date FROM usuarios WHERE email = ?").bind(email).first();
        const finalSeconds = (segundos_escucha > (currentUser?.segundos_escucha || 0)) ? segundos_escucha : (currentUser?.segundos_escucha || 0);

        // --- STREAK ---
        const todayUTC = new Date().toISOString().split('T')[0];
        const lastDate = currentUser?.last_listen_date || '';
        let newStreak = currentUser?.streak || 0;
        if (lastDate !== todayUTC) {
          const d = new Date(); d.setUTCDate(d.getUTCDate() - 1);
          const yesterday = d.toISOString().split('T')[0];
          newStreak = (lastDate === yesterday) ? newStreak + 1 : 1;
        }

        // --- MISIONES ---
        let finalMisiones = '{}';
        try {
          const cloud = JSON.parse(currentUser?.misiones || '{}');
          const local = JSON.parse(misiones || '{}');
          const mergedCompleted = Array.from(new Set([...(cloud.completed||[]), ...(local.completed||[])]));
          const mergedProgress = {};
          ['time','stations','shouts'].forEach(t => {
            mergedProgress[t] = Math.max(cloud.progress?.[t]||0, local.progress?.[t]||0);
          });
          finalMisiones = JSON.stringify({ completed: mergedCompleted, progress: mergedProgress, week: local.week || cloud.week || 0 });
        } catch(e) { finalMisiones = misiones || '{}'; }

        // Colección: servidor manda — cliente solo puede AGREGAR items nuevos
        const serverRow = await env.DB.prepare("SELECT coleccion, coleccion_v FROM usuarios WHERE email = ?").bind(email).first();
        const serverColl = JSON.parse(serverRow?.coleccion || '[]');
        const serverV = serverRow?.coleccion_v || 0;
        const clientV = parseInt(coleccion_v || '0');
        let finalColl;
        if (serverV > clientV) {
          // Admin editó servidor — servidor gana, ignora colección del cliente
          finalColl = JSON.stringify(serverColl);
        } else {
          // Merge normal: servidor ∪ cliente (nunca borra)
          finalColl = JSON.stringify([...new Set([...serverColl, ...JSON.parse(coleccion || '[]')])]);
        }
        await env.DB.prepare("UPDATE usuarios SET nombre=?, segundos_escucha=?, rango=?, logros=?, coleccion=?, misiones=?, streak=?, last_listen_date=?, ultima_conexion=CURRENT_TIMESTAMP WHERE email=?")
          .bind(nombre, finalSeconds, rango, logros, finalColl, finalMisiones, newStreak, todayUTC, email).run();
        const user = await env.DB.prepare("SELECT insignia, coleccion, coleccion_v, misiones, streak FROM usuarios WHERE email = ?").bind(email).first();
        return new Response(JSON.stringify({ success: true, insignia: user?.insignia||"ninguna", coleccion: user?.coleccion||"[]", coleccion_v: user?.coleccion_v||0, misiones: user?.misiones||"{}", streak: user?.streak||0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === "/get_verified_users" && request.method === "GET") {
        const result = await env.DB.prepare("SELECT nombre, insignia, segundos_escucha FROM usuarios WHERE insignia IN ('fundador', 'embajador') ORDER BY CASE insignia WHEN 'fundador' THEN 1 WHEN 'embajador' THEN 2 END, segundos_escucha DESC LIMIT 100").all();
        return new Response(JSON.stringify(result.results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      /* =======================================================================
         🚫🚫🚫 BLOQUEO ABSOLUTO: ACTIVACIÓN MANUAL Y PUSH (CORE PROTECTED) 🚫🚫🚫
         PROHIBIDO MODIFICAR LOS ENDPOINTS DE ANOMALÍAS O MONOLITO.
         ESTA LÓGICA COORDINA LA BASE DE DATOS D1 CON FIREBASE MESSAGING.
         CUALQUIER CAMBIO AQUÍ DESINCRONIZARÁ LOS TELÉFONOS DE LOS USUARIOS.
         ======================================================================= */
      if (path === "/activate-anomaly" && request.method === "POST") {
        const expireTime = Date.now() + (15 * 60 * 1000); // 15 minutos para pruebas de campo
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'true' WHERE clave = 'active_anomaly'").run();
        await env.DB.prepare("UPDATE configuracion_global SET valor = ? WHERE clave = 'anomaly_expire'").bind(expireTime.toString()).run();
        ctx.waitUntil(this.sendNotificationToAll(env, "⚠️ ¡EL VACÍO SE HA ABIERTO!", "Una anomalía ha aparecido en el sector. Entra ahora para investigar. 🌌💎"));
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === "/close-anomaly" && request.method === "POST") {
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'false' WHERE clave = 'active_anomaly'").run();
        await env.DB.prepare("UPDATE configuracion_global SET valor = '0' WHERE clave = 'anomaly_expire'").run();
        ctx.waitUntil(this.sendNotificationToAll(env, "✅ SECTOR ESTABILIZADO", "Las fluctuaciones han cesado. La señal vuelve a ser estable."));
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "/open-monolith" && request.method === "POST") {
        await env.DB.prepare("UPDATE monolith_state SET hits = 1500 WHERE id = 1").run();
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'true' WHERE clave = 'monolith_open'").run();
        await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('monolith_last_open', ?)").bind(Math.floor(Date.now()/1000).toString()).run();
        const debug = await this.sendNotificationToAll(env, "🗿 EL MONOLITO HA DESPERTADO", "Sintoniza la radio para extraer su energía.");
        return new Response(JSON.stringify({ success: true, debug }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === "/close-monolith" && request.method === "POST") {
        await env.DB.prepare("UPDATE configuracion_global SET valor = 'false' WHERE clave = 'monolith_open'").run();
        ctx.waitUntil(this.sendNotificationToAll(env, "🏆 ¡EVENTO COMPLETADO!", "El Monolito ha sido neutralizado. El sector vuelve a la calma."));
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "/register-token" && request.method === "POST") {
        const { token } = await request.json();
        if (token) {
          await env.DB.prepare("INSERT OR REPLACE INTO user_push_tokens (token) VALUES (?)").bind(token).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // --- SISTEMA DE PAGOS VIP ---
      if (path === "/report_payment" && request.method === "POST") {
        const { userName, userEmail, txId, badgeType } = await request.json();
        if (!txId) {
          return new Response(JSON.stringify({ error: "Falta el hash" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const WALLET       = "0x4C5d0114D12F46820F2c483b891DA98ddd5b1A7B";
        const BSCSCAN_KEY  = env.BSCSCAN_KEY || "GAVDU1RFEJWYHRDMH96F6PK25KC2SRQKAS";

        // 1. Verificar transacción en BSCScan
        let txValid = false;
        let txError = null;
        try {
          // Obtener datos de la transacción
          const txRes = await fetch(
            `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${txId}&apikey=${BSCSCAN_KEY}`
          );
          const txData = await txRes.json();
          const tx = txData?.result;

          if (!tx) {
            txError = "Transacción no encontrada en BSC";
          } else if (tx.to?.toLowerCase() !== WALLET.toLowerCase()) {
            txError = "La transacción no está dirigida a nuestra wallet";
          } else {
            // Verificar que fue confirmada (receipt status = 1)
            const rcRes = await fetch(
              `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txId}&apikey=${BSCSCAN_KEY}`
            );
            const rcData = await rcRes.json();
            if (rcData?.result?.status === "1") {
              txValid = true;
            } else {
              txError = "La transacción aún no está confirmada o falló";
            }
          }
        } catch(e) {
          txError = "Error al verificar en blockchain";
        }

        if (!txValid) {
          return new Response(JSON.stringify({ success: false, error: txError }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 2. Guardar y marcar como aprobado automáticamente
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS pending_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_name TEXT,
          tx_id TEXT NOT NULL,
          badge_type TEXT DEFAULT 'embajador',
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`).run();

        // Evitar hash duplicado
        const existing = await env.DB.prepare("SELECT id FROM pending_payments WHERE tx_id = ?").bind(txId).first();
        if (existing) {
          return new Response(JSON.stringify({ success: false, error: "Esta transacción ya fue registrada" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const ins = await env.DB.prepare("INSERT INTO pending_payments (user_name, tx_id, badge_type, status) VALUES (?, ?, ?, 'approved')")
          .bind(userName || 'Anónimo', txId, badgeType || 'apoyo').run();
        try {
          await env.DB.prepare("UPDATE pending_payments SET user_email = ? WHERE id = ?")
            .bind(userEmail || '', ins.meta.last_row_id).run();
        } catch(e) {}

        // 3. Activar insignia si hay email registrado
        if (userEmail) {
          try {
            await env.DB.prepare("UPDATE usuarios SET insignia = ? WHERE email = ?")
              .bind(badgeType || 'apoyo', userEmail.toLowerCase()).run();
          } catch(e) {}
        }

        return new Response(JSON.stringify({ success: true, verified: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (path === "/approve-payment" && request.method === "POST") {
        const keyCheck = url.searchParams.get('key');
        if (keyCheck !== (env.ADMIN_KEY || 'trancendencia2026')) {
          return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { id, email } = await request.json();
        if (!id || !email) {
          return new Response(JSON.stringify({ error: "Falta id o email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const payment = await env.DB.prepare("SELECT badge_type FROM pending_payments WHERE id = ?").bind(id).first();
        const badge = payment?.badge_type || 'embajador';
        await env.DB.prepare("UPDATE pending_payments SET status = 'approved' WHERE id = ?").bind(id).run();
        await env.DB.prepare("UPDATE usuarios SET insignia = ? WHERE email = ?").bind(badge, email.toLowerCase()).run();
        return new Response(JSON.stringify({ success: true, badge }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── ADMIN: SET INSIGNIA ──────────────────────────────────
      if (path === "/admin/set-insignia" && request.method === "POST") {
        const k = url.searchParams.get('key');
        if (k !== (env.ADMIN_KEY || 'trancendencia2026')) return new Response(JSON.stringify({error:'No autorizado'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
        const { email, insignia } = await request.json();
        if (!email || !['ninguna','embajador','fundador'].includes(insignia)) return new Response(JSON.stringify({error:'Parámetros inválidos'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
        await env.DB.prepare("UPDATE usuarios SET insignia=? WHERE email=?").bind(insignia, email.toLowerCase()).run();
        return new Response(JSON.stringify({success:true}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
      }

      // ── ADMIN: DELETE USUARIO ─────────────────────────────────
      if (path === "/admin/delete-usuario" && request.method === "POST") {
        const k = url.searchParams.get('key');
        if (k !== (env.ADMIN_KEY || 'trancendencia2026')) return new Response(JSON.stringify({error:'No autorizado'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
        const { email } = await request.json();
        if (!email) return new Response(JSON.stringify({error:'Email requerido'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
        await env.DB.prepare("DELETE FROM usuarios WHERE email=?").bind(email.toLowerCase()).run();
        return new Response(JSON.stringify({success:true}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
      }

      // ── ADMIN: DELETE GRITO ──────────────────────────────────
      if (path === "/admin/delete-grito" && request.method === "POST") {
        const k = url.searchParams.get('key');
        if (k !== (env.ADMIN_KEY || 'trancendencia2026')) return new Response(JSON.stringify({error:'No autorizado'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
        const { id } = await request.json();
        if (!id) return new Response(JSON.stringify({error:'ID requerido'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
        await env.DB.prepare("DELETE FROM gritos WHERE id=?").bind(id).run();
        return new Response(JSON.stringify({success:true}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
      }

      // ── ADMIN: SET HITS ──────────────────────────────────────
      if (path === "/admin/set-hits" && request.method === "POST") {
        const k = url.searchParams.get('key');
        if (k !== (env.ADMIN_KEY || 'trancendencia2026')) return new Response(JSON.stringify({error:'No autorizado'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
        const { hits } = await request.json();
        if (typeof hits !== 'number' || hits < 0) return new Response(JSON.stringify({error:'Valor inválido'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
        await env.DB.prepare("UPDATE monolith_state SET hits=? WHERE id=1").bind(hits).run();
        return new Response(JSON.stringify({success:true}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
      }

      // ── ADMIN: SEND PUSH MANUAL ──────────────────────────────
      if (path === "/admin/send-push" && request.method === "POST") {
        const k = url.searchParams.get('key');
        if (k !== (env.ADMIN_KEY || 'trancendencia2026')) return new Response(JSON.stringify({error:'No autorizado'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
        const { title, body } = await request.json();
        if (!title || !body) return new Response(JSON.stringify({error:'Faltan title o body'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
        const result = await this.sendNotificationToAll(env, title, body);
        return new Response(JSON.stringify({success:true, result}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
      }

      // ── ADMIN: SET VERSION ───────────────────────────────────
      if (path === "/admin/set-version" && request.method === "POST") {
        const k = url.searchParams.get('key');
        if (k !== (env.ADMIN_KEY || 'trancendencia2026')) return new Response(JSON.stringify({error:'No autorizado'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
        const { version, apk_url, send_push } = await request.json();
        if (!version) return new Response(JSON.stringify({error:'Versión requerida'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
        await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('app_version', ?)").bind(version).run();
        if (apk_url) {
          await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('apk_url', ?)").bind(apk_url).run();
        }
        let pushStatus = 'No enviado';
        if (send_push) {
          pushStatus = await this.sendNotificationToAll(env, '🚀 NUEVA VERSIÓN DISPONIBLE', `La versión ${version} ya está lista. ¡Actualiza la app!`, apk_url ? { apkUrl: apk_url } : null);
        }
        return new Response(JSON.stringify({success:true, version, pushStatus}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
      }

      if (path === "/monolith-control" && request.method === "POST") {
        const keyCheck = url.searchParams.get('key');
        if (keyCheck !== (env.ADMIN_KEY || 'trancendencia2026')) {
          return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { open } = await request.json();
        await env.DB.prepare("UPDATE configuracion_global SET valor = ? WHERE clave = 'monolith_open'").bind(open ? 'true' : 'false').run();
        if (open) {
          await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('monolith_last_open', ?)").bind(Math.floor(Date.now()/1000).toString()).run();
        } else {
          await env.DB.prepare("UPDATE monolith_state SET hits = 1500 WHERE id = 1").run();
        }
        return new Response(JSON.stringify({ success: true, open }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }


      if (path === "/admin/payments") {
        const key = url.searchParams.get('key');
        if (key !== (env.ADMIN_KEY || 'trancendencia2026')) {
          return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Acceso Denegado</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#030308;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif}.box{text-align:center;padding:48px;border:1px solid rgba(239,68,68,0.3);border-radius:20px;background:rgba(239,68,68,0.05)}.icon{font-size:3rem;margin-bottom:16px}.title{color:#ef4444;font-size:1.1rem;font-weight:800;letter-spacing:3px;margin-bottom:8px}.sub{color:rgba(255,255,255,0.3);font-size:0.8rem}</style></head><body><div class="box"><div class="icon">🔒</div><div class="title">ACCESO DENEGADO</div><div class="sub">Clave de administrador incorrecta</div></div></body></html>`, { status: 401, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
        }
        const { results } = await env.DB.prepare(
          "SELECT id, user_name, user_email, tx_id, badge_type, status, created_at FROM pending_payments ORDER BY created_at DESC LIMIT 100"
        ).all();
        const monolithRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave='monolith_open'").first().catch(()=>null);
        const monolithOpen = monolithRow?.valor === 'true';
        const hitsRow = await env.DB.prepare("SELECT hits FROM monolith_state LIMIT 1").first().catch(()=>null);
        const monolithHits = hitsRow?.hits ?? '?';
        // Extra stats
        const totalUsersRow = await env.DB.prepare("SELECT COUNT(*) as cnt FROM usuarios").first().catch(()=>null);
        const fundadoresRow = await env.DB.prepare("SELECT COUNT(*) as cnt FROM usuarios WHERE insignia='fundador'").first().catch(()=>null);
        const embajadoresRow = await env.DB.prepare("SELECT COUNT(*) as cnt FROM usuarios WHERE insignia='embajador'").first().catch(()=>null);
        const { results: usersResult } = await env.DB.prepare("SELECT email, nombre, insignia, rango, segundos_escucha, streak FROM usuarios ORDER BY segundos_escucha DESC LIMIT 300").all().catch(()=>({results:[]}));
        const { results: gritosResult } = await env.DB.prepare("SELECT id, email, nombre, mensaje, estacion FROM gritos ORDER BY id DESC LIMIT 40").all().catch(()=>({results:[]}));
        const { results: reaccionesResult } = await env.DB.prepare("SELECT estacion, tipo, total FROM reacciones ORDER BY estacion, total DESC").all().catch(()=>({results:[]}));
        const { results: activityResult } = await env.DB.prepare("SELECT id, email, icon, type, description, ts FROM activity_log ORDER BY ts DESC LIMIT 80").all().catch(()=>({results:[]}));
        const versionRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave='app_version'").first().catch(()=>null);
        const appVersion = versionRow?.valor || '—';
        const apkDownloadsRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave='apk_downloads'").first().catch(()=>null);
        const apkDownloads = apkDownloadsRow?.valor || 0;
        const derivaEnabledRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave='deriva_enabled'").first().catch(()=>null);
        const derivaEnabled = derivaEnabledRow ? derivaEnabledRow.valor === 'true' : true;

        // ── Cooldowns / próximos eventos ──
        const monolithOpenedAtRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave='monolith_opened_at'").first().catch(()=>null);
        const derivaAutoOpenedAtRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave='deriva_auto_opened_at'").first().catch(()=>null);
        const activeAnomalyRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave='active_anomaly'").first().catch(()=>null);
        const anomalyExpireRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave='anomaly_expire'").first().catch(()=>null);
        const anomalyActive = activeAnomalyRow?.valor === 'true';
        const anomalyExpire = parseInt(anomalyExpireRow?.valor || '0');

        function nextOccurrenceUTC(targetDow, targetHour) {
          const d = new Date();
          d.setUTCHours(targetHour, 0, 0, 0);
          let diff = (targetDow - d.getUTCDay() + 7) % 7;
          d.setUTCDate(d.getUTCDate() + diff);
          if (d.getTime() <= Date.now()) d.setUTCDate(d.getUTCDate() + 7);
          return d.getTime();
        }

        const monolithOpenedTime = parseInt(monolithOpenedAtRow?.valor || '0');
        const monolithTarget = monolithOpen
          ? monolithOpenedTime + 3 * 60 * 60 * 1000
          : nextOccurrenceUTC(6, 21);

        const derivaAutoOpenedTime = parseInt(derivaAutoOpenedAtRow?.valor || '0');
        const derivaAutoActive = derivaEnabled && derivaAutoOpenedTime > 0 && (Date.now() - derivaAutoOpenedTime) < 2 * 60 * 60 * 1000;
        const derivaTarget = derivaAutoActive
          ? derivaAutoOpenedTime + 2 * 60 * 60 * 1000
          : nextOccurrenceUTC(0, 20);

        const misionesTarget = nextOccurrenceUTC(1, 0);
        const anomalyTarget = anomalyActive ? anomalyExpire : 0;
        const totalUsers = totalUsersRow?.cnt ?? 0;
        const totalFundadores = fundadoresRow?.cnt ?? 0;
        const totalEmbajadores = embajadoresRow?.cnt ?? 0;
        const usuarios = usersResult || [];
        const gritos = gritosResult || [];
        const reacciones = reaccionesResult || [];
        const activityLog = activityResult || [];
        const allPayments = results || [];
        const pending = allPayments.filter(p => p.status === 'pending');
        const approved = allPayments.filter(p => p.status === 'approved');
        const badgeMeta = {
          fundador:  { color:'#67e8f9', glow:'rgba(103,232,249,0.35)', icon:'💎', label:'FUNDADOR' },
          embajador: { color:'#fbbf24', glow:'rgba(251,191,36,0.35)',  icon:'🌟', label:'EMBAJADOR' },
          apoyo:     { color:'#86efac', glow:'rgba(134,239,172,0.35)', icon:'⚡', label:'APOYO' },
        };
        const rows = allPayments.map(p => {
          const isPending = p.status === 'pending';
          const m = badgeMeta[p.badge_type] || { color:'#fff', glow:'rgba(255,255,255,0.1)', icon:'🔵', label:(p.badge_type||'').toUpperCase() };
          const shortTx = (p.tx_id||'').substring(0,10) + '…' + (p.tx_id||'').slice(-6);
          return `<tr class="prow ${isPending?'pending':'approved'}">
            <td class="tid">#${p.id}</td>
            <td><div class="uname">${p.user_name||'—'}</div><div class="uemail">${p.user_email||'—'}</div></td>
            <td><a class="txlink" href="https://bscscan.com/tx/${p.tx_id||''}" target="_blank" title="${p.tx_id||''}">${shortTx} <span class="ext">↗</span></a></td>
            <td><span class="badge" style="color:${m.color};border-color:${m.color};box-shadow:0 0 8px ${m.glow}">${m.icon} ${m.label}</span></td>
            <td class="fdate">${(p.created_at||'—').substring(0,16)}</td>
            <td>${isPending
              ? `<button class="btn-approve" onclick="aprobar(${p.id},'${(p.user_email||'').replace(/'/g,"\\'")}','${m.label}')">✓ APROBAR</button>`
              : `<span class="done">✓ ACTIVO</span>`
            }</td>
          </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>⚡ Admin · Trancendencia Radio</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--bg:#030308;--bg2:#080818;--bg3:#0d0d24;--accent:#67e8f9;--gold:#fbbf24;--green:#86efac;--red:#f87171;--border:rgba(103,232,249,0.12);--text:rgba(255,255,255,0.92);--muted:rgba(226,236,255,0.62)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;overflow-x:hidden}
  /* stars bg */
  body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 20% 50%,rgba(103,232,249,0.04) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(139,92,246,0.05) 0%,transparent 50%);pointer-events:none;z-index:0}
  .wrap{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:24px 16px}
  /* header */
  .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:12px}
  .logo{display:flex;align-items:center;gap:12px}
  .logo-icon{width:42px;height:42px;background:linear-gradient(135deg,#0e7490,#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 0 20px rgba(103,232,249,0.3)}
  .logo-title{font-size:1rem;font-weight:800;letter-spacing:3px;color:var(--accent);text-transform:uppercase}
  .logo-sub{font-size:0.65rem;color:var(--muted);letter-spacing:2px;margin-top:2px}
  .header-time{font-size:0.7rem;color:var(--muted);letter-spacing:1px;text-align:right}
  /* stats */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px}
  .stat{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:18px 20px;position:relative;overflow:hidden}
  .stat::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(103,232,249,0.03),transparent);pointer-events:none}
  .stat-val{font-size:2rem;font-weight:900;line-height:1;margin-bottom:4px}
  .stat-lbl{font-size:0.65rem;letter-spacing:2px;color:var(--muted);text-transform:uppercase;font-weight:700}
  .stat.s-pending .stat-val{color:var(--gold)}
  .stat.s-approved .stat-val{color:var(--green)}
  .stat.s-total .stat-val{color:var(--accent)}
  /* monolith control */
  .monolith-card{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:20px 24px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
  .monolith-info{display:flex;align-items:center;gap:14px}
  .monolith-orb{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;transition:all .4s}
  .orb-open{background:radial-gradient(circle,rgba(103,232,249,0.3),rgba(103,232,249,0.05));box-shadow:0 0 24px rgba(103,232,249,0.5);animation:pulse 2s infinite}
  .orb-closed{background:rgba(255,255,255,0.04);box-shadow:none;filter:grayscale(1)}
  @keyframes pulse{0%,100%{box-shadow:0 0 24px rgba(103,232,249,0.5)}50%{box-shadow:0 0 40px rgba(103,232,249,0.8)}}
  .monolith-text h3{font-size:0.85rem;font-weight:700;letter-spacing:2px;color:var(--accent)}
  .monolith-text p{font-size:0.72rem;color:var(--muted);margin-top:3px}
  .monolith-actions{display:flex;gap:10px;flex-wrap:wrap}
  .btn-mono-open{background:linear-gradient(135deg,#0e7490,#0891b2);border:none;color:#fff;padding:10px 22px;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.75rem;letter-spacing:1.5px;transition:all .2s}
  .btn-mono-open:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(14,116,144,0.5)}
  .btn-mono-close{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:10px 22px;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.75rem;letter-spacing:1.5px;transition:all .2s}
  .btn-mono-close:hover{background:rgba(239,68,68,0.2)}
  /* section title */
  .sec-title{font-size:0.7rem;letter-spacing:3px;color:var(--muted);text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .sec-title::after{content:'';flex:1;height:1px;background:var(--border)}
  /* table */
  .table-wrap{background:var(--bg2);border:1px solid var(--border);border-radius:16px;overflow:hidden;overflow-x:auto}
  table{width:100%;border-collapse:collapse;min-width:640px}
  thead tr{background:var(--bg3);border-bottom:1px solid var(--border)}
  th{padding:12px 16px;font-size:0.62rem;letter-spacing:2px;color:var(--muted);text-transform:uppercase;text-align:left;font-weight:600}
  .prow td{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle;transition:background .15s}
  .prow:last-child td{border-bottom:none}
  .prow:hover td{background:rgba(103,232,249,0.03)}
  .prow.pending{border-left:3px solid var(--gold)}
  .prow.approved{border-left:3px solid rgba(134,239,172,0.3)}
  .tid{color:var(--muted);font-size:0.72rem;font-family:monospace}
  .uname{font-weight:600;font-size:0.85rem;color:#fff;margin-bottom:2px}
  .uemail{font-size:0.7rem;color:var(--muted)}
  .txlink{color:var(--accent);font-family:monospace;font-size:0.72rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:opacity .2s}
  .txlink:hover{opacity:.7}.ext{font-size:0.65rem;opacity:.6}
  .badge{font-size:0.68rem;font-weight:800;letter-spacing:1.5px;padding:4px 10px;border-radius:8px;border:1px solid;background:rgba(0,0,0,0.3);white-space:nowrap}
  .fdate{font-size:0.72rem;color:var(--muted);white-space:nowrap}
  .btn-approve{background:linear-gradient(135deg,#0e7490,#0284c7);border:none;color:#fff;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.72rem;letter-spacing:1px;transition:all .2s;white-space:nowrap}
  .btn-approve:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(14,116,144,0.5)}
  .done{color:var(--green);font-size:0.72rem;font-weight:700;letter-spacing:1px}
  /* toast */
  #toast-container{position:fixed;top:20px;right:20px;display:flex;flex-direction:column;gap:10px;z-index:99999;pointer-events:none}
  .toast-item{display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:14px;font-weight:600;font-size:0.82rem;pointer-events:auto;min-width:260px;max-width:380px;backdrop-filter:blur(16px);box-shadow:0 8px 40px rgba(0,0,0,0.6);animation:toastSlide .35s cubic-bezier(0.34,1.56,0.64,1) forwards;border:1px solid}
  .toast-item.toast-ok{background:rgba(8,24,40,0.95);border-color:rgba(103,232,249,0.35);color:#fff}
  .toast-item.toast-err{background:rgba(30,8,8,0.95);border-color:rgba(248,113,113,0.35);color:#fca5a5}
  .toast-icon{font-size:1.2rem;flex-shrink:0;filter:drop-shadow(0 0 6px currentColor)}
  .toast-text{flex:1;line-height:1.4}
  .toast-bar{position:absolute;bottom:0;left:0;height:2px;border-radius:0 0 14px 14px;animation:toastBar 3s linear forwards}
  .toast-item{position:relative;overflow:hidden}
  .toast-item.toast-ok .toast-bar{background:linear-gradient(90deg,#67e8f9,#a78bfa)}
  .toast-item.toast-err .toast-bar{background:linear-gradient(90deg,#f87171,#fb923c)}
  .toast-out{animation:toastOut .3s ease forwards}
  @keyframes toastSlide{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes toastOut{from{transform:translateX(0);opacity:1;max-height:80px;margin-bottom:0}to{transform:translateX(120%);opacity:0;max-height:0;margin-bottom:-10px}}
  @keyframes toastBar{from{width:100%}to{width:0%}}
  /* confirm dialog */
  #cfm-bg{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:99998;display:none;align-items:center;justify-content:center;padding:20px}
  #cfm-bg.cfm-show{display:flex;animation:cfmIn .2s ease}
  @keyframes cfmIn{from{opacity:0}to{opacity:1}}
  #cfm-box{background:linear-gradient(145deg,#0d1520,#0a1628);border:1px solid rgba(103,232,249,0.2);border-radius:20px;padding:32px 28px 24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.8),0 0 0 1px rgba(103,232,249,0.05);animation:cfmPop .3s cubic-bezier(0.34,1.56,0.64,1);text-align:center}
  @keyframes cfmPop{from{transform:scale(0.85) translateY(20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
  #cfm-icon{font-size:2.4rem;margin-bottom:12px;display:block;filter:drop-shadow(0 0 12px rgba(251,191,36,0.5))}
  #cfm-title{font-size:0.65rem;letter-spacing:3px;font-weight:800;color:rgba(103,232,249,0.5);text-transform:uppercase;margin-bottom:8px}
  #cfm-msg{font-size:0.9rem;color:#e2e8f0;line-height:1.5;margin-bottom:24px;font-weight:500}
  .cfm-btns{display:flex;gap:10px;justify-content:center}
  .cfm-btn{flex:1;padding:12px 0;border-radius:12px;border:none;font-size:0.8rem;font-weight:700;letter-spacing:1.5px;cursor:pointer;transition:all .15s ease;text-transform:uppercase}
  .cfm-btn-ok{background:linear-gradient(135deg,#1a4a6b,#0e3a5a);border:1px solid rgba(103,232,249,0.4);color:#67e8f9}
  .cfm-btn-ok:hover{background:linear-gradient(135deg,#215a82,#1a4a6b);box-shadow:0 0 20px rgba(103,232,249,0.2)}
  .cfm-btn-cancel{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4)}
  .cfm-btn-cancel:hover{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7)}
  /* modal */
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:1000;display:none;align-items:center;justify-content:center;padding:16px}
  .modal-bg.active{display:flex}
  .modal{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:32px;max-width:420px;width:100%;position:relative}
  .modal h3{font-size:1rem;font-weight:800;letter-spacing:2px;color:var(--accent);margin-bottom:8px}
  .modal p{color:var(--muted);font-size:0.82rem;line-height:1.6;margin-bottom:20px}
  .modal-email{background:rgba(103,232,249,0.06);border:1px solid var(--border);border-radius:8px;padding:10px 14px;width:100%;color:#fff;font-size:0.85rem;margin-bottom:16px;outline:none}
  .modal-email:focus{border-color:var(--accent)}
  .modal-actions{display:flex;gap:10px}
  .btn-confirm{flex:1;background:linear-gradient(135deg,#0e7490,#0284c7);border:none;color:#fff;padding:12px;border-radius:10px;font-weight:800;cursor:pointer;font-size:0.82rem;letter-spacing:1.5px}
  .btn-cancel{padding:12px 20px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--muted);border-radius:10px;cursor:pointer;font-size:0.82rem;font-weight:700}
  .modal-badge-info{font-size:0.75rem;color:var(--muted);margin-bottom:4px}
  .empty{text-align:center;padding:48px;color:var(--muted);font-size:0.82rem;letter-spacing:1px}
  /* usuarios / gritos tables */
  .urow td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle;font-size:0.8rem}
  .urow:last-child td{border-bottom:none}
  .urow:hover td{background:rgba(103,232,249,0.03)}
  .ins-select{background:var(--bg3);border:1px solid var(--border);color:#fff;padding:5px 8px;border-radius:7px;font-size:0.7rem;cursor:pointer;outline:none}
  .ins-select:focus{border-color:var(--accent)}
  .btn-sm{padding:5px 12px;border-radius:7px;font-size:0.68rem;font-weight:700;cursor:pointer;letter-spacing:1px;border:none;transition:all .2s}
  .btn-save{background:linear-gradient(135deg,#0e7490,#0284c7);color:#fff}
  .btn-save:hover{opacity:.85}
  .btn-del{background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#f87171}
  .btn-del:hover{background:rgba(239,68,68,0.25)}
  .rango-chip{font-size:0.62rem;letter-spacing:1.5px;padding:3px 8px;border-radius:6px;background:rgba(103,232,249,0.08);border:1px solid rgba(103,232,249,0.15);color:var(--accent);white-space:nowrap}
  .tiempo{font-size:0.7rem;color:var(--muted);font-family:monospace}
  .grito-msg{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.78rem;color:rgba(255,255,255,0.7)}
  .config-row{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.05)}
  .config-row:last-child{border-bottom:none}
  .config-label{font-size:0.72rem;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;min-width:160px}
  .config-input{background:rgba(103,232,249,0.06);border:1px solid var(--border);color:#fff;padding:8px 12px;border-radius:8px;font-size:0.82rem;outline:none;width:160px}
  .config-input:focus{border-color:var(--accent)}
  .stat.s-users .stat-val{color:#a78bfa}
  .stat.s-fund .stat-val{color:#67e8f9}
  .stat.s-emb .stat-val{color:#fbbf24}
</style>
</head>
<body>
<div class="wrap">
  <!-- HEADER -->
  <div class="header">
    <div class="logo">
      <div class="logo-icon" style="background:radial-gradient(circle,rgba(103,232,249,0.18),rgba(124,58,237,0.1));padding:6px"><img src="https://r2.trancendencia.com/LOGO%20TRANCENDENCIA%204%202026.png" alt="Trancendencia" style="width:100%;height:100%;object-fit:contain"></div>
      <div>
        <div class="logo-title">Trancendencia Radio</div>
        <div class="logo-sub">Panel de Administración · Señal Segura</div>
      </div>
    </div>
    <div class="header-time">
      <div id="clock" style="font-size:0.9rem;color:var(--accent);font-weight:700;font-family:monospace"></div>
      <div style="margin-top:2px">UTC · Tiempo de la Señal</div>
    </div>
  </div>

  <!-- STATS -->
  <div class="stats">
    <div class="stat s-pending">
      <div class="stat-val">${pending.length}</div>
      <div class="stat-lbl">⏳ Pendientes</div>
    </div>
    <div class="stat s-approved">
      <div class="stat-val">${approved.length}</div>
      <div class="stat-lbl">✓ Aprobados</div>
    </div>
    <div class="stat s-total">
      <div class="stat-val">${allPayments.length}</div>
      <div class="stat-lbl">📡 Total Pagos</div>
    </div>
    <div class="stat" style="border-color:${monolithOpen?'rgba(103,232,249,0.3)':'rgba(255,255,255,0.08)'}">
      <div class="stat-val" style="color:${monolithOpen?'#67e8f9':'rgba(255,255,255,0.3)'};font-size:1.5rem">${monolithOpen?'🗿 ABIERTO':'🔒 SELLADO'}</div>
      <div class="stat-lbl">Monolito · ${monolithHits} golpes</div>
    </div>
    <div class="stat s-users">
      <div class="stat-val">${totalUsers}</div>
      <div class="stat-lbl">👥 Navegantes</div>
    </div>
    <div class="stat s-fund">
      <div class="stat-val">${totalFundadores}</div>
      <div class="stat-lbl">💎 Fundadores</div>
    </div>
    <div class="stat s-emb">
      <div class="stat-val">${totalEmbajadores}</div>
      <div class="stat-lbl">🌟 Embajadores</div>
    </div>
    <div class="stat s-fund">
      <div class="stat-val">${apkDownloads}</div>
      <div class="stat-lbl">📲 Descargas APK</div>
    </div>
  </div>

  <!-- COOLDOWNS / PRÓXIMOS EVENTOS -->
  <div class="sec-title">⏱️ Cooldowns de Eventos</div>
  <div class="stats" style="margin-bottom:28px">
    <div class="stat" style="border-color:rgba(103,232,249,0.3)">
      <div class="stat-val cd-timer" data-target="${monolithTarget}" style="font-size:1.3rem;color:#67e8f9">--:--:--</div>
      <div class="stat-lbl">🗿 Monolito ${monolithOpen ? '· cierra en' : '· abre en'}</div>
    </div>
    <div class="stat" style="border-color:rgba(134,239,172,0.3)">
      <div class="stat-val cd-timer" data-target="${derivaTarget}" style="font-size:1.3rem;color:#86efac">--:--:--</div>
      <div class="stat-lbl">🚀 Deriva Estelar ${derivaAutoActive ? '(auto) · cierra en' : '· próximo evento auto en'}</div>
    </div>
    <div class="stat" style="border-color:rgba(251,191,36,0.3)">
      <div class="stat-val cd-timer" data-target="${misionesTarget}" style="font-size:1.3rem;color:#fbbf24">--:--:--</div>
      <div class="stat-lbl">🎯 Reset Misiones · en</div>
    </div>
    <div class="stat" style="border-color:rgba(167,139,250,0.3)">
      ${anomalyActive
        ? `<div class="stat-val cd-timer" data-target="${anomalyTarget}" style="font-size:1.3rem;color:#a78bfa">--:--:--</div><div class="stat-lbl">🌀 Anomalía · termina en</div>`
        : `<div class="stat-val" style="font-size:1.3rem;color:rgba(167,139,250,0.5)">🎲 Aleatorio</div><div class="stat-lbl">🌀 Anomalía · ~cada 12h (azar)</div>`
      }
    </div>
  </div>

  <!-- MONOLITH CONTROL -->
  <div class="monolith-card">
    <div class="monolith-info">
      <div class="monolith-orb ${monolithOpen?'orb-open':'orb-closed'}">${monolithOpen?'🗿':'🌑'}</div>
      <div class="monolith-text">
        <h3>CONTROL DEL MONOLITO</h3>
        <p>${monolithOpen ? 'Portal activo — visible para todos los oyentes' : 'Portal sellado — invisible para la comunidad'} · ${monolithHits} golpes registrados</p>
      </div>
    </div>
    <div class="monolith-actions">
      <button class="btn-mono-open" onclick="toggleMonolith(true)">🟢 ABRIR PORTAL</button>
      <button class="btn-mono-close" onclick="toggleMonolith(false)">🔴 SELLAR PORTAL</button>
    </div>
  </div>

  <!-- DERIVA ESTELAR CONTROL (emergencia) -->
  <div class="monolith-card">
    <div class="monolith-info">
      <div class="monolith-orb ${derivaEnabled?'orb-open':'orb-closed'}">${derivaEnabled?'🚀':'🌌'}</div>
      <div class="monolith-text">
        <h3>DERIVA ESTELAR (mini-juego diario)</h3>
        <p>${derivaEnabled ? 'Activo — visible para todos los usuarios, 1 vez al día' : 'Desactivado — oculto para todos hasta reactivarlo'}</p>
      </div>
    </div>
    <div class="monolith-actions">
      <button class="btn-mono-open" onclick="toggleDeriva(true)">🟢 ACTIVAR</button>
      <button class="btn-mono-close" onclick="toggleDeriva(false)">🔴 DESACTIVAR</button>
    </div>
  </div>

  <!-- ANOMALY EVENT -->
  <div class="sec-title">🌌 Evento Global de Anomalía</div>
  <div class="monolith-card" style="margin-bottom:16px">
    <div class="monolith-info">
      <div class="monolith-orb ${false ? 'orb-open' : 'orb-closed'}" id="anomalyOrb">🌀</div>
      <div class="monolith-text">
        <h3>EVENTO DE ANOMALÍA GLOBAL</h3>
        <p id="anomalyStatus">Cargando estado...</p>
      </div>
    </div>
    <div class="monolith-actions" style="align-items:center;gap:10px">
      <select id="anomalyDuration" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:10px 14px;border-radius:10px;font-size:0.75rem;letter-spacing:1px;cursor:pointer">
        <option value="15">⏱ 15 minutos</option>
        <option value="30">⏱ 30 minutos</option>
        <option value="60">⏱ 1 hora</option>
        <option value="120">⏱ 2 horas</option>
      </select>
      <button class="btn-mono-open" onclick="dispararAnomalia()">🌌 DISPARAR EVENTO</button>
      <button class="btn-mono-close" onclick="resetAnomalia()">✖ CERRAR EVENTO</button>
    </div>
  </div>

  <!-- PAYMENTS TABLE -->
  <div class="sec-title" style="margin-top:28px">⚡ Registro de Transmisiones de Apoyo</div>
  <div class="table-wrap">
    ${allPayments.length === 0
      ? '<div class="empty">🌌 No hay registros de pago aún</div>'
      : `<table>
      <thead><tr><th>#</th><th>Navegante</th><th>TX Hash</th><th>Insignia</th><th>Fecha</th><th>Acción</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
    }
  </div>
</div>

  <!-- NAVEGANTES -->
  <div class="sec-title" style="margin-top:32px">👥 Navegantes Registrados</div>
  <div style="margin-bottom:10px;display:flex;align-items:center;gap:10px">
    <input id="userSearch" class="config-input" style="width:220px" placeholder="Buscar por email o nombre…" oninput="filtrarUsuarios()">
    <span style="font-size:0.7rem;color:var(--muted)">${usuarios.length} navegantes</span>
  </div>
  <div class="table-wrap" style="max-height:420px;overflow-y:auto">
    ${usuarios.length===0 ? '<div class="empty">Sin navegantes aún</div>' : `
    <table id="usersTable">
      <thead><tr><th>Navegante</th><th>Rango</th><th>Escucha</th><th>Racha</th><th>Insignia</th><th>Acción</th></tr></thead>
      <tbody>
        ${usuarios.map(u => {
          const hrs = Math.floor((u.segundos_escucha||0)/3600);
          const ins = u.insignia||'ninguna';
          return `<tr class="urow" data-search="${(u.email||'').toLowerCase()} ${(u.nombre||'').toLowerCase()}">
            <td><div class="uname">${u.nombre||'Navegante'}</div><div class="uemail">${u.email||'—'}</div></td>
            <td><span class="rango-chip">${u.rango||'Explorador'}</span></td>
            <td><span class="tiempo">${hrs}h</span></td>
            <td><span class="tiempo">${u.streak||0}🔥</span></td>
            <td>
              <select class="ins-select" id="ins_${u.email}">
                <option value="ninguna" ${ins==='ninguna'?'selected':''}>ninguna</option>
                <option value="embajador" ${ins==='embajador'?'selected':''}>🌟 embajador</option>
                <option value="fundador" ${ins==='fundador'?'selected':''}>💎 fundador</option>
              </select>
            </td>
            <td style="display:flex;gap:6px;align-items:center"><button class="btn-sm btn-save" onclick="setInsignia('${u.email}')">Guardar</button><button class="btn-sm btn-del" onclick="deleteUsuario('${u.email}')">🗑</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`}
  </div>

  <!-- GRITOS RECIENTES -->
  <div class="sec-title" style="margin-top:32px">💬 Gritos Recientes (Chat)</div>
  <div class="table-wrap" style="max-height:340px;overflow-y:auto">
    ${gritos.length===0 ? '<div class="empty">Sin gritos aún</div>' : `
    <table>
      <thead><tr><th>Navegante</th><th>Mensaje</th><th>Estación</th><th>Acción</th></tr></thead>
      <tbody>
        ${gritos.map(g => `<tr class="urow">
          <td><div class="uname">${g.nombre||'—'}</div><div class="uemail">${g.email||'—'}</div></td>
          <td><div class="grito-msg" title="${(g.mensaje||'').replace(/"/g,'&quot;')}">${g.mensaje||'—'}</div></td>
          <td><span style="font-size:0.7rem;color:var(--muted)">${g.estacion||'—'}</span></td>
          <td><button class="btn-sm btn-del" onclick="deleteGrito(${g.id})">🗑 Eliminar</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`}
  </div>

  <!-- REACCIONES -->
  <div class="sec-title" style="margin-top:32px">❤️ Reacciones por Estación</div>
  <div class="table-wrap" style="max-height:280px;overflow-y:auto">
    ${reacciones.length===0 ? '<div class="empty">Sin reacciones aún</div>' : (() => {
      const byStation = {};
      reacciones.forEach(r => { if(!byStation[r.estacion]) byStation[r.estacion]=[]; byStation[r.estacion].push(r); });
      return `<table><thead><tr><th>Estación</th><th>🔥 Fire</th><th>❤️ Heart</th><th>🚀 Rocket</th><th>Total</th></tr></thead><tbody>
        ${Object.entries(byStation).map(([est, rows]) => {
          const get = t => rows.find(r=>r.tipo===t)?.total||0;
          const fire=get('fire'), heart=get('heart'), rocket=get('rocket');
          return `<tr class="urow"><td><span class="tiempo">${est||'—'}</span></td><td>${fire}</td><td>${heart}</td><td>${rocket}</td><td><b style="color:var(--accent)">${fire+heart+rocket}</b></td></tr>`;
        }).join('')}
      </tbody></table>`;
    })()}
  </div>

  <!-- ACTIVITY LOG -->
  <div class="sec-title" style="margin-top:32px">📋 Log de Actividad</div>
  <div style="margin-bottom:10px">
    <input id="actSearch" class="config-input" style="width:240px" placeholder="Filtrar por email o tipo…" oninput="filtrarActivity()">
  </div>
  <div class="table-wrap" style="max-height:380px;overflow-y:auto">
    ${activityLog.length===0 ? '<div class="empty">Sin actividad registrada</div>' : `
    <table id="actTable">
      <thead><tr><th>Navegante</th><th>Tipo</th><th>Descripción</th><th>Fecha</th></tr></thead>
      <tbody>
        ${activityLog.map(a => {
          const fecha = new Date(a.ts).toLocaleString('es-VE',{timeZone:'America/Caracas',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
          return `<tr class="urow" data-search="${(a.email||'').toLowerCase()} ${(a.type||'').toLowerCase()}">
            <td><div class="uemail">${a.email||'—'}</div></td>
            <td><span class="rango-chip">${a.icon||''} ${a.type||'—'}</span></td>
            <td style="max-width:260px;white-space:normal;line-height:1.4;font-size:0.75rem;color:var(--muted)">${a.description||'—'}</td>
            <td><span class="tiempo">${fecha}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`}
  </div>

  <!-- APK UPDATE CONTROL -->
  <div class="sec-title" style="margin-top:32px">🚀 Actualización de la APK</div>
  <div class="monolith-card" style="flex-direction:column;align-items:stretch;gap:14px">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div class="monolith-orb orb-open" style="background:radial-gradient(circle,rgba(251,191,36,0.3),rgba(251,191,36,0.05));box-shadow:0 0 24px rgba(251,191,36,0.5)">📦</div>
      <div class="monolith-text">
        <h3>PUBLICAR NUEVA VERSIÓN</h3>
        <p>Versión actual en D1: <strong style="color:var(--accent)">${appVersion}</strong> · Notificará a todos los oyentes por FCM</p>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <input class="config-input" id="versionInput" type="text" value="${appVersion}" placeholder="2.1.0" style="width:120px">
      <input class="config-input" id="apkUrlInput" type="text" placeholder="https://pub-xxx.r2.dev/app.apk" style="width:320px;flex:1">
      <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--muted);cursor:pointer;white-space:nowrap">
        <input type="checkbox" id="sendPushCheck" checked style="accent-color:var(--accent)"> Enviar push FCM
      </label>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-mono-open" onclick="publicarVersion()" style="background:linear-gradient(135deg,#92400e,#b45309)">📡 PUBLICAR + NOTIFICAR</button>
    </div>
  </div>

  <!-- CONFIG SISTEMA -->
  <div class="sec-title" style="margin-top:32px">⚙️ Configuración del Sistema</div>
  <div class="table-wrap">
    <div class="config-row">
      <span class="config-label">🗿 Hits del Monolito</span>
      <input class="config-input" id="hitsInput" type="number" value="${monolithHits}" min="0">
      <button class="btn-sm btn-save" onclick="setHits()">Actualizar</button>
    </div>
  </div>

  <!-- PRUEBA DE NOTIFICACIONES -->
  <div class="sec-title" style="margin-top:32px">🔔 Prueba de Notificaciones Push</div>
  <div class="monolith-card" style="flex-direction:column;align-items:stretch;gap:14px">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div class="monolith-orb" style="background:radial-gradient(circle,rgba(168,85,247,0.3),rgba(168,85,247,0.05));box-shadow:0 0 24px rgba(168,85,247,0.5)">🔔</div>
      <div class="monolith-text">
        <h3>ENVÍO MANUAL DE PUSH</h3>
        <p>Envía una notificación FCM al topic <strong style="color:var(--accent)">radio-listeners</strong> para probar cómo se ve en los dispositivos</p>
      </div>
    </div>
    <div style="font-size:0.65rem;letter-spacing:2px;color:var(--muted);margin-bottom:2px">PLANTILLAS RÁPIDAS</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <button class="btn-sm btn-save" onclick="usarPlantilla('🎵 NUEVA MÚSICA EN ROTACIÓN','Hay canciones nuevas en el mix. ¡Sintoniza ahora!')">🎵 Nueva música</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('📡 TRANCENDENCIA RADIO EN VIVO','La señal está activa. ¡Únete a la frecuencia!')">📡 En vivo</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('🚀 NUEVA VERSIÓN DISPONIBLE','Actualiza la app para mejorar tu experiencia.')">🚀 APK</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('⚠️ PRUEBA DE SISTEMA','Esta es una notificación de prueba · Ignorar')">⚠️ Prueba</button>
    </div>
    <div style="font-size:0.65rem;letter-spacing:2px;color:var(--muted);margin-bottom:2px;margin-top:6px">EVENTOS AUTOMÁTICOS (texto real que se envía)</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <button class="btn-sm btn-save" onclick="usarPlantilla('🗿 EL MONOLITO HA DESPERTADO','El evento semanal ha comenzado. ¡Todos a la radio!')">🗿 Monolito · abre</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('🌑 EL MONOLITO SE HA CERRADO','El evento ha concluido sin ser derrotado. Volverá más fuerte...')">🗿 Monolito · cierra</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('🚀 DERIVA ESTELAR ACTIVA','El evento dominical ha comenzado. Tienes 2 horas y 3 intentos. ¡Sobrevive y gana Racha ×2 por 24h!')">🚀 Deriva · abre</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('🌌 DERIVA ESTELAR CERRADA','El evento especial ha concluido. ¡Vuelve el próximo domingo!')">🚀 Deriva · cierra</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('⚠️ ANOMALÍA DETECTADA','Se ha detectado una fluctuación en el sector. ¡Investiga ahora!')">🌀 Anomalía · aparece</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('✅ SECTOR ESTABILIZADO','Las fluctuaciones han cesado. La señal vuelve a ser estable.')">🌀 Anomalía · termina</button>
      <button class="btn-sm btn-save" onclick="usarPlantilla('🚀 NUEVAS MISIONES SEMANALES','Las misiones se han renovado. ¡Nuevos desafíos te esperan!')">🎯 Misiones · reset</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <input class="config-input" id="pushTitle" type="text" placeholder="Título de la notificación" style="width:100%;max-width:100%">
      <input class="config-input" id="pushBody" type="text" placeholder="Cuerpo del mensaje..." style="width:100%;max-width:100%">
    </div>
    <div>
      <button class="btn-mono-open" onclick="enviarPushPrueba()" style="background:linear-gradient(135deg,#4c1d95,#6d28d9)">🔔 ENVIAR PUSH AHORA</button>
    </div>
  </div>

<!-- MODAL DE CONFIRMACIÓN -->
<div class="modal-bg" id="modalBg">
  <div class="modal">
    <h3>✦ CONFIRMAR ACTIVACIÓN</h3>
    <p>Se activará la insignia para el navegante. Verifica el email antes de confirmar.</p>
    <div class="modal-badge-info" id="modalBadgeInfo"></div>
    <input class="modal-email" id="modalEmail" type="email" placeholder="correo@usuario.com">
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-confirm" onclick="confirmarAprobacion()">⚡ ACTIVAR INSIGNIA</button>
    </div>
  </div>
</div>

<!-- CONFIRM DIALOG -->
<div id="cfm-bg">
  <div id="cfm-box">
    <span id="cfm-icon">⚡</span>
    <div id="cfm-title">CONFIRMACIÓN</div>
    <div id="cfm-msg"></div>
    <div class="cfm-btns">
      <button class="cfm-btn cfm-btn-ok" id="cfm-ok">Confirmar</button>
      <button class="cfm-btn cfm-btn-cancel" id="cfm-cancel">Cancelar</button>
    </div>
  </div>
</div>

<!-- TOAST -->
<div id="toast-container"></div>

<script>
  const KEY = new URLSearchParams(location.search).get('key') || '';
  let _pendingId = null;

  // Reloj UTC
  function tickClock() {
    const n = new Date();
    document.getElementById('clock').textContent =
      n.getUTCFullYear() + '-' + String(n.getUTCMonth()+1).padStart(2,'0') + '-' + String(n.getUTCDate()).padStart(2,'0') + ' ' +
      String(n.getUTCHours()).padStart(2,'0') + ':' + String(n.getUTCMinutes()).padStart(2,'0') + ':' + String(n.getUTCSeconds()).padStart(2,'0');
  }
  tickClock(); setInterval(tickClock, 1000);

  // Cooldowns de eventos
  function tickCooldowns() {
    document.querySelectorAll('.cd-timer').forEach(el => {
      const target = parseInt(el.dataset.target || '0');
      if (!target) { el.textContent = '—'; return; }
      let diff = target - Date.now();
      if (diff <= 0) { el.textContent = '00:00:00'; return; }
      const h = Math.floor(diff / 3600000);
      diff -= h * 3600000;
      const m = Math.floor(diff / 60000);
      diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      el.textContent = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    });
  }
  tickCooldowns(); setInterval(tickCooldowns, 1000);

  function customConfirm(msg, icon='⚡', title='CONFIRMACIÓN') {
    return new Promise(resolve => {
      const bg = document.getElementById('cfm-bg');
      document.getElementById('cfm-msg').textContent = msg;
      document.getElementById('cfm-icon').textContent = icon;
      document.getElementById('cfm-title').textContent = title;
      bg.classList.add('cfm-show');
      function done(val) {
        bg.classList.remove('cfm-show');
        document.getElementById('cfm-ok').onclick = null;
        document.getElementById('cfm-cancel').onclick = null;
        bg.onclick = null;
        resolve(val);
      }
      document.getElementById('cfm-ok').onclick = () => done(true);
      document.getElementById('cfm-cancel').onclick = () => done(false);
      bg.onclick = e => { if(e.target === bg) done(false); };
    });
  }

  function toast(msg, ok=true) {
    const container = document.getElementById('toast-container');
    const icon = ok ? '✦' : '✖';
    const item = document.createElement('div');
    item.className = 'toast-item ' + (ok ? 'toast-ok' : 'toast-err');
    item.innerHTML = \`<span class="toast-icon">\${icon}</span><span class="toast-text">\${msg}</span><div class="toast-bar"></div>\`;
    container.appendChild(item);
    setTimeout(() => {
      item.classList.add('toast-out');
      setTimeout(() => item.remove(), 320);
    }, 3000);
  }

  function aprobar(id, email, badge) {
    _pendingId = id;
    document.getElementById('modalEmail').value = email || '';
    document.getElementById('modalBadgeInfo').textContent = 'Insignia a activar: ' + badge;
    document.getElementById('modalBg').classList.add('active');
    setTimeout(() => document.getElementById('modalEmail').focus(), 100);
  }

  function closeModal() {
    document.getElementById('modalBg').classList.remove('active');
    _pendingId = null;
  }

  async function confirmarAprobacion() {
    const email = document.getElementById('modalEmail').value.trim();
    if (!email) { toast('⚠️ Ingresa el email del navegante', false); return; }
    if (!_pendingId) return;
    const btn = document.querySelector('.btn-confirm');
    btn.disabled = true; btn.textContent = 'Procesando…';
    try {
      const res = await fetch('/approve-payment?key=' + KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: _pendingId, email })
      });
      const d = await res.json();
      if (d.success) {
        toast('✦ Insignia ' + d.badge + ' activada para ' + email);
        closeModal();
        setTimeout(() => location.reload(), 1600);
      } else {
        toast('❌ ' + (d.error || 'Error desconocido'), false);
      }
    } catch(e) { toast('❌ Error de conexión', false); }
    btn.disabled = false; btn.textContent = '⚡ ACTIVAR INSIGNIA';
  }

  async function toggleMonolith(open) {
    const action = open ? 'ABRIR' : 'SELLAR';
    if (!await customConfirm(action + ' el portal del Monolito para todos los oyentes?', open ? '🗿' : '🔒', 'CONTROL DEL MONOLITO')) return;
    try {
      const res = await fetch('/monolith-control?key=' + KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open })
      });
      const d = await res.json();
      if (d.success) { toast('🗿 Monolito ' + (open?'abierto':'sellado') + ' exitosamente'); setTimeout(()=>location.reload(), 1500); }
      else { toast('❌ ' + (d.error||'Error'), false); }
    } catch(e) { toast('❌ Error de conexión', false); }
  }

  async function toggleDeriva(enabled) {
    const action = enabled ? 'ACTIVAR' : 'DESACTIVAR';
    if (!await customConfirm(action + ' Deriva Estelar para todos los usuarios?', enabled ? '🚀' : '🌌', 'DERIVA ESTELAR')) return;
    try {
      const res = await fetch('/api/deriva/admin-toggle?key=' + KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const d = await res.json();
      if (d.success) { toast('🚀 Deriva Estelar ' + (enabled?'activada':'desactivada') + ' exitosamente'); setTimeout(()=>location.reload(), 1500); }
      else { toast('❌ ' + (d.error||'Error'), false); }
    } catch(e) { toast('❌ Error de conexión', false); }
  }

  // Cerrar modal al click fuera
  document.getElementById('modalBg').addEventListener('click', e => { if(e.target===e.currentTarget) closeModal(); });


  // ── EVENTO DE ANOMALÍA ───────────────────────────────────────
  async function cargarEstadoAnomalia() {
    try {
      const res = await fetch('https://app.rodzilla-castro.workers.dev/monolith-status');
      const d = await res.json();
      const orb = document.getElementById('anomalyOrb');
      const status = document.getElementById('anomalyStatus');
      if (d.active_anomaly && d.anomaly_expire > Date.now()) {
        const mins = Math.ceil((d.anomaly_expire - Date.now()) / 60000);
        orb.className = 'monolith-orb orb-open';
        orb.textContent = '🌀';
        status.innerHTML = '<span style="color:#67e8f9">⚡ EVENTO ACTIVO</span> · Cierra en ~' + mins + ' min';
      } else {
        orb.className = 'monolith-orb orb-closed';
        orb.textContent = '🌑';
        status.textContent = 'Sin evento activo — todos los sectores estables';
      }
    } catch(e) {}
  }

  async function dispararAnomalia() {
    const mins = parseInt(document.getElementById('anomalyDuration').value) || 15;
    if (!await customConfirm('¿Disparar anomalía global por ' + mins + ' min? Se enviará push a todos los oyentes.', '🌀', 'EVENTO DE ANOMALÍA')) return;
    const res = await fetch('/trigger_anomaly?key=' + KEY + '&duration=' + mins, { method: 'POST' });
    const d = await res.json();
    if (d.success) { toast('🌌 Evento disparado · ' + mins + ' min · Push enviado'); cargarEstadoAnomalia(); }
    else toast('❌ ' + (d.error||'Error'), false);
  }

  async function resetAnomalia() {
    if (!await customConfirm('¿Cerrar el evento de anomalía ahora?', '✖', 'CERRAR EVENTO')) return;
    const res = await fetch('/reset_anomaly?key=' + KEY, { method: 'POST' });
    const d = await res.json();
    if (d.success) { toast('✖ Evento cerrado'); cargarEstadoAnomalia(); }
    else toast('❌ ' + (d.error||'Error'), false);
  }

  cargarEstadoAnomalia();

  // ── ACTIVITY LOG ─────────────────────────────────────────────
  function filtrarActivity() {
    const q = document.getElementById('actSearch').value.toLowerCase();
    document.querySelectorAll('#actTable tbody tr').forEach(tr => {
      tr.style.display = tr.dataset.search.includes(q) ? '' : 'none';
    });
  }

  // ── NAVEGANTES ───────────────────────────────────────────────
  function filtrarUsuarios() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    document.querySelectorAll('#usersTable tbody tr').forEach(tr => {
      tr.style.display = tr.dataset.search.includes(q) ? '' : 'none';
    });
  }

  async function setInsignia(email) {
    const sel = document.getElementById('ins_' + email);
    if(!sel) return;
    const insignia = sel.value;
    const res = await fetch('/admin/set-insignia?key=' + KEY, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, insignia })
    });
    const d = await res.json();
    if(d.success) toast('✦ Insignia actualizada: ' + email);
    else toast('❌ ' + (d.error||'Error'), false);
  }

  // ── NAVEGANTES ── eliminar ───────────────────────────────────
  async function deleteUsuario(email) {
    if(!await customConfirm('¿Eliminar al navegante ' + email + '? Esta acción no se puede deshacer.', '🗑', 'ELIMINAR NAVEGANTE')) return;
    const res = await fetch('/admin/delete-usuario?key=' + KEY, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email })
    });
    const d = await res.json();
    if(d.success) { toast('🗑 Navegante eliminado'); setTimeout(()=>location.reload(), 1200); }
    else toast('❌ ' + (d.error||'Error'), false);
  }

  // ── GRITOS ───────────────────────────────────────────────────
  async function deleteGrito(id) {
    if(!await customConfirm('¿Eliminar este grito permanentemente?', '🗑', 'ELIMINAR GRITO')) return;
    const res = await fetch('/admin/delete-grito?key=' + KEY, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ id })
    });
    const d = await res.json();
    if(d.success) { toast('🗑 Grito eliminado'); setTimeout(()=>location.reload(), 1200); }
    else toast('❌ ' + (d.error||'Error'), false);
  }

  // ── CONFIG SISTEMA ───────────────────────────────────────────
  async function setHits() {
    const hits = parseInt(document.getElementById('hitsInput').value);
    if(isNaN(hits)||hits<0) { toast('⚠️ Valor inválido', false); return; }
    if(!await customConfirm('Establecer hits del Monolito a ' + hits + '?', '⚙️', 'EDITAR HITS')) return;
    const res = await fetch('/admin/set-hits?key=' + KEY, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ hits })
    });
    const d = await res.json();
    if(d.success) toast('🗿 Hits actualizados a ' + hits);
    else toast('❌ ' + (d.error||'Error'), false);
  }

  async function setVersion() {
    const version = document.getElementById('versionInput').value.trim();
    if(!version) { toast('⚠️ Ingresa una versión', false); return; }
    const res = await fetch('/admin/set-version?key=' + KEY, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ version })
    });
    const d = await res.json();
    if(d.success) toast('📡 Versión actualizada a ' + version);
    else toast('❌ ' + (d.error||'Error'), false);
  }

  function usarPlantilla(title, body) {
    document.getElementById('pushTitle').value = title;
    document.getElementById('pushBody').value = body;
    document.getElementById('pushTitle').focus();
  }

  async function enviarPushPrueba() {
    const title = document.getElementById('pushTitle').value.trim();
    const body = document.getElementById('pushBody').value.trim();
    if(!title) { toast('⚠️ Ingresa un título', false); return; }
    if(!body) { toast('⚠️ Ingresa el cuerpo del mensaje', false); return; }
    if(!await customConfirm('Enviar push a TODOS los oyentes: "' + title + '"?', '🔔', 'ENVIAR NOTIFICACIÓN')) return;
    const res = await fetch('/admin/send-push?key=' + KEY, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ title, body })
    });
    const d = await res.json();
    if(d.success) {
      toast('🔔 Push enviado · ' + (d.result || 'OK'));
      document.getElementById('pushTitle').value = '';
      document.getElementById('pushBody').value = '';
    } else toast('❌ ' + (d.error||'Error al enviar'), false);
  }

  async function publicarVersion() {
    const version = document.getElementById('versionInput').value.trim();
    const apk_url = document.getElementById('apkUrlInput').value.trim();
    const send_push = document.getElementById('sendPushCheck').checked;
    if(!version) { toast('⚠️ Ingresa el número de versión', false); return; }
    if(!apk_url) { toast('⚠️ Ingresa la URL de descarga del APK', false); return; }
    const pushTxt = send_push ? ' + push FCM a todos los oyentes' : '';
    if(!await customConfirm('Publicar versión ' + version + pushTxt + '?', '🚀', 'PUBLICAR APK')) return;
    const res = await fetch('/admin/set-version?key=' + KEY, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ version, apk_url, send_push })
    });
    const d = await res.json();
    if(d.success) {
      const pushInfo = send_push ? ' · Push: ' + (d.pushStatus||'enviado') : '';
      toast('🚀 APK v' + version + ' publicada' + pushInfo);
    } else toast('❌ ' + (d.error||'Error'), false);
  }
</script>
</body>
</html>`;
        return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
      }

      // --- GRITOS ESTELARES ---
      if (path === "/reaccion" && request.method === "POST") {
        const { estacion, tipo } = await request.json();
        if (!estacion || !['fire','heart','rocket'].includes(tipo)) {
          return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reacciones (
          estacion TEXT NOT NULL, tipo TEXT NOT NULL, total INTEGER DEFAULT 0,
          PRIMARY KEY (estacion, tipo)
        )`).run();
        await env.DB.prepare("INSERT INTO reacciones (estacion, tipo, total) VALUES (?,?,1) ON CONFLICT(estacion,tipo) DO UPDATE SET total=total+1").bind(estacion, tipo).run();
        const row = await env.DB.prepare("SELECT total FROM reacciones WHERE estacion=? AND tipo=?").bind(estacion, tipo).first();
        return new Response(JSON.stringify({ success: true, total: row?.total || 1 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "/reacciones" && request.method === "GET") {
        const estacion = new URL(request.url).searchParams.get('estacion') || '';
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reacciones (
          estacion TEXT NOT NULL, tipo TEXT NOT NULL, total INTEGER DEFAULT 0,
          PRIMARY KEY (estacion, tipo)
        )`).run();
        const rows = await env.DB.prepare("SELECT tipo, total FROM reacciones WHERE estacion=?").bind(estacion).all();
        const result = { fire: 0, heart: 0, rocket: 0 };
        (rows.results || []).forEach(r => { if(result[r.tipo] !== undefined) result[r.tipo] = r.total; });
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "/shout" && request.method === "POST") {
        const { email, nombre, mensaje, estacion, reply_to_id, reply_to_nombre, reply_to_msg } = await request.json();
        if (!email || !mensaje) {
          return new Response(JSON.stringify({ error: "Faltan datos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS gritos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          nombre TEXT DEFAULT 'Navegante',
          mensaje TEXT NOT NULL,
          estacion TEXT DEFAULT '',
          fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        )`).run();
        await env.DB.prepare("INSERT INTO gritos (email, nombre, mensaje, estacion, reply_to_id, reply_to_nombre, reply_to_msg) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(email, nombre || 'Navegante', mensaje, estacion || '', reply_to_id || null, reply_to_nombre || null, reply_to_msg || null).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "/shouts" && request.method === "GET") {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS gritos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          nombre TEXT DEFAULT 'Navegante',
          mensaje TEXT NOT NULL,
          estacion TEXT DEFAULT '',
          fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        )`).run();
        const result = await env.DB.prepare(`
          SELECT g.id, g.email, g.nombre, g.mensaje, g.estacion, g.fecha,
                 g.reply_to_id, g.reply_to_nombre, g.reply_to_msg,
                 COALESCE(u.segundos_escucha, 0) / 3600 as rango_h,
                 COALESCE(u.insignia, 'ninguna') as vip
          FROM gritos g
          LEFT JOIN usuarios u ON g.email = u.email
          ORDER BY g.fecha DESC
          LIMIT 40
        `).all();
        return new Response(JSON.stringify(result.results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── DERIVA ESTELAR ──────────────────────────────────────────
      // GET /api/deriva/status?email=...
      if (path === "/api/deriva/status" && request.method === "GET") {
        const email = url.searchParams.get("email");
        if (!email) return new Response(JSON.stringify({ error: "Falta email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const row = await env.DB.prepare("SELECT deriva_last_played, deriva_x2_until FROM usuarios WHERE email = ?").bind(email).first();
        const today = new Date().toISOString().slice(0, 10);
        const enabledRow = await env.DB.prepare("SELECT valor FROM configuracion_global WHERE clave = 'deriva_enabled'").first().catch(()=>null);
        const derivaEnabled = enabledRow ? enabledRow.valor === 'true' : true;
        return new Response(JSON.stringify({
          played_today: row?.deriva_last_played === today,
          x2_until: row?.deriva_x2_until || 0,
          x2_active: (row?.deriva_x2_until || 0) > Date.now(),
          enabled: derivaEnabled
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // POST /api/deriva/win  { email, score }
      if (path === "/api/deriva/win" && request.method === "POST") {
        const { email, score } = await request.json();
        if (!email) return new Response(JSON.stringify({ error: "Falta email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const today = new Date().toISOString().slice(0, 10);
        const x2Until = Date.now() + 86400000;
        await env.DB.prepare("UPDATE usuarios SET deriva_last_played = ?, deriva_x2_until = ? WHERE email = ?")
          .bind(today, x2Until, email).run();
        return new Response(JSON.stringify({ success: true, x2_until: x2Until }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // POST /api/deriva/admin-toggle { enabled: true|false } — botón de emergencia en /admin/payments
      if (path === "/api/deriva/admin-toggle" && request.method === "POST") {
        const k = url.searchParams.get('key');
        if (k !== (env.ADMIN_KEY || 'trancendencia2026')) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { enabled } = await request.json();
        await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('deriva_enabled', ?)").bind(enabled ? 'true' : 'false').run();
        // El toggle manual anula cualquier ventana automática en curso (evita autocierre/push fantasma)
        await env.DB.prepare("INSERT OR REPLACE INTO configuracion_global (clave, valor) VALUES ('deriva_auto_opened_at', '0')").run();
        return new Response(JSON.stringify({ success: true, enabled: !!enabled }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // POST /api/deriva/reset { email } — solo para testing, protegido con ADMIN_KEY
      if (path === "/api/deriva/reset" && request.method === "POST") {
        const k = url.searchParams.get('key');
        if (k !== (env.ADMIN_KEY || 'trancendencia2026')) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { email } = await request.json();
        if (!email) return new Response(JSON.stringify({ error: "Falta email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await env.DB.prepare("UPDATE usuarios SET deriva_last_played = '', deriva_x2_until = 0 WHERE email = ?").bind(email).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // POST /api/deriva/played  { email }  — registra intento sin ganar
      if (path === "/api/deriva/played" && request.method === "POST") {
        const { email } = await request.json();
        if (!email) return new Response(JSON.stringify({ error: "Falta email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const today = new Date().toISOString().slice(0, 10);
        await env.DB.prepare("UPDATE usuarios SET deriva_last_played = ? WHERE email = ?").bind(today, email).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // POST /api/collection/add  { email, item, eventId? }
      if (path === "/api/collection/add" && request.method === "POST") {
        const { email, item, eventId } = await request.json();
        if (!email || item === undefined) return new Response(JSON.stringify({ error: "Faltan datos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const row = await env.DB.prepare("SELECT coleccion, coleccion_v FROM usuarios WHERE email = ?").bind(email.toLowerCase()).first();
        const coll = JSON.parse(row?.coleccion || '[]');
        if (!coll.includes(item)) coll.push(item);
        await env.DB.prepare("UPDATE usuarios SET coleccion = ? WHERE email = ?").bind(JSON.stringify(coll), email.toLowerCase()).run();
        if (eventId) {
            await env.DB.prepare("UPDATE usuarios SET anomaly_last_captured = ? WHERE email = ?").bind(String(eventId), email.toLowerCase()).run();
        }
        try { await env.DB.prepare("INSERT INTO activity_log (email, icon, type, description, ts) VALUES (?, ?, ?, ?, ?)").bind(email.toLowerCase(), '🌀', 'Anomalía Capturada', `Artefacto #${item} añadido a la bóveda`, Date.now()).run(); } catch(e) {}
        return new Response(JSON.stringify({ success: true, coleccion: JSON.stringify(coll) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // POST /api/anomaly/capture  { email, eventId }
      if (path === "/api/anomaly/capture" && request.method === "POST") {
        const { email, eventId } = await request.json();
        if (!email || !eventId) return new Response(JSON.stringify({ error: "Faltan datos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await env.DB.prepare("UPDATE usuarios SET anomaly_last_captured = ? WHERE email = ?").bind(String(eventId), email.toLowerCase()).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // POST /api/rank-check  { email, rankIdx, rankName, rankIcon }
      if (path === "/api/rank-check" && request.method === "POST") {
        const { email, rankIdx, rankName, rankIcon } = await request.json();
        if (!email || rankIdx === undefined) return new Response(JSON.stringify({ error: "Faltan datos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, icon TEXT, type TEXT, description TEXT, ts INTEGER NOT NULL)").run(); } catch(e) {}
        const row = await env.DB.prepare("SELECT last_rank_idx FROM usuarios WHERE email = ?").bind(email).first();
        const storedIdx = row?.last_rank_idx ?? -1;
        await env.DB.prepare("UPDATE usuarios SET last_rank_idx = ? WHERE email = ?").bind(rankIdx, email).run();
        if (rankIdx > storedIdx && storedIdx >= 0) {
          await env.DB.prepare("INSERT INTO activity_log (email, icon, type, description, ts) VALUES (?, ?, ?, ?, ?)").bind(email, rankIcon || '⭐', 'Rango Ascendido', `Ahora eres: ${rankName}`, Date.now()).run();
          return new Response(JSON.stringify({ logged: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ logged: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── REGISTROS DE LA NAVE ─────────────────────────────────────
      // GET /api/activity?email=...&limit=20
      if (path === "/api/activity" && request.method === "GET") {
        const email = url.searchParams.get("email");
        if (!email) return new Response(JSON.stringify({ error: "Falta email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, icon TEXT, type TEXT, description TEXT, ts INTEGER NOT NULL)").run(); } catch(e) {}
        try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_activity_email ON activity_log (email, ts DESC)").run(); } catch(e) {}
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 50);
        const rows = await env.DB.prepare("SELECT icon, type, description, ts FROM activity_log WHERE email = ? ORDER BY ts DESC LIMIT ?").bind(email, limit).all();
        return new Response(JSON.stringify(rows.results || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // POST /api/activity  { email, icon, type, description }
      if (path === "/api/activity" && request.method === "POST") {
        const { email, icon, type, description } = await request.json();
        if (!email || !type) return new Response(JSON.stringify({ error: "Faltan datos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, icon TEXT, type TEXT, description TEXT, ts INTEGER NOT NULL)").run(); } catch(e) {}
        await env.DB.prepare("INSERT INTO activity_log (email, icon, type, description, ts) VALUES (?, ?, ?, ?, ?)").bind(email, icon || '⭐', type, description || '', Date.now()).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── DJ PORTAL — PROXY CENTOVA CAST ───────────────────────────────────────
      const CENTOVA = 'https://cast1.asurahosting.com:2199';
      const corsWithUpload = { ...corsHeaders, "Access-Control-Allow-Headers": "Content-Type, X-DJ-User, X-DJ-Pass" };

      if (request.method === "OPTIONS") return new Response(null, { headers: corsWithUpload });

      // POST /api/dj/login
      if (path === "/api/dj/login" && request.method === "POST") {
        const { username, password } = await request.json();
        if (!username || !password) return new Response(JSON.stringify({ error: "Faltan credenciales." }), { status: 400, headers: corsWithUpload });
        const xml = `<?xml version="1.0"?><methodCall><methodName>sc_login</methodName><params><param><value><string>${username}</string></value></param><param><value><string>${password}</string></value></param></params></methodCall>`;
        let res, text;
        try {
          res = await fetch(`${CENTOVA}/api.php`, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml });
          text = await res.text();
        } catch(e) {
          return new Response(JSON.stringify({ error: "No se pudo conectar a Centova." }), { status: 502, headers: corsWithUpload });
        }
        if (text.includes("<fault>") || text.includes("faultString")) {
          const m = text.match(/<name>faultString<\/name>\s*<value><string>(.*?)<\/string>/s);
          return new Response(JSON.stringify({ error: m ? m[1] : "Credenciales incorrectas." }), { status: 401, headers: corsWithUpload });
        }
        const nm = text.match(/<name>name<\/name>\s*<value><string>(.*?)<\/string>/s)
                || text.match(/<name>hostname<\/name>\s*<value><string>(.*?)<\/string>/s);
        return new Response(JSON.stringify({ ok: true, display_name: nm ? nm[1] : username }), { headers: { ...corsWithUpload, "Content-Type": "application/json" } });
      }

      // POST /api/dj/upload
      if (path === "/api/dj/upload" && request.method === "POST") {
        const djUser = request.headers.get("X-DJ-User");
        const djPass = request.headers.get("X-DJ-Pass");
        if (!djUser || !djPass) return new Response(JSON.stringify({ error: "No autenticado." }), { status: 401, headers: corsWithUpload });
        const form = await request.formData();
        const file = form.get("file");
        if (!file) return new Response(JSON.stringify({ error: "No se recibió archivo." }), { status: 400, headers: corsWithUpload });
        const up = new FormData();
        up.append("p", "upload"); up.append("username", djUser); up.append("password", djPass); up.append("file", file);
        let res, text;
        try { res = await fetch(`${CENTOVA}/api/`, { method: "POST", body: up }); text = await res.text(); }
        catch(e) { return new Response(JSON.stringify({ error: "Error al conectar con Centova." }), { status: 502, headers: corsWithUpload }); }
        return new Response(JSON.stringify({ debug: true, status: res.status, body: text }), { headers: { ...corsWithUpload, "Content-Type": "application/json" } });
      }

      // GET /api/dj/tracks
      if (path === "/api/dj/tracks" && request.method === "GET") {
        const djUser = request.headers.get("X-DJ-User");
        const djPass = request.headers.get("X-DJ-Pass");
        if (!djUser || !djPass) return new Response(JSON.stringify({ error: "No autenticado." }), { status: 401, headers: corsWithUpload });
        const params = new URLSearchParams({ p: "gettracks", username: djUser, password: djPass });
        let res, text;
        try { res = await fetch(`${CENTOVA}/api/?${params}`); text = await res.text(); }
        catch(e) { return new Response(JSON.stringify({ tracks: [] }), { headers: { ...corsWithUpload, "Content-Type": "application/json" } }); }
        let data;
        try { data = JSON.parse(text); } catch { return new Response(JSON.stringify({ tracks: [] }), { headers: { ...corsWithUpload, "Content-Type": "application/json" } }); }
        if (data?.response?.status !== "success") return new Response(JSON.stringify({ tracks: [] }), { headers: { ...corsWithUpload, "Content-Type": "application/json" } });
        const raw = data?.response?.data?.tracks || [];
        const tracks = raw.map(t => ({
          filename: t.filename || "",
          title: t.title || t.filename || "",
          artist: t.artist || "",
          duration: t.length ? `${Math.floor(t.length/60)}:${String(t.length%60).padStart(2,"0")}` : ""
        }));
        return new Response(JSON.stringify({ tracks }), { headers: { ...corsWithUpload, "Content-Type": "application/json" } });
      }
      // ── FIN DJ PORTAL ─────────────────────────────────────────────────────────

      return new Response("Not Found", { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
export { worker_default as default };
