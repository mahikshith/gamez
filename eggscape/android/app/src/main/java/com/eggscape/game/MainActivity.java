package com.eggscape.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Display;
import android.view.DisplayCutout;
import android.view.View;
import android.view.WindowInsets;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;

public class MainActivity extends Activity {
    /** the game is served from the APK's assets under this host; nothing else may load in the WebView (it carries the bridge) */
    private static final String HOST = "appassets.androidplatform.net";
    private static final int BG = Color.parseColor("#428abe");
    private WebView web;
    private long lastBack = 0;
    private Vibrator vib;
    private volatile int buzzes = 0;
    // 0.8.10: buzzes are marked as game feedback (USAGE_GAME), so Android applies the phone's media vibration setting to
    // them; without attributes they were "unknown", which some phones file under touch feedback (often switched off)
    private static final android.media.AudioAttributes GAME_ATTR = new android.media.AudioAttributes.Builder()
        .setUsage(android.media.AudioAttributes.USAGE_GAME).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    private String lastSafe = "";
    private WindowInsets lastInsets;
    private Monetization money;

    /** JS bridge: window.EggApp.vibrate(ms) */
    public class Bridge {
        /** 0.8.10: what can stop a buzz on this phone, for the speed log and the Settings row (mykee felt none in 0.8.9,
         *  with Battery saver on all session: Android mutes app vibration in Battery saver) */
        @JavascriptInterface
        public String hapticInfo() {
            org.json.JSONObject o = new org.json.JSONObject();
            try {
                o.put("has", vib != null && vib.hasVibrator() ? 1 : 0);
                if (vib != null && Build.VERSION.SDK_INT >= 26) o.put("amp", vib.hasAmplitudeControl() ? 1 : 0);
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) o.put("saver", pm.isPowerSaveMode() ? 1 : 0);
                android.media.AudioManager am = (android.media.AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (am != null) o.put("ringer", am.getRingerMode()); // 0 silent, 1 vibrate, 2 normal
                o.put("sent", buzzes);
            } catch (Exception ignored) { /* optional */ }
            return o.toString();
        }
        @JavascriptInterface
        public void vibrate(int ms) {
            if (vib == null || ms <= 0) return;
            if (ms > 500) ms = 500;
            if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createOneShot(ms, ms >= 30 ? 255 : 140), GAME_ATTR);
            else vib.vibrate(ms);
            buzzes++;
        }
        /** a pattern "on,off,on,..." in ms: strong (255) for beats of 30 ms or more, lighter (140) for short ones */
        @JavascriptInterface
        public void vibratePattern(String csv) {
            if (vib == null || csv == null) return;
            try {
                String[] p = csv.split(",");
                int n = Math.min(p.length, 12);
                long[] tm = new long[n + 1]; int[] amp = new int[n + 1];
                tm[0] = 0; amp[0] = 0; // the waveform starts with a pause
                for (int i = 0; i < n; i++) {
                    int v = Math.max(0, Math.min(400, Integer.parseInt(p[i].trim())));
                    tm[i + 1] = v; amp[i + 1] = (i % 2 == 0) ? (v >= 30 ? 255 : 140) : 0;
                }
                if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createWaveform(tm, amp, -1), GAME_ATTR);
                else vib.vibrate(tm, -1);
                buzzes++;
            } catch (Exception ignored) { /* haptics are optional */ }
        }
        /** ads and in-app products (src/ads.js): each answers later through window.__eggAd / __eggBuy / __eggGrant */
        @JavascriptInterface public void showRewarded(String tag, String id) { if (money != null) money.showRewarded(tag, id); }
        @JavascriptInterface public void showInterstitial(String id) { if (money != null) money.showInterstitial(id); }
        @JavascriptInterface public void buy(String sku, String id) { if (money != null) money.buy(sku, id); }
        @JavascriptInterface public void restorePurchases() { if (money != null) money.restore(); }
        /** the age question answered "Under 13": child-directed ad requests (remembered by the shell) */
        @JavascriptInterface public void setChildSafe(boolean on) { if (money != null) money.setChildSafe(on); }
        /** the speed log (src/diag.js): what Android knows about this phone right now, as JSON; full adds the parts that never change */
        @JavascriptInterface public String deviceInfo(boolean full) { return deviceInfoJson(full); }
        /** the speed log as a text file: saved to Downloads/Eggscape (Android 10+) and handed to the share sheet. Nothing is sent by the app itself. */
        @JavascriptInterface public void shareLog(final String name, final String text) {
            runOnUiThread(new Runnable() { @Override public void run() { shareLogNow(name, text); } });
        }
        /**
         * 0.8.15 reminders (src/engine/herald.js plans them, Reminders.java keeps the appointment). All local to this
         * phone. notifyState: "granted" | "ask" (Android 13+: the permission is not given) | "off" (switched off in the
         * phone's settings). notifyAsk: shows Android's own question (13+); the answer comes back to the page through
         * window.__eggNotif(true | false). openedFrom: the reminder this launch came from ("" = from the icon), read once.
         */
        @JavascriptInterface public void notifyAt(String atMs, String id, String title, String text) {
            try { Reminders.schedule(MainActivity.this, 0, Long.parseLong(atMs), id, title, text); } catch (Throwable e) { /* optional */ }
        }
        /** the later notes of a long absence: slot 1 and 2 (herald.js). Opening the game cancels all of them. */
        @JavascriptInterface public void notifyMore(String slot, String atMs, String id, String title, String text) {
            try { Reminders.schedule(MainActivity.this, Integer.parseInt(slot), Long.parseLong(atMs), id, title, text); } catch (Throwable e) { /* optional */ }
        }
        @JavascriptInterface public void notifyCancel() { Reminders.cancel(MainActivity.this); }
        @JavascriptInterface public String notifyState() { return Reminders.state(MainActivity.this); }
        @JavascriptInterface public void notifyAsk() {
            runOnUiThread(new Runnable() { @Override public void run() {
                try {
                    String st = Reminders.state(MainActivity.this);
                    if (Build.VERSION.SDK_INT >= 33 && "ask".equals(st)) requestPermissions(new String[] { android.Manifest.permission.POST_NOTIFICATIONS }, REQ_NOTIF);
                    else tellNotif("granted".equals(st));
                } catch (Throwable e) { tellNotif(false); }
            } });
        }
        @JavascriptInterface public String openedFrom() { String f = openedFrom; openedFrom = ""; return f == null ? "" : f; }
        /**
         * 0.8.12, the slow-drawing watchdog (src/recover.js): the page found that the web view no longer draws with the
         * graphics chip and that loading the page again did not cure it. rung 2 ends the page's own process (the game
         * comes back through onRenderProcessGone), rung 3 starts the whole app again (what mykee did by hand). keep is
         * the page's save and notes: the web view writes its storage to disk a few seconds late, so they are kept here
         * (written at once) and handed back to the next start by unstash().
         */
        @JavascriptInterface public void recover(final int rung, final String keep) {
            try { getSharedPreferences("egg", MODE_PRIVATE).edit().putString("stash", keep == null ? "" : keep).commit(); } catch (Throwable e) { /* the page's own storage is the fallback */ }
            runOnUiThread(new Runnable() { @Override public void run() { recoverNow(rung); } });
        }
        @JavascriptInterface public String unstash() {
            try {
                android.content.SharedPreferences p = getSharedPreferences("egg", MODE_PRIVATE);
                String v = p.getString("stash", "");
                if (v.length() > 0) p.edit().remove("stash").commit();
                return v;
            } catch (Throwable e) { return ""; }
        }
    }

    private static volatile int cures = 0; // deliberate restarts of the page's process, for the speed log
    private void recoverNow(int rung) {
        if (money != null && money.adShowing()) return; // never under an ad; the page asks again at the next calm moment
        if (rung == 2 && Build.VERSION.SDK_INT >= 29 && web != null) {
            try {
                android.webkit.WebViewRenderProcess rp = web.getWebViewRenderProcess();
                if (rp != null && rp.terminate()) { cures++; return; }
            } catch (Throwable e) { /* the full restart below */ }
        }
        restartApp();
    }
    /** A clean start of the whole app: a tiny activity in a process of its own ends this one and opens the game again. */
    private void restartApp() {
        try {
            Intent i = new Intent(this, RestartActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            i.putExtra("pid", android.os.Process.myPid());
            startActivity(i);
            overridePendingTransition(0, 0);
        } catch (Throwable e) {
            try { recreate(); } catch (Throwable e2) { /* stay as we are */ }
        }
    }

    // ---- the speed log's Android side (0.8.7): read-only facts about the phone, and the share sheet
    private volatile int trimCount = 0, lastTrim = 0;
    private static volatile int renderGone = 0; // times the page's process died and the game was started again
    /** Android asking apps to give memory back: a phone under memory pressure stutters, so the log counts these */
    @Override public void onTrimMemory(int level) {
        super.onTrimMemory(level); trimCount++; lastTrim = level;
        // 0.8.10: memory is short: the page gives back every picture the screen in front does not need (main.js
        // trimPictures). UI_HIDDEN (20) is only "the app left the screen" and is skipped.
        if (level != TRIM_MEMORY_UI_HIDDEN && level >= TRIM_MEMORY_RUNNING_LOW && web != null) {
            final int lv = level;
            runOnUiThread(() -> { try { if (web != null) web.evaluateJavascript("window.__eggTrim&&window.__eggTrim(" + lv + ")", null); } catch (Exception e) { /* page not up yet */ } });
        }
    }

    // 0.8.10: this app's own memory as Android counts it (graphics = the pictures on the graphics chip, where the web
    // view keeps its canvases). Reading it takes tens of milliseconds, so a background thread samples it and the log
    // gets the last sample: never a hitch in the game. The speed log of 0.8.9 showed the phone's free memory falling
    // about 115 MB a level until drawing collapsed; these numbers say whether that is fixed.
    private volatile int memGfxMb = -1, memNativeMb = -1, memPssMb = -1;
    private volatile long memAt = 0;
    private volatile boolean memBusy = false;
    private void sampleMemory() {
        long now = android.os.SystemClock.elapsedRealtime();
        if (memBusy || now - memAt < 4000) return;
        memBusy = true; memAt = now;
        Thread t = new Thread(new Runnable() { @Override public void run() {
            try {
                android.os.Debug.MemoryInfo mi = new android.os.Debug.MemoryInfo();
                android.os.Debug.getMemoryInfo(mi);
                memGfxMb = kbStat(mi, "summary.graphics"); memNativeMb = kbStat(mi, "summary.native-heap"); memPssMb = mi.getTotalPss() / 1024;
            } catch (Throwable e) { /* the log is optional */ }
            memBusy = false;
        } }, "egg-mem");
        t.setPriority(Thread.MIN_PRIORITY); t.setDaemon(true);
        try { t.start(); } catch (Throwable e) { memBusy = false; }
    }
    private static int kbStat(android.os.Debug.MemoryInfo mi, String key) {
        if (Build.VERSION.SDK_INT < 23) return -1;
        try { String v = mi.getMemoryStat(key); return v == null ? -1 : Integer.parseInt(v.trim()) / 1024; } catch (Throwable e) { return -1; }
    }

    private String deviceInfoJson(boolean full) {
        org.json.JSONObject o = new org.json.JSONObject();
        try {
            sampleMemory();
            if (memPssMb >= 0) { o.put("gfxMb", memGfxMb); o.put("nativeMb", memNativeMb); o.put("pssMb", memPssMb); }
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                o.put("powerSave", pm.isPowerSaveMode() ? 1 : 0);
                if (Build.VERSION.SDK_INT >= 29) o.put("thermal", pm.getCurrentThermalStatus()); // 0 none .. 3 severe .. 6 shutdown
            }
            android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            if (am != null) {
                android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo();
                am.getMemoryInfo(mi);
                o.put("availMb", mi.availMem / 1048576L);
                o.put("lowMem", mi.lowMemory ? 1 : 0);
                if (full) { o.put("totalMb", mi.totalMem / 1048576L); o.put("memClass", am.getMemoryClass()); o.put("lowRam", am.isLowRamDevice() ? 1 : 0); }
            }
            o.put("trim", trimCount);
            o.put("trimLevel", lastTrim);
            o.put("renderGone", renderGone);
            if (cures > 0) o.put("cures", cures);
            android.os.BatteryManager bm = (android.os.BatteryManager) getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) { o.put("battery", bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY)); o.put("charging", bm.isCharging() ? 1 : 0); }
            Display d = Build.VERSION.SDK_INT >= 30 ? getDisplay() : getWindowManager().getDefaultDisplay();
            if (d != null) o.put("hz", Math.round(d.getRefreshRate() * 10f) / 10.0);
            Runtime rt = Runtime.getRuntime();
            o.put("javaHeapMb", (rt.totalMemory() - rt.freeMemory()) / 1048576L);
            if (full) {
                o.put("maker", Build.MANUFACTURER);
                o.put("model", Build.MODEL);
                o.put("device", Build.DEVICE);
                o.put("hardware", Build.HARDWARE);
                o.put("board", Build.BOARD);
                o.put("android", Build.VERSION.RELEASE);
                o.put("sdk", Build.VERSION.SDK_INT);
                if (Build.VERSION.SDK_INT >= 31) { o.put("socMaker", Build.SOC_MANUFACTURER); o.put("soc", Build.SOC_MODEL); }
                o.put("cores", rt.availableProcessors());
                org.json.JSONArray mhz = new org.json.JSONArray(); // each core's top speed: shows the big and the small cores
                for (int i = 0; i < 16; i++) {
                    java.io.File f = new java.io.File("/sys/devices/system/cpu/cpu" + i + "/cpufreq/cpuinfo_max_freq");
                    if (!f.exists()) break;
                    java.io.BufferedReader br = null;
                    try { br = new java.io.BufferedReader(new java.io.FileReader(f)); String ln = br.readLine(); if (ln != null) mhz.put(Integer.parseInt(ln.trim()) / 1000); }
                    catch (Exception e) { break; }
                    finally { if (br != null) try { br.close(); } catch (Exception e) { /* closed */ } }
                }
                if (mhz.length() > 0) o.put("cpuMhz", mhz);
                if (d != null) {
                    org.json.JSONArray modes = new org.json.JSONArray();
                    for (Display.Mode m : d.getSupportedModes()) modes.put(m.getPhysicalWidth() + "x" + m.getPhysicalHeight() + "@" + Math.round(m.getRefreshRate()));
                    o.put("modes", modes);
                    Display.Mode cur = d.getMode();
                    o.put("mode", cur.getPhysicalWidth() + "x" + cur.getPhysicalHeight() + "@" + Math.round(cur.getRefreshRate()));
                }
                o.put("density", (double) getResources().getDisplayMetrics().density);
                if (Build.VERSION.SDK_INT >= 26) { android.content.pm.PackageInfo wv = WebView.getCurrentWebViewPackage(); if (wv != null) o.put("webview", wv.packageName + " " + wv.versionName); }
                o.put("app", getPackageManager().getPackageInfo(getPackageName(), 0).versionName);
            }
        } catch (Throwable e) {
            try { o.put("err", String.valueOf(e)); } catch (Exception e2) { /* nothing to add */ }
        }
        return o.toString();
    }

    private void shareLogNow(String name, String text) {
        try {
            if (name == null || !name.matches("[A-Za-z0-9._-]{1,80}")) name = "eggscape-log.txt";
            if (text == null) text = "";
            if (text.length() > 2000000) text = text.substring(text.length() - 2000000);
            Uri uri = null;
            if (Build.VERSION.SDK_INT >= 29) { // our own file in Downloads/Eggscape: no permission needed, and the tester can find it again
                android.content.ContentValues cv = new android.content.ContentValues();
                cv.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, name);
                cv.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "text/plain");
                cv.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS + "/Eggscape");
                uri = getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri != null) {
                    java.io.OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) uri = null;
                    else { try { os.write(text.getBytes("UTF-8")); } finally { os.close(); } }
                }
            }
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_SUBJECT, name);
            if (uri != null) {
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.setClipData(android.content.ClipData.newRawUri(name, uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                send.putExtra(Intent.EXTRA_TEXT, text.length() > 60000 ? text.substring(text.length() - 60000) : text); // older Android: the newest part as plain text
            }
            startActivity(Intent.createChooser(send, "Send the Eggscape speed log"));
            if (uri != null) Toast.makeText(this, "Also saved in Downloads/Eggscape", Toast.LENGTH_LONG).show();
        } catch (Throwable e) {
            Toast.makeText(this, "Could not share the log", Toast.LENGTH_SHORT).show();
        }
    }

    // 0.8.15 reminders: which one this launch came from, and Android's answer to the permission question
    private static final int REQ_NOTIF = 7103;
    private volatile String openedFrom = "";
    private void noteOpenedFrom(Intent in) { try { String f = in == null ? null : in.getStringExtra(Reminders.EXTRA_FROM); if (f != null && !f.isEmpty()) { openedFrom = f; in.removeExtra(Reminders.EXTRA_FROM); } } catch (Throwable e) { /* optional */ } }
    private void tellNotif(final boolean ok) {
        runOnUiThread(new Runnable() { @Override public void run() { try { if (web != null) web.evaluateJavascript("window.__eggNotif&&window.__eggNotif(" + (ok ? "true" : "false") + ")", null); } catch (Throwable e) { /* page not up */ } } });
    }
    @Override protected void onNewIntent(Intent in) { super.onNewIntent(in); setIntent(in); noteOpenedFrom(in); }
    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == REQ_NOTIF) tellNotif(res != null && res.length > 0 && res[0] == android.content.pm.PackageManager.PERMISSION_GRANTED);
    }

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        noteOpenedFrom(getIntent());
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();

        // 2026-11-20: test (debug) builds can be traced from a computer (chrome://inspect, Performance tab) to see where a
        // real phone spends its frame time; release builds never allow it
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(v -> true);
        // 2026-11-19 speed pass: no hardware layer on the WebView (it drew every frame into an extra offscreen buffer first; WebView already draws straight to the GPU)
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setGeolocationEnabled(false);
        s.setSaveFormData(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.addJavascriptInterface(new Bridge(), "EggApp");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                // security: the game is fully offline. Only our own assets load; any other request (a stray link, an injected
                // script, a tracker) gets an empty 403 instead of reaching the network with the EggApp bridge on the page.
                Uri u = r.getUrl();
                if (u != null && HOST.equals(u.getHost()) && "https".equals(u.getScheme())) return loader.shouldInterceptRequest(u);
                if (u != null && ("data".equals(u.getScheme()) || "blob".equals(u.getScheme()))) return null;
                return new WebResourceResponse("text/plain", "utf-8", 403, "Blocked", null, new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                // security: the WebView never leaves the game. A web link (store page, privacy policy) opens in the browser;
                // every other scheme (intent:, file:, javascript:) is dropped.
                Uri u = r.getUrl();
                if (u != null && HOST.equals(u.getHost()) && "https".equals(u.getScheme())) return false;
                if (u != null && r.isForMainFrame() && r.hasGesture() && ("https".equals(u.getScheme()) || "http".equals(u.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE)); } catch (Exception e) { /* no browser */ }
                }
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) { lastSafe = ""; pushSafe(); }
            // 0.8.10: Android may kill the page's own process when the phone is out of memory (or it can crash). Left
            // unhandled, that closes the whole app in the player's face. The dead view is dropped and the game starts
            // again from the title: progress lives in the page's storage, so nothing is lost but the level in play.
            @Override public boolean onRenderProcessGone(WebView v, android.webkit.RenderProcessGoneDetail d) {
                renderGone++;
                try { android.view.ViewParent p = v.getParent(); if (p instanceof android.view.ViewGroup) ((android.view.ViewGroup) p).removeView(v); v.destroy(); } catch (Exception e) { /* already gone */ }
                if (v == web) web = null;
                recreate();
                return true;
            }
        });
        // the safe area: every insets change (rotation, cutout, gesture nav switched on) is handed to the page
        web.setOnApplyWindowInsetsListener((v, ins) -> { lastInsets = ins; pushSafe(); return v.onApplyWindowInsets(ins); });
        web.addOnLayoutChangeListener((v, l, t, r, bt, ol, ot, or, ob) -> { if (r - l != or - ol || bt - t != ob - ot) v.post(this::pushSafe); });
        setContentView(web);
        // 2026-11-20 speed: the WebView covers the window and paints its own background, so the window's background
        // (a full-screen fill under it on every frame) is dropped. The launch preview still uses the theme colour.
        w.setBackgroundDrawable(null);
        prefer60Hz();
        money = new Monetization(this, web);
        hideBars();
        // always start from our own page (restoreState could bring back any URL the saved state held)
        web.loadUrl("https://" + HOST + "/index.html");
    }

    /**
     * The safe insets in CSS px. The bars are hidden (immersive) and the page draws into the cutout, so this uses the
     * room the bars and the cutout WOULD take, plus the system gesture zones at the bottom and the sides (touches there
     * are eaten by back / home gestures). API 30+: getInsetsIgnoringVisibility(systemBars | displayCutout) and
     * getInsets(systemGestures). API 28-29: the cutout's safe insets plus a 24 dp bottom. Older: a status-bar-ish top.
     */
    private int[] safeInsetsPx() {
        int t = 0, b = 0, l = 0, r = 0;
        WindowInsets ins = lastInsets != null ? lastInsets : web != null ? web.getRootWindowInsets() : null;
        float d = getResources().getDisplayMetrics().density;
        if (ins != null && Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets bars = ins.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            android.graphics.Insets gest = ins.getInsets(WindowInsets.Type.systemGestures());
            t = bars.top; l = Math.max(bars.left, 0); r = Math.max(bars.right, 0);
            b = Math.max(bars.bottom, gest.bottom);
            // the side gesture zones (back swipe) only take swipes that start at the very edge, so a tap there still works:
            // the sides are padded only where a bar or the cutout sits (landscape), never by the ~30 dp gesture strips
        } else if (ins != null && Build.VERSION.SDK_INT >= 28) {
            DisplayCutout c = ins.getDisplayCutout();
            if (c != null) { t = c.getSafeInsetTop(); b = c.getSafeInsetBottom(); l = c.getSafeInsetLeft(); r = c.getSafeInsetRight(); }
            b = Math.max(b, Math.round(24 * d));
            if (t == 0) t = Math.round(24 * d);
        } else {
            int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
            t = id > 0 ? getResources().getDimensionPixelSize(id) : Math.round(24 * d);
            b = Math.round(16 * d);
        }
        // the WebView's CSS px are dp: divide by density
        return new int[] { Math.round(t / d), Math.round(b / d), Math.round(l / d), Math.round(r / d) };
    }

    /**
     * 2026-11-20 (mykee's 90 Hz flagship stuttered): the game never draws faster than 60 fps, but on a 90 Hz screen 60
     * fps cannot be shown evenly, so it drew every 11 ms refresh (or every second one, 45 fps, whenever a frame ran
     * long) and the physics, which steps in 8.3 ms, moved things by 1 and 2 steps in turn. Asking the screen for its
     * 60 Hz mode (same resolution) gives every frame 16.7 ms, even motion, and saves battery. The system may ignore the
     * wish (battery saver, some makers); the game measures the real rate either way.
     */
    private void prefer60Hz() {
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            Display d;
            if (Build.VERSION.SDK_INT >= 30) d = getDisplay();
            else d = getWindowManager().getDefaultDisplay();
            if (d == null) return;
            Display.Mode cur = d.getMode(), best = null;
            for (Display.Mode m : d.getSupportedModes()) {
                if (m.getPhysicalWidth() != cur.getPhysicalWidth() || m.getPhysicalHeight() != cur.getPhysicalHeight()) continue;
                float hz = m.getRefreshRate();
                if (hz < 59f || hz > 61f) continue;
                best = m;
            }
            if (best == null) return;
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.preferredDisplayModeId = best.getModeId();
            lp.preferredRefreshRate = best.getRefreshRate();
            getWindow().setAttributes(lp);
        } catch (Exception e) { /* keep the screen's own rate */ }
    }

    private void pushSafe() {
        if (web == null) return;
        int[] s = safeInsetsPx();
        String js = "window.__eggSafe={t:" + s[0] + ",b:" + s[1] + ",l:" + s[2] + ",r:" + s[3] + "};";
        if (js.equals(lastSafe)) return;
        lastSafe = js;
        web.evaluateJavascript("(function(){" + js + "try{window.dispatchEvent(new Event('eggsafe'))}catch(e){}})()", null);
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) { hideBars(); if (web != null) web.post(this::pushSafe); } }

    @Override public void onConfigurationChanged(android.content.res.Configuration c) { super.onConfigurationChanged(c); lastSafe = ""; lastInsets = null; if (web != null) web.post(this::pushSafe); }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); } // the game keeps its own save (localStorage)

    /*
     * 0.8.2 (mykee: the test ads never showed their close X, even after 30 s): WebView.pauseTimers() is GLOBAL. It froze
     * the JavaScript of every WebView in the app, and AdMob's full-screen ads are WebViews too. The moment an ad opened
     * over the game, this onPause froze the ad's own countdown, so "Reward in 8 seconds" never ticked and the close X
     * never came. onPause now pauses only the game's page (it stops drawing and the game mutes itself on
     * visibilitychange); the global freeze runs only when the app really goes to the background with no ad up.
     */
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }

    @Override protected void onStop() { if (web != null && (money == null || !money.adShowing())) web.pauseTimers(); super.onStop(); }

    @Override protected void onStart() { super.onStart(); if (web != null) web.resumeTimers(); }

    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.resumeTimers(); } hideBars(); if (money != null) money.onHostResume(); }

    @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        // the game consumes back where it has a natural back (pause, menus); otherwise press twice within 2 s to exit
        if (web == null) { finish(); return; }
        web.evaluateJavascript("(function(){try{return window.__eggBack?window.__eggBack():false}catch(e){return false}})()", r -> {
            if ("true".equals(r)) return;
            long now = System.currentTimeMillis();
            if (now - lastBack < 2000) finish();
            else { lastBack = now; Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show(); }
        });
    }
}
