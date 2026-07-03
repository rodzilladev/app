package com.trancendencia.radio;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/* 🛡️ PROTECTED CORE: FIREBASE MESSAGING SERVICE - NO MODIFICAR SIN AUTORIZACIÓN */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    /* =======================================================================
       🚫🚫🚫 BLOQUEO ABSOLUTO: PUENTE DE DATOS EN TIEMPO REAL 🚫🚫🚫
       ESTÁ TOTALMENTE PROHIBIDO MODIFICAR ESTE EVENTO DE RECEPCIÓN.
       ======================================================================= */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        String title = null;
        String body = null;
        String eventType = remoteMessage.getData().get("eventType");
        String apkUrl = remoteMessage.getData().get("apkUrl");

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        } else if (remoteMessage.getData().size() > 0) {
            title = remoteMessage.getData().get("title");
            body = remoteMessage.getData().get("body");
        }

        if (title != null && body != null) {
            // 1. Mostrar notificación en sistema
            sendNotification(title, body, apkUrl);

            // 2. Avisar a la App (si está abierta) para refrescar UI
            Intent intent = new Intent("com.trancendencia.radio.PUSH_SIGNAL");
            intent.setPackage(getPackageName());

            String broadcastType = "GENERAL_UPDATE";
            if (title.contains("ANOMALÍA")) {
                broadcastType = "ANOMALY_DETECTED";
            } else if (title.contains("COMPLETADO")) {
                broadcastType = "MONOLITH_DEFEATED";
            } else if (title.contains("DESPERTADO")) {
                broadcastType = "MONOLITH_AWAKENED";
            }

            intent.putExtra("type", broadcastType);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            intent.putExtra("eventType", eventType != null ? eventType : broadcastType);
            sendBroadcast(intent);
        }
    }

    private void sendNotification(String title, String messageBody, String apkUrl) {
        Intent intent;
        if (apkUrl != null && !apkUrl.isEmpty()) {
            // Notificación de actualización: al tocarla, abrir el navegador y descargar el APK directo
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl));
        } else {
            intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_IMMUTABLE);

        String channelId = "trancendencia_alerts";
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, channelId)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setLargeIcon(android.graphics.BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher))
                        .setContentTitle(title)
                        .setContentText(messageBody)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(messageBody))
                        .setAutoCancel(true)
                        .setSound(defaultSoundUri)
                        .setContentIntent(pendingIntent)
                        .setPriority(NotificationCompat.PRIORITY_HIGH);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId,
                    "Alertas de Trancendencia",
                    NotificationManager.IMPORTANCE_HIGH);
            notificationManager.createNotificationChannel(channel);
        }

        notificationManager.notify(0, notificationBuilder.build());
    }
}
