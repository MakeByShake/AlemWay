package kz.alemway.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

/**
 * Оболочка над живым сайтом alemway.kz. Весь интерфейс и все данные (клиенты, документы)
 * приходят с сайта, поэтому любое изменение сайта сразу видно в приложении.
 */
public class MainActivity extends BridgeActivity {

    private static final String HOST = "alemway.kz";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final WebView webView = getBridge().getWebView();

        // Вход в админку и кабинет держится на cookie — не теряем их между запусками.
        CookieManager.getInstance().setAcceptCookie(true);

        // Файлы (PDF, Excel, ZIP), которые WebView не умеет показать, скачиваются в «Загрузки».
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                Uri uri = Uri.parse(url);
                if (!"https".equals(uri.getScheme())) {
                    return;
                }
                String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request request = new DownloadManager.Request(uri);
                String cookies = CookieManager.getInstance().getCookie(url);
                // Cookie входа отправляем только на свой сайт.
                if (cookies != null && isOwnHost(uri)) {
                    request.addRequestHeader("Cookie", cookies);
                }
                request.addRequestHeader("User-Agent", userAgent);
                request.setMimeType(mimeType);
                request.setTitle(name);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(request);
                Toast.makeText(this, "Скачивается: " + name, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Не удалось скачать файл", Toast.LENGTH_SHORT).show();
            }
        });

        openFromIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openFromIntent(intent);
    }

    /** Ярлыки значка («Сайт», «Кабинет клиента») передают адрес страницы сайта. */
    private void openFromIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data != null && "https".equals(data.getScheme()) && isOwnHost(data)) {
            getBridge().getWebView().loadUrl(data.toString());
        }
    }

    private static boolean isOwnHost(Uri uri) {
        String host = uri.getHost();
        return host != null && (host.equals(HOST) || host.endsWith("." + HOST));
    }

    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
