package kz.alemway.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Оболочка над живым сайтом alemway.kz. Весь интерфейс и все данные (клиенты, документы)
 * приходят с сайта, поэтому любое изменение сайта сразу видно в приложении.
 */
public class MainActivity extends BridgeActivity {

    private static final String HOST = "alem-way-git-app-tools-makebyshakes-projects.vercel.app";
    private static final int MAX_FILES = 10;
    private static final int MAX_BYTES = 15 * 1024 * 1024;

    /** Файлы, которыми поделились из WhatsApp/галереи; страница /admin/share забирает их один раз. */
    private final List<String[]> shared = new ArrayList<>();

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

        // Страница /admin/share забирает файлы через window.AlemWayShare (только с нашего сайта).
        webView.addJavascriptInterface(new ShareBridge(), "AlemWayShare");
        // Блокировка PIN/отпечатком на сайте спрашивает отпечаток через сам телефон (WebView не умеет WebAuthn).
        webView.addJavascriptInterface(new BioBridge(), "AlemWayBio");

        openFromIntent(getIntent());
    }

    private class ShareBridge {
        @JavascriptInterface
        public String take() {
          synchronized (MainActivity.this) {
            StringBuilder json = new StringBuilder("[");
            for (int i = 0; i < shared.size(); i++) {
                String[] f = shared.get(i);
                if (i > 0) json.append(',');
                json.append("{\"name\":").append(quote(f[0])).append(",\"type\":").append(quote(f[1])).append(",\"data\":\"").append(f[2]).append("\"}");
            }
            shared.clear();
            return json.append(']').toString();
          }
        }
    }


    private static final Pattern REQUEST_ID = Pattern.compile("[A-Za-z0-9-]{1,64}");
    private static final int BIO_KINDS = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    /** Отпечаток пальца / лицо через системное окно Android; ответ уходит в window.__awBio(id, ok). */
    private class BioBridge {
        @JavascriptInterface
        public boolean available() {
            return BiometricManager.from(MainActivity.this).canAuthenticate(BIO_KINDS) == BiometricManager.BIOMETRIC_SUCCESS;
        }

        @JavascriptInterface
        public void authenticate(final String id, final String title) {
            if (id == null || !REQUEST_ID.matcher(id).matches()) return;
            runOnUiThread(() -> {
                try {
                    BiometricPrompt prompt = new BiometricPrompt(MainActivity.this, ContextCompat.getMainExecutor(MainActivity.this), new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            answer(id, true);
                        }

                        @Override
                        public void onAuthenticationError(int code, CharSequence message) {
                            answer(id, false);
                        }
                    });
                    BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title == null || title.isEmpty() ? "AlemWay" : title)
                        .setNegativeButtonText("PIN")
                        .setAllowedAuthenticators(BIO_KINDS)
                        .build();
                    prompt.authenticate(info);
                } catch (Exception e) {
                    answer(id, false);
                }
            });
        }
    }

    private void answer(String id, boolean ok) {
        runOnUiThread(() -> getBridge().getWebView().evaluateJavascript("window.__awBio && window.__awBio('" + id + "', " + ok + ")", null));
    }

    private static String quote(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20) b.append(' ');
            else b.append(c);
        }
        return b.append('"').toString();
    }

    /** Читает файлы из «Поделиться» и открывает страницу, где сотрудник выбирает клиента. */
    private boolean receiveShare(Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return false;
        List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri one = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (one != null) uris.add(one);
        } else {
            ArrayList<Uri> many = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (many != null) uris.addAll(many);
        }
        synchronized (this) {
            shared.clear();
            for (Uri uri : uris) {
                if (shared.size() >= MAX_FILES) break;
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    if (in == null) continue;
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        if (out.size() > MAX_BYTES) break;
                    }
                    if (out.size() > MAX_BYTES) continue;
                    String type = getContentResolver().getType(uri);
                    shared.add(new String[] { nameOf(uri), type == null ? "application/octet-stream" : type, Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP) });
                } catch (Exception ignored) {
                }
            }
        }
        if (shared.isEmpty()) {
            Toast.makeText(this, "Не удалось прочитать файл", Toast.LENGTH_SHORT).show();
        } else {
            getBridge().getWebView().loadUrl("https://" + HOST + "/admin/share?native=1");
        }
        return true;
    }

    private String nameOf(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String name = c.getString(0);
                if (name != null) return name;
            }
        } catch (Exception ignored) {
        }
        String last = uri.getLastPathSegment();
        return last == null ? "file" : last;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openFromIntent(intent);
    }

    /** Ярлыки значка («Сайт», «Кабинет клиента») передают адрес страницы сайта. */
    private void openFromIntent(Intent intent) {
        if (receiveShare(intent)) return;
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
