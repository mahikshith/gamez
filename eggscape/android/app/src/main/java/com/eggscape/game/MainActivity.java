package com.eggscape.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
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

public class MainActivity extends Activity {
    private static final int BG = Color.parseColor("#1b1410");
    private WebView web;
    private long lastBack = 0;
    private Vibrator vib;
    private String lastSafe = "";
    private WindowInsets lastInsets;

    /** JS bridge: window.EggApp.vibrate(ms) */
    public class Bridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            if (vib == null || ms <= 0) return;
            if (ms > 500) ms = 500;
            if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            else vib.vibrate(ms);
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();

        web = new WebView(this);
        web.setBackgroundColor(BG);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(v -> true);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.addJavascriptInterface(new Bridge(), "EggApp");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return loader.shouldInterceptRequest(r.getUrl());
            }
            @Override public void onPageFinished(WebView v, String url) { lastSafe = ""; pushSafe(); }
        });
        // the safe area: every insets change (rotation, cutout, gesture nav switched on) is handed to the page
        web.setOnApplyWindowInsetsListener((v, ins) -> { lastInsets = ins; pushSafe(); return v.onApplyWindowInsets(ins); });
        web.addOnLayoutChangeListener((v, l, t, r, bt, ol, ot, or, ob) -> { if (r - l != or - ol || bt - t != ob - ot) v.post(this::pushSafe); });
        setContentView(web);
        hideBars();
        if (b == null) web.loadUrl("https://appassets.androidplatform.net/index.html");
        else web.restoreState(b);
    }

    /**
     * The safe insets in CSS px. The bars are hidden (immersive) and the page draws into the cutout, so this uses the
     * room the bars and the cutout WOULD take, plus the system gesture zones at the bottom and the sides (touches there
     * are eaten by back / home gestures). API 30+: getInsetsIgnoringVisibility(systemBars | displayCutout) and
     * getInsets(systemGestures). API 28-29: the cutout's safe insets plus a 24 dp bottom. Older: a status-bar-ish top.
     */
    private int[] safeInsetsPx() {
        int t = 0, b = 0, l = 0, r = 0;
        WindowInsets ins = lastInsets != null ? lastInsets : web.getRootWindowInsets();
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

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) { hideBars(); web.post(this::pushSafe); } }

    @Override public void onConfigurationChanged(android.content.res.Configuration c) { super.onConfigurationChanged(c); lastSafe = ""; lastInsets = null; web.post(this::pushSafe); }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }

    @Override protected void onPause() { web.onPause(); web.pauseTimers(); super.onPause(); }

    @Override protected void onResume() { super.onResume(); web.onResume(); web.resumeTimers(); hideBars(); }

    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        // the game consumes back where it has a natural back (pause, menus); otherwise press twice within 2 s to exit
        web.evaluateJavascript("(function(){try{return window.__eggBack?window.__eggBack():false}catch(e){return false}})()", r -> {
            if ("true".equals(r)) return;
            long now = System.currentTimeMillis();
            if (now - lastBack < 2000) finish();
            else { lastBack = now; Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show(); }
        });
    }
}
