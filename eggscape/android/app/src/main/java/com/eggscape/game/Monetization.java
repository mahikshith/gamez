package com.eggscape.game;

import android.app.Activity;
import android.webkit.WebView;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
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
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

import java.util.Collections;
import java.util.List;

/**
 * Ads (AdMob) and the one-time Premium purchase (Play Billing) for the web game. The game's policy lives in
 * src/ads.js; this class only shows what it is asked to and answers through window.__eggAd(id, ok) /
 * window.__eggBuy(id, ok) / window.__eggOwned(sku, on) / window.__eggPrice(sku, price).
 *
 * The ad unit ids below are Google's public TEST ids (they always fill with a test ad and never pay). Before a store
 * release: replace APP_ID in AndroidManifest.xml and the two unit ids with the real ones from the AdMob console, and
 * create the in-app product PREMIUM_SKU in the Play Console.
 */
public class Monetization {
    static final String REWARDED_UNIT = "ca-app-pub-3940256099942544/5224354917"; // TEST id
    static final String INTERSTITIAL_UNIT = "ca-app-pub-3940256099942544/1033173712"; // TEST id
    static final String PREMIUM_SKU = "eggscape_premium";

    private final Activity act;
    private final WebView web;
    private RewardedAd rewarded;
    private InterstitialAd interstitial;
    private boolean loadingRewarded, loadingInterstitial;
    private BillingClient billing;
    private ProductDetails premium;
    private String buyId;

    Monetization(Activity act, WebView web) {
        this.act = act;
        this.web = web;
        try {
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

    // ------------------------------------------------------------------ JS answers
    private void js(String code) { act.runOnUiThread(() -> web.evaluateJavascript("(function(){try{" + code + "}catch(e){}})()", null)); }
    private static String q(String s) { return "'" + (s == null ? "" : s.replace("\\", "\\\\").replace("'", "\\'")) + "'"; }
    private void adResult(String id, boolean ok) { js("window.__eggAd&&window.__eggAd(" + q(id) + "," + ok + ")"); }
    private void buyResult(String id, boolean ok) { js("window.__eggBuy&&window.__eggBuy(" + q(id) + "," + ok + ")"); }
    private void owned(boolean on) { js("window.__eggOwned&&window.__eggOwned(" + q(PREMIUM_SKU) + "," + on + ")"); }

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

    // ------------------------------------------------------------------ Premium (Play Billing)
    private void connectBilling() {
        if (billing == null) return;
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                queryPremium();
                restore();
            }
            @Override public void onBillingServiceDisconnected() { /* reconnect on the next call */ }
        });
    }

    private void queryPremium() {
        if (billing == null) return;
        QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder().setProductId(PREMIUM_SKU).setProductType(BillingClient.ProductType.INAPP).build())).build();
        billing.queryProductDetailsAsync(p, (r, list) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null && !list.isEmpty()) {
                premium = list.get(0);
                ProductDetails.OneTimePurchaseOfferDetails o = premium.getOneTimePurchaseOfferDetails();
                if (o != null) js("window.__eggPrice&&window.__eggPrice(" + q(PREMIUM_SKU) + "," + q(o.getFormattedPrice()) + ")");
            }
        });
    }

    void restore() {
        if (billing == null || !billing.isReady()) { connectBilling(); return; }
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, list) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK || list == null) return;
            boolean has = false;
            for (Purchase p : list) if (p.getProducts().contains(PREMIUM_SKU) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) { has = true; ack(p); }
            if (has) owned(true);
        });
    }

    void buy(String sku, String id) {
        act.runOnUiThread(() -> {
            if (billing == null || !billing.isReady() || premium == null || !PREMIUM_SKU.equals(sku)) { buyResult(id, false); connectBilling(); return; }
            buyId = id;
            BillingFlowParams f = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(premium).build())).build();
            BillingResult r = billing.launchBillingFlow(act, f);
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) { buyId = null; buyResult(id, false); }
        });
    }

    private void onPurchases(@NonNull BillingResult r, List<Purchase> list) {
        boolean ok = false;
        if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
            for (Purchase p : list) if (p.getProducts().contains(PREMIUM_SKU) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) { ok = true; ack(p); }
        } else if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) ok = true;
        if (ok) owned(true);
        if (buyId != null) { buyResult(buyId, ok); buyId = null; }
    }

    private void ack(Purchase p) {
        if (p.isAcknowledged() || billing == null) return;
        billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
    }
}
