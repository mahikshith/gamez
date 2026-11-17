package com.eggscape.game;

import android.app.Activity;
import android.webkit.WebView;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Ads (AdMob) and in-app products (Play Billing) for the web game. The game's policy and the product table live in
 * src/ads.js and src/economy.js; this class only shows and sells what it is asked to, and answers through
 * window.__eggAd(id, ok) / window.__eggBuy(id, ok, state) / window.__eggGrant(sku, token) / window.__eggPrice(sku, price).
 *
 * Money safety: every PURCHASED purchase is handed to window.__eggGrant first. Only when that returns true (the game
 * saved it; it is idempotent per purchase token) is a consumable consumed or a non-consumable acknowledged. A purchase
 * the page could not take (not loaded yet, a crash) stays unconsumed and is granted by the next restore(), which runs
 * on every billing connect and every game start. PENDING purchases are never granted until Play reports them PURCHASED.
 *
 * The ad unit ids below are Google's public TEST ids (they always fill with a test ad and never pay). Before a store
 * release: replace APP_ID in AndroidManifest.xml and the two unit ids with the real ones from the AdMob console, and
 * create every product in CONSUMABLE / ONE_TIME in the Play Console (one-time products, the ids exactly as below).
 */
public class Monetization {
    static final String REWARDED_UNIT = "ca-app-pub-3940256099942544/5224354917"; // TEST id
    static final String INTERSTITIAL_UNIT = "ca-app-pub-3940256099942544/1033173712"; // TEST id
    static final String PREMIUM_SKU = "eggscape_premium";
    /** bought again and again: consumed after the grant (keep in sync with IAP in src/economy.js) */
    static final Set<String> CONSUMABLE = new HashSet<>(Arrays.asList(
            "coins_250", "coins_850", "coins_1500", "coins_3300", "coins_7000", "bundle_helper", "bundle_flock", "egg_bank"));
    /** bought once: acknowledged after the grant, given back by restore() */
    static final Set<String> ONE_TIME = new HashSet<>(Arrays.asList(
            "starter_nest", "season_pack", "all_chicks", "no_ads", PREMIUM_SKU));
    /**
     * Security: the app's licence key (Play Console > Monetize with Play > Monetization setup > Licensing, the base64 RSA
     * public key). When set, a purchase is granted only if Google's signature over it checks out, which stops fake-billing
     * apps from minting coins. Empty (test builds) skips the check. There is no game server, so this is the strongest
     * check available on the device.
     */
    static final String PLAY_LICENSE_KEY = "";
    private static final String PREFS = "egg_money", PREF_CHILD = "childSafe";

    private final Activity act;
    private final WebView web;
    private RewardedAd rewarded;
    private InterstitialAd interstitial;
    private boolean loadingRewarded, loadingInterstitial;
    private BillingClient billing;
    private final Map<String, ProductDetails> products = new HashMap<>();
    private String buyId, buySku;

    Monetization(Activity act, WebView web) {
        this.act = act;
        this.web = web;
        try {
            // a child-safe player (the game's age question) keeps child-directed ad requests from the very first ad
            applyChildSafe(act.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).getBoolean(PREF_CHILD, false));
            MobileAds.initialize(act, status -> { loadRewarded(); loadInterstitial(); });
        } catch (Throwable t) { /* ads are optional: the game still runs */ }
        try {
            billing = BillingClient.newBuilder(act)
                    .setListener(this::onPurchases)
                    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                    .build();
            connectBilling();
        } catch (Throwable t) { billing = null; }
    }

    static boolean known(String sku) { return CONSUMABLE.contains(sku) || ONE_TIME.contains(sku); }

    // ------------------------------------------------------------------ JS answers
    private void js(String code) { act.runOnUiThread(() -> web.evaluateJavascript("(function(){try{" + code + "}catch(e){}})()", null)); }
    /** a JS string literal: JSONObject.quote escapes quotes, backslashes, newlines and U+2028/2029 (no injection, no syntax break) */
    private static String q(String s) { return JSONObject.quote(s == null ? "" : s); }
    private void adResult(String id, boolean ok) { js("window.__eggAd&&window.__eggAd(" + q(id) + "," + ok + ")"); }
    private void buyResult(String id, boolean ok, String state) { js("window.__eggBuy&&window.__eggBuy(" + q(id) + "," + ok + "," + q(state) + ")"); }

    /** asks the page to grant one product; then(true) only once the game saved it */
    private interface Done { void run(boolean ok); }
    private void grantJs(String sku, String token, boolean again, Done then) {
        // again: a one-time product Play says we already acknowledged (a reinstall, a cleared save): give the unlock back,
        // but never pay its coins and boosts a second time
        String code = "(function(){try{return !!(window.__eggGrant&&window.__eggGrant(" + q(sku) + "," + q(token) + "," + again + "))}catch(e){return false}})()";
        act.runOnUiThread(() -> web.evaluateJavascript(code, v -> then.run("true".equals(v))));
    }

    // ------------------------------------------------------------------ child-safe ads (src/offers.js age question)
    void setChildSafe(boolean on) {
        act.getSharedPreferences(PREFS, Activity.MODE_PRIVATE).edit().putBoolean(PREF_CHILD, on).apply();
        act.runOnUiThread(() -> {
            try {
                applyChildSafe(on);
                // ads already loaded were requested without the tag: drop them and load new ones
                rewarded = null; interstitial = null;
                loadRewarded(); loadInterstitial();
            } catch (Throwable t) { /* ads are optional */ }
        });
    }

    private static void applyChildSafe(boolean on) {
        RequestConfiguration.Builder b = MobileAds.getRequestConfiguration().toBuilder()
                .setTagForChildDirectedTreatment(on ? RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
                        : RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_UNSPECIFIED);
        if (on) b.setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G);
        MobileAds.setRequestConfiguration(b.build());
    }

    // ------------------------------------------------------------------ ads
    private void loadRewarded() {
        if (rewarded != null || loadingRewarded) return;
        loadingRewarded = true;
        act.runOnUiThread(() -> RewardedAd.load(act, REWARDED_UNIT, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull RewardedAd ad) { rewarded = ad; loadingRewarded = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { rewarded = null; loadingRewarded = false; }
        }));
    }

    private void loadInterstitial() {
        if (interstitial != null || loadingInterstitial) return;
        loadingInterstitial = true;
        act.runOnUiThread(() -> InterstitialAd.load(act, INTERSTITIAL_UNIT, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull InterstitialAd ad) { interstitial = ad; loadingInterstitial = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { interstitial = null; loadingInterstitial = false; }
        }));
    }

    void showRewarded(String tag, String id) {
        act.runOnUiThread(() -> {
            RewardedAd ad = rewarded;
            if (ad == null) { adResult(id, false); loadRewarded(); return; }
            rewarded = null;
            final boolean[] earned = { false };
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() { adResult(id, earned[0]); loadRewarded(); }
                @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { adResult(id, false); loadRewarded(); }
            });
            ad.show(act, reward -> earned[0] = true);
        });
    }

    void showInterstitial(String id) {
        act.runOnUiThread(() -> {
            InterstitialAd ad = interstitial;
            if (ad == null) { adResult(id, false); loadInterstitial(); return; }
            interstitial = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() { adResult(id, true); loadInterstitial(); }
                @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { adResult(id, false); loadInterstitial(); }
            });
            ad.show(act);
        });
    }

    // ------------------------------------------------------------------ in-app products (Play Billing)
    private void connectBilling() {
        if (billing == null) return;
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                queryProducts();
                restore();
            }
            @Override public void onBillingServiceDisconnected() { /* reconnect on the next call */ }
        });
    }

    /** every product's details (needed to launch a purchase) and its localized price, sent to the page */
    private void queryProducts() {
        if (billing == null) return;
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (Set<String> set : Arrays.asList(CONSUMABLE, ONE_TIME))
            for (String sku : set) list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(sku).setProductType(BillingClient.ProductType.INAPP).build());
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, details) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK || details == null) return;
            for (ProductDetails d : details) {
                synchronized (products) { products.put(d.getProductId(), d); }
                ProductDetails.OneTimePurchaseOfferDetails o = d.getOneTimePurchaseOfferDetails();
                if (o != null) js("window.__eggPrice&&window.__eggPrice(" + q(d.getProductId()) + "," + q(o.getFormattedPrice()) + ")");
            }
        });
    }

    void restore() { restore(null); }

    /**
     * Every purchase Play still knows: non-consumables are granted again (their entitlement; the game pays coins only
     * for a token it has not seen), and consumables left unconsumed (an app killed mid-grant) are granted and consumed.
     */
    private void restore(Runnable after) {
        if (billing == null || !billing.isReady()) { connectBilling(); if (after != null) after.run(); return; }
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, list) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null)
                for (Purchase p : list) handle(p, null);
            if (after != null) after.run();
        });
    }

    void buy(String sku, String id) {
        act.runOnUiThread(() -> {
            ProductDetails d;
            synchronized (products) { d = products.get(sku); }
            if (billing == null || !billing.isReady() || d == null || !known(sku) || buyId != null) {
                buyResult(id, false, "");
                if (billing == null || !billing.isReady()) connectBilling(); else if (d == null) queryProducts();
                return;
            }
            buyId = id; buySku = sku;
            BillingFlowParams f = BillingFlowParams.newBuilder().setProductDetailsParamsList(java.util.Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build())).build();
            BillingResult r = billing.launchBillingFlow(act, f);
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) answerBuy(false, "");
        });
    }

    private void answerBuy(boolean ok, String state) {
        act.runOnUiThread(() -> {
            if (buyId == null) return;
            String id = buyId;
            buyId = null; buySku = null;
            buyResult(id, ok, state);
        });
    }

    private void onPurchases(@NonNull BillingResult r, List<Purchase> list) {
        int code = r.getResponseCode();
        final String sku = buySku;
        if (code == BillingClient.BillingResponseCode.OK && list != null) {
            boolean mine = false;
            for (Purchase p : list) {
                boolean forBuy = sku != null && p.getProducts().contains(sku);
                if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) { if (forBuy) { mine = true; answerBuy(false, "pending"); } continue; }
                if (forBuy) { mine = true; handle(p, ok -> answerBuy(ok, ok ? "" : "error")); }
                else handle(p, null);
            }
            if (!mine) answerBuy(false, "");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            // owned already (a one-time product, or a consumable whose grant never finished): restore grants it again
            restore(() -> answerBuy(true, ""));
        } else answerBuy(false, code == BillingClient.BillingResponseCode.USER_CANCELED ? "cancel" : "");
    }

    /** grant one PURCHASED purchase through the page, then consume / acknowledge it once the page saved it */
    private void handle(Purchase p, Done then) {
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) { if (then != null) then.run(false); return; }
        List<String> skus = new ArrayList<>();
        for (String s : p.getProducts()) if (known(s)) skus.add(s);
        if (skus.isEmpty() || !verified(p)) { if (then != null) then.run(false); return; } // a forged purchase is never granted nor acknowledged
        final int[] left = { skus.size() };
        final boolean[] all = { true };
        for (String sku : skus) grantJs(sku, p.getPurchaseToken(), ONE_TIME.contains(sku) && p.isAcknowledged(), ok -> {
            if (!ok) all[0] = false;
            if (--left[0] > 0) return;
            if (all[0]) settle(p, skus);
            if (then != null) then.run(all[0]);
        });
    }

    private void settle(Purchase p, List<String> skus) {
        if (billing == null) return;
        boolean consumable = false;
        for (String s : skus) if (CONSUMABLE.contains(s)) consumable = true;
        if (consumable) billing.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), (r, token) -> { });
        else if (!p.isAcknowledged())
            billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
    }

    /** Google's RSA signature over the purchase JSON, checked with the app's licence key (skipped while the key is empty) */
    private static boolean verified(Purchase p) {
        if (PLAY_LICENSE_KEY.isEmpty()) return true;
        try {
            PublicKey key = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(android.util.Base64.decode(PLAY_LICENSE_KEY, android.util.Base64.DEFAULT)));
            Signature sig = Signature.getInstance("SHA1withRSA");
            sig.initVerify(key);
            sig.update(p.getOriginalJson().getBytes(StandardCharsets.UTF_8));
            return sig.verify(android.util.Base64.decode(p.getSignature(), android.util.Base64.DEFAULT));
        } catch (Exception e) { return false; }
    }
}
