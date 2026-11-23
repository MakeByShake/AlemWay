package kz.alemway.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.biometric.BiometricManager;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Оболочка над живым сайтом alemway.kz. Весь интерфейс и все данные (клиенты, документы)
 * приходят с сайта, поэтому любое изменение сайта сразу видно в приложении.
 */
public class MainActivity extends BridgeActivity {

    private static final String HOST = "alemway.kz";
    private static final int MAX_FILES = 10;
    private static final int MAX_BYTES = 15 * 1024 * 1024;

    /** Файлы, которыми поделились из WhatsApp/галереи; страница /admin/share забирает их один раз. */
    private final List<String[]> shared = new ArrayList<>();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final WebView webView = getBridge().getWebView();

        // Android 15 рисует страницу под строкой часов и под кнопками внизу. Отодвигаем её:
        // сверху на высоту строки состояния (и выреза камеры), снизу на кнопки или клавиатуру,
        // чтобы поле ввода в чате не пряталось. Полоса сверху белая, значки на ней тёмные.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false); // одинаково на всех версиях Android
        android.view.View root = findViewById(android.R.id.content);
        root.setBackgroundColor(0xFFFFFFFF);
        getWindow().getDecorView().setBackgroundColor(0xFFFFFFFF);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(true);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(root);

        // Вход в админку и кабинет держится на cookie — не теряем их между запусками.
        CookieManager.getInstance().setAcceptCookie(true);

        // Канал уведомлений «Сообщения» (Android 8+): ответы куратора и сроки по делу.
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(PUSH_CHANNEL, "Сообщения", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Ответы AlemWay и напоминания о сроках");
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }

        // Файлы (PDF, Excel, ZIP), которые WebView не умеет показать, скачиваются в «Загрузки».
        // Файлы (декларация, PDF, Excel), которые WebView не умеет показать: страница сама скачивает их
        // со своим входом (cookie), приложение кладёт файл в «Загрузки» и сразу открывает.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Uri uri = Uri.parse(url);
            if (!"https".equals(uri.getScheme())) return;
            if (!isOwnHost(uri)) {
                // Чужой сайт: пусть откроет обычный браузер, наш вход туда не уходит.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return;
            }
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            Toast.makeText(this, "Скачивается: " + name, Toast.LENGTH_SHORT).show();
            webView.evaluateJavascript(
                "(function(u,n,m){fetch(u,{credentials:'include'}).then(function(r){if(!r.ok)throw 0;return r.blob();})"
                    + ".then(function(b){var f=new FileReader();f.onload=function(){var s=String(f.result);"
                    + "AlemWaySave.save(n,m||b.type||'application/octet-stream',s.slice(s.indexOf(',')+1));};f.readAsDataURL(b);})"
                    + ".catch(function(){AlemWaySave.fail();});})(" + quote(url) + "," + quote(name) + "," + quote(mimeType == null ? "" : mimeType) + ")",
                null
            );
        });


        openFromIntent(getIntent());
    }

    /**
     * Мосты для страниц сайта. Их надо добавить ДО первой загрузки: WebView показывает такие объекты
     * только страницам, загруженным после добавления, а Capacitor открывает сайт внутри super.load().
     * window.AlemWayShare: /admin/share забирает файлы из «Поделиться».
     * window.AlemWayBio: блокировка PIN спрашивает отпечаток через сам телефон (WebView не умеет WebAuthn).
     */
    @Override
    protected void load() {
        WebView early = findViewById(com.getcapacitor.android.R.id.webview);
        if (early != null) {
            early.addJavascriptInterface(new ShareBridge(), "AlemWayShare");
            early.addJavascriptInterface(new BioBridge(), "AlemWayBio");
            early.addJavascriptInterface(new PushBridge(), "AlemWayPush");
            early.addJavascriptInterface(new SaveBridge(), "AlemWaySave");
            early.addJavascriptInterface(new ScanBridge(), "AlemWayScan");
        }
        super.load();
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


    static final String PUSH_CHANNEL = "messages";
    private static final int PUSH_PERMISSION = 7101;
    private String pushWaiting;

    /**
     * Уведомления в приложении через Firebase: сайт спрашивает разрешение и получает токен телефона,
     * потом сервер шлёт на этот токен. Ответ уходит в window.__awPush(id, token, state).
     */
    private class PushBridge {
        /** "off" (Firebase не настроен), "granted", "default" (ещё не спрашивали или можно спросить), "denied". */
        @JavascriptInterface
        public String state() {
            if (FirebaseApp.getApps(MainActivity.this).isEmpty()) return "off";
            if (NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled()) return "granted";
            if (Build.VERSION.SDK_INT >= 33 && !getSharedPreferences("aw", MODE_PRIVATE).getBoolean("push-asked", false)) return "default";
            if (Build.VERSION.SDK_INT >= 33 && ActivityCompat.shouldShowRequestPermissionRationale(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)) return "default";
            return "denied";
        }

        @JavascriptInterface
        public void request(final String id) {
            if (id == null || !REQUEST_ID.matcher(id).matches()) return;
            runOnUiThread(() -> {
                if (FirebaseApp.getApps(MainActivity.this).isEmpty()) {
                    pushAnswer(id, null, "off");
                } else if (NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled()) {
                    sendToken(id);
                } else if (Build.VERSION.SDK_INT >= 33) {
                    pushWaiting = id;
                    getSharedPreferences("aw", MODE_PRIVATE).edit().putBoolean("push-asked", true).apply();
                    ActivityCompat.requestPermissions(MainActivity.this, new String[] { Manifest.permission.POST_NOTIFICATIONS }, PUSH_PERMISSION);
                } else {
                    pushAnswer(id, null, "denied");
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != PUSH_PERMISSION || pushWaiting == null) return;
        String id = pushWaiting;
        pushWaiting = null;
        if (grantResults.length > 0 && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) sendToken(id);
        else pushAnswer(id, null, "denied");
    }

    private void sendToken(String id) {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (task.isSuccessful() && task.getResult() != null) pushAnswer(id, task.getResult(), "granted");
                else pushAnswer(id, null, "error");
            });
        } catch (Exception e) {
            pushAnswer(id, null, "error");
        }
    }

    private void pushAnswer(String id, String token, String state) {
        String t = token == null ? "null" : quote(token);
        runOnUiThread(() -> getBridge().getWebView().evaluateJavascript("window.__awPush && window.__awPush('" + id + "', " + t + ", '" + state + "')", null));
    }


    /** Скачанный страницей файл: в «Загрузки» телефона и сразу открыть. */
    private class SaveBridge {
        @JavascriptInterface
        public void save(String name, String mime, String base64) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String safe = name == null || name.isEmpty() ? "file" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
                String type = mime == null || mime.isEmpty() ? "application/octet-stream" : mime;
                Uri saved;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    v.put(MediaStore.Downloads.MIME_TYPE, type);
                    v.put(MediaStore.Downloads.IS_PENDING, 1);
                    saved = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (saved == null) throw new IllegalStateException("no uri");
                    try (OutputStream out = getContentResolver().openOutputStream(saved)) {
                        out.write(bytes);
                    }
                    v.clear();
                    v.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(saved, v, null, null);
                } else {
                    File dir = new File(getCacheDir(), "downloads");
                    dir.mkdirs();
                    File file = new File(dir, safe);
                    try (FileOutputStream out = new FileOutputStream(file)) {
                        out.write(bytes);
                    }
                    saved = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                }
                final Uri open = saved;
                runOnUiThread(() -> {
                    Intent view = new Intent(Intent.ACTION_VIEW);
                    view.setDataAndType(open, type);
                    view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        startActivity(view);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Сохранено в «Загрузки»: " + safe, Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Exception e) {
                fail();
            }
        }

        @JavascriptInterface
        public void fail() {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Не удалось скачать файл", Toast.LENGTH_SHORT).show());
        }
    }


    /** Лимит загрузки файла на сайт (как в src/lib/scan.ts). */
    private static final int SCAN_PDF_LIMIT = (int) (3.8 * 1024 * 1024);
    private String scanWaiting;
    private final ActivityResultLauncher<IntentSenderRequest> scanLauncher =
        registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), result -> onScanResult(result.getResultCode(), result.getData()));

    /**
     * Сканер документов Google (ML Kit): сам находит лист, обрезает и выравнивает, несколько страниц, PDF.
     * Ответ уходит в window.__awScan(id, {pdf} или {pages}, state).
     */
    private class ScanBridge {
        @JavascriptInterface
        public boolean available() {
            return true;
        }

        @JavascriptInterface
        public void start(final String id) {
            if (id == null || !REQUEST_ID.matcher(id).matches()) return;
            runOnUiThread(() -> {
                try {
                    GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
                        .setGalleryImportAllowed(true)
                        .setPageLimit(15)
                        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_PDF, GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
                        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                        .build();
                    GmsDocumentScanner scanner = GmsDocumentScanning.getClient(options);
                    scanner.getStartScanIntent(MainActivity.this)
                        .addOnSuccessListener(sender -> {
                            scanWaiting = id;
                            scanLauncher.launch(new IntentSenderRequest.Builder(sender).build());
                        })
                        .addOnFailureListener(e -> scanAnswer(id, null, "error"));
                } catch (Exception e) {
                    scanAnswer(id, null, "error");
                }
            });
        }
    }

    private void onScanResult(int code, Intent data) {
        String id = scanWaiting;
        scanWaiting = null;
        if (id == null) return;
        if (code != RESULT_OK || data == null) {
            scanAnswer(id, null, "cancel");
            return;
        }
        try {
            GmsDocumentScanningResult result = GmsDocumentScanningResult.fromActivityResultIntent(data);
            if (result == null) throw new IllegalStateException("no result");
            byte[] pdf = result.getPdf() == null ? null : readAll(result.getPdf().getUri());
            StringBuilder json = new StringBuilder("{");
            if (pdf != null && pdf.length <= SCAN_PDF_LIMIT) {
                json.append("\"pdf\":\"").append(Base64.encodeToString(pdf, Base64.NO_WRAP)).append('"');
            } else if (result.getPages() != null) {
                // PDF вышел тяжелее лимита: отдаём страницы, сайт сожмёт их сам.
                json.append("\"pages\":[");
                int i = 0;
                for (GmsDocumentScanningResult.Page page : result.getPages()) {
                    byte[] jpg = readAll(page.getImageUri());
                    if (jpg == null) continue;
                    if (i++ > 0) json.append(',');
                    json.append('"').append(Base64.encodeToString(jpg, Base64.NO_WRAP)).append('"');
                }
                json.append(']');
            } else {
                throw new IllegalStateException("empty");
            }
            scanAnswer(id, json.append('}').toString(), "ok");
        } catch (Exception e) {
            scanAnswer(id, null, "error");
        }
    }

    private byte[] readAll(Uri uri) {
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }

    private void scanAnswer(String id, String json, String state) {
        String body = json == null ? "null" : json;
        runOnUiThread(() -> getBridge().getWebView().evaluateJavascript("window.__awScan && window.__awScan('" + id + "', " + body + ", '" + state + "')", null));
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
        // Нажатие на уведомление: Firebase кладёт поле "url" (путь на сайте) в intent.
        String path = intent == null ? null : intent.getStringExtra("url");
        if (path != null && path.startsWith("/") && !path.startsWith("//")) {
            getBridge().getWebView().loadUrl("https://" + HOST + path);
            return;
        }
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
