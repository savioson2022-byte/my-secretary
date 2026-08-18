package app.mysecretary.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String APP_ORIGIN = "https://my-secretary-remote.vercel.app";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        openDeepLink(getIntent());
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            "assistant_reminders",
            "비서 알림",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("일정, 할 일, 즉시처리 알림");
        channel.enableVibration(true);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openDeepLink(intent);
    }

    private void openDeepLink(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null || uri.getScheme() == null || bridge == null) return;

        String scheme = uri.getScheme();
        if (!"mysecretary".equals(scheme) && !"my-secretary".equals(scheme)) return;

        String host = uri.getHost() == null ? "" : uri.getHost();
        String target;
        switch (host) {
            case "voice":
                target = "/?voice=1";
                break;
            case "settings":
                target = "/settings";
                break;
            case "auth":
                target = "/auth/native-callback" + (uri.getEncodedFragment() == null ? "" : "#" + uri.getEncodedFragment());
                break;
            case "today":
            default:
                target = "/";
        }
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(APP_ORIGIN + target));
    }
}
