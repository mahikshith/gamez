package com.eggscape.game;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * 0.8.12: starts the game again in a brand-new process (the slow-drawing watchdog's last rung, src/recover.js).
 * It runs in a process of its own (":restart" in the manifest) so it outlives the game's process: it ends that
 * process, opens MainActivity in a fresh task, and ends itself. It shows only the theme's sky colour, for a moment.
 * Not exported: only the game itself can start it.
 */
public class RestartActivity extends Activity {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        try {
            int pid = getIntent() != null ? getIntent().getIntExtra("pid", -1) : -1;
            if (pid > 0 && pid != android.os.Process.myPid()) android.os.Process.killProcess(pid);
            Intent i = new Intent(this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            startActivity(i);
            overridePendingTransition(0, 0);
        } catch (Throwable e) { /* the player opens the app again by hand */ }
        finish();
        Runtime.getRuntime().exit(0);
    }
}
