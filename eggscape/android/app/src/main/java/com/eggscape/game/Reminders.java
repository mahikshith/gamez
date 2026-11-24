package com.eggscape.game;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

/**
 * 0.8.15: one local reminder, planned by the game when it goes to the background (src/engine/herald.js decides whether,
 * when and what; this class only keeps the appointment). Nothing is sent to or received from any server: the alarm
 * and the notification are made on this phone. The alarm is inexact (no exact-alarm permission), a reboot drops it
 * (the game plans the next one the next time it is closed), and opening the game cancels it.
 */
public class Reminders extends BroadcastReceiver {
    static final String CHANNEL = "reminders";
    static final String ACTION = "com.eggscape.game.REMIND";
    static final String EXTRA_FROM = "egg_from";
    static final int NOTE_ID = 7101;
    static final int REQ = 7102;

    /** "granted": reminders can be shown. "ask": Android 13+ and the permission was not given (yet). "off": switched off in the phone's settings. */
    static String state(Context c) {
        try {
            if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return "ask";
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            return nm != null && nm.areNotificationsEnabled() ? "granted" : "off";
        } catch (Throwable t) { return "off"; }
    }

    private static PendingIntent alarmIntent(Context c, String id, String title, String text, int flags) {
        Intent i = new Intent(c, Reminders.class).setAction(ACTION);
        if (id != null) i.putExtra("id", id).putExtra("title", title).putExtra("text", text);
        return PendingIntent.getBroadcast(c, REQ, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context c, long atMs, String id, String title, String text) {
        try {
            if (!"granted".equals(state(c)) || atMs <= System.currentTimeMillis() || title == null || title.isEmpty()) return;
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = alarmIntent(c, id == null ? "" : id, clip(title, 60), clip(text, 120), PendingIntent.FLAG_UPDATE_CURRENT);
            am.cancel(pi);
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi); // inexact on purpose: a reminder may come a little late, never needs the exact-alarm permission
        } catch (Throwable t) { /* a reminder is optional */ }
    }

    static void cancel(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = alarmIntent(c, null, null, null, PendingIntent.FLAG_NO_CREATE);
            if (am != null && pi != null) { am.cancel(pi); pi.cancel(); }
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTE_ID); // one that is already showing goes too: he is in the game now
        } catch (Throwable t) { /* optional */ }
    }

    private static String clip(String s, int n) { return s == null ? "" : s.length() > n ? s.substring(0, n) : s; }

    @Override public void onReceive(Context c, Intent in) {
        try {
            if (in == null || !ACTION.equals(in.getAction()) || !"granted".equals(state(c))) return;
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            String id = in.getStringExtra("id"), title = in.getStringExtra("title"), text = in.getStringExtra("text");
            if (title == null || title.isEmpty()) return;
            Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK).putExtra(EXTRA_FROM, id == null ? "reminder" : id);
            PendingIntent tap = PendingIntent.getActivity(c, REQ, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("A note when a spin or a chest is waiting. One a day at most.");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
                b = new Notification.Builder(c, CHANNEL);
            } else b = new Notification.Builder(c);
            b.setSmallIcon(R.drawable.ic_stat_egg).setContentTitle(title).setContentText(text == null ? "" : text).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).setColor(0xFFE8A020);
            nm.notify(NOTE_ID, b.build());
        } catch (Throwable t) { /* optional */ }
    }
}
