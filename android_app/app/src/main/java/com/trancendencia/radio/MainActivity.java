package com.trancendencia.radio;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.*;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends AppCompatActivity {

    private WebView myWebView;
    private static final int NOTIFICATION_PERMISSION_CODE = 123;

    /* =======================================================================
       🚫🚫🚫 BLOQUEO ABSOLUTO: PUENTE NATIVO PUSH A WEBVIEW 🚫🚫🚫
       ESTÁ TOTALMENTE PROHIBIDO MODIFICAR ESTE BROADCAST RECEIVER O EL METODO
       `evaluateJavascript` QUE LLAMA A `window.onNativeSignal`.
       ======================================================================= */
    private final BroadcastReceiver pushReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String type = intent.getStringExtra("type");
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String eventType = intent.getStringExtra("eventType");

            if (type != null && myWebView != null) {
                String payload = String.format(
                    "{\"type\":\"%s\",\"title\":\"%s\",\"body\":\"%s\",\"eventType\":\"%s\"}",
                    type.replace("\"", "\\\""),
                    title != null ? title.replace("\"", "\\\"") : "",
                    body != null ? body.replace("\"", "\\\"") : "",
                    eventType != null ? eventType.replace("\"", "\\\"") : type
                );
                myWebView.post(() -> myWebView.evaluateJavascript(
                    "if(window.onNativeSignal) window.onNativeSignal('PUSH_RECEIVED', " + payload + ");", null
                ));
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        myWebView = findViewById(R.id.webview);
        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // Cache optimizada para reducir latencia en streams
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);

        myWebView.addJavascriptInterface(new WebAppInterface(), "AndroidInterface");
        myWebView.setWebViewClient(new WebViewClient());
        myWebView.setWebChromeClient(new WebChromeClient());

        myWebView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setData(Uri.parse(url));
            startActivity(i);
        });

        myWebView.loadUrl("https://trancendencia-prueba.pages.dev/trancendencia_ultimate_pro.html");

        // Registrar receptor de señales internas
        IntentFilter filter = new IntentFilter("com.trancendencia.radio.PUSH_SIGNAL");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(pushReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(pushReceiver, filter);
        }

        requestNotificationPermission();
        initFirebaseToken();
    }

    // ✅ Iniciar ForegroundService al ir a segundo plano (Protección total)
    @Override
    protected void onPause() {
        super.onPause();
        Intent serviceIntent = new Intent(this, RadioForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    // ✅ Detener ForegroundService al volver al frente (Ahorro de batería)
    @Override
    protected void onResume() {
        super.onResume();
        stopService(new Intent(this, RadioForegroundService.class));
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(pushReceiver);
        } catch (Exception e) {
            // Ya estaba desregistrado
        }
        stopService(new Intent(this, RadioForegroundService.class));
    }

    @Override
    public void onBackPressed() {
        if (myWebView.canGoBack()) {
            myWebView.goBack();
        } else {
            // No matar la app, solo moverla al fondo para que el Service tome el control
            moveTaskToBack(true);
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_CODE);
            }
        }
    }

    private void initFirebaseToken() {
        FirebaseMessaging.getInstance().subscribeToTopic("radio-listeners");
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) return;
            String token = task.getResult();
            myWebView.post(() -> myWebView.evaluateJavascript(
                "if(window.registerPushToken) window.registerPushToken('" + token + "');", null
            ));
        });
    }

    public class WebAppInterface {
        @JavascriptInterface
        public void showToast(String toast) {
            android.widget.Toast.makeText(MainActivity.this, toast,
                android.widget.Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public void sendLocalNotification(String title, String message) {
            String channelId = "trancendencia_alerts";
            android.app.NotificationManager manager = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    channelId, "Alertas Estelares",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notificaciones de anomalías y eventos");
                if (manager != null) manager.createNotificationChannel(channel);
            }

            android.content.Intent intent = new android.content.Intent(MainActivity.this, MainActivity.class);
            intent.setFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP);
            android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
                MainActivity.this, 0, intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
            );

            androidx.core.app.NotificationCompat.Builder builder = new androidx.core.app.NotificationCompat.Builder(MainActivity.this, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setLargeIcon(android.graphics.BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher))
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new androidx.core.app.NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

            if (manager != null) manager.notify(99, builder.build());
        }
    }
}
