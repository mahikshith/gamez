# Eggscape Android shell (proof)

A plain Gradle project: one Activity hosting the web game in a WebView, fully offline
(assets served through `WebViewAssetLoader` at https://appassets.androidplatform.net/).

## Set up
1. JDK 17+ (21 works), Gradle 8.x, Node.
2. Android SDK: install the command-line tools into `~/android/sdk`, then
   `sdkmanager --sdk_root=$HOME/android/sdk "platforms;android-34" "build-tools;34.0.0" "platform-tools"`
   (this asks you to accept the Android SDK licenses).
3. `echo "sdk.dir=$HOME/android/sdk" > local.properties` in this folder.

## Build
```
sh sync-web.sh                 # node tools/build.mjs --target app, copies index.html into app/src/main/assets
gradle assembleDebug           # APK: app/build/outputs/apk/debug/app-debug.apk
cp app/build/outputs/apk/debug/app-debug.apk release/eggscape-web-proof-0.1.apk
```
`--target app` = portal "web" (stub ads), every level unlocked, own save key `eggscape_app_save`, `__APP__` true.

## FPS overlay
Tap the top-left corner (56 px square) 5 times within 2 s to toggle. Shows FPS, 10 s average, worst frame
(10 s), refresh estimate, canvas size and devicePixelRatio. No loop runs while hidden.

## Back button
The shell calls `window.__eggBack()`; the game consumes it in play (pause), pause (resume), info, levels, extras,
practice and store. Otherwise press twice within 2 s to exit.
