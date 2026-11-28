package com.eggscape.game;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

/**
 * Local reminders (0.8.15; 0.8.17: a series of up to six, a test note, kept across a restart). src/engine/herald.js
 * decides whether, when and what; this class only keeps the appointments. Nothing is sent to or received from any
 * server: the alarms and the notifications are made on this phone.
 *
 * The alarms are inexact (setAndAllowWhileIdle: no exact-alarm permission). Each planned note is also written to this
 * app's own preferences, so after a phone restart or an app update {@link Replan} sets the future ones again without
 * the game's page. Opening the game cancels them all (the game plans a fresh series when it is left again).
 */
public class Reminders extends BroadcastReceiver {
    static final String CHANNEL = "reminders";
    static final String ACTION = "com.eggscape.game.REMIND";
    static final String EXTRA_FROM = "egg_from";
    static final String PREFS = "egg_notes";
    static final int NOTE_ID = 7101;
    static final int TEST_NOTE_ID = 7105;
    static final int REQ = 7102;
    static final int SLOTS = 6; // the series of herald.js (HERALD.series)
    static final int TEST = SLOTS; // the Settings test note: its own alarm, never cancelled by opening the game

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /**
     * "granted": notes can be shown. "ask": Android 13+ and the permission is not given yet (its question can be shown).
     * "never": Android 13+, refused before and Android will not show its question again (only the app's notification
     * settings can turn them on). "off": switched off in the phone's settings, or this app's channel is blocked.
     */
    static String state(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                boolean asked = prefs(c).getBoolean("asked", false);
                if (asked && c instanceof Activity && !((Activity) c).shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) return "never";
                return "ask";
            }
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null || !nm.areNotificationsEnabled()) return "off";
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = nm.getNotificationChannel(CHANNEL);
                if (ch != null && ch.getImportance() == NotificationManager.IMPORTANCE_NONE) return "off";
            }
            return "granted";
        } catch (Throwable t) { return "off"; }
    }

    /** the channel exists from the first plan on, so the app's notification settings page lists it before any note came */
    static void channel(Context c) {
        try {
            if (Build.VERSION.SDK_INT < 26) return;
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("A note when a spin, a chest or a gift is waiting. One a day at most, never at night.");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        } catch (Throwable t) { /* optional */ }
    }

    private static PendingIntent alarmIntent(Context c, int slot, String id, String title, String text, int flags) {
        Intent i = new Intent(c, Reminders.class).setAction(ACTION);
        if (id != null) i.putExtra("id", id).putExtra("title", title).putExtra("text", text).putExtra("slot", slot);
        return PendingIntent.getBroadcast(c, REQ + 10 + slot, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void arm(Context c, int slot, long atMs, String id, String title, String text) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(c, slot, id == null ? "" : id, clip(title, 60), clip(text, 120), PendingIntent.FLAG_UPDATE_CURRENT);
        am.cancel(pi);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi); // inexact on purpose: a note may come a little late, never needs the exact-alarm permission
    }

    static void schedule(Context c, int slot, long atMs, String id, String title, String text) {
        try {
            if (slot < 0 || slot > TEST || !"granted".equals(state(c)) || atMs <= System.currentTimeMillis() || title == null || title.isEmpty()) return;
            channel(c);
            arm(c, slot, atMs, id, title, text);
            if (slot < SLOTS) { // kept for Replan (a restart drops every alarm)
                JSONObject o = new JSONObject().put("at", atMs).put("id", id == null ? "" : id).put("title", clip(title, 60)).put("text", clip(text, 120));
                prefs(c).edit().putString("s" + slot, o.toString()).apply();
            }
        } catch (Throwable t) { /* a reminder is optional */ }
    }

    /** the Settings test: a real note through the real path (alarm, this receiver, the channel) in about `secs` seconds */
    static void test(Context c, int secs) {
        schedule(c, TEST, System.currentTimeMillis() + Math.max(5, Math.min(60, secs)) * 1000L, "test", "The hen says hello", "Reminders work on this phone. Tap to come back.");
    }

    static void cancel(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            SharedPreferences.Editor ed = prefs(c).edit();
            for (int slot = 0; slot < SLOTS; slot++) {
                PendingIntent pi = alarmIntent(c, slot, null, null, null, PendingIntent.FLAG_NO_CREATE);
                if (am != null && pi != null) { am.cancel(pi); pi.cancel(); }
                ed.remove("s" + slot);
            }
            ed.apply();
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTE_ID); // one that is already showing goes too: he is in the game now
        } catch (Throwable t) { /* optional */ }
    }

    /** after a restart or an app update: the planned notes still to come are set again (the past ones are dropped) */
    static int replan(Context c) {
        int n = 0;
        try {
            SharedPreferences p = prefs(c);
            long now = System.currentTimeMillis();
            for (int slot = 0; slot < SLOTS; slot++) {
                String s = p.getString("s" + slot, null);
                if (s == null) continue;
                JSONObject o = new JSONObject(s);
                long at = o.optLong("at", 0);
                if (at > now && "granted".equals(state(c))) { arm(c, slot, at, o.optString("id"), o.optString("title"), o.optString("text")); n++; }
                else if (at <= now) p.edit().remove("s" + slot).apply();
            }
            p.edit().putLong("replanAt", now).putInt("replanN", n).apply();
        } catch (Throwable t) { /* optional */ }
        return n;
    }

    /** a launch from a note: remembered for the speed log */
    static void noteOpened(Context c, String id) {
        try { prefs(c).edit().putLong("openAt", System.currentTimeMillis()).putString("openId", id == null ? "" : id).apply(); } catch (Throwable t) { /* optional */ }
    }
    static void noteAsked(Context c) { try { prefs(c).edit().putBoolean("asked", true).apply(); } catch (Throwable t) { /* optional */ } }

    /** makers whose battery savers are known to stop the alarms of an app swiped out of the recent apps */
    private static final String[] STRICT = { "xiaomi", "redmi", "poco", "vivo", "iqoo", "oppo", "realme", "oneplus", "huawei", "honor", "meizu", "asus", "samsung", "tecno", "infinix", "itel", "lenovo", "motorola" };

    /** what the phone says, as JSON for the Settings row and the speed log */
    static String info(Context c) {
        try {
            JSONObject o = new JSONObject();
            o.put("perm", state(c)).put("sdk", Build.VERSION.SDK_INT);
            String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase(Locale.ROOT);
            o.put("maker", maker);
            String chan = "unset";
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
                NotificationChannel ch = nm == null ? null : nm.getNotificationChannel(CHANNEL);
                if (ch != null) { int im = ch.getImportance(); chan = im == NotificationManager.IMPORTANCE_NONE ? "blocked" : im <= NotificationManager.IMPORTANCE_LOW ? "quiet" : im >= NotificationManager.IMPORTANCE_HIGH ? "high" : "default"; }
            } else chan = "n/a";
            o.put("chan", chan);
            String bat = "?";
            if (Build.VERSION.SDK_INT >= 23) {
                PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
                if (pm != null) bat = pm.isIgnoringBatteryOptimizations(c.getPackageName()) ? "free" : "saver";
            }
            o.put("battery", bat);
            boolean strict = false;
            for (String m : STRICT) if (maker.contains(m)) strict = true;
            o.put("strict", strict);
            SharedPreferences p = prefs(c);
            JSONArray plan = new JSONArray();
            for (int slot = 0; slot < SLOTS; slot++) { String s = p.getString("s" + slot, null); if (s != null) { JSONObject q = new JSONObject(s); plan.put(new JSONObject().put("at", q.optLong("at")).put("id", q.optString("id"))); } }
            o.put("plan", plan);
            o.put("firedAt", p.getLong("firedAt", 0)).put("firedId", p.getString("firedId", ""));
            o.put("openAt", p.getLong("openAt", 0)).put("openId", p.getString("openId", ""));
            o.put("replanAt", p.getLong("replanAt", 0)).put("replanN", p.getInt("replanN", 0));
            return o.toString();
        } catch (Throwable t) { return "{}"; }
    }

    /** "app": this app's notification settings; "battery": the phone's battery optimisation list (no special permission) */
    static void openSettings(Activity a, String which) {
        Intent i = null;
        try {
            if ("battery".equals(which) && Build.VERSION.SDK_INT >= 23) i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            else if (Build.VERSION.SDK_INT >= 26) i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, a.getPackageName());
            if (i != null) { a.startActivity(i); return; }
        } catch (Throwable t) { /* that page does not exist on this phone: the app's own page below */ }
        try { a.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", a.getPackageName(), null))); } catch (Throwable t) { /* nothing to open */ }
    }

    private static String clip(String s, int n) { return s == null ? "" : s.length() > n ? s.substring(0, n) : s; }

    @Override public void onReceive(Context c, Intent in) {
        try {
            if (in == null || !ACTION.equals(in.getAction()) || !"granted".equals(state(c))) return;
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            String id = in.getStringExtra("id"), title = in.getStringExtra("title"), text = in.getStringExtra("text");
            int slot = in.getIntExtra("slot", 0);
            if (title == null || title.isEmpty()) return;
            boolean test = slot == TEST;
            Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK).putExtra(EXTRA_FROM, id == null || id.isEmpty() ? "reminder" : id);
            PendingIntent tap = PendingIntent.getActivity(c, test ? REQ + 1 : REQ, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            channel(c);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
            b.setSmallIcon(R.drawable.ic_stat_egg).setContentTitle(title).setContentText(text == null ? "" : text).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).setColor(0xFFE8A020);
            nm.notify(test ? TEST_NOTE_ID : NOTE_ID, b.build());
            SharedPreferences.Editor ed = prefs(c).edit().putLong("firedAt", System.currentTimeMillis()).putString("firedId", id == null ? "" : id);
            if (!test && slot >= 0 && slot < SLOTS) ed.remove("s" + slot);
            ed.apply();
        } catch (Throwable t) { /* optional */ }
    }
}
