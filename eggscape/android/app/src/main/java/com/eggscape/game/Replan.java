package com.eggscape.game;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 0.8.17: a phone restart drops every alarm, and so can an app update. Without this the planned reminders were simply
 * gone after a restart until the game was opened and left again. Reminders.java keeps each planned note in the app's
 * preferences; here the ones still to come are set again. No web page is needed.
 * Exported only because the system sends these two broadcasts; nobody else can send them (protected broadcasts).
 */
public class Replan extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent in) {
        try {
            String a = in == null ? null : in.getAction();
            if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) Reminders.replan(c);
        } catch (Throwable t) { /* optional */ }
    }
}
